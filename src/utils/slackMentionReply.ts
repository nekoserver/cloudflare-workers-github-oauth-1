import { generateSlackAiReply, type AiRunFn, type AiUsage } from './slackAiReply';
import { convertMarkdownToSlackMrkdwn } from './markdownToSlackMrkdwn';

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
  /**
   * `/neko askgk <質問文>` サブコマンド用。rust-worker-sqlx-d1の
   * /tunnel-signer経由でtunnelsへ質問を送りreplyを返す(index.tsのaskgkDepと
   * 同じ関数)。未設定(Service Binding無し)の場合はPOST /api/aichat側と同じ
   * 「現在利用できません」文言を返す。
   */
  askTunnelSigner?: (message: string) => Promise<string>;
};

const ASKGK_MENTION_PREFIX = '/neko askgk';

/**
 * メンション本文(ボットメンション除去済み)が`/neko askgk`サブコマンドかどうかを
 * 判定し、該当する場合は質問文を取り出す。先頭が`/neko askgk`に完全一致または
 * スペース区切りで続く場合のみ対象とし、他の`/neko`サブコマンドや
 * `/neko askgkxxx`のような紛らわしい文字列には反応しない。
 */
export function parseAskgkMentionCommand(cleanedText: string): { question: string } | null {
  if (cleanedText === ASKGK_MENTION_PREFIX) {
    return { question: '' };
  }
  if (cleanedText.startsWith(ASKGK_MENTION_PREFIX + ' ')) {
    return { question: cleanedText.slice(ASKGK_MENTION_PREFIX.length).trim() };
  }
  return null;
}

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
 * AI応答をSlackのメッセージ記法(mrkdwn)に整形する。AIが生成したMarkdownを
 * convertMarkdownToSlackMrkdwnでmrkdwnへ変換して返す(見出し・太字・箇条書き等が
 * Slack上でも読みやすく表示される)。フェンスコードブロック/インラインコードは
 * 変換内部で退避されるため、応答本文にそのまま含まれていても壊れない。
 * エラーメッセージ(ok:false)は変換せず、絵文字付きの通常テキストのまま返す。
 */
export function formatSlackAiReplyText(aiResult: { ok: true; text: string } | { ok: false; error: string }): string {
  if (!aiResult.ok) {
    return `❌ AI応答の取得に失敗しました: ${aiResult.error}`;
  }
  return convertMarkdownToSlackMrkdwn(aiResult.text);
}

/**
 * `/neko askgk <質問文>` サブコマンドの応答文を組み立てる。POST /api/aichat側の
 * 同コマンド(interpretAichatSlashCommand)と同じ文言・分岐(質問文なし/未設定/
 * エラー/成功)を踏襲する。
 */
async function resolveAskgkMentionReply(
  question: string,
  askTunnelSigner: ((message: string) => Promise<string>) | undefined
): Promise<string> {
  // tunnel-signerファイルに渡すヘルプコマンドは「/neko askgk」(引数なし、空文字
  // のまま渡す)と「/neko askgk help」(エイリアス変換せず"help"のまま渡す)の
  // 2通りで、どちらもここではエラーにせずそのままaskTunnelSignerへ渡す。
  if (!askTunnelSigner) {
    return '❌ /neko askgk は現在利用できません(rust-worker-sqlx-d1連携未設定)';
  }
  try {
    const reply = await askTunnelSigner(question);
    return `**質問**: ${question || '(引数なし)'}\n\n${reply}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `❌ /neko askgk でエラーが発生しました: ${message}`;
  }
}

/**
 * Slackの app_mention イベントを処理する。
 * メンション本文をAIチャットに渡して応答を取得し、同じスレッドに返信する。
 * AI応答取得に失敗した場合もエラー内容をSlackへ返信する（記録＝戻り値、通知＝Slack返信）。
 */
export async function handleSlackAppMention(deps: SlackMentionReplyDeps): Promise<SlackMentionReplyResult> {
  if (!deps.slackToken) {
    return { posted: false, error: 'SOT is not configured' };
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

  const askgkCommand = parseAskgkMentionCommand(cleanedText);
  if (askgkCommand) {
    const replyText = await resolveAskgkMentionReply(askgkCommand.question, deps.askTunnelSigner);
    const result = await deps.postMessage({
      token: deps.slackToken,
      channel: deps.channel,
      text: replyText,
      thread_ts: deps.threadTs,
    });
    return result.ok ? { posted: true } : { posted: false, error: result.error ?? 'Unknown error' };
  }

  const aiResult = await generateSlackAiReply(cleanedText, deps.configuredModel, deps.aiRun);
  const replyText = formatSlackAiReplyText(aiResult);

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
