import { generateSlackAiReply, type AiRunFn, type AiUsage } from './slackAiReply';

export type SlackPostMessageFn = (params: {
  token: string;
  channel: string;
  text: string;
  thread_ts?: string;
}) => Promise<{ ok: boolean; error?: string }>;

export type SlackSaveShareFn = (params: {
  question: string;
  answer: string;
  model: string;
  usage: AiUsage;
}) => Promise<void>;

export type SlackMentionReplyDeps = {
  text: string;
  channel: string;
  threadTs: string;
  slackToken: string | undefined;
  configuredModel: string | undefined;
  aiRun: AiRunFn;
  postMessage: SlackPostMessageFn;
  /**
   * AI応答に成功した場合、AIチャットページ(/aichat)から参照できるよう
   * ai_chat_sharesへ保存するための任意フック。保存の成否はSlackへの
   * 返信結果に影響させない(失敗してもSlack応答自体は成功として扱う)。
   */
  saveShare?: SlackSaveShareFn;
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

  if (aiResult.ok && deps.saveShare) {
    try {
      await deps.saveShare({ question: cleanedText, answer: aiResult.text, model: aiResult.usedModel, usage: aiResult.usage });
    } catch {
      // 保存はAIチャットページで参照可能にするための付随機能のため、
      // 失敗してもSlackへの返信自体は成功として扱う(呼び出し側のsaveShare実装が
      // 詳細をログに記録する)。
    }
  }

  return { posted: true };
}
