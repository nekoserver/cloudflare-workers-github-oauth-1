export type SlackPostResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

function parseSlackResponse(payload: any, parseError: string | null, status: number): SlackPostResult {
  const appendParseInfo = (detail: string) =>
    parseError ? `${detail} (parse: ${parseError})` : detail;

  if (status < 200 || status >= 300) {
    const detail = payload && typeof payload.error === 'string' ? payload.error : `HTTP ${status}`;
    return { ok: false, status, error: appendParseInfo(detail) };
  }

  if (!payload || payload.ok !== true) {
    const detail = payload && typeof payload.error === 'string' ? payload.error : 'Slack API error';
    return { ok: false, status, error: appendParseInfo(detail) };
  }

  return { ok: true, status };
}

async function fetchSlackApi(url: string, token: string, body: Record<string, unknown>): Promise<SlackPostResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  let payload: any = null;
  let parseError: string | null = null;
  try {
    payload = await response.json();
  } catch (error) {
    parseError = error instanceof Error ? error.message : 'JSON parse failed';
    payload = null;
  }

  return parseSlackResponse(payload, parseError, response.status);
}

type SlackPostParams = {
  token: string;
  channel: string;
  text: string;
  blocks?: Record<string, unknown>[];
  thread_ts?: string;
};

export async function postSlackMessage({ token, channel, text, blocks, thread_ts }: SlackPostParams): Promise<SlackPostResult> {
  const body: Record<string, unknown> = { channel, text };
  if (blocks) {
    body.blocks = blocks;
  }
  if (thread_ts) {
    body.thread_ts = thread_ts;
  }
  return fetchSlackApi('https://slack.com/api/chat.postMessage', token, body);
}

type SlackModalView = {
  type: 'modal';
  title: { type: 'plain_text'; text: string };
  close?: { type: 'plain_text'; text: string };
  blocks: Record<string, unknown>[];
};

type OpenSlackModalParams = {
  token: string;
  triggerId: string;
  view: SlackModalView;
};

export async function openSlackModal({ token, triggerId, view }: OpenSlackModalParams): Promise<SlackPostResult> {
  return fetchSlackApi('https://slack.com/api/views.open', token, { trigger_id: triggerId, view });
}

type UpdateSlackModalParams = {
  token: string;
  viewId: string;
  view: SlackModalView;
};

export async function updateSlackModal({ token, viewId, view }: UpdateSlackModalParams): Promise<SlackPostResult> {
  return fetchSlackApi('https://slack.com/api/views.update', token, { view_id: viewId, view });
}

type RespondToInteractionParams = {
  responseUrl: string;
  text: string;
  blocks?: Record<string, unknown>[];
};

export async function respondToInteraction({ responseUrl, text, blocks }: RespondToInteractionParams): Promise<SlackPostResult> {
  const body: Record<string, unknown> = {
    response_type: 'ephemeral',
    replace_original: false,
    text,
  };
  if (blocks) {
    body.blocks = blocks;
  }

  const response = await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  if (response.status >= 200 && response.status < 300) {
    return { ok: true, status: response.status };
  }

  const errorText = await response.text().catch(() => '');
  return { ok: false, status: response.status, error: errorText.slice(0, 500) };
}
