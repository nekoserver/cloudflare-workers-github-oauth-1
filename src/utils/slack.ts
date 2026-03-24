export type SlackPostResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

type SlackPostParams = {
  token: string;
  channel: string;
  text: string;
  blocks?: Record<string, unknown>[];
};

export async function postSlackMessage({ token, channel, text, blocks }: SlackPostParams): Promise<SlackPostResult> {
  const body: Record<string, unknown> = { channel, text };
  if (blocks) {
    body.blocks = blocks;
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`,
    };
  }

  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      status: response.status,
      error: payload && typeof payload.error === 'string' ? payload.error : 'Slack API error',
    };
  }

  return { ok: true, status: response.status };
}

type SlackModalView = {
  type: 'modal';
  title: { type: 'plain_text'; text: string };
  blocks: Record<string, unknown>[];
};

type OpenSlackModalParams = {
  token: string;
  triggerId: string;
  view: SlackModalView;
};

export async function openSlackModal({ token, triggerId, view }: OpenSlackModalParams): Promise<SlackPostResult> {
  const response = await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      trigger_id: triggerId,
      view,
    }),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`,
    };
  }

  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      status: response.status,
      error: payload && typeof payload.error === 'string' ? payload.error : 'Slack API error',
    };
  }

  return { ok: true, status: response.status };
}
