const MAX_FREE_TEXT_LENGTH = 3000;

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
  slackToken: string | undefined;
  slackChannel: string | undefined;
  verifySignature: (
    rawBody: string,
    timestamp: string | undefined,
    signature: string | undefined,
    signingSecret: string
  ) => Promise<{ success: boolean; reason?: string }>;
  postMessage: (params: { token: string; channel: string; text: string }) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * Slack スラッシュコマンド `/pts` を処理する。
 * 署名検証に失敗した場合のみ 401・本文なしを返す（Slack以外からの偽装リクエストを拒否するため）。
 * それ以外（設定不備・入力検証エラー・Slack API失敗・成功）はすべて200 + ephemeralメッセージで返す。
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

  if (!deps.slackToken || !deps.slackChannel) {
    return { status: 200, body: { response_type: 'ephemeral', text: '❌ Slack連携が設定されていません（SLACK_OAUTH_TOKEN / SLACK_CHANNEL_ID が未設定）' } };
  }

  const message = buildFreeTextSlackMessage(userName, validated.text);
  const result = await deps.postMessage({ token: deps.slackToken, channel: deps.slackChannel, text: message });
  if (!result.ok) {
    return { status: 200, body: { response_type: 'ephemeral', text: `❌ 投稿に失敗しました: ${result.error || '不明なエラー'}` } };
  }

  return { status: 200, body: { response_type: 'ephemeral', text: '✅ Slackに投稿しました' } };
}
