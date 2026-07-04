export type SlackEventCallbackEvent = {
  type: string;
  user?: string;
  text?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  channel_type?: string;
};

export type SlackEventCallback = {
  type: 'event_callback';
  team_id?: string;
  event: SlackEventCallbackEvent;
};

export type SlackEventResponse =
  | { status: 200; body: { challenge: string }; eventCallback: null }
  | { status: 200; body: null; eventCallback: SlackEventCallback | null }
  | { status: 400; body: null; eventCallback: null }
  | { status: 401; body: null; eventCallback: null };

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

function isSlackEventCallback(record: Record<string, unknown>): record is SlackEventCallback {
  if (record.type !== 'event_callback') return false;
  const event = record.event;
  return typeof event === 'object' && event !== null && typeof (event as Record<string, unknown>).type === 'string';
}

/**
 * Slack Events API の受信エンドポイント用ハンドラ。
 * url_verification（Request URL登録時のchallenge応答）を処理し、
 * event_callback（実際のイベント通知）はパース済みペイロードをeventCallbackとして返す。
 * 呼び出し元がイベント種別(app_mention等)に応じた実処理をディスパッチする。
 * 署名検証に失敗した場合のみ401を返す。
 */
export async function handleSlackEvent(deps: SlackEventDeps): Promise<SlackEventResponse> {
  if (!deps.signingSecret) {
    return { status: 401, body: null, eventCallback: null };
  }

  const verification = await deps.verifySignature(deps.rawBody, deps.timestamp, deps.signature, deps.signingSecret);
  if (!verification.success) {
    return { status: 401, body: null, eventCallback: null };
  }

  let payload: unknown;
  try {
    payload = deps.rawBody ? JSON.parse(deps.rawBody) : {};
  } catch {
    return { status: 400, body: null, eventCallback: null };
  }

  const record = payload as Record<string, unknown>;
  if (record?.type === 'url_verification' && typeof record.challenge === 'string') {
    return { status: 200, body: { challenge: record.challenge }, eventCallback: null };
  }

  if (isSlackEventCallback(record)) {
    return { status: 200, body: null, eventCallback: record };
  }

  return { status: 200, body: null, eventCallback: null };
}
