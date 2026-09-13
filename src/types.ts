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
  /** 自App自身のBot User ID(U始まり)。app_mentionイベントのevent.userと比較し、自App自身の発言だけを除外するために使う。未設定時はbot_id付きイベントを一律除外する(安全側デフォルト) */
  SLACK_BOT_USER_ID?: string;
  /** 通知の送信先スイッチ。'worker' で外部Workerへ切替、未設定・それ以外は 'slack'（従来どおり） */
  NOTIFY_TARGET?: string;
  /** NOTIFY_TARGET=worker のときの送信先URL */
  NOTIFY_WORKER_URL?: string;
  /** NOTIFY_TARGET=worker のときのAuthorizationヘッダに使う共有シークレット（任意） */
  NOTIFY_WORKER_SECRET?: string;
  /**
   * /neko hellodw が起動確認のpingを送るdynamicneko(Cloudflare Dynamic Worker
   * Loader使用)へのService Binding。公開URLへの通常fetch()は*.workers.dev同士
   * だとCloudflareにHTTP 404 error code: 1042で拒否されるため、wrangler.tomlの
   * [[services]]でdynamicnekoをbindingすること(URLではなくFetcher)。
   */
  DYNAMICNEKO?: Fetcher;
  /** dynamicneko側 GET /api/ping のAuthorizationヘッダに使う共有シークレット。dynamicneko側のPING_SECRETと同じ値を設定する */
  DYNAMICNEKO_PING_SECRET?: string;
  /** dynamicnekoのNew SnippetウィジェットがPOST /api/kimi-code/generate-externalを呼ぶ際のBearer認証シークレット。dynamicneko側と同じ変数名・同じ値を設定する */
  KIMI_CODE_EXTERNAL_SECRET?: string;
  /** dynamicnekoのAI問い合わせウィジェットがPOST /api/aichat/query-external・/api/aichat/permission-externalを呼ぶ際のBearer認証シークレット。dynamicneko側と同じ変数名・同じ値を設定する */
  AICHAT_EXTERNAL_SECRET?: string;
  SESSION_IDLE_TIMEOUT_SECONDS?: string;
  COMMIT_HISTORY_PAGE_SIZE?: string;
  RESEND_WEBHOOK_DEDUP_TTL_SECONDS?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  CF_AUTH_WEBHOOK_SECRET?: string;
  /** /webhook/cf-wh1（Cloudflareからのwebhook）のHMAC-SHA256署名検証用シークレット */
  CF_WH1_WEBHOOK_SECRET?: string;
  /** harness_hook_logへのPostToolUseフック書き込み用の共有シークレット */
  HARNESS_HOOK_SECRET?: string;
  GITHUB_TOKEN?: string;
  /**
   * /gh-attach（gh issue create --attachのWASM移植）のアップロード専用GitHub PAT
   * （classic、repoスコープ必須）。uploads.github.com/user-attachments/assetsは
   * GitHub Appのトークン（ghu_）では動作しないため、このアプリのOAuthトークンとは
   * 別にclassic PATが必要（実際に404が再現し検証済み）。未設定時はアップロードが失敗する。
   */
  GH_ATTACH_UPLOAD_TOKEN?: string;
  AI?: Ai;
  AI_MODEL?: string;
  AI_CHAT_MODEL?: string;
  /** 未設定時はテストメール送信機能自体を無効(デフォルトOFF)にする */
  RESEND_API_KEY?: string;
  /** /neko vlink が使うGoogle Custom Search JSON APIのAPIキー。GOOGLE_CSE_CXとセットで設定する(未設定時は/neko vlinkを無効化) */
  GOOGLE_CSE_API_KEY?: string;
  /** /neko vlink が使うGoogle Programmable Search Engineの検索エンジンID(cxパラメータ) */
  GOOGLE_CSE_CX?: string;
  /** /cursor-agent ページが使うCursor Background Agent APIのAPIキー。未設定時は/cursor-agentからの起動を無効化する */
  CURSOR_API_KEY?: string;
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
