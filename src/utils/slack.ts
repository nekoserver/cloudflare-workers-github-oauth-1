export type SlackPostResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

type SlackPostParams = {
  token: string;
  channel: string;
  text: string;
};

export async function postSlackMessage({ token, channel, text }: SlackPostParams): Promise<SlackPostResult> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      text,
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
