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

export type InteractionResult = {
  status: number;
  steps: string[];
};

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

  if (interactionPayload.type !== 'block_actions') {
    await log('skip', `type=${interactionPayload.type}`);
    return { status: 200, steps };
  }

  const action = interactionPayload.actions?.[0];
  if (!action || action.action_id !== 'view_ai_summary_detail') {
    await log('skip', `action_id=${action?.action_id ?? 'none'}`);
    return { status: 200, steps };
  }

  const requestId = action.value;
  const triggerId = interactionPayload.trigger_id;
  const responseUrl: string | undefined = interactionPayload.response_url;
  if (!requestId || !triggerId) {
    await log('error', `requestId=${requestId ?? 'none'}, triggerId=${triggerId ?? 'none'}`);
    return { status: 200, steps };
  }

  await log('action_matched', `requestId=${requestId}`);

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
