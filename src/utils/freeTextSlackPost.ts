const MAX_FREE_TEXT_LENGTH = 3000;

export const TSUBUYAKI_SAMPLE_ACTION_ID = 'tsubuyaki_sample_reaction';
export const TSUBUYAKI_SAMPLE_CHOICES = { understood: '確認しました', thanks: 'ありがとう' } as const;

/**
 * /slack-post（つぶやき投稿）で利用できる Block Kit テンプレート。
 * ID は外部 UI からも送られるため、表示名とは分離して安定させる。
 */
export const SLACK_POST_TEMPLATES = [
  { id: 'interactive_sample', emoji: '🖱️', title: 'cronトリガー更新通知', description: 'Slackでボタンを押すと同じチャンネルに操作した人とボタン名を通知（集計・保存なし）' },
  { id: 'plain', emoji: '💬', title: 'フリーメッセージ', description: '自由な内容をそのまま共有' },
  { id: 'announcement', emoji: '📣', title: 'お知らせ', description: '全体への告知や重要な連絡' },
  { id: 'news', emoji: '📰', title: 'ニュース', description: '新着情報や社内ニュース' },
  { id: 'release', emoji: '🚀', title: 'リリース', description: 'リリース内容と変更点' },
  { id: 'maintenance', emoji: '🛠️', title: 'メンテナンス', description: '作業予定やサービス停止' },
  { id: 'incident', emoji: '🚨', title: '障害情報', description: '障害の発生・経過・復旧' },
  { id: 'warning', emoji: '⚠️', title: '注意喚起', description: '重要な注意事項を共有' },
  { id: 'security', emoji: '🛡️', title: 'セキュリティ', description: '脆弱性や安全上の連絡' },
  { id: 'approval', emoji: '✅', title: '承認依頼', description: '確認・承認を依頼' },
  { id: 'request', emoji: '🙏', title: '対応依頼', description: '作業や回答を依頼' },
  { id: 'question', emoji: '❓', title: '質問・相談', description: 'チームに質問や相談' },
  { id: 'decision', emoji: '⚖️', title: '決定事項', description: '決まった内容を記録' },
  { id: 'meeting', emoji: '📅', title: '会議案内', description: '日時・議題・参加方法' },
  { id: 'minutes', emoji: '📝', title: '議事録', description: '会議の要点とアクション' },
  { id: 'reminder', emoji: '⏰', title: 'リマインダー', description: '期限や予定を再通知' },
  { id: 'deadline', emoji: '⌛', title: '締切', description: '期限と必要な対応を周知' },
  { id: 'task', emoji: '📌', title: 'タスク共有', description: '担当・期限・進捗を共有' },
  { id: 'progress', emoji: '📊', title: '進捗報告', description: '現在地と次のアクション' },
  { id: 'daily', emoji: '☀️', title: '日報', description: '実績・課題・翌日の予定' },
  { id: 'weekly', emoji: '📈', title: '週報', description: '一週間の成果と来週の予定' },
  { id: 'event', emoji: '🎉', title: 'イベント', description: 'イベントの開催案内' },
  { id: 'survey', emoji: '🗳️', title: 'アンケート', description: '意見や回答を募集' },
  { id: 'welcome', emoji: '👋', title: '歓迎', description: '新メンバーを紹介' },
  { id: 'thanks', emoji: '💐', title: '感謝・称賛', description: '貢献への感謝を共有' },
  { id: 'celebration', emoji: '🏆', title: '成果・達成', description: 'マイルストーンを祝う' },
  { id: 'tips', emoji: '💡', title: 'Tips', description: '便利な知識や手順を共有' },
  { id: 'customer', emoji: '🤝', title: '顧客フィードバック', description: '顧客の声や要望を共有' },
  { id: 'oncall', emoji: '📞', title: '当番・引き継ぎ', description: '当番情報と申し送り' },
] as const;

export type SlackPostTemplateId = typeof SLACK_POST_TEMPLATES[number]['id'];

