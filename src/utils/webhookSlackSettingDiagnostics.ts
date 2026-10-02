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
  SOT?: string;
  SLACK_CHANNEL_ID?: string;
};

export function buildWebhookSettingChecks(env: WebhookSettingEnv): WebhookSettingChecks {
  const notifyTarget: 'slack' | 'worker' = env.NOTIFY_TARGET === 'worker' ? 'worker' : 'slack';
  const notifyWorkerUrlSet = !!env.NOTIFY_WORKER_URL;
  const notifyWorkerSecretSet = !!env.NOTIFY_WORKER_SECRET;
  const slackTokenSet = !!env.SOT;
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

// ─── cf-auth(dynamicneko/cf-auth)側の設定状況の横比較 ──────────────────────
// 本体Worker単体の設定だけを見ていると、「他のWorkerが将来増える」前提に
// 対して不十分という指摘を受けて追加。cf-auth側のGET /settings-check
// (Service Binding経由、INGEST_SECRET=NOTIFY_WORKER_SECRETで認証)を呼び、
// 本体側の真偽値一覧と並べて表示できるようにする。

export type CfAuthSettingChecks = {
  ingestSecretSet: boolean;
  webhookSecretSet: boolean;
  googleClientIdSet: boolean;
  googleClientSecretSet: boolean;
  githubClientIdSet: boolean;
  githubClientSecretSet: boolean;
  cookieSecretIsDefault: boolean;
};

export type CfAuthSettingCheckResult =
  | { ok: true; checks: CfAuthSettingChecks }
  | { ok: false; errorCode: 'binding_missing' | 'secret_missing' | 'http_error' | 'invalid_response'; detail: string };

function isCfAuthSettingChecks(value: unknown): value is CfAuthSettingChecks {
  if (!value || typeof value !== 'object') return false;
  const keys: (keyof CfAuthSettingChecks)[] = [
    'ingestSecretSet',
    'webhookSecretSet',
    'googleClientIdSet',
    'googleClientSecretSet',
    'githubClientIdSet',
    'githubClientSecretSet',
    'cookieSecretIsDefault',
  ];
  return keys.every((key) => typeof (value as Record<string, unknown>)[key] === 'boolean');
}

/**
 * cf-auth(Service Binding)の GET /settings-check を呼び、設定状況の真偽値を
 * 取得する。本体Worker自身のNOTIFY_WORKER_SECRETをそのままBearerとして使う
 * (cf-auth側のINGEST_SECRETと同じ値である前提。値が食い違っていれば
 * secret_missingではなくhttp_error(401)として検出できる)。
 */
export async function fetchCfAuthSettingChecks(
  fetcher: { fetch: typeof fetch } | undefined,
  notifyWorkerSecret: string | undefined
): Promise<CfAuthSettingCheckResult> {
  if (!fetcher) {
    return { ok: false, errorCode: 'binding_missing', detail: 'CF_AUTH Service Bindingが設定されていません(wrangler.tomlの[[services]]を確認してください)' };
  }
  if (!notifyWorkerSecret) {
    return { ok: false, errorCode: 'secret_missing', detail: 'NOTIFY_WORKER_SECRETが未設定のため、cf-auth側の/settings-checkを認証できません' };
  }
  let response: Response;
  try {
    response = await fetcher.fetch('https://cf-auth.internal/settings-check', {
      headers: { Authorization: `Bearer ${notifyWorkerSecret}` },
    });
  } catch (error) {
    return { ok: false, errorCode: 'http_error', detail: error instanceof Error ? error.message : 'Unknown error' };
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    return { ok: false, errorCode: 'http_error', detail: `cf-authの/settings-checkがステータス${response.status}を返しました: ${bodyText.slice(0, 300)}` };
  }
  const json: unknown = await response.json().catch(() => null);
  if (!isCfAuthSettingChecks(json)) {
    return { ok: false, errorCode: 'invalid_response', detail: 'cf-authの/settings-checkのレスポンス形式が不正です' };
  }
  return { ok: true, checks: json };
}
