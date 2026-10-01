// /wh-setting_github-to-slack ページ用の純粋関数群。
// GitHub webhook(経路A)→ 通知先切替(NOTIFY_TARGET)→ Slack or cf-auth(経路C)
// という一連の設定が揃っているかを、secretの値そのものは一切外部に出さずに
// 「設定されているかどうか(真偽値)」だけで可視化するための診断ロジック。

export type WebhookSettingChecks = {
  githubWebhookSecretSet: boolean;
  notifyTarget: 'slack' | 'worker';
  notifyWorkerUrlSet: boolean;
  notifyWorkerSecretSet: boolean;
  slackTokenSet: boolean;
  slackChannelSet: boolean;
  /** 現在のNOTIFY_TARGETの設定で、実際に通知が送信されうる状態かどうか */
  isNotifyConfigured: boolean;
};

export type WebhookSettingEnv = {
  GITHUB_WEBHOOK_SECRET?: string;
  NOTIFY_TARGET?: string;
  NOTIFY_WORKER_URL?: string;
  NOTIFY_WORKER_SECRET?: string;
  SLACK_OAUTH_TOKEN?: string;
  SLACK_CHANNEL_ID?: string;
};

export function buildWebhookSettingChecks(env: WebhookSettingEnv): WebhookSettingChecks {
  const notifyTarget: 'slack' | 'worker' = env.NOTIFY_TARGET === 'worker' ? 'worker' : 'slack';
  const notifyWorkerUrlSet = !!env.NOTIFY_WORKER_URL;
  const notifyWorkerSecretSet = !!env.NOTIFY_WORKER_SECRET;
  const slackTokenSet = !!env.SLACK_OAUTH_TOKEN;
  const slackChannelSet = !!env.SLACK_CHANNEL_ID;

  // src/utils/notifyDispatch.ts の isNotifyConfigured() と同じロジック。
  // targetが'worker'のときはworkerUrlの有無だけを見る(slack_enabledのD1設定は
  // 見ない)。targetが'slack'のときはslackToken・slackChannelの有無を見る
  // (D1のslack_enabledユーザーオプションは本体Worker全体の単一値では
  // ないため、このページでは個別に判定できない。別途注記する)。
  const isNotifyConfigured = notifyTarget === 'worker' ? notifyWorkerUrlSet : slackTokenSet && slackChannelSet;

  return {
    githubWebhookSecretSet: !!env.GITHUB_WEBHOOK_SECRET,
    notifyTarget,
    notifyWorkerUrlSet,
    notifyWorkerSecretSet,
    slackTokenSet,
    slackChannelSet,
    isNotifyConfigured,
  };
}

export type WebhookLogDisplayRow = {
  eventType: string | null;
  status: string;
  repository: string | null;
  receivedAt: string;
  error: string | null;
};

export type WebhookLogRawRow = {
  event_type: string | null;
  status: string;
  payload: string | null;
  error: string | null;
  received_at: string;
};

/**
 * webhook_log.payload(JSON文字列)から repository フィールドだけを安全に取り出す。
 * JSON parseに失敗したpayloadでもページ全体が落ちないようにnullへフォールバックする。
 */
export function extractRepositoryFromWebhookLogPayload(payload: string | null): string | null {
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed && typeof parsed === 'object' && 'repository' in parsed) {
      const repo = (parsed as { repository?: unknown }).repository;
      return typeof repo === 'string' ? repo : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function toWebhookLogDisplayRows(rows: WebhookLogRawRow[]): WebhookLogDisplayRow[] {
  return rows.map((row) => ({
    eventType: row.event_type,
    status: row.status,
    repository: extractRepositoryFromWebhookLogPayload(row.payload),
    receivedAt: row.received_at,
    error: row.error,
  }));
}