export function isSlackPostTemplateId(value: unknown): value is SlackPostTemplateId {
  return typeof value === 'string' && SLACK_POST_TEMPLATES.some((template) => template.id === value);
}

/** ユーザー入力を信頼済みのテンプレートで包み、chat.postMessage 用 blocks を作る。 */
export function buildFreeTextSlackBlocks(displayName: string, text: string, templateId: SlackPostTemplateId): Record<string, unknown>[] | undefined {
  if (templateId === 'plain') return undefined;
  const template = SLACK_POST_TEMPLATES.find((item) => item.id === templateId)!;
  const blocks: Record<string, unknown>[] = [
    { type: 'header', text: { type: 'plain_text', text: `${template.emoji} ${template.title}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text } },
    { type: 'divider' },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `投稿者: *${displayName}*` }] },
  ];
  if (templateId === 'interactive_sample') {
    blocks.splice(2, 0, { type: 'actions', elements: Object.entries(TSUBUYAKI_SAMPLE_CHOICES).map(([value, label]) => ({
      type: 'button', action_id: TSUBUYAKI_SAMPLE_ACTION_ID + '_' + value,
      text: { type: 'plain_text', text: label }, value,
    })) });
  }
  return blocks;
}

export type FreeTextValidationResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function validateFreeText(text: unknown): FreeTextValidationResult {
  if (typeof text !== 'string') {
    return { ok: false, error: '本文が指定されていません' };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: '本文が空です' };
  }
  if (trimmed.length > MAX_FREE_TEXT_LENGTH) {
    return { ok: false, error: `本文が長すぎます（${MAX_FREE_TEXT_LENGTH}文字以内にしてください）` };
  }
  return { ok: true, text: trimmed };
}

export function buildFreeTextSlackMessage(displayName: string, text: string): string {
  return `📮 *${displayName}* さんの投稿:\n${text}`;
}

export type SlashCommandResponse = {
  status: number;
  body: { response_type: 'ephemeral'; text: string } | null;
};

export type TsubuyakiSlashCommandDeps = {
  rawBody: string;
  timestamp: string | undefined;
  signature: string | undefined;
  signingSecret: string | undefined;
  verifySignature: (
    rawBody: string,
    timestamp: string | undefined,
    signature: string | undefined,
    signingSecret: string
  ) => Promise<{ success: boolean; reason?: string }>;
  /** 送信先(Slack/外部Worker)はこの関数の内部実装(notifyDispatch)が NOTIFY_TARGET で切り替える */
  sendNotification: (message: { text: string }) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * Slack スラッシュコマンド `/pts` を処理する。
 * 署名検証に失敗した場合のみ 401・本文なしを返す（Slack以外からの偽装リクエストを拒否するため）。
 * それ以外（設定不備・入力検証エラー・送信失敗・成功）はすべて200 + ephemeralメッセージで返す。
 */
export async function handleTsubuyakiSlashCommand(deps: TsubuyakiSlashCommandDeps): Promise<SlashCommandResponse> {
  if (!deps.signingSecret) {
    return { status: 200, body: { response_type: 'ephemeral', text: '❌ Slack連携の署名鍵（SLACK_SIGNING_SECRET）が設定されていません' } };
  }

  const verification = await deps.verifySignature(deps.rawBody, deps.timestamp, deps.signature, deps.signingSecret);
  if (!verification.success) {
    return { status: 401, body: null };
  }

  const form = new URLSearchParams(deps.rawBody);
  const text = form.get('text') || '';
  const userName = form.get('user_name') || 'unknown';

  const validated = validateFreeText(text);
  if (!validated.ok) {
    return { status: 200, body: { response_type: 'ephemeral', text: `❌ ${validated.error}` } };
  }

  const message = buildFreeTextSlackMessage(userName, validated.text);
  const result = await deps.sendNotification({ text: message });
  if (!result.ok) {
    return { status: 200, body: { response_type: 'ephemeral', text: `❌ 投稿に失敗しました: ${result.error || '不明なエラー'}` } };
  }

  return { status: 200, body: { response_type: 'ephemeral', text: '✅ Slackに投稿しました' } };
}
