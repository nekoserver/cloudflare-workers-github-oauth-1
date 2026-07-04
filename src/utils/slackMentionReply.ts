import { generateSlackAiReply, type AiRunFn } from './slackAiReply';

export type SlackPostMessageFn = (params: {
  token: string;
  channel: string;
  text: string;
  thread_ts?: string;
}) => Promise<{ ok: boolean; error?: string }>;

export type SlackMentionReplyDeps = {
  text: string;
  channel: string;
  threadTs: string;
  slackToken: string | undefined;
  configuredModel: string | undefined;
  aiRun: AiRunFn;
  postMessage: SlackPostMessageFn;
};

export type SlackMentionReplyResult =
  | { posted: true }
  | { posted: false; error: string };

/**
 * メンション本文から `<@BOTID>` トークンを取り除き、質問文だけを取り出す。
 */
export function stripBotMentions(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/gi, '').trim();
}

/**
 * Slackの app_mention イベントを処理する。
 * メンション本文をAIチャットに渡して応答を取得し、同じスレッドに返信する。
 * AI応答取得に失敗した場合もエラー内容をSlackへ返信する（記録＝戻り値、通知＝Slack返信）。
 */
export async function handleSlackAppMention(deps: SlackMentionReplyDeps): Promise<SlackMentionReplyResult> {
  if (!deps.slackToken) {
    return { posted: false, error: 'SLACK_OAUTH_TOKEN is not configured' };
  }

  const cleanedText = stripBotMentions(deps.text);
  if (!cleanedText) {
    const result = await deps.postMessage({
      token: deps.slackToken,
      channel: deps.channel,
      text: '❓ 質問内容が空です。メンションと一緒に聞きたいことを書いてください。',
      thread_ts: deps.threadTs,
    });
    return result.ok ? { posted: true } : { posted: false, error: result.error ?? 'Unknown error' };
  }

  const aiResult = await generateSlackAiReply(cleanedText, deps.configuredModel, deps.aiRun);
  const replyText = aiResult.ok ? aiResult.text : `❌ AI応答の取得に失敗しました: ${aiResult.error}`;

  const result = await deps.postMessage({
    token: deps.slackToken,
    channel: deps.channel,
    text: replyText,
    thread_ts: deps.threadTs,
  });

  if (!result.ok) {
    return { posted: false, error: result.error ?? 'Unknown error' };
  }
  return { posted: true };
}
