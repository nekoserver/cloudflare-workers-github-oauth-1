export type SlackEventResponse =
  | { status: 200; body: { challenge: string } }
  | { status: 200; body: null }
  | { status: 400; body: null }
  | { status: 401; body: null };

export type SlackEventDeps = {
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
};

/**
 * Slack Events API の受信エンドポイント用ハンドラ。
 * url_verification（Request URL登録時のchallenge応答）を処理する。
 * 署名検証に失敗した場合のみ401を返し、それ以外のイベントは200で確認応答する。
 */
export async function handleSlackEvent(deps: SlackEventDeps): Promise<SlackEventResponse> {
  if (!deps.signingSecret) {
    return { status: 401, body: null };
  }

  const verification = await deps.verifySignature(deps.rawBody, deps.timestamp, deps.signature, deps.signingSecret);
  if (!verification.success) {
    return { status: 401, body: null };
  }

  let payload: unknown;
  try {
    payload = deps.rawBody ? JSON.parse(deps.rawBody) : {};
  } catch {
    return { status: 400, body: null };
  }

  const record = payload as Record<string, unknown>;
  if (record?.type === 'url_verification' && typeof record.challenge === 'string') {
    return { status: 200, body: { challenge: record.challenge } };
  }

  return { status: 200, body: null };
}
