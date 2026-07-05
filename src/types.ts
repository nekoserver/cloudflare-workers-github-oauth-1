/**
 * 共通型定義
 */
import type { JWTPayload } from './utils/jwt';

/** Cloudflare Workers 環境変数バインディング */
export type Bindings = {
  JWT_SECRET: string;
  ENVIRONMENT: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  DB?: D1Database;
  ANALYTICS?: AnalyticsEngineDataset;
  RESEND_WEBHOOK_SECRET?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_OAUTH_TOKEN?: string;
  SLACK_CLIENT_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CHANNEL_ID?: string;
  /** 通知の送信先スイッチ。'worker' で外部Workerへ切替、未設定・それ以外は 'slack'（従来どおり） */
  NOTIFY_TARGET?: string;
  /** NOTIFY_TARGET=worker のときの送信先URL */
  NOTIFY_WORKER_URL?: string;
  /** NOTIFY_TARGET=worker のときのAuthorizationヘッダに使う共有シークレット（任意） */
  NOTIFY_WORKER_SECRET?: string;
  SESSION_IDLE_TIMEOUT_SECONDS?: string;
  COMMIT_HISTORY_PAGE_SIZE?: string;
  RESEND_WEBHOOK_DEDUP_TTL_SECONDS?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  CF_AUTH_WEBHOOK_SECRET?: string;
  GITHUB_TOKEN?: string;
  AI?: Ai;
  AI_MODEL?: string;
  AI_CHAT_MODEL?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
};

/** Hono コンテキスト変数 */
export type Variables = {
  user: JWTPayload;
};

// =====================================================
// Webhook ペイロード型定義
// =====================================================

/** GitHub Webhook の installation/installation_repositories イベントペイロード */
export interface GitHubWebhookInstallationPayload {
  action?: string;
  installation?: {
    id: number;
    app_slug?: string;
    permissions?: Record<string, string>;
    repository_selection?: string;
  };
  repositories?: Array<{ name?: string; full_name?: string }>;
  repositories_added?: Array<{ name?: string; full_name?: string }>;
  repositories_removed?: Array<{ name?: string; full_name?: string }>;
  sender?: { login?: string };
}

/** GitHub Webhook の repository イベントペイロード */
export interface GitHubWebhookRepositoryPayload {
  action?: string;
  repository?: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    owner?: { login: string };
    html_url?: string;
  };
  sender?: { login?: string };
}

/** GitHub Webhook の pull_request イベントペイロード */
export interface GitHubWebhookPullRequestPayload {
  action?: string;
  pull_request?: {
    title: string;
    body: string | null;
    html_url: string;
    diff_url: string;
    commits_url?: string;
    number: number;
    user?: { login: string };
  };
  repository?: {
    full_name: string;
  };
  sender?: { login?: string };
}

/** Resend Webhook のペイロード */
export interface ResendWebhookPayload {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    subject?: string;
    bounce?: {
      type?: string;
      message?: string;
    };
    error?: {
      message?: string;
    };
  };
}

/**
 * セッションアイドルタイムアウト秒数を解決する
 * 環境変数の値をパースし、maxSeconds を超えないように制限する
 */
export function resolveIdleTimeoutSeconds(
  envValue: string | undefined,
  maxSeconds: number,
  settingsSeconds?: number
): number {
  const parsed = Number(envValue);
  const defaultIdle = 30 * 60;
  const resolvedSettings = Number(settingsSeconds);
  const fallbackIdle = Number.isFinite(resolvedSettings) && resolvedSettings > 0
    ? Math.floor(resolvedSettings)
    : defaultIdle;
  let idleSeconds = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallbackIdle;
  if (idleSeconds > maxSeconds) {
    idleSeconds = maxSeconds;
  }
  return idleSeconds;
}
