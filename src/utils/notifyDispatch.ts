import { postSlackMessage, type SlackPostResult } from './slack';

/**
 * 通知の送信先スイッチ。
 * NOTIFY_TARGET を 'worker' に切り替えるだけで、既存のSlack通知呼び出しを
 * すべて外部Workerへの送信に切り替えられるようにする。未設定・'worker'以外は
 * 従来どおり 'slack'（後方互換のデフォルト）。
 */
export type NotifyTarget = 'slack' | 'worker';

export type NotifyEnv = {
  NOTIFY_TARGET?: string;
  SLACK_OAUTH_TOKEN?: string;
  SLACK_CHANNEL_ID?: string;
  NOTIFY_WORKER_URL?: string;
  NOTIFY_WORKER_SECRET?: string;
};

export type NotifyConfig = {
  target: NotifyTarget;
  slackToken?: string;
  slackChannel?: string;
  workerUrl?: string;
  workerSecret?: string;
};

export type NotifyMessage = {
  text: string;
  blocks?: Record<string, unknown>[];
  thread_ts?: string;
};

export type NotifyResult = SlackPostResult;

export function resolveNotifyTarget(env: Pick<NotifyEnv, 'NOTIFY_TARGET'>): NotifyTarget {
  return env.NOTIFY_TARGET === 'worker' ? 'worker' : 'slack';
}

export function resolveNotifyConfig(env: NotifyEnv): NotifyConfig {
  return {
    target: resolveNotifyTarget(env),
    slackToken: env.SLACK_OAUTH_TOKEN,
    slackChannel: env.SLACK_CHANNEL_ID,
    workerUrl: env.NOTIFY_WORKER_URL,
    workerSecret: env.NOTIFY_WORKER_SECRET,
  };
}

/**
 * 現在の送信先に必要な設定が揃っているかを判定する。
 * 揃っていない場合、sendNotification は実際の送信を行わずエラーを返す。
 */
export function isNotifyConfigured(config: NotifyConfig): boolean {
  if (config.target === 'worker') {
    return !!config.workerUrl;
  }
  return !!config.slackToken && !!config.slackChannel;
}

function describeMissingConfig(config: NotifyConfig): string {
  if (config.target === 'worker') {
    return '通知先Workerが設定されていません（NOTIFY_WORKER_URL が未設定）';
  }
  return 'Slack連携が設定されていません（SLACK_OAUTH_TOKEN / SLACK_CHANNEL_ID が未設定）';
}

async function sendToWorker(config: NotifyConfig, message: NotifyMessage, fetchImpl: typeof fetch): Promise<NotifyResult> {
  try {
    const response = await fetchImpl(config.workerUrl as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(config.workerSecret ? { Authorization: `Bearer ${config.workerSecret}` } : {}),
      },
      body: JSON.stringify({
        channel: config.slackChannel,
        text: message.text,
        blocks: message.blocks,
        thread_ts: message.thread_ts,
        source: 'cloudflare-workers-github-oauth-1',
      }),
    });
    if (response.status < 200 || response.status >= 300) {
      const detail = await response.text().catch(() => '');
      return { ok: false, status: response.status, error: detail.slice(0, 500) || `HTTP ${response.status}` };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export type SendNotificationDeps = {
  postSlackMessage: typeof postSlackMessage;
  fetchImpl: typeof fetch;
};

const defaultDeps: SendNotificationDeps = {
  postSlackMessage,
  fetchImpl: (...args: Parameters<typeof fetch>) => fetch(...args),
};

/**
 * 通知を送信する唯一の窓口。呼び出し側はSlackか外部Workerかを意識せず、
 * NotifyConfig（resolveNotifyConfigで作る）とメッセージ本文だけを渡せばよい。
 * 送信先はすべて NOTIFY_TARGET の値で決まる。
 */
export async function sendNotification(
  config: NotifyConfig,
  message: NotifyMessage,
  deps: SendNotificationDeps = defaultDeps
): Promise<NotifyResult> {
  if (!isNotifyConfigured(config)) {
    return { ok: false, error: describeMissingConfig(config) };
  }

  if (config.target === 'worker') {
    return sendToWorker(config, message, deps.fetchImpl);
  }

  return deps.postSlackMessage({
    token: config.slackToken as string,
    channel: config.slackChannel as string,
    text: message.text,
    blocks: message.blocks,
    thread_ts: message.thread_ts,
  });
}
