import { openSlackModal, respondToInteraction } from './slack';
import { buildSummaryModal, buildSummaryFallbackBlocks, type SummaryModalRow } from './aiSummary';

export type InteractionDeps = {
  signingSecret: string | undefined;
  slackToken: string | undefined;
  rawBody: string;
  timestamp: string | undefined;
  signature: string | undefined;
  dbQuery: (requestId: string) => Promise<SummaryModalRow | null>;
  logStep: (step: string, detail?: string) => Promise<void>;
  verifySignature: (rawBody: string, timestamp: string | undefined, signature: string | undefined, secret: string) => Promise<{ success: boolean; reason?: string }>;
};

export type SlackAiReplyTask = {
  text: string;
  channel: string;
  threadTs: string;
  teamId?: string;
};

export type InteractionResult = {
  status: number;
  steps: string[];
  aiReplyTask?: SlackAiReplyTask;
};

/**
 * メッセージショートカット（message_action）でAI応答を依頼する際の Callback ID。
 * Slack App の「Message Shortcuts」設定でこの文字列を Callback ID に指定すること。
 */
export const SLACK_AI_REPLY_CALLBACK_ID = 'ask_ai';

export async function handleSlackInteraction(deps: InteractionDeps): Promise<InteractionResult> {
  const steps: string[] = [];
  const log = async (step: string, detail?: string) => {
    steps.push(step);
    await deps.logStep(step, detail);
  };

  await log('received');

  if (!deps.signingSecret) {
    await log('error', 'SLACK_SIGNING_SECRET not configured');
    return { status: 200, steps };
  }

  await log('body_read', `length=${deps.rawBody.length}`);

  const verification = await deps.verifySignature(deps.rawBody, deps.timestamp, deps.signature, deps.signingSecret);
  if (!verification.success) {
    await log('sig_fail', verification.reason ?? 'unknown');
    return { status: 401, steps };
  }
  await log('sig_ok');

  let interactionPayload: any;
  try {
    const params = new URLSearchParams(deps.rawBody);
    const payloadStr = params.get('payload');
    if (!payloadStr) {
      await log('error', 'missing payload field');
      return { status: 200, steps };
    }
    interactionPayload = JSON.parse(payloadStr);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    await log('error', `parse failed: ${msg}`);
    return { status: 200, steps };
  }

  await log('parsed', `type=${interactionPayload.type}, action_id=${interactionPayload.actions?.[0]?.action_id ?? 'none'}`);

  if (interactionPayload.type === 'message_action') {
    if (interactionPayload.callback_id !== SLACK_AI_REPLY_CALLBACK_ID) {
      await log('skip', `callback_id=${interactionPayload.callback_id ?? 'none'}`);
      return { status: 200, steps };
    }

    const text = interactionPayload.message?.text;
    const channel = interactionPayload.channel?.id;
    const threadTs = interactionPayload.message?.thread_ts ?? interactionPayload.message?.ts;
    const teamId = interactionPayload.team?.id;

    if (!text || !channel || !threadTs) {
      await log('error', `missing message/channel/ts in message_action payload`);
      return { status: 200, steps };
    }

    await log('message_action_matched', `channel=${channel}`);
    return { status: 200, steps, aiReplyTask: { text, channel, threadTs, teamId } };
  }

  if (interactionPayload.type !== 'block_actions') {
    await log('skip', `type=${interactionPayload.type}`);
    return { status: 200, steps };
  }

  const action = interactionPayload.actions?.[0];
  const actionId = action?.action_id ?? 'none';

  if (!action || actionId !== 'view_ai_summary_detail') {
    await log('skip', `action_id=${actionId}`);
    return { status: 200, steps };
  }

  const requestId = action.value;
  const triggerId = interactionPayload.trigger_id;
  const responseUrl: string | undefined = interactionPayload.response_url;
  if (!requestId || !triggerId) {
    await log('error', `requestId=${requestId ?? 'none'}, triggerId=${triggerId ?? 'none'}`);
    return { status: 200, steps };
  }

  await log('action_matched', `action_id=${actionId}, requestId=${requestId}`);

  if (!deps.slackToken) {
    await log('error', 'SLACK_OAUTH_TOKEN not configured');
    return { status: 200, steps };
  }

  try {
    const row = await deps.dbQuery(requestId);

    if (!row) {
      await log('db_miss', `requestId=${requestId}`);
      if (responseUrl) {
        await respondToInteraction({ responseUrl, text: `要約データが見つかりません (ID: ${requestId})` });
      }
      return { status: 200, steps };
    }

    await log('db_hit', `pr_number=${row.pr_number}`);

    const modalView = buildSummaryModal(row);
    const modalResult = await openSlackModal({ token: deps.slackToken, triggerId, view: modalView });
    if (!modalResult.ok) {
      await log('modal_fail', `error=${modalResult.error}, status=${modalResult.status}`);
      if (responseUrl) {
        const fallback = buildSummaryFallbackBlocks(row);
        const fallbackResult = await respondToInteraction({ responseUrl, text: fallback.text, blocks: fallback.blocks });
        await log('fallback', fallbackResult.ok ? 'ok' : `fail: ${fallbackResult.error}`);
      }
    } else {
      await log('modal_ok', `requestId=${requestId}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    await log('exception', msg);
  }

  return { status: 200, steps };
}
