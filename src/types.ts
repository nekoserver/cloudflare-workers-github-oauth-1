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
  SESSION_IDLE_TIMEOUT_SECONDS?: string;
  COMMIT_HISTORY_PAGE_SIZE?: string;
  RESEND_WEBHOOK_DEDUP_TTL_SECONDS?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_TOKEN?: string;
  AI?: Ai;
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
    from?: string;
    to?: string | string[];
    subject?: string;
  };
}

/**
 * セッションアイドルタイムアウト秒数を解決する
 * 環境変数の値をパースし、maxSeconds を超えないように制限する
 */
export function resolveIdleTimeoutSeconds(envValue: string | undefined, maxSeconds: number): number {
  const parsed = Number(envValue);
  const defaultIdle = 30 * 60;
  let idleSeconds = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultIdle;
  if (idleSeconds > maxSeconds) {
    idleSeconds = maxSeconds;
  }
  return idleSeconds;
}
