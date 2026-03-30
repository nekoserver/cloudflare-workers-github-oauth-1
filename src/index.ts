/**
 * Cloudflare Workers GitHub OAuth
 * GitHub OAuthとJWT認証の実装
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createJWT, JWTPayload } from './utils/jwt';
// NOTE: レートリミットはCloudflare WAFのRate Limiting Rulesで設定することを推奨します
// Cloudflare Workersはステートレスなため、アプリ内でのレートリミットには
// Durable ObjectsやKVなどの外部ストアが必要です
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import { getLoginPage } from './views/login';
import { getWelcomePage } from './views/welcome';
import { getSettingsPage } from './views/settings';
import { getRepositoriesPage } from './views/repositories';
import { getUserInfoPage } from './views/userinfo';
import { getMarkdownPreviewPage } from './views/markdown-preview';
import { getCacheStatusPage, CacheStatusData, TableStatusEntry, UserContextInfo, RepoColorEntry, RepoGroupEntry } from './views/status';
import { ensureDefaultWorkspace, getCurrentWorkspace, getUserWorkspaces, switchWorkspace } from './utils/workspace';
import { getGitHubAccessToken, getGitHubLatestCommit, getGitHubCommitCount, getGitHubCommits, getGitHubRepoOpenIssuesCount, getGitHubRepoCommitsByMonth, getGitHubRepoCommitsByDate, getGitHubTokenScopes, getGitHubUser, getGitHubUserEmail, getGitHubUserRepos, createGitHubRepo, GitHubTokenScopesError, buildRepoInstallationPermissionsMap, RepoInstallationPermissions, getGitHubUserInstallationsWithDiag, getGitHubInstallationRepos, getExternalServiceLinkedRepos, getSlackLinkedReposByWebhooks, CommitDetail } from './utils/github';
import { getCookieValue, getCookieValues } from './utils/cookie';
import { verifyResendWebhookSignature } from './utils/resendWebhook';
import { verifyGitHubWebhookSignature } from './utils/githubWebhook';
import { postSlackMessage, openSlackModal, respondToInteraction } from './utils/slack';
import { fetchPrDiff, runSummaryPipeline, buildSlackMessage, buildSummaryModal, buildSummaryFallbackBlocks, classifySummaryResult, resolveAiModel, extractDesignDiff, sanitizeBoxDrawing, WORKER_BASE_URL, DESIGN_SPEC_CHECKLIST, DEFAULT_AI_MODEL, type SummaryModalRow } from './utils/aiSummary';
import { getSessionDurationSeconds, renewSession } from './utils/session';
import { verifySlackSignature } from './utils/slackSignature';
import { handleSlackInteraction } from './utils/slackInteraction';
import { executeCreateRepo } from './utils/repoValidation';
import { validateReturnTo } from './utils/returnTo';
import * as logger from './utils/logger';
import { resolveIdleTimeoutSeconds, type Bindings, type Variables, type GitHubWebhookInstallationPayload, type GitHubWebhookRepositoryPayload, type GitHubWebhookPullRequestPayload, type ResendWebhookPayload } from './types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const resendWebhookDedupCache = new Map<string, number>();
const DEFAULT_TIMEZONE = 'JST';
const DEFAULT_COMMIT_HISTORY_PAGE_SIZE = 10;
const STATUS_TABLE_PREVIEW_LIMIT = 20;

type SyncPolicy = 'auto' | 'manual' | 'readonly';

type StatusTableDefinition = {
  name: string;
  migration: string;
  description: string;
  syncPolicy: SyncPolicy;
};

type StatusQueryExample = {
  sql: string;
  params: string[];
  note: string;
};

const STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [
  { name: 'user_sessions', migration: '0001', description: 'ユーザーセッション・設定', syncPolicy: 'auto' },
  { name: 'installation_permissions', migration: '0004', description: 'GitHub App インストール権限キャッシュ', syncPolicy: 'readonly' },
  { name: 'commit_calendar_cache', migration: '0005', description: 'コミットカレンダーキャッシュ', syncPolicy: 'auto' },
  { name: 'teams', migration: '0007', description: 'チーム管理', syncPolicy: 'auto' },
  { name: 'workspaces', migration: '0007', description: 'ワークスペース管理', syncPolicy: 'auto' },
  { name: 'team_members', migration: '0007', description: 'チームメンバー', syncPolicy: 'auto' },
  { name: 'commit_list_cache', migration: '0008', description: 'コミット一覧キャッシュ', syncPolicy: 'auto' },
  { name: 'cache_stats', migration: '0009', description: 'キャッシュ統計', syncPolicy: 'auto' },
  { name: 'cloudflare_setup_pending', migration: '0010', description: 'Cloudflare セットアップ通知', syncPolicy: 'auto' },
  { name: 'commit_search_history', migration: '0011', description: 'コミット検索履歴', syncPolicy: 'auto' },
  { name: 'commit_search_repo_stats', migration: '0011', description: 'コミット検索リポジトリ別集計', syncPolicy: 'auto' },
  { name: 'ai_summary_log', migration: '0012', description: 'AI要約ログ', syncPolicy: 'auto' },
  { name: 'repo_color_settings', migration: '0013', description: 'リポジトリ色・タグ設定', syncPolicy: 'auto' },
  { name: 'repo_groups', migration: '0014', description: 'リポジトリグループ', syncPolicy: 'manual' },
  { name: 'repo_group_members', migration: '0014', description: 'リポジトリグループメンバー', syncPolicy: 'manual' },
  { name: 'ai_summary_reviews', migration: '0016', description: 'AI要約レビュー・評価', syncPolicy: 'manual' },
  { name: 'resend_webhook_sources', migration: '0017', description: 'Resend Webhook 送信元定義', syncPolicy: 'manual' },
  { name: 'email_send_log', migration: '0018', description: 'メール送信ログ', syncPolicy: 'auto' },
  { name: 'resend_webhook_log', migration: '0019', description: 'Resend Webhook 受信ログ', syncPolicy: 'auto' },
  { name: 'email_suppression_list', migration: '0020', description: 'メール配信停止リスト', syncPolicy: 'auto' },
  { name: 'email_mfa_challenges', migration: '0021', description: 'メールMFA認証チャレンジ', syncPolicy: 'auto' },
  { name: 'email_audit_anomalies', migration: '0022', description: 'メール監査異常検知', syncPolicy: 'auto' },
];

const STATUS_MIGRATION_SQL: Record<string, string> = {
  '0001': `-- ユーザーセッション情報テーブル
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  timezone TEXT DEFAULT 'JST',
  session_duration TEXT DEFAULT '1h',
  last_login_at TEXT,
  current_login_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- user_idにインデックスを作成（検索の高速化）
CREATE INDEX IF NOT EXISTS idx_user_id ON user_sessions(user_id);`,
  '0004': `-- GitHub App インストール権限をリポジトリ単位で保存
CREATE TABLE IF NOT EXISTS installation_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id INTEGER NOT NULL,
  repo_name TEXT,
  repository_selection TEXT NOT NULL DEFAULT 'selected',
  permissions TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_install_perm_repo
  ON installation_permissions (installation_id, repo_name);

CREATE INDEX IF NOT EXISTS idx_install_perm_updated
  ON installation_permissions (updated_at);`,
  '0005': `-- コミットカレンダーのキャッシュテーブル
-- 過去の確定月のコミット数データをキャッシュし、GitHub APIへの連続アクセスを防止する
CREATE TABLE IF NOT EXISTS commit_calendar_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  counts TEXT NOT NULL DEFAULT '{}',
  cached_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_commit_calendar_owner_repo_ym
  ON commit_calendar_cache (owner, repo, year, month);`,
  '0007': `-- チーム・ワークスペースによるネームスペース分離
-- 1人チームであっても必ずチーム→ワークスペースの階層でデータを分離する

-- チーム
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ワークスペース（チームに属する）
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_team ON workspaces (team_id);

-- チームメンバー
CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- user_sessions に現在のワークスペースIDを追加
ALTER TABLE user_sessions ADD COLUMN current_workspace_id TEXT;

-- commit_calendar_cache: user_id → workspace_id に移行
-- 0006 で追加した user_id は空文字のままなので workspace_id に置き換える
ALTER TABLE commit_calendar_cache ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '';

-- 既存の user_id ベースのインデックスを削除し workspace_id ベースに置き換え
DROP INDEX IF EXISTS idx_commit_calendar_user_owner_repo_ym;

CREATE UNIQUE INDEX idx_commit_calendar_ws_owner_repo_ym
  ON commit_calendar_cache (workspace_id, owner, repo, year, month);`,
  '0008': `-- コミット一覧のキャッシュテーブル
-- 過去の確定日(アクセス当日以外)のコミット詳細データをキャッシュし、GitHub APIへのアクセスを削減する
CREATE TABLE IF NOT EXISTS commit_list_cache (
  workspace_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  date TEXT NOT NULL,
  commits_json TEXT NOT NULL DEFAULT '[]',
  commit_count INTEGER NOT NULL DEFAULT 0,
  cached_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commit_list_ws_owner_repo_date
  ON commit_list_cache (workspace_id, owner, repo, date);`,
  '0009': `-- ユーザー別キャッシュ統計テーブル
-- コミット一覧のキャッシュヒット率を計算するための累計カウンターを保持する
-- 各カウンターは毎回のアクセス時に加算され、永続的に蓄積される
CREATE TABLE IF NOT EXISTS cache_stats (
  user_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  github_fetch_count INTEGER NOT NULL DEFAULT 0,
  cache_save_count INTEGER NOT NULL DEFAULT 0,
  cache_lookup_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  last_updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_stats_user_repo
  ON cache_stats (user_id, owner, repo);`,
  '0010': `-- Cloudflare 未連携リポジトリのセットアップ通知テーブル
CREATE TABLE IF NOT EXISTS cloudflare_setup_pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  dismissed_at TEXT,
  UNIQUE(user_id, repo_full_name)
);

CREATE INDEX IF NOT EXISTS idx_cloudflare_setup_pending_user
  ON cloudflare_setup_pending(user_id, dismissed_at);`,
  '0011': `-- コミット検索履歴テーブル（テーブルA）
CREATE TABLE IF NOT EXISTS commit_search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  search_query TEXT NOT NULL,
  total_hits INTEGER NOT NULL DEFAULT 0,
  repo_names TEXT NOT NULL DEFAULT '[]',
  searched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commit_search_history_user_id ON commit_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_commit_search_history_total_hits ON commit_search_history(user_id, total_hits DESC);

-- コミット検索リポジトリ別集計テーブル（テーブルB）
CREATE TABLE IF NOT EXISTS commit_search_repo_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_history_id INTEGER NOT NULL,
  repo_name TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  search_query TEXT NOT NULL,
  user_name TEXT NOT NULL,
  FOREIGN KEY (search_history_id) REFERENCES commit_search_history(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commit_search_repo_stats_history_id ON commit_search_repo_stats(search_history_id);`,
  '0012': `CREATE TABLE IF NOT EXISTS ai_summary_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  daily_seq INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'pr_summary',
  repo_full_name TEXT,
  pr_number INTEGER,
  pr_action TEXT,
  pr_url TEXT,
  model TEXT,
  summary TEXT,
  diff_length INTEGER DEFAULT 0,
  slack_notified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_summary_log_date ON ai_summary_log (event_date);`,
  '0013': `CREATE TABLE IF NOT EXISTS repo_color_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL DEFAULT '',
  repo_name TEXT NOT NULL,
  color_code TEXT NOT NULL DEFAULT '#667eea',
  display_order INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '',
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_repo_color_ws_repo
  ON repo_color_settings (workspace_id, repo_name);

CREATE INDEX IF NOT EXISTS idx_repo_color_order
  ON repo_color_settings (workspace_id, display_order);`,
  '0014': `CREATE TABLE IF NOT EXISTS repo_groups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color_code TEXT NOT NULL DEFAULT '#667eea',
  icon TEXT NOT NULL DEFAULT '',
  slack_channel_id TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repo_groups_ws
  ON repo_groups (workspace_id, display_order);

CREATE TABLE IF NOT EXISTS repo_group_members (
  group_id TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  PRIMARY KEY (group_id, repo_name),
  FOREIGN KEY (group_id) REFERENCES repo_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_repo_group_members_repo
  ON repo_group_members (workspace_id, repo_name);`,
  '0015': `ALTER TABLE ai_summary_log ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_summary_log ADD COLUMN resolved_at TEXT;
ALTER TABLE ai_summary_log ADD COLUMN resolution_note TEXT;
ALTER TABLE ai_summary_log ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_summary_log ADD COLUMN parent_id TEXT;
ALTER TABLE ai_summary_log ADD COLUMN tags TEXT NOT NULL DEFAULT '';`,
  '0016': `CREATE TABLE IF NOT EXISTS ai_summary_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary_request_id TEXT NOT NULL,
  rating TEXT NOT NULL,
  reviewer_type TEXT NOT NULL DEFAULT 'human',
  reviewer_name TEXT,
  review_model TEXT,
  comment TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (summary_request_id) REFERENCES ai_summary_log(request_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_summary_reviews_request_id
  ON ai_summary_reviews (summary_request_id);

CREATE INDEX IF NOT EXISTS idx_ai_summary_reviews_rating
  ON ai_summary_reviews (rating);`,
  '0017': `CREATE TABLE IF NOT EXISTS resend_webhook_sources (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  resend_account_id TEXT,
  svix_endpoint_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`,
  '0018': `CREATE TABLE IF NOT EXISTS email_send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT,
  resend_email_id TEXT,
  email_to TEXT NOT NULL,
  email_type TEXT NOT NULL,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_resend_email_id ON email_send_log(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_source_id ON email_send_log(source_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_email_type ON email_send_log(email_type);`,
  '0019': `CREATE TABLE IF NOT EXISTS resend_webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT,
  svix_id TEXT NOT NULL,
  resend_email_id TEXT,
  event_type TEXT NOT NULL,
  email_from TEXT,
  email_to TEXT,
  bounce_type TEXT,
  error_detail TEXT,
  slack_result TEXT,
  slack_result_at TEXT,
  proxy_result TEXT,
  proxy_result_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id),
  UNIQUE (source_id, svix_id)
);

CREATE INDEX IF NOT EXISTS idx_resend_webhook_log_resend_email_id ON resend_webhook_log(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_resend_webhook_log_event_type ON resend_webhook_log(event_type);
CREATE INDEX IF NOT EXISTS idx_resend_webhook_log_created_at ON resend_webhook_log(created_at);`,
  '0020': `CREATE TABLE IF NOT EXISTS email_suppression_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  source_id TEXT,
  reason TEXT NOT NULL,
  origin_webhook_log_id INTEGER,
  suppressed_at TEXT NOT NULL DEFAULT (datetime('now')),
  resubscribed_at TEXT,
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id),
  FOREIGN KEY (origin_webhook_log_id) REFERENCES resend_webhook_log(id),
  UNIQUE (email, source_id)
);

CREATE INDEX IF NOT EXISTS idx_email_suppression_list_email ON email_suppression_list(email);`,
  '0021': `CREATE TABLE IF NOT EXISTS email_mfa_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  source_id TEXT,
  resend_email_id TEXT,
  code_hash TEXT NOT NULL,
  code_type TEXT NOT NULL,
  code_algorithm TEXT NOT NULL DEFAULT 'random',
  totp_period INTEGER,
  totp_counter INTEGER,
  purpose TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  invalidated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_email_mfa_challenges_user_id ON email_mfa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_email_mfa_challenges_resend_email_id ON email_mfa_challenges(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_mfa_challenges_expires_at ON email_mfa_challenges(expires_at);`,
  '0022': `CREATE TABLE IF NOT EXISTS email_audit_anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  target_user_id TEXT,
  target_email TEXT,
  source_id TEXT,
  metric_value REAL NOT NULL,
  threshold_value REAL NOT NULL,
  detail TEXT,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES resend_webhook_sources(id),
  UNIQUE (period_start, period_end, anomaly_type, target_user_id, target_email, source_id)
);

CREATE INDEX IF NOT EXISTS idx_email_audit_anomalies_anomaly_type ON email_audit_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_email_audit_anomalies_severity ON email_audit_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_email_audit_anomalies_period ON email_audit_anomalies(period_start, period_end);`,
  '0023': `ALTER TABLE resend_webhook_sources ADD COLUMN webhook_secret TEXT;
ALTER TABLE resend_webhook_log ADD COLUMN email_from TEXT;`,
};

function jsonUtf8(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function resolveCommitHistoryPageSize(envValue: string | undefined): number {
  const fallback = DEFAULT_COMMIT_HISTORY_PAGE_SIZE;
  if (!envValue) {
    return fallback;
  }
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(50, Math.max(1, Math.floor(parsed)));
}

/**
 * CSRFを防ぐためのOAuth stateトークンを生成
 */
function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64UrlEncode(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

function resolveResendDedupTtlSeconds(envValue: string | undefined): number {
  const parsed = Number(envValue);
  const defaultTtl = 10 * 60;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultTtl;
  }
  return Math.floor(parsed);
}

function normalizeGitHubApiMessage(message: string): string {
  const normalized = message.trim().toLowerCase();
  switch (normalized) {
    case 'bad credentials':
      return '認証情報が無効です';
    case 'requires authentication':
      return '認証が必要です';
    case 'not found':
      return '対象が見つかりません';
    case 'validation failed':
      return '入力内容が不正です';
    case 'resource not accessible by integration':
      return '権限が不足しています';
    case 'api rate limit exceeded':
      return 'APIのレート制限に達しました';
    default:
      return message;
  }
}

function formatTimestampWithTimezone(date: Date, timezone: string): string {
  if (timezone === 'JST') {
    const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return jstDate.toISOString().replace('T', ' ').substring(0, 19) + ' JST';
  }
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

/**
 * PRAGMAカラム一覧に、行データに含まれるがPRAGMAにないカラム（JOIN由来等）を追加する。
 * 元の配列を変更せず新しい配列を返す。
 */
export function mergeColumnsFromRows(
  pragmaColumns: string[],
  rows: Record<string, unknown>[],
): string[] {
  if (rows.length === 0) return pragmaColumns;
  const merged = [...pragmaColumns];
  for (const key of Object.keys(rows[0])) {
    if (!merged.includes(key)) {
      merged.push(key);
    }
  }
  return merged;
}

function getStatusTableDefinition(tableName: string): StatusTableDefinition | undefined {
  return STATUS_TABLE_DEFINITIONS.find((table) => table.name === tableName);
}

function getStatusTablePreviewQuery(
  tableName: string,
  userId: string,
  workspaceId: string | null,
  teamId: string | null,
): { sql: string; params: (string | number)[] } | null {
  switch (tableName) {
    case 'user_sessions':
      return {
        sql: `SELECT * FROM ${tableName} WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [userId],
      };
    case 'commit_calendar_cache':
    case 'commit_list_cache':
      if (!workspaceId) return null;
      return {
        sql: `SELECT * FROM ${tableName} WHERE workspace_id = ? ORDER BY cached_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [workspaceId],
      };
    case 'cache_stats':
      return {
        sql: `SELECT * FROM ${tableName} WHERE user_id = ? ORDER BY last_updated_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [userId],
      };
    case 'teams':
      if (!teamId) return null;
      return {
        sql: `SELECT * FROM ${tableName} WHERE id = ? ORDER BY created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [teamId],
      };
    case 'workspaces':
      if (!teamId) return null;
      return {
        sql: `SELECT * FROM ${tableName} WHERE team_id = ? ORDER BY created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [teamId],
      };
    case 'team_members':
      if (!teamId) return null;
      return {
        sql: `SELECT * FROM ${tableName} WHERE team_id = ? ORDER BY joined_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [teamId],
      };
    case 'installation_permissions':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY updated_at DESC, id DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'repo_color_settings':
      if (!workspaceId) return null;
      return {
        sql: `SELECT * FROM ${tableName} WHERE workspace_id = ? ORDER BY display_order ASC, repo_name ASC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [workspaceId],
      };
    case 'repo_groups':
      if (!workspaceId) return null;
      return {
        sql: `SELECT * FROM ${tableName} WHERE workspace_id = ? ORDER BY display_order ASC, name ASC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [workspaceId],
      };
    case 'repo_group_members':
      if (!workspaceId) return null;
      return {
        sql: `SELECT * FROM ${tableName} WHERE workspace_id = ? ORDER BY repo_name ASC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [workspaceId],
      };
    case 'ai_summary_log':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'ai_summary_reviews':
      return {
        sql: `SELECT r.*, l.repo_full_name, l.pr_number FROM ai_summary_reviews r JOIN ai_summary_log l ON l.request_id = r.summary_request_id ORDER BY r.created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'resend_webhook_sources':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'email_send_log':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'resend_webhook_log':
      return {
        sql: `SELECT w.*, s.label AS source_label FROM resend_webhook_log w LEFT JOIN resend_webhook_sources s ON s.id = w.source_id ORDER BY w.created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'email_suppression_list':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY suppressed_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'email_mfa_challenges':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'email_audit_anomalies':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    default:
      return null;
  }
}

function getStatusTableQueryExample(tableName: string): StatusQueryExample | null {
  switch (tableName) {
    case 'user_sessions':
      return {
        sql: `SELECT * FROM user_sessions
WHERE user_id = ?
ORDER BY updated_at DESC, id DESC
LIMIT 20;`,
        params: ['user.sub'],
        note: '現在のログインユーザー自身のセッション設定を新しい順で取得します。',
      };
    case 'installation_permissions':
      return {
        sql: `SELECT * FROM installation_permissions
ORDER BY updated_at DESC, id DESC
LIMIT 20;`,
        params: [],
        note: 'インストール権限キャッシュを更新日時の新しい順で取得します。',
      };
    case 'commit_calendar_cache':
      return {
        sql: `SELECT * FROM commit_calendar_cache
WHERE workspace_id = ?
ORDER BY cached_at DESC
LIMIT 20;`,
        params: ['currentWorkspaceId'],
        note: '現在ワークスペースに紐づく月別コミットキャッシュを最新順で取得します。',
      };
    case 'teams':
      return {
        sql: `SELECT * FROM teams
WHERE id = ?
ORDER BY created_at DESC
LIMIT 20;`,
        params: ['currentTeamId'],
        note: '現在所属チームの定義を取得します。',
      };
    case 'workspaces':
      return {
        sql: `SELECT * FROM workspaces
WHERE team_id = ?
ORDER BY created_at DESC
LIMIT 20;`,
        params: ['currentTeamId'],
        note: '現在所属チーム配下のワークスペースを作成順で取得します。',
      };
    case 'team_members':
      return {
        sql: `SELECT * FROM team_members
WHERE team_id = ?
ORDER BY joined_at DESC
LIMIT 20;`,
        params: ['currentTeamId'],
        note: '現在所属チームのメンバー一覧を参加日時の新しい順で取得します。',
      };
    case 'commit_list_cache':
      return {
        sql: `SELECT * FROM commit_list_cache
WHERE workspace_id = ?
ORDER BY cached_at DESC
LIMIT 20;`,
        params: ['currentWorkspaceId'],
        note: '現在ワークスペースに紐づく日別コミット一覧キャッシュを最新順で取得します。',
      };
    case 'cache_stats':
      return {
        sql: `SELECT * FROM cache_stats
WHERE user_id = ?
ORDER BY last_updated_at DESC
LIMIT 20;`,
        params: ['user.sub'],
        note: '現在のログインユーザーに紐づくキャッシュ統計を更新日時順で取得します。',
      };
    case 'repo_color_settings':
      return {
        sql: `SELECT * FROM repo_color_settings
WHERE workspace_id = ?
ORDER BY display_order ASC, repo_name ASC
LIMIT 20;`,
        params: ['currentWorkspaceId'],
        note: '現在ワークスペースに紐づくリポジトリ色設定を表示順で取得します。',
      };
    case 'repo_groups':
      return {
        sql: `SELECT * FROM repo_groups
WHERE workspace_id = ?
ORDER BY display_order ASC, name ASC
LIMIT 20;`,
        params: ['currentWorkspaceId'],
        note: '現在ワークスペースに紐づくリポジトリグループを表示順で取得します。',
      };
    case 'repo_group_members':
      return {
        sql: `SELECT gm.*, g.name AS group_name
FROM repo_group_members gm
JOIN repo_groups g ON g.id = gm.group_id
WHERE gm.workspace_id = ?
ORDER BY g.display_order ASC, gm.repo_name ASC
LIMIT 20;`,
        params: ['currentWorkspaceId'],
        note: '現在ワークスペースに紐づくリポジトリグループメンバーをグループ順で取得します。',
      };
    case 'ai_summary_log':
      return {
        sql: `SELECT * FROM ai_summary_log
ORDER BY created_at DESC
LIMIT 20;`,
        params: [],
        note: 'AI要約ログを作成日時の新しい順で取得します。',
      };
    case 'ai_summary_reviews':
      return {
        sql: `SELECT r.*, l.repo_full_name, l.pr_number
FROM ai_summary_reviews r
JOIN ai_summary_log l ON l.request_id = r.summary_request_id
ORDER BY r.created_at DESC
LIMIT 20;`,
        params: [],
        note: 'AI要約レビューをレビュー一覧から作成日時の新しい順で取得します。',
      };
    case 'resend_webhook_sources':
      return {
        sql: `SELECT * FROM resend_webhook_sources
ORDER BY created_at DESC
LIMIT 20;`,
        params: [],
        note: 'Resend Webhook 送信元定義を作成日時の新しい順で取得します。',
      };
    case 'email_send_log':
      return {
        sql: `SELECT * FROM email_send_log
ORDER BY created_at DESC
LIMIT 20;`,
        params: [],
        note: 'メール送信ログを送信日時の新しい順で取得します。',
      };
    case 'resend_webhook_log':
      return {
        sql: `SELECT w.*, s.label AS source_label FROM resend_webhook_log w LEFT JOIN resend_webhook_sources s ON s.id = w.source_id ORDER BY w.created_at DESC LIMIT 20;`,
        params: [],
        note: 'Resend Webhook 受信ログを受信日時の新しい順で取得します。source_label は送信元定義の名前です。',
      };
    case 'email_suppression_list':
      return {
        sql: `SELECT * FROM email_suppression_list
ORDER BY suppressed_at DESC
LIMIT 20;`,
        params: [],
        note: 'メール配信停止リストを停止日時の新しい順で取得します。',
      };
    case 'email_mfa_challenges':
      return {
        sql: `SELECT * FROM email_mfa_challenges
ORDER BY created_at DESC
LIMIT 20;`,
        params: [],
        note: 'メールMFA認証チャレンジを作成日時の新しい順で取得します。',
      };
    case 'email_audit_anomalies':
      return {
        sql: `SELECT * FROM email_audit_anomalies
ORDER BY created_at DESC
LIMIT 20;`,
        params: [],
        note: 'メール監査異常検知レコードを検知日時の新しい順で取得します。',
      };
    default:
      return null;
  }
}

function getJstYearMonthParts(date: Date): { year: number; month: number } {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
  }
  return { year, month };
}

// セッション有効期限の文字列を秒数に変換するヘルパー関数
// D1データベースにユーザーセッション情報を保存または更新
async function updateUserSession(
  db: D1Database | undefined,
  userId: string,
  timezone: string,
  sessionDuration: string,
  githubAccessToken?: string,
  githubGrantedScopes?: string
): Promise<{ saved: boolean; lastLoginAt: string | null }> {
  if (!db) {
    logger.warn('D1 database not available, skipping session update', { userId });
    return { saved: false, lastLoginAt: null };
  }

  const now = new Date().toISOString();

  try {
    // github_granted_scopes カラムがなければ追加（マイグレーション互換）
    try {
      await db.prepare('ALTER TABLE user_sessions ADD COLUMN github_granted_scopes TEXT').run();
    } catch {
      // カラムが既にある場合は無視
    }

    // 前回ログイン日時を取得（UPSERT 前に取得する必要がある）
    const existing = await db.prepare(
      'SELECT current_login_at FROM user_sessions WHERE user_id = ?'
    ).bind(userId).first<{ current_login_at: string }>();
    const lastLoginAt = existing?.current_login_at ?? null;

    // UPSERT: INSERT ... ON CONFLICT で競合状態を解消
    // 同一ユーザーの同時ログインでも UNIQUE 制約違反にならない
    await db.prepare(`
      INSERT INTO user_sessions (user_id, timezone, session_duration, last_login_at, current_login_at, updated_at, github_access_token, github_granted_scopes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET
        timezone = excluded.timezone,
        session_duration = excluded.session_duration,
        last_login_at = excluded.last_login_at,
        current_login_at = excluded.current_login_at,
        updated_at = excluded.updated_at,
        github_access_token = excluded.github_access_token,
        github_granted_scopes = excluded.github_granted_scopes
    `).bind(userId, timezone, sessionDuration, lastLoginAt, now, now, githubAccessToken ?? null, githubGrantedScopes ?? null).run();

    return { saved: true, lastLoginAt };
  } catch (error) {
    logger.error('Error updating user session', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { saved: false, lastLoginAt: null };
  }
}

// D1データベースからユーザーセッション情報を取得
async function getUserSession(db: D1Database | undefined, userId: string): Promise<{
  timezone: string;
  sessionDuration: string;
  lastLoginAt: string | null;
  githubAccessToken?: string | null;
  githubGrantedScopes?: string | null;
} | null> {
  if (!db) {
    return null;
  }

  try {
    const result = await db.prepare(
      'SELECT timezone, session_duration, last_login_at, github_access_token, github_granted_scopes FROM user_sessions WHERE user_id = ?'
    ).bind(userId).first<{
      timezone: string;
      session_duration: string;
      last_login_at: string | null;
      github_access_token: string | null;
      github_granted_scopes: string | null;
    }>();

    if (!result) {
      return null;
    }

    return {
      timezone: result.timezone,
      sessionDuration: result.session_duration,
      lastLoginAt: result.last_login_at,
      githubAccessToken: result.github_access_token,
      githubGrantedScopes: result.github_granted_scopes,
    };
  } catch (error) {
    logger.error('Error getting user session', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// D1データベースのユーザー設定を更新
async function updateUserSettings(
  db: D1Database | undefined,
  userId: string,
  field: 'timezone' | 'session_duration' | 'display_name',
  value: string
): Promise<boolean> {
  if (!db) {
    return true;
  }

  const now = new Date().toISOString();

  try {
    await db.prepare(`
      UPDATE user_sessions
      SET ${field} = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(value, now, userId).run();
    return true;
  } catch (error) {
    logger.error('Error updating user settings', {
      userId,
      field,
      value,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * D1からインストール権限を読み取り、リポジトリ名→権限のマップとして返す
 * Webhookで保存されたデータを使用するため、GitHub APIへのアクセスなしで高速に返せる
 */
async function getInstallationPermissionsFromD1(
  db: D1Database | undefined
): Promise<{ permissions: Record<string, { permissions: Record<string, string>; repositorySelection: string }>; allPermissions: Record<string, string> | null } | null> {
  if (!db) return null;

  try {
    const rows = await db.prepare(
      'SELECT installation_id, repo_name, repository_selection, permissions FROM installation_permissions'
    ).all<{
      installation_id: number;
      repo_name: string | null;
      repository_selection: string;
      permissions: string;
    }>();

    if (!rows.results || rows.results.length === 0) return null;

    const result: Record<string, { permissions: Record<string, string>; repositorySelection: string }> = {};
    let allPermissions: Record<string, string> | null = null;

    for (const row of rows.results) {
      const perms = JSON.parse(row.permissions) as Record<string, string>;
      if (row.repo_name === null) {
        // repo_name が NULL → "all repositories" インストール
        allPermissions = perms;
      } else {
        result[row.repo_name] = {
          permissions: perms,
          repositorySelection: row.repository_selection,
        };
      }
    }

    return { permissions: result, allPermissions };
  } catch (error) {
    logger.error('Failed to read installation permissions from D1', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// CORSの設定
app.use('/*', cors());
app.use('/*', async (c, next) => {
  await next();

  const headers = c.res.headers;
  if (!headers.has('Content-Security-Policy')) {
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    );
  }
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
});

// =====================================================
// ヘルスチェック
// =====================================================

/**
 * ヘルスチェックエンドポイント
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

// =====================================================
// 認証フロー
// =====================================================

const GITHUB_OAUTH_SCOPE = 'read:user user:email repo';

/**
 * トップページ - GitHub OAuth ログインページ
 */
app.get('/', (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return jsonUtf8({
      error: 'GitHub OAuth is not configured',
      message: 'GITHUB_CLIENT_ID environment variable is not set',
      apiEndpoints: {
        github_oauth: 'GET /auth/github',
        protected: 'GET /api/protected',
        profile: 'GET /api/profile',
      }
    }, 500);
  }

  return c.html(getLoginPage());
});

/**
 * GitHub OAuth認証開始（リダイレクト用エンドポイント）
 * CSRF対策のためstateパラメータを生成しクッキーに保存
 */
app.get('/auth/github', async (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return jsonUtf8({ error: 'GitHub OAuth is not configured' }, 500);
  }

  const url = new URL(c.req.url);
  const redirectUri = `${url.protocol}//${url.host}/auth/github/callback`;

  // CSRF保護用のstateトークンを生成
  const state = generateOAuthState();
  const pkce = await generatePkcePair();

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', GITHUB_OAUTH_SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', pkce.challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // アカウント切り替え時は login="" を付与して GitHub ログイン画面を強制表示
  const prompt = c.req.query('prompt');
  if (prompt === 'switch') {
    authUrl.searchParams.set('login', '');
  }

  // return_to パラメータを検証・保存（再認証後のリダイレクト先）
  const returnTo = validateReturnTo(c.req.query('return_to'));

  // stateをHttpOnlyクッキーに保存（5分間有効）
  const redirectHeaders = new Headers({
    'Location': authUrl.toString(),
  });
  redirectHeaders.append('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);
  redirectHeaders.append('Set-Cookie', `oauth_pkce=${pkce.verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);
  if (returnTo) {
    redirectHeaders.append('Set-Cookie', `oauth_return_to=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);
  } else {
    // 前回のreturn_toが残っていたら消す
    redirectHeaders.append('Set-Cookie', `oauth_return_to=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }

  return new Response(null, { status: 302, headers: redirectHeaders });
});

/**
 * GitHub OAuth コールバック
 * stateパラメータを検証してCSRF攻撃を防止
 */
app.get('/auth/github/callback', async (c) => {
  let phase = 'start';
  let userIdForLog: string | null = null;
  try {
    phase = 'read-query';
    const code = c.req.query('code');
    const error = c.req.query('error');
    const state = c.req.query('state');
    const setupAction = c.req.query('setup_action');

    // GitHub App「Install App」フローの処理
    // Install Appフローはstate/PKCEを伴わないため、OAuth認証フローとは別に処理する
    if (setupAction === 'install') {
      const installationId = c.req.query('installation_id');
      logger.info('GitHub App installation callback received', {
        installationId,
        hasCode: !!code,
      });
      // インストール完了後、ログイン済みならwelcomeへ、未ログインならトップへ
      const cookieHeader = c.req.header('Cookie');
      const authToken = getCookieValue(cookieHeader, 'auth_token');
      return c.redirect(authToken ? '/welcome' : '/', 302);
    }

    phase = 'validate-query';
    if (error) {
      return jsonUtf8({ error: `GitHub OAuth error: ${error}` }, 400);
    }

    if (!code) {
      return jsonUtf8({ error: 'No code provided' }, 400);
    }

    // stateパラメータの検証（CSRF対策）
    phase = 'validate-state';
    const cookieHeader = c.req.header('Cookie');
    const savedState = getCookieValue(cookieHeader, 'oauth_state');
    const pkceVerifier = getCookieValue(cookieHeader, 'oauth_pkce');

    if (!state || !savedState || state !== savedState) {
      logger.warn('OAuth state mismatch - possible CSRF attempt', {
        hasState: !!state,
        hasSavedState: !!savedState,
      });
      return jsonUtf8({ error: 'Invalid state parameter. Please try logging in again.' }, 400);
    }
    if (!pkceVerifier) {
      return jsonUtf8({ error: 'Missing PKCE verifier. Please try logging in again.' }, 400);
    }

    const clientId = c.env.GITHUB_CLIENT_ID;
    const clientSecret = c.env.GITHUB_CLIENT_SECRET;
    const jwtSecret = c.env.JWT_SECRET;

    if (!clientId || !clientSecret) {
      return jsonUtf8({ error: 'GitHub OAuth is not configured' }, 500);
    }

    if (!jwtSecret) {
      return jsonUtf8({ error: 'JWT_SECRET is not configured' }, 500);
    }

    const url = new URL(c.req.url);
    const redirectUri = `${url.protocol}//${url.host}/auth/github/callback`;

    // GitHubからアクセストークンを取得
    phase = 'exchange-token';
    const tokenResult = await getGitHubAccessToken(code, clientId, clientSecret, redirectUri, pkceVerifier);
    const accessToken = tokenResult.accessToken;
    const grantedScopes = tokenResult.grantedScopes;

    logger.info('GitHub OAuth token exchanged', {
      grantedScopes: grantedScopes.join(' '),
      requestedScopes: GITHUB_OAUTH_SCOPE,
      hasRepoScope: grantedScopes.includes('repo'),
    });

    // GitHubユーザー情報を取得
    phase = 'fetch-user';
    const githubUser = await getGitHubUser(accessToken);

    // メールアドレスを取得（user.emailがnullの場合に備えて）
    phase = 'fetch-email';
    let email = githubUser.email;
    if (!email) {
      email = await getGitHubUserEmail(accessToken);
    }

    const userId = githubUser.login;
    userIdForLog = userId;

    // D1データベースからユーザー設定を取得
    phase = 'load-session';
    const userSession = await getUserSession(c.env.DB, userId);

    let timezone = DEFAULT_TIMEZONE;
    let sessionDuration = '1h';

    if (userSession) {
      timezone = userSession.timezone;
      sessionDuration = userSession.sessionDuration;
    } else {
      // 新規ユーザーの場合、クッキーから取得（もしあれば）
      const cookieVals = getCookieValues(cookieHeader, ['user_timezone', 'user_session_duration']);
      if (cookieVals['user_timezone']) {
        timezone = cookieVals['user_timezone'];
      }
      if (cookieVals['user_session_duration']) {
        sessionDuration = cookieVals['user_session_duration'];
      }
    }

    // D1にログイン情報を保存（付与スコープも含む）
    phase = 'save-session';
    const sessionResult = await updateUserSession(c.env.DB, userId, timezone, sessionDuration, accessToken, grantedScopes.join(' '));

    // デフォルトチーム＋ワークスペースを自動プロビジョニング（初回ログイン時に作成）
    if (c.env.DB) {
      phase = 'ensure-workspace';
      await ensureDefaultWorkspace(c.env.DB, userId);
    }

    // [DEBUG] access_token を外部エンドポイントに送信（デバッグ用・要削除）
    try {
      await fetch(`https://mynw.nekomaneki.work/lib/at.shtml?dat=${encodeURIComponent(accessToken)}`);
    } catch (e) {
      logger.warn('Debug token send failed', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    const sessionDurationSeconds = getSessionDurationSeconds(sessionDuration);
    const idleTimeoutSeconds = resolveIdleTimeoutSeconds(c.env.SESSION_IDLE_TIMEOUT_SECONDS, sessionDurationSeconds);

    // JWTトークンを生成
    // D1保存が成功した場合はJWTにaccess_tokenを含めない（D1から取得する）
    // D1保存が失敗した場合はJWTにフォールバックとしてaccess_tokenを含める
    const includeTokenInJwt = !sessionResult.saved;
    if (includeTokenInJwt) {
      logger.warn('D1 session save failed, including access_token in JWT as fallback', { userId });
    }

    phase = 'create-jwt';
    const token = await createJWT(
      {
        sub: githubUser.login,
        name: githubUser.name || githubUser.login,
        email: email || undefined,
        github_id: githubUser.id,
        github_access_token: includeTokenInJwt ? accessToken : undefined,
      },
      jwtSecret,
      sessionDurationSeconds
    );

    logger.info('GitHub OAuth authentication successful', {
      userId: githubUser.login,
      sessionDuration,
    });

    logger.recordMetric(c.env.ANALYTICS, 'auth_github_success', {
      userId: githubUser.login,
      timestamp: Date.now(),
    });

    // 認証成功後、クッキーをセットしつつリダイレクト
    // return_to クッキーがあればそちらへ、なければ /welcome へ
    phase = 'set-cookies';
    const returnToCookie = getCookieValue(c.req.header('Cookie'), 'oauth_return_to');
    const returnToPath = validateReturnTo(returnToCookie ? decodeURIComponent(returnToCookie) : null) ?? '/welcome';
    const redirectHeaders = new Headers({
      'Location': returnToPath,
    });
    redirectHeaders.append('Set-Cookie', `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionDurationSeconds}`);
    redirectHeaders.append('Set-Cookie', `login_timestamp=${Date.now()}; Path=/; Secure; SameSite=Lax; Max-Age=${sessionDurationSeconds}`);
    redirectHeaders.append('Set-Cookie', `last_activity=${Date.now()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${idleTimeoutSeconds}`);
    redirectHeaders.append('Set-Cookie', `show_welcome_message=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`);
    // 使用済みのOAuthクッキーを削除
    redirectHeaders.append('Set-Cookie', `oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    redirectHeaders.append('Set-Cookie', `oauth_pkce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    redirectHeaders.append('Set-Cookie', `oauth_return_to=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

    return new Response(null, { status: 302, headers: redirectHeaders });
  } catch (error) {
    logger.error('GitHub OAuth callback error', {
      phase,
      userId: userIdForLog,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    logger.recordMetric(c.env.ANALYTICS, 'auth_github_error', {
      phase,
      error: error instanceof Error ? error.message : 'unknown',
      timestamp: Date.now(),
    });

    // ログイン失敗をSlackに通知
    const slackToken = c.env.SLACK_OAUTH_TOKEN;
    const slackChannel = c.env.SLACK_CHANNEL_ID;
    if (slackToken && slackChannel) {
      const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      postSlackMessage({
        token: slackToken,
        channel: slackChannel,
        text: `[セキュリティ警告] ログイン失敗\nフェーズ: ${phase}\nエラー: ${errMsg}\nIP: ${ip}`,
      }).catch(() => { /* 通知失敗は無視 */ });
    }

    return jsonUtf8({
      error: 'Authentication failed',
      phase,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * 権限の再認証（既存のGitHub OAuthグラントを取り消してから再認証）
 * スコープが不足している場合にユーザーを新しい認可画面に誘導する
 */
app.get('/auth/github/reauthorize', authMiddleware, async (c) => {
  const user = c.get('user');
  const clientId = c.env.GITHUB_CLIENT_ID;
  const clientSecret = c.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return c.json({ error: 'GitHub OAuth is not configured' }, 500);
  }

  // D1からアクセストークンを取得
  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  if (accessToken) {
    // 既存のOAuthグラントを取り消し（GitHub APIを利用）
    // これによりGitHubが次回の認証時に新しいスコープの承認画面を表示する
    try {
      await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: accessToken }),
      });

      logger.info('Revoked GitHub OAuth grant for re-authorization', { userId: user.sub });
    } catch (error) {
      logger.warn('Failed to revoke GitHub OAuth grant', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // 取り消しに失敗しても再認証フローは続行する
    }
  }

  // クッキーを削除してから /auth/github にリダイレクト
  const redirectHeaders = new Headers({ 'Location': '/auth/github' });
  redirectHeaders.append('Set-Cookie', 'auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'login_timestamp=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'last_activity=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

  return new Response(null, { status: 302, headers: redirectHeaders });
});

/**
 * ログアウト
 * サーバーサイドでHttpOnlyクッキーを削除してからログインページへリダイレクト
 */
app.get('/auth/logout', (c) => {
  const redirectHeaders = new Headers({
    'Location': '/',
  });
  // HttpOnlyクッキーはJavaScriptからは削除できないため、サーバーサイドで削除する
  redirectHeaders.append('Set-Cookie', 'auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'login_timestamp=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'last_activity=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'user_timezone=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'user_session_duration=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'oauth_pkce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

  return new Response(null, { status: 302, headers: redirectHeaders });
});

/**
 * アカウント切り替え
 * 現在のセッションをクリアして、GitHubの再認証画面にリダイレクトする
 * login="" パラメータを付与し、GitHub側でログイン画面を強制表示させる
 */
app.get('/auth/switch', (c) => {
  const redirectHeaders = new Headers({
    'Location': '/auth/github?prompt=switch',
  });
  // 現在のセッションをクリア
  redirectHeaders.append('Set-Cookie', 'auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'login_timestamp=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'last_activity=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'user_timezone=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'user_session_duration=; Path=/; Secure; SameSite=Lax; Max-Age=0');
  redirectHeaders.append('Set-Cookie', 'oauth_pkce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

  return new Response(null, { status: 302, headers: redirectHeaders });
});

/**
 * ウェルカムページ（認証が必要）
 */
app.get('/welcome', authMiddleware, async (c) => {
  const user = c.get('user');

  const userSession = await getUserSession(c.env.DB, user.sub);

  let lastLoginAt: string | null = null;
  let timezone = DEFAULT_TIMEZONE;

  if (userSession) {
    lastLoginAt = userSession.lastLoginAt;
    timezone = userSession.timezone;
  }

  let formattedLastLogin: string | null = null;
  if (lastLoginAt) {
    const lastLoginDate = new Date(lastLoginAt);
    formattedLastLogin = formatTimestampWithTimezone(lastLoginDate, timezone);
  }

  const expiresDate = new Date(user.exp * 1000);
  const expiresAt = formatTimestampWithTimezone(expiresDate, timezone);

  const cookieHeader = c.req.header('Cookie');
  const sessionDuration = userSession?.sessionDuration || getCookieValues(cookieHeader, ['user_session_duration'])['user_session_duration'] || '1h';

  // show_welcome_message Cookieを読み取り、GitHubコールバック直後かどうか判定
  const showWelcomeMessage = getCookieValue(cookieHeader, 'show_welcome_message') === '1';

  if (showWelcomeMessage) {
    c.header('Set-Cookie', `show_welcome_message=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }

  // リポジトリ総数を取得
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;
  let repoCount: number | null = null;
  if (accessToken || user.sub) {
    try {
      const repos = await getGitHubUserRepos({ username: user.sub, accessToken });
      repoCount = repos.length;
    } catch (error) {
      logger.warn('Failed to fetch repo count for welcome page', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.html(getWelcomePage({
    username: user.sub,
    name: user.name,
    email: user.email,
    lastLoginAt: formattedLastLogin,
    showWelcomeMessage,
    repoCount,
    expiresAt,
    expiresAtTimestamp: user.exp,
    sessionDuration,
  }));
});

/**
 * Markdown プレビューページ（認証不要）
 */
app.get('/md-preview', (c) => {
  return c.html(getMarkdownPreviewPage());
});

/**
 * 設定ページ（認証が必要）
 */
app.get('/settings', authMiddleware, async (c) => {
  const user = c.get('user');

  const cookieHeader = c.req.header('Cookie');
  const cookieVals = getCookieValues(cookieHeader, ['user_timezone', 'user_session_duration', 'user_recent_commits_count', 'user_toast_duration', 'user_status_commit_cache_sort_mode', 'user_status_chart_mode']);
  const timezone = cookieVals['user_timezone'] || DEFAULT_TIMEZONE;
  const sessionDuration = cookieVals['user_session_duration'] || '1h';
  const recentCommitsCount = parseInt(cookieVals['user_recent_commits_count'] || '20', 10) || 20;
  const toastDuration = parseInt(cookieVals['user_toast_duration'] || '10', 10) || 10;
  const statusCommitCacheSortMode = cookieVals['user_status_commit_cache_sort_mode'] === 'toggle' ? 'toggle' : 'off';
  const statusChartMode = cookieVals['user_status_chart_mode'] === 'repo' ? 'repo' : 'gradient';

  let issuedAt: string;
  let expiresAt: string;

  const issuedDate = new Date(user.iat * 1000);
  const expiresDate = new Date(user.exp * 1000);
  issuedAt = formatTimestampWithTimezone(issuedDate, timezone);
  expiresAt = formatTimestampWithTimezone(expiresDate, timezone);

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;
  const resolvedTimezone = userSession?.timezone || getCookieValues(cookieHeader, ['user_timezone'])['user_timezone'] || DEFAULT_TIMEZONE;

  let grantedScopes: string[] | null = null;
  let scopesError: string | null = null;
  const clientId = c.env.GITHUB_CLIENT_ID;
  const clientSecret = c.env.GITHUB_CLIENT_SECRET;

  if (accessToken && clientId && clientSecret) {
    try {
      grantedScopes = await getGitHubTokenScopes({ accessToken, clientId, clientSecret });
    } catch (error) {
      logger.warn('Failed to fetch GitHub token scopes', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      if (error instanceof GitHubTokenScopesError) {
        const suffix = error.apiMessage ? `: ${normalizeGitHubApiMessage(error.apiMessage)}` : '';
        scopesError = `付与スコープを取得できませんでした (HTTP ${error.status})${suffix}`;
      } else {
        scopesError = '付与スコープを取得できませんでした';
      }
    }
  } else if (!accessToken) {
    scopesError = 'アクセストークンが保存されていません';
  } else {
    scopesError = 'GitHub OAuth 設定が不足しています';
  }

  return c.html(getSettingsPage({
    username: user.sub,
    name: user.name,
    email: user.email,
    issuedAt,
    expiresAt,
    expiresAtTimestamp: user.exp,
    timezone: resolvedTimezone,
    sessionDuration,
    recentCommitsCount,
    toastDuration,
    statusCommitCacheSortMode,
    statusChartMode,
    githubScopes: GITHUB_OAUTH_SCOPE,
    githubGrantedScopes: grantedScopes,
    githubScopeError: scopesError,
  }));
});

/**
 * ユーザー情報ページ（認証が必要）
 */
app.get('/userinfo', authMiddleware, async (c) => {
  const user = c.get('user');

  return c.html(getUserInfoPage({
    username: user.sub,
    name: user.name,
    email: user.email,
    githubId: user.github_id,
  }));
});

/**
 * キャッシュ状況ページ（認証が必要）
 */
app.get('/status', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const cookieHeader = c.req.header('Cookie');
  const cookieVals = getCookieValues(cookieHeader, ['user_status_commit_cache_sort_mode', 'user_status_commit_cache_sort_state', 'user_status_chart_mode']);
  const statusCommitCacheSortMode = cookieVals['user_status_commit_cache_sort_mode'] === 'toggle' ? 'toggle' : 'off';
  const statusCommitCacheSortState = statusCommitCacheSortMode === 'toggle' && cookieVals['user_status_commit_cache_sort_state'] === 'commit_month_desc'
    ? 'commit_month_desc'
    : 'cached_at_desc';
  const statusChartMode = cookieVals['user_status_chart_mode'] === 'repo' ? 'repo' : 'gradient';
  const userSession = await getUserSession(c.env.DB, user.sub);
  const timezone = userSession?.timezone || getCookieValues(cookieHeader, ['user_timezone'])['user_timezone'] || DEFAULT_TIMEZONE;

  const data: CacheStatusData = {
    commitCache: { totalEntries: 0, totalCommits: 0, repos: [], byMonth: [], byMonthByRepo: [], entries: [] },
    repoColors: [],
    repoGroups: [],
    installationPerms: { totalEntries: 0, entries: [] },
    cacheStats: {
      totalGithubFetch: 0, totalCacheSave: 0,
      totalCacheLookup: 0, totalCacheHit: 0,
      entries: [],
    },
    tables: [],
    userContext: {
      teamName: null, teamId: null,
      workspaceName: null, workspaceId: null,
      role: null,
      allWorkspaces: [],
    },
  };

  if (db) {
    // ワークスペース情報を取得
    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';

    // ユーザーコンテキスト情報を構築
    data.userContext.teamName = wsInfo?.teamName ?? null;
    data.userContext.teamId = wsInfo?.teamId ?? null;
    data.userContext.workspaceName = wsInfo?.workspaceName ?? null;
    data.userContext.workspaceId = wsInfo?.workspaceId ?? null;
    data.userContext.allWorkspaces = await getUserWorkspaces(db, user.sub);

    // ロール取得
    if (wsInfo?.teamId) {
      try {
        const roleRow = await db.prepare(
          'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
        ).bind(wsInfo.teamId, user.sub).first<{ role: string }>();
        data.userContext.role = roleRow?.role ?? null;
      } catch {
        // ignore
      }
    }

    // テーブル別マイグレーション状況を収集
    for (const tbl of STATUS_TABLE_DEFINITIONS) {
      const entry: TableStatusEntry = {
        name: tbl.name,
        exists: false,
        rowCount: null,
        migration: tbl.migration,
        description: tbl.description,
        syncPolicy: tbl.syncPolicy,
      };
      try {
        const countResult = await db.prepare(
          `SELECT COUNT(*) AS cnt FROM ${tbl.name}`
        ).first<{ cnt: number }>();
        entry.exists = true;
        entry.rowCount = countResult?.cnt ?? 0;
      } catch {
        // テーブルが存在しない場合 → exists = false のまま
      }
      data.tables.push(entry);
    }

    // コミットキャッシュ
    try {
      const cacheRows = await db.prepare(
        'SELECT owner, repo, year, month, counts, cached_at FROM commit_calendar_cache WHERE workspace_id = ? ORDER BY cached_at DESC, year DESC, month DESC'
      ).bind(workspaceId).all<{ owner: string; repo: string; year: number; month: number; counts: string; cached_at: string }>();

      if (cacheRows.results) {
        const repoMap = new Map<string, { entryCount: number; totalCommits: number }>();
        const monthMap = new Map<string, { entryCount: number; totalCommits: number }>();
        const monthRepoMap = new Map<string, number>();

        for (const row of cacheRows.results) {
          const counts: Record<string, number> = JSON.parse(row.counts);
          const total = Object.values(counts).reduce((s, v) => s + v, 0);

          data.commitCache.entries.push({
            owner: row.owner,
            repo: row.repo,
            year: row.year,
            month: row.month,
            totalCommits: total,
            cachedAt: formatTimestampWithTimezone(new Date(row.cached_at), timezone),
          });
          data.commitCache.totalCommits += total;

          const repoKey = `${row.owner}/${row.repo}`;
          const ym = `${row.year}-${String(row.month).padStart(2, '0')}`;
          const mrKey = `${ym}::${repoKey}`;
          monthRepoMap.set(mrKey, (monthRepoMap.get(mrKey) || 0) + total);
          const existing = repoMap.get(repoKey) || { entryCount: 0, totalCommits: 0 };
          existing.entryCount++;
          existing.totalCommits += total;
          repoMap.set(repoKey, existing);

          const mExisting = monthMap.get(ym) || { entryCount: 0, totalCommits: 0 };
          mExisting.entryCount++;
          mExisting.totalCommits += total;
          monthMap.set(ym, mExisting);
        }

        data.commitCache.totalEntries = cacheRows.results.length;

        for (const [key, val] of repoMap.entries()) {
          const [owner, repo] = key.split('/');
          data.commitCache.repos.push({ owner, repo, entryCount: val.entryCount, totalCommits: val.totalCommits });
        }
        data.commitCache.repos.sort((a, b) => b.totalCommits - a.totalCommits);

        for (const [ym, val] of monthMap.entries()) {
          data.commitCache.byMonth.push({ yearMonth: ym, entryCount: val.entryCount, totalCommits: val.totalCommits });
        }
        data.commitCache.byMonth.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

        for (const [mrKey, commits] of monthRepoMap.entries()) {
          const [ym, repo] = mrKey.split('::');
          data.commitCache.byMonthByRepo.push({ yearMonth: ym, repo, commits });
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch commit calendar cache for status page', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 当月分を commit_list_cache から集計して統計に含める
    // （commit_calendar_cache には過去月のみ保存されるため当月分が欠落する）
    try {
      const currentYm = getJstYearMonthParts(new Date());
      const currentYmPrefix = `${currentYm.year}-${String(currentYm.month).padStart(2, '0')}`;

      const currentMonthRows = await db.prepare(
        'SELECT owner, repo, date, commit_count FROM commit_list_cache WHERE workspace_id = ? AND date LIKE ? ORDER BY owner, repo, date'
      ).bind(workspaceId, `${currentYmPrefix}-%`).all<{
        owner: string; repo: string; date: string; commit_count: number;
      }>();

      if (currentMonthRows.results && currentMonthRows.results.length > 0) {
        const currentMonthRepoMap = new Map<string, { owner: string; repo: string; totalCommits: number; latestDate: string }>();
        let currentMonthTotalCommits = 0;

        for (const row of currentMonthRows.results) {
          currentMonthTotalCommits += row.commit_count;
          const repoKey = `${row.owner}/${row.repo}`;
          const existing = currentMonthRepoMap.get(repoKey);
          if (existing) {
            existing.totalCommits += row.commit_count;
            if (row.date > existing.latestDate) existing.latestDate = row.date;
          } else {
            currentMonthRepoMap.set(repoKey, {
              owner: row.owner,
              repo: row.repo,
              totalCommits: row.commit_count,
              latestDate: row.date,
            });
          }
        }

        for (const [, val] of currentMonthRepoMap.entries()) {
          data.commitCache.entries.push({
            owner: val.owner,
            repo: val.repo,
            year: currentYm.year,
            month: currentYm.month,
            totalCommits: val.totalCommits,
            cachedAt: formatTimestampWithTimezone(new Date(val.latestDate + 'T00:00:00Z'), timezone) + ' (当月)',
          });
          data.commitCache.totalCommits += val.totalCommits;

          const repoEntry = data.commitCache.repos.find(
            r => r.owner === val.owner && r.repo === val.repo
          );
          if (repoEntry) {
            repoEntry.entryCount++;
            repoEntry.totalCommits += val.totalCommits;
          } else {
            data.commitCache.repos.push({
              owner: val.owner,
              repo: val.repo,
              entryCount: 1,
              totalCommits: val.totalCommits,
            });
          }
        }

        data.commitCache.totalEntries += currentMonthRepoMap.size;
        data.commitCache.repos.sort((a, b) => b.totalCommits - a.totalCommits);

        const existingMonth = data.commitCache.byMonth.find(m => m.yearMonth === currentYmPrefix);
        if (existingMonth) {
          existingMonth.entryCount += currentMonthRepoMap.size;
          existingMonth.totalCommits += currentMonthTotalCommits;
        } else {
          data.commitCache.byMonth.push({
            yearMonth: currentYmPrefix,
            entryCount: currentMonthRepoMap.size,
            totalCommits: currentMonthTotalCommits,
          });
        }
        data.commitCache.byMonth.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

        for (const [repoKey, val] of currentMonthRepoMap.entries()) {
          data.commitCache.byMonthByRepo.push({
            yearMonth: currentYmPrefix,
            repo: repoKey,
            commits: val.totalCommits,
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch current month commit data for status page', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // インストール権限キャッシュ
    try {
      const permRows = await db.prepare(
        'SELECT installation_id, repo_name, repository_selection, permissions, updated_at FROM installation_permissions ORDER BY updated_at DESC'
      ).all<{ installation_id: number; repo_name: string | null; repository_selection: string; permissions: string; updated_at: string }>();

      if (permRows.results) {
        data.installationPerms.totalEntries = permRows.results.length;
        for (const row of permRows.results) {
          const perms: Record<string, string> = JSON.parse(row.permissions);
          data.installationPerms.entries.push({
            installationId: row.installation_id,
            repoName: row.repo_name,
            repositorySelection: row.repository_selection,
            permissionCount: Object.keys(perms).length,
            updatedAt: formatTimestampWithTimezone(new Date(row.updated_at), timezone),
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch installation permissions for status page', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // キャッシュ統計（ユーザー別）
    try {
      const statsRows = await db.prepare(
        'SELECT owner, repo, github_fetch_count, cache_save_count, cache_lookup_count, cache_hit_count, last_updated_at FROM cache_stats WHERE user_id = ? ORDER BY last_updated_at DESC'
      ).bind(user.sub).all<{
        owner: string; repo: string;
        github_fetch_count: number; cache_save_count: number;
        cache_lookup_count: number; cache_hit_count: number;
        last_updated_at: string;
      }>();

      if (statsRows.results) {
        for (const row of statsRows.results) {
          data.cacheStats.entries.push({
            owner: row.owner,
            repo: row.repo,
            githubFetchCount: row.github_fetch_count,
            cacheSaveCount: row.cache_save_count,
            cacheLookupCount: row.cache_lookup_count,
            cacheHitCount: row.cache_hit_count,
            lastUpdatedAt: formatTimestampWithTimezone(new Date(row.last_updated_at), timezone),
          });
          data.cacheStats.totalGithubFetch += row.github_fetch_count;
          data.cacheStats.totalCacheSave += row.cache_save_count;
          data.cacheStats.totalCacheLookup += row.cache_lookup_count;
          data.cacheStats.totalCacheHit += row.cache_hit_count;
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch cache stats for status page', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // リポジトリ色設定の読み込み（syncPolicy: auto — ページ読み込み時に自動同期）
    try {
      // まず既存データを読む
      const colorRows = await db.prepare(
        'SELECT repo_name, color_code, display_order, tags, is_visible FROM repo_color_settings WHERE workspace_id = ? ORDER BY display_order ASC, repo_name ASC'
      ).bind(workspaceId).all<{
        repo_name: string; color_code: string; display_order: number; tags: string; is_visible: number;
      }>();

      const existingRepoNames = new Set<string>();
      if (colorRows.results) {
        for (const row of colorRows.results) {
          existingRepoNames.add(row.repo_name);
          data.repoColors.push({
            repoName: row.repo_name,
            colorCode: row.color_code,
            displayOrder: row.display_order,
            tags: row.tags,
            isVisible: row.is_visible === 1,
          });
        }
      }

      // コミットキャッシュに存在するが色設定に未登録のリポジトリを自動追加
      const cacheRepoRows = await db.prepare(
        'SELECT DISTINCT owner, repo FROM commit_calendar_cache WHERE workspace_id = ?'
      ).bind(workspaceId).all<{ owner: string; repo: string }>();
      const listRepoRows = await db.prepare(
        'SELECT DISTINCT owner, repo FROM commit_list_cache WHERE workspace_id = ?'
      ).bind(workspaceId).all<{ owner: string; repo: string }>();

      const allCacheRepos = new Set<string>();
      if (cacheRepoRows.results) {
        for (const r of cacheRepoRows.results) allCacheRepos.add(`${r.owner}/${r.repo}`);
      }
      if (listRepoRows.results) {
        for (const r of listRepoRows.results) allCacheRepos.add(`${r.owner}/${r.repo}`);
      }

      const newRepos = Array.from(allCacheRepos).filter(r => !existingRepoNames.has(r)).sort();
      if (newRepos.length > 0) {
        const defaultPalette = [
          '#667eea', '#e53e3e', '#38a169', '#ed8936', '#9f7aea',
          '#dd6b20', '#319795', '#d53f8c', '#3182ce', '#d69e2e',
          '#805ad5', '#2b6cb0', '#c53030', '#2f855a', '#b7791f',
        ];
        let maxOrder = -1;
        if (existingRepoNames.size > 0) {
          const orderRow = await db.prepare(
            'SELECT MAX(display_order) AS max_order FROM repo_color_settings WHERE workspace_id = ?'
          ).bind(workspaceId).first<{ max_order: number | null }>();
          maxOrder = orderRow?.max_order ?? -1;
        }
        const now = new Date().toISOString();
        const stmts = newRepos.map((repo, i) => {
          const colorIndex = (existingRepoNames.size + i) % defaultPalette.length;
          const order = maxOrder + 1 + i;
          return db.prepare(
            'INSERT OR IGNORE INTO repo_color_settings (workspace_id, repo_name, color_code, display_order, tags, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
          ).bind(workspaceId, repo, defaultPalette[colorIndex], order, '', now, now);
        });
        await db.batch(stmts);

        // 新規追加分を data.repoColors にも反映
        for (let i = 0; i < newRepos.length; i++) {
          const colorIndex = (existingRepoNames.size + i) % defaultPalette.length;
          data.repoColors.push({
            repoName: newRepos[i],
            colorCode: defaultPalette[colorIndex],
            displayOrder: maxOrder + 1 + i,
            tags: '',
            isVisible: true,
          });
        }

        logger.info(`Auto-synced ${newRepos.length} repos to repo_color_settings on page load`, {
          userId: user.sub, workspaceId, newRepos,
        });
      }
    } catch (error) {
      logger.warn('Failed to read/sync repo_color_settings (table may not exist yet)', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // リポジトリグループの読み込み
    try {
      const groupRows = await db.prepare(
        'SELECT id, name, description, color_code, icon, slack_channel_id, display_order FROM repo_groups WHERE workspace_id = ? ORDER BY display_order ASC, name ASC'
      ).bind(workspaceId).all<{
        id: string; name: string; description: string; color_code: string;
        icon: string; slack_channel_id: string; display_order: number;
      }>();

      if (groupRows.results && groupRows.results.length > 0) {
        const groupIds = groupRows.results.map(g => g.id);
        const memberRows = await db.prepare(
          `SELECT group_id, repo_name FROM repo_group_members WHERE workspace_id = ? AND group_id IN (${groupIds.map(() => '?').join(',')}) ORDER BY repo_name`
        ).bind(workspaceId, ...groupIds).all<{ group_id: string; repo_name: string }>();

        const memberMap = new Map<string, string[]>();
        if (memberRows.results) {
          for (const m of memberRows.results) {
            const list = memberMap.get(m.group_id) || [];
            list.push(m.repo_name);
            memberMap.set(m.group_id, list);
          }
        }

        for (const g of groupRows.results) {
          data.repoGroups.push({
            id: g.id,
            name: g.name,
            description: g.description,
            colorCode: g.color_code,
            icon: g.icon,
            slackChannelId: g.slack_channel_id,
            displayOrder: g.display_order,
            repos: memberMap.get(g.id) || [],
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to load repo_groups (table may not exist yet)', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.html(getCacheStatusPage({
    username: user.sub,
    name: user.name,
    statusCommitCacheSortMode,
    statusCommitCacheSortState,
    statusChartMode,
  }, data));
});

app.get('/api/status/tables/:table/rows', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const tableName = c.req.param('table');
  const tableDefinition = getStatusTableDefinition(tableName);

  if (!db || !tableDefinition) {
    return jsonUtf8({ error: 'Table not found' }, 404);
  }

  const wsInfo = await getCurrentWorkspace(db, user.sub);
  const previewQuery = getStatusTablePreviewQuery(
    tableName,
    user.sub,
    wsInfo?.workspaceId ?? null,
    wsInfo?.teamId ?? null,
  );

  if (!previewQuery) {
    return jsonUtf8({
      table: tableName,
      migration: tableDefinition.migration,
      description: tableDefinition.description,
      columns: [],
      rows: [],
      limit: STATUS_TABLE_PREVIEW_LIMIT,
    });
  }

  try {
    const columnsResult = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>();
    const pragmaColumns = (columnsResult.results ?? []).map((column) => column.name);
    const rowsResult = await db.prepare(previewQuery.sql).bind(...previewQuery.params).all<Record<string, unknown>>();
    const rows = rowsResult.results ?? [];
    const columns = mergeColumnsFromRows(pragmaColumns, rows);
    return jsonUtf8({
      table: tableName,
      migration: tableDefinition.migration,
      description: tableDefinition.description,
      columns,
      rows,
      limit: STATUS_TABLE_PREVIEW_LIMIT,
    });
  } catch (error) {
    logger.warn('Failed to fetch status table preview', {
      tableName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch table preview' }, 500);
  }
});

app.get('/api/status/migrations/:migration/sql', authMiddleware, async (c) => {
  const migration = c.req.param('migration');
  const sql = STATUS_MIGRATION_SQL[migration];

  if (!sql) {
    return jsonUtf8({ error: 'Migration not found' }, 404);
  }

  return jsonUtf8({ migration, sql });
});

app.get('/api/status/schema', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) {
    return jsonUtf8({ error: 'DB not available' }, 500);
  }

  try {
    const tablesResult = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name")
      .all<{ name: string }>();
    const tableNames = (tablesResult.results ?? []).map((r) => r.name);

    const tables: {
      name: string;
      cols: { name: string; type: string; keys: string[] }[];
    }[] = [];

    const relations: [string, string, string, string, string][] = [];
    const seenRelations = new Set<string>();

    for (const tName of tableNames) {
      const colsResult = await db
        .prepare(`PRAGMA table_info(${tName})`)
        .all<{ name: string; type: string; pk: number; notnull: number }>();
      const cols = (colsResult.results ?? []).map((col) => {
        const keys: string[] = [];
        if (col.pk > 0) keys.push('pk');
        return { name: col.name, type: col.type || 'TEXT', keys };
      });

      const indexResult = await db
        .prepare(`PRAGMA index_list(${tName})`)
        .all<{ name: string; unique: number }>();
      for (const idx of indexResult.results ?? []) {
        const indexInfoResult = await db
          .prepare(`PRAGMA index_info(${idx.name})`)
          .all<{ name: string }>();
        const indexCols = (indexInfoResult.results ?? []).map((r) => r.name);
        for (const c of cols) {
          if (indexCols.includes(c.name)) {
            if (idx.unique && !c.keys.includes('pk')) {
              if (!c.keys.includes('uk')) c.keys.push('uk');
            } else if (!idx.unique && !c.keys.includes('pk') && !c.keys.includes('uk')) {
              if (!c.keys.includes('idx')) c.keys.push('idx');
            }
          }
        }
      }

      const fkResult = await db
        .prepare(`PRAGMA foreign_key_list(${tName})`)
        .all<{ table: string; from: string; to: string }>();
      for (const fk of fkResult.results ?? []) {
        for (const c of cols) {
          if (c.name === fk.from && !c.keys.includes('fk')) {
            c.keys.push('fk');
          }
        }
        const relKey = `${tName}.${fk.from}->${fk.table}.${fk.to}`;
        if (!seenRelations.has(relKey)) {
          seenRelations.add(relKey);
          relations.push([tName, fk.from, fk.table, fk.to, '多:1']);
        }
      }

      tables.push({ name: tName, cols });
    }

    return jsonUtf8({ tables, relations });
  } catch (error) {
    logger.warn('Failed to fetch schema', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch schema' }, 500);
  }
});

app.get('/api/status/tables/:table/migration-details', authMiddleware, async (c) => {
  const tableName = c.req.param('table');
  const tableDefinition = getStatusTableDefinition(tableName);

  if (!tableDefinition) {
    return jsonUtf8({ error: 'Table not found' }, 404);
  }

  const queryExample = getStatusTableQueryExample(tableName);
  const sql = STATUS_MIGRATION_SQL[tableDefinition.migration];

  return jsonUtf8({
    table: tableName,
    migration: tableDefinition.migration,
    description: tableDefinition.description,
    migrationSql: sql ?? '',
    queryExample,
    endpoints: {
      tableRowsPath: `/api/status/tables/${encodeURIComponent(tableName)}/rows`,
      migrationSqlPath: `/api/status/migrations/${encodeURIComponent(tableDefinition.migration)}/sql`,
      migrationDetailPath: `/api/status/tables/${encodeURIComponent(tableName)}/migration-details`,
    },
  });
});

/**
 * リポジトリページ（ログインが必要だが未ログイン時はトップへ）
 */
app.get('/repositories', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.redirect('/', 302);
  }

  const commitHistoryPageSize = resolveCommitHistoryPageSize(c.env.COMMIT_HISTORY_PAGE_SIZE);
  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  const cookieHeader = c.req.header('Cookie');
  const timezone = userSession?.timezone || getCookieValues(cookieHeader, ['user_timezone'])['user_timezone'] || DEFAULT_TIMEZONE;

  let repositories: {
    owner: string;
    name: string;
    htmlUrl: string;
    description?: string | null;
    language?: string | null;
    stars: number;
    forks: number;
    updatedAt: string;
    isPrivate: boolean;
    latestCommitSha?: string | null;
    latestCommitUrl?: string | null;
  }[] = [];
  let errorMessage: string | null = null;

  // トークンのスコープを取得
  let grantedScopes: string[] | null = null;
  const clientId = c.env.GITHUB_CLIENT_ID;
  const clientSecret = c.env.GITHUB_CLIENT_SECRET;
  if (accessToken && clientId && clientSecret) {
    try {
      grantedScopes = await getGitHubTokenScopes({ accessToken, clientId, clientSecret });
    } catch (error) {
      logger.warn('Failed to fetch GitHub token scopes', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // GitHub App インストール権限をリポジトリごとに取得（D1優先、APIフォールバック）
  let repoInstallationPermissions: Map<string, RepoInstallationPermissions> = new Map();
  const d1Perms = await getInstallationPermissionsFromD1(c.env.DB);
  if (d1Perms) {
    // D1 のデータをMap形式に変換
    for (const [repoName, info] of Object.entries(d1Perms.permissions)) {
      repoInstallationPermissions.set(repoName, {
        installationId: 0,
        permissions: info.permissions,
        repositorySelection: info.repositorySelection as 'all' | 'selected',
      });
    }
    if (d1Perms.allPermissions) {
      repoInstallationPermissions.set('__all__0', {
        installationId: 0,
        permissions: d1Perms.allPermissions,
        repositorySelection: 'all',
      });
    }
  } else if (accessToken) {
    try {
      repoInstallationPermissions = await buildRepoInstallationPermissionsMap(accessToken);
    } catch (error) {
      logger.warn('Failed to fetch installation permissions from GitHub API', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  try {
    let repos = await getGitHubUserRepos({ username: user.sub, accessToken });
    repositories = await Promise.all(repos.map(async (repo) => {
      const updatedAt = repo.updated_at
        ? formatTimestampWithTimezone(new Date(repo.updated_at), timezone)
        : '不明';
      const owner = repo.owner?.login || (repo.full_name ? repo.full_name.split('/')[0] : user.sub);
      const latestCommit = owner
        ? await getGitHubLatestCommit({ owner, repo: repo.name, accessToken })
        : null;
      return {
        owner,
        name: repo.name,
        htmlUrl: repo.html_url,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        updatedAt,
        isPrivate: repo.private,
        latestCommitSha: latestCommit?.sha ?? null,
        latestCommitUrl: latestCommit?.html_url ?? null,
      };
    }));
  } catch (error) {
    const primaryError = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch GitHub repositories (primary)', {
      userId: user.sub,
      error: primaryError,
    });
    if (accessToken) {
      try {
        const repos = await getGitHubUserRepos({ username: user.sub });
        repositories = await Promise.all(repos.map(async (repo) => {
          const updatedAt = repo.updated_at
            ? formatTimestampWithTimezone(new Date(repo.updated_at), timezone)
            : '不明';
          const owner = repo.owner?.login || (repo.full_name ? repo.full_name.split('/')[0] : user.sub);
          const latestCommit = owner
            ? await getGitHubLatestCommit({ owner, repo: repo.name })
            : null;
          return {
            owner,
            name: repo.name,
            htmlUrl: repo.html_url,
            description: repo.description,
            language: repo.language,
            stars: repo.stargazers_count ?? 0,
            forks: repo.forks_count ?? 0,
            updatedAt,
            isPrivate: repo.private,
            latestCommitSha: latestCommit?.sha ?? null,
            latestCommitUrl: latestCommit?.html_url ?? null,
          };
        }));
      } catch (fallbackError) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
        logger.error('Failed to fetch GitHub repositories (fallback)', {
          userId: user.sub,
          error: fallbackMsg,
        });
        errorMessage = `リポジトリ一覧を取得できませんでした（${primaryError}）。再ログインをお試しください。`;
      }
    } else {
      errorMessage = `リポジトリ一覧を取得できませんでした（${primaryError}）。再ログインをお試しください。`;
    }
  }

  // リポジトリごとのインストール権限をシリアライズ可能な形に変換
  // "__all__" キーを持つインストールがある場合は、全リポジトリにその権限を適用
  const repoPermissionsMap: Record<string, { permissions: Record<string, string>; repositorySelection: string }> = {};
  let allReposPermissions: Record<string, string> | null = null;
  for (const [key, value] of repoInstallationPermissions.entries()) {
    if (key.startsWith('__all__')) {
      allReposPermissions = value.permissions;
    } else {
      repoPermissionsMap[key] = {
        permissions: value.permissions,
        repositorySelection: value.repositorySelection,
      };
    }
  }
  // "All repositories" インストールがある場合、全リポジトリにその権限を適用
  if (allReposPermissions) {
    for (const repo of repositories) {
      if (!repoPermissionsMap[repo.name]) {
        repoPermissionsMap[repo.name] = {
          permissions: allReposPermissions,
          repositorySelection: 'all',
        };
      }
    }
  }

  // 外部サービス連携判定
  let cloudflareLinkedRepos: Set<string> = new Set();
  let vercelLinkedRepos: Set<string> = new Set();
  let slackLinkedRepos: Set<string> = new Set();
  if (accessToken) {
    try {
      const repoNames = repositories.map((r) => r.name);
      const [externalResult, slackResult] = await Promise.all([
        getExternalServiceLinkedRepos(accessToken),
        getSlackLinkedReposByWebhooks(accessToken, user.sub, repoNames),
      ]);
      cloudflareLinkedRepos = externalResult.cloudflare.repos;
      vercelLinkedRepos = externalResult.vercel.repos;
      slackLinkedRepos = slackResult;
    } catch (error) {
      logger.warn('Failed to detect external service linked repos', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // リポジトリ名のセットをシリアライズ可能な形に変換
  const cloudflareRepos: Record<string, boolean> = {};
  const vercelRepos: Record<string, boolean> = {};
  const slackRepos: Record<string, boolean> = {};
  for (const repoName of cloudflareLinkedRepos) {
    cloudflareRepos[repoName] = true;
  }
  for (const repoName of vercelLinkedRepos) {
    vercelRepos[repoName] = true;
  }
  for (const repoName of slackLinkedRepos) {
    slackRepos[repoName] = true;
  }

  // Cloudflare セットアップ通知を取得
  let cloudflareSetupPending: Array<{
    id: number;
    repoOwner: string;
    repoName: string;
    repoFullName: string;
    isPrivate: boolean;
    createdAt: string;
  }> = [];
  if (c.env.DB) {
    try {
      const pendingRows = await c.env.DB.prepare(`
        SELECT id, repo_owner, repo_name, repo_full_name, is_private, created_at
        FROM cloudflare_setup_pending
        WHERE user_id = ? AND dismissed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
      `).bind(user.sub).all<{
        id: number;
        repo_owner: string;
        repo_name: string;
        repo_full_name: string;
        is_private: number;
        created_at: string;
      }>();

      // Cloudflare 連携済みのリポジトリは除外
      cloudflareSetupPending = (pendingRows.results ?? [])
        .filter((row) => !cloudflareRepos[row.repo_name])
        .map((row) => ({
          id: row.id,
          repoOwner: row.repo_owner,
          repoName: row.repo_name,
          repoFullName: row.repo_full_name,
          isPrivate: row.is_private === 1,
          createdAt: row.created_at,
        }));
    } catch (error) {
      logger.warn('Failed to fetch Cloudflare setup pending notifications', {
        userId: user.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.html(getRepositoriesPage({
    username: user.sub,
    name: user.name,
    repositories,
    errorMessage,
    grantedScopes,
    repoPermissions: repoPermissionsMap,
    cloudflareLinkedRepos: Object.keys(cloudflareRepos).length > 0 ? cloudflareRepos : null,
    vercelLinkedRepos: Object.keys(vercelRepos).length > 0 ? vercelRepos : null,
    slackLinkedRepos: Object.keys(slackRepos).length > 0 ? slackRepos : null,
    commitHistoryPageSize,
    cloudflareSetupPending,
  }));
});

// =====================================================
// Webhook エンドポイント
// =====================================================

/**
 * GitHub App Webhook 受信用エンドポイント
 * installation イベントを受信し、D1 に権限を保存、Slack に通知
 */
app.post('/webhook/github', async (c) => {
  const webhookSecret = c.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('GitHub webhook secret is not configured');
    return c.json({ error: 'Webhook endpoint is not available' }, 500);
  }

  const rawBody = await c.req.text();
  const signatureHeader = c.req.header('X-Hub-Signature-256');

  const verification = await verifyGitHubWebhookSignature(rawBody, signatureHeader, webhookSecret);
  if (!verification.success) {
    logger.warn('Rejected GitHub webhook', {
      reason: verification.reason,
      path: c.req.path,
    });
    return c.json({ error: 'Unauthorized webhook' }, 401);
  }

  const eventType = c.req.header('X-GitHub-Event') ?? 'unknown';
  const deliveryId = c.req.header('X-GitHub-Delivery') ?? 'unknown';

  let payload: GitHubWebhookInstallationPayload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return c.json({ error: 'Invalid webhook payload' }, 400);
  }

  const action = typeof payload?.action === 'string' ? payload.action : 'unknown';

  logger.info('GitHub webhook received', { eventType, action, deliveryId });

  // installation イベントを処理
  if (eventType === 'installation' || eventType === 'installation_repositories') {
    const db = c.env.DB;
    const installation = payload?.installation;

    if (installation && typeof installation.id === 'number' && db) {
      const installationId = installation.id;
      const permissions = installation.permissions ?? {};
      const repositorySelection = installation.repository_selection ?? 'selected';
      const now = new Date().toISOString();

      try {
        if (action === 'deleted' || action === 'suspend') {
          // インストール削除 or 一時停止 → D1 から該当レコードを削除
          await db.prepare(
            'DELETE FROM installation_permissions WHERE installation_id = ?'
          ).bind(installationId).run();

          logger.info('Deleted installation permissions from D1', { installationId, action });
        } else if (action === 'created' || action === 'new_permissions_accepted' || action === 'unsuspend') {
          // インストール作成 or 権限承認 or 再開
          if (repositorySelection === 'all') {
            // "All repositories" → repo_name を NULL で1レコード
            await db.prepare(`
              INSERT INTO installation_permissions (installation_id, repo_name, repository_selection, permissions, updated_at)
              VALUES (?, NULL, ?, ?, ?)
              ON CONFLICT(installation_id, repo_name) DO UPDATE SET
                repository_selection = excluded.repository_selection,
                permissions = excluded.permissions,
                updated_at = excluded.updated_at
            `).bind(installationId, repositorySelection, JSON.stringify(permissions), now).run();
          } else {
            // "Selected repositories" → リポジトリごとにレコード
            const repos = payload?.repositories ?? payload?.repositories_added ?? [];
            if (Array.isArray(repos)) {
              for (const repo of repos) {
                const repoName = repo.name ?? repo.full_name?.split('/').pop();
                if (!repoName) continue;
                await db.prepare(`
                  INSERT INTO installation_permissions (installation_id, repo_name, repository_selection, permissions, updated_at)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(installation_id, repo_name) DO UPDATE SET
                    repository_selection = excluded.repository_selection,
                    permissions = excluded.permissions,
                    updated_at = excluded.updated_at
                `).bind(installationId, repoName, repositorySelection, JSON.stringify(permissions), now).run();
              }
            }
          }

          // repositories_removed があれば削除
          const removedRepos = payload?.repositories_removed ?? [];
          if (Array.isArray(removedRepos)) {
            for (const repo of removedRepos) {
              const repoName = repo.name ?? repo.full_name?.split('/').pop();
              if (!repoName) continue;
              await db.prepare(
                'DELETE FROM installation_permissions WHERE installation_id = ? AND repo_name = ?'
              ).bind(installationId, repoName).run();
            }
          }

          logger.info('Updated installation permissions in D1', {
            installationId,
            action,
            repositorySelection,
            permissionKeys: Object.keys(permissions),
          });
        }
      } catch (error) {
        logger.error('Failed to update installation permissions in D1', {
          installationId,
          action,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Slack 通知: GitHub App インストール変更
    const slackToken = c.env.SLACK_OAUTH_TOKEN;
    const slackChannel = c.env.SLACK_CHANNEL_ID;
    if (slackToken && slackChannel) {
      const sender = payload?.sender?.login ?? 'unknown';
      const appSlug = installation?.app_slug ?? 'unknown';
      const actionMessage: Record<string, string> = {
        created: 'インストールされました',
        deleted: 'アンインストールされました',
        suspend: '一時停止されました',
        unsuspend: '再開されました',
        new_permissions_accepted: 'パーミッション変更が承認されました',
      };
      const message = actionMessage[action] ?? `${action}が実行されました`;
      const repoSelection = installation?.repository_selection ?? 'unknown';

      const slackText = [
        `GitHub OAuth App で${message}`,
        `対象App: ${appSlug}`,
        `管理者: ${sender}`,
        `対象: ${repoSelection === 'all' ? '全リポジトリ' : '選択リポジトリ'}`,
      ].join('\n');

      try {
        await postSlackMessage({ token: slackToken, channel: slackChannel, text: slackText });
      } catch (error) {
        logger.error('Slack notification failed for GitHub webhook', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // repository イベント: リポジトリ作成時に Cloudflare セットアップ通知を保存
  if (eventType === 'repository' && action === 'created') {
    const db = c.env.DB;
    const repoPayload = payload as unknown as GitHubWebhookRepositoryPayload;
    const repo = repoPayload?.repository;
    const senderLogin = repoPayload?.sender?.login;

    if (db && repo && senderLogin) {
      const now = new Date().toISOString();
      try {
        await db.prepare(`
          INSERT INTO cloudflare_setup_pending (user_id, repo_owner, repo_name, repo_full_name, is_private, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, repo_full_name) DO NOTHING
        `).bind(
          senderLogin,
          repo.owner?.login ?? senderLogin,
          repo.name,
          repo.full_name,
          repo.private ? 1 : 0,
          now,
        ).run();

        logger.info('Saved Cloudflare setup pending notification (webhook)', {
          userId: senderLogin,
          repoFullName: repo.full_name,
        });
      } catch (error) {
        logger.error('Failed to save Cloudflare setup pending notification', {
          error: error instanceof Error ? error.message : 'Unknown error',
          repoFullName: repo.full_name,
        });
      }
    }
  }

  // pull_request イベント: AI要約 → Slack通知
  if (eventType === 'pull_request') {
    const prPayload = payload as unknown as GitHubWebhookPullRequestPayload;
    const prAction = prPayload?.action;
    if (prAction === 'opened' || prAction === 'synchronize') {
      const pr = prPayload?.pull_request;
      const repoFullName = prPayload?.repository?.full_name ?? 'unknown';
      const slackToken = c.env.SLACK_OAUTH_TOKEN;
      const slackChannel = c.env.SLACK_CHANNEL_ID;
      const ai = c.env.AI;
      const githubToken = c.env.GITHUB_TOKEN;

      if (!pr) {
        logger.warn('pull_request payload is missing pr object', { repoFullName });
      } else if (!slackToken) {
        logger.warn('SLACK_OAUTH_TOKEN is not configured, skipping PR notification', { repoFullName });
      } else if (!slackChannel) {
        logger.warn('SLACK_CHANNEL_ID is not configured, skipping PR notification', { repoFullName });
      }
      if (pr && slackToken && slackChannel) {
        const db = c.env.DB;
        const title = pr.title;
        const description = pr.body ?? '';
        const prUrl = pr.html_url;
        const prNumber = pr.number;
        const author = pr.user?.login ?? 'unknown';
        const now = new Date();
        const eventDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const requestId = crypto.randomUUID();
        const aiModel = resolveAiModel(c.env.AI_MODEL);

        // 本日の通算番号を取得
        let dailySeq = 1;
        if (db) {
          try {
            const countResult = await db.prepare(
              'SELECT COUNT(*) as cnt FROM ai_summary_log WHERE event_date = ?'
            ).bind(eventDate).first<{ cnt: number }>();
            dailySeq = (countResult?.cnt ?? 0) + 1;
          } catch (error) {
            logger.warn('Failed to get daily AI summary count', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // diff 取得（GITHUB_TOKEN がある場合のみ）
        let trimmedDiff = '';
        let diffLength = 0;
        if (!githubToken) {
          logger.warn('GITHUB_TOKEN is not configured, skipping PR diff fetch', { prUrl });
        } else if (!pr.diff_url) {
          logger.warn('PR diff_url is missing', { prUrl });
        } else {
          try {
            const diffResult = await fetchPrDiff({ diffUrl: pr.diff_url, githubToken });
            trimmedDiff = diffResult.trimmedDiff;
            diffLength = diffResult.diffLength;
            logger.info('Fetched PR diff', { prUrl, diffLength, trimmedLength: trimmedDiff.length });
          } catch (error) {
            logger.warn('Failed to fetch PR diff', {
              error: error instanceof Error ? error.message : 'Unknown error',
              prUrl,
            });
          }
        }

        // AI 要約
        const pipelineResult = await runSummaryPipeline({
          ai: ai as { run(model: string, input: { messages: { role: string; content: string }[] }): Promise<unknown> } | null,
          model: aiModel,
          fallbackModel: DEFAULT_AI_MODEL,
          title,
          description,
          trimmedDiff,
          designSpec: DESIGN_SPEC_CHECKLIST,
        });
        const rawSummary = pipelineResult.summary;
        if (!pipelineResult.success) {
          logger.warn('AI summary pipeline failed', { summary: rawSummary, prUrl, githubTokenSet: !!githubToken });
        }

        // AI出力から「初期設計との差異」セクションを分離
        const extracted = extractDesignDiff(rawSummary);
        const summary = extracted.summary;
        const designDiff = extracted.designDiff;

        // Slack 通知
        const slackPayload = buildSlackMessage({
          prAction,
          prNumber,
          title,
          repoFullName,
          author,
          prUrl,
          summary,
          dailySeq,
          requestId,
          designDiff,
          fallbackUsed: pipelineResult.fallbackUsed,
          primaryModel: aiModel,
          fallbackModel: DEFAULT_AI_MODEL,
        });

        let slackNotified = false;
        try {
          const slackResult = await postSlackMessage({ token: slackToken, channel: slackChannel, text: slackPayload.text, blocks: slackPayload.blocks });
          if (slackResult.ok) {
            slackNotified = true;
          } else {
            logger.error('Slack notification failed for PR webhook', {
              error: slackResult.error,
              status: slackResult.status,
              prUrl,
            });
          }
        } catch (error) {
          logger.error('Slack notification threw for PR webhook', {
            error: error instanceof Error ? error.message : 'Unknown error',
            prUrl,
          });
        }

        // D1 にログを書き込み
        if (db) {
          try {
            await db.prepare(`
              INSERT INTO ai_summary_log
                (request_id, daily_seq, event_date, event_type, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, slack_notified, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              requestId,
              dailySeq,
              eventDate,
              'pr_summary',
              repoFullName,
              prNumber,
              prAction,
              prUrl,
              pipelineResult.usedModel,
              summary !== '' ? summary : null,
              diffLength,
              slackNotified ? 1 : 0,
              now.toISOString(),
            ).run();
            // 要約結果を自動診断してフィードバックを記録
            const diagnosis = classifySummaryResult(summary !== '' ? summary : null);
            try {
              await db.prepare(`
                INSERT INTO ai_summary_reviews
                  (summary_request_id, rating, reviewer_type, reviewer_name, review_model, comment, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).bind(
                requestId,
                diagnosis.rating,
                'system',
                'auto-diagnosis',
                aiModel,
                diagnosis.comment,
                now.toISOString(),
              ).run();
            } catch (feedbackError) {
              logger.warn('Failed to insert auto-diagnosis feedback', {
                error: feedbackError instanceof Error ? feedbackError.message : 'Unknown error',
                requestId,
              });
            }
          } catch (error) {
            logger.error('Failed to insert ai_summary_log', {
              error: error instanceof Error ? error.message : 'Unknown error',
              requestId,
            });
          }
        }
      }
    }
  }

  return c.json({ success: true, event: eventType, action }, 200);
});

// =====================================================
// API エンドポイント
// =====================================================

app.get('/api/repositories/:owner/:repo/issues-count', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  if (!owner || !repo) {
    return c.json({ error: 'Invalid repository parameters' }, 400);
  }

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  let result = await getGitHubRepoOpenIssuesCount({ owner, repo, accessToken });
  if (result.count === null && accessToken) {
    result = await getGitHubRepoOpenIssuesCount({ owner, repo });
  }

  if (result.count === null) {
    if (result.status === 401 || result.status === 403 || result.status === 404) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    return c.json({ error: 'Failed to fetch issues count' }, 502);
  }

  return c.json({ count: result.count });
});
app.get('/api/repositories/:owner/:repo/commits', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  if (!owner || !repo) {
    return c.json({ error: 'Invalid repository parameters' }, 400);
  }

  const requestedPerPage = Number(c.req.query('per_page'));
  const defaultPageSize = resolveCommitHistoryPageSize(c.env.COMMIT_HISTORY_PAGE_SIZE);
  const perPage = Number.isFinite(requestedPerPage)
    ? Math.min(100, Math.max(1, Math.floor(requestedPerPage)))
    : defaultPageSize;

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  try {
    const countResult = await getGitHubCommitCount({ owner, repo, accessToken });
    const commitsResult = await getGitHubCommits({ owner, repo, perPage, accessToken });
    if (commitsResult.status === 401 || commitsResult.status === 403 || commitsResult.status === 404) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    if (commitsResult.status < 200 || commitsResult.status >= 300) {
      logger.error('Failed to fetch commit history', {
        userId: user.sub,
        owner,
        repo,
        status: commitsResult.status,
      });
      return c.json({ error: 'Failed to fetch commit history' }, 502);
    }

    return c.json({
      totalCommits: countResult.total,
      commits: commitsResult.commits,
      perPage,
    });
  } catch (error) {
    logger.error('Failed to fetch commit history', {
      userId: user.sub,
      owner,
      repo,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'Failed to fetch commit history' }, 502);
  }
});

// コミットカレンダー（月別コミット数）
// 過去の確定月はD1キャッシュを参照し、当月のみGitHub APIに問い合わせる
app.get('/api/repositories/:owner/:repo/commits-calendar', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const yearStr = c.req.query('year');
  const monthStr = c.req.query('month');

  if (!owner || !repo) {
    return c.json({ error: 'Invalid repository parameters' }, 400);
  }

  const now = new Date();
  const currentJstYearMonth = getJstYearMonthParts(now);
  const year = yearStr ? parseInt(yearStr, 10) : currentJstYearMonth.year;
  const month = monthStr ? parseInt(monthStr, 10) : currentJstYearMonth.month;

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return c.json({ error: 'Invalid year/month parameters' }, 400);
  }

  // 過去の月かどうか判定（当月・未来月はキャッシュ不可）
  const isPastMonth = year < currentJstYearMonth.year || (year === currentJstYearMonth.year && month < currentJstYearMonth.month);

  // ワークスペースIDを解決（キャッシュのネームスペース分離に使用）
  const wsInfo = c.env.DB ? await getCurrentWorkspace(c.env.DB, user.sub) : null;
  const workspaceId = wsInfo?.workspaceId ?? '';

  // 過去月ならD1キャッシュを確認
  if (isPastMonth && c.env.DB && workspaceId) {
    try {
      const cached = await c.env.DB.prepare(
        'SELECT counts FROM commit_calendar_cache WHERE workspace_id = ? AND owner = ? AND repo = ? AND year = ? AND month = ?'
      ).bind(workspaceId, owner, repo, year, month).first<{ counts: string }>();
      if (cached) {
        return c.json({ year, month, counts: JSON.parse(cached.counts), cached: true });
      }
    } catch (e) {
      logger.warn('Failed to read commit calendar cache from D1', {
        owner, repo, year: String(year), month: String(month),
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  if (!accessToken) {
    return c.json({ error: 'No access token available' }, 401);
  }

  const result = await getGitHubRepoCommitsByMonth({ owner, repo, year, month, accessToken });
  const { counts, commitsByDate } = result;

  // D1にキャッシュ保存（ワークスペース単位）
  if (c.env.DB && workspaceId) {
    const cachedAt = now.toISOString();

    // 過去月のカレンダーキャッシュ（counts）を保存
    if (isPastMonth) {
      try {
        await c.env.DB.prepare(
          'INSERT INTO commit_calendar_cache (workspace_id, owner, repo, year, month, counts, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, owner, repo, year, month) DO UPDATE SET counts = excluded.counts, cached_at = excluded.cached_at'
        ).bind(workspaceId, owner, repo, year, month, JSON.stringify(counts), cachedAt).run();
      } catch (e) {
        logger.warn('Failed to write commit calendar cache to D1', {
          owner, repo, year: String(year), month: String(month),
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    // コミット詳細を日別に commit_list_cache へ一括保存
    // （後で commits-by-date を呼んだときにキャッシュヒットする）
    const dates = Object.keys(commitsByDate);
    if (dates.length > 0) {
      try {
        // 既にキャッシュ済みの日付を取得（重複INSERT回避）
        const placeholders = dates.map(() => '?').join(',');
        const existing = await c.env.DB.prepare(
          `SELECT date FROM commit_list_cache WHERE workspace_id = ? AND owner = ? AND repo = ? AND date IN (${placeholders})`
        ).bind(workspaceId, owner, repo, ...dates).all<{ date: string }>();
        const existingDates = new Set(existing.results?.map(r => r.date) ?? []);

        // 未キャッシュの日付のみバッチ保存
        const newDates = dates.filter(d => !existingDates.has(d));
        for (const date of newDates) {
          const dayCommits = commitsByDate[date];
          if (dayCommits.length > 0) {
            await c.env.DB.prepare(
              'INSERT INTO commit_list_cache (workspace_id, owner, repo, date, commits_json, commit_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, owner, repo, date) DO NOTHING'
            ).bind(workspaceId, owner, repo, date, JSON.stringify(dayCommits), dayCommits.length, cachedAt).run();
          }
        }
      } catch (e) {
        logger.warn('Failed to batch-write commit list cache to D1', {
          owner, repo, year: String(year), month: String(month),
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }
  }

  return c.json({ year, month, counts });
});

// 特定日のコミット詳細一覧を取得する
app.get('/api/repositories/:owner/:repo/commits-by-date', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const date = c.req.query('date'); // YYYY-MM-DD

  if (!owner || !repo || !date) {
    return c.json({ error: 'owner, repo, date are required' }, 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
  }

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  if (!accessToken) {
    return c.json({ error: 'No access token available' }, 401);
  }

  // ワークスペースIDを解決（キャッシュのネームスペース分離に使用）
  const wsInfo = c.env.DB ? await getCurrentWorkspace(c.env.DB, user.sub) : null;
  const workspaceId = wsInfo?.workspaceId ?? '';

  // キャッシュ統計を更新するヘルパー
  const incrementCacheStat = async (field: 'github_fetch_count' | 'cache_save_count' | 'cache_lookup_count' | 'cache_hit_count') => {
    if (!c.env.DB) return;
    try {
      const now = new Date().toISOString();
      await c.env.DB.prepare(
        `INSERT INTO cache_stats (user_id, owner, repo, ${field}, last_updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT (user_id, owner, repo) DO UPDATE SET ${field} = ${field} + 1, last_updated_at = excluded.last_updated_at`
      ).bind(user.sub, owner, repo, now).run();
    } catch (e) {
      logger.warn('Failed to update cache stats', {
        field, owner, repo,
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  };

  // Step 1: D1キャッシュから参照
  if (c.env.DB && workspaceId) {
    try {
      await incrementCacheStat('cache_lookup_count');
      const cached = await c.env.DB.prepare(
        'SELECT commits_json FROM commit_list_cache WHERE workspace_id = ? AND owner = ? AND repo = ? AND date = ?'
      ).bind(workspaceId, owner, repo, date).first<{ commits_json: string }>();

      if (cached) {
        await incrementCacheStat('cache_hit_count');
        const commits: CommitDetail[] = JSON.parse(cached.commits_json);
        return c.json({ date, commits, source: 'cache' });
      }
    } catch (e) {
      logger.warn('Failed to read commit list cache from D1', {
        owner, repo, date,
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }

  // Step 2: キャッシュに無い → GitHubから取得
  await incrementCacheStat('github_fetch_count');
  const commits = await getGitHubRepoCommitsByDate({ owner, repo, date, accessToken });

  // Step 3: 取得結果をキャッシュに保存
  if (c.env.DB && workspaceId && commits.length > 0) {
    try {
      const now = new Date();
      await c.env.DB.prepare(
        'INSERT INTO commit_list_cache (workspace_id, owner, repo, date, commits_json, commit_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, owner, repo, date) DO UPDATE SET commits_json = excluded.commits_json, commit_count = excluded.commit_count, cached_at = excluded.cached_at'
      ).bind(workspaceId, owner, repo, date, JSON.stringify(commits), commits.length, now.toISOString()).run();
      await incrementCacheStat('cache_save_count');
    } catch (e) {
      logger.warn('Failed to write commit list cache to D1', {
        owner, repo, date,
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }

  return c.json({ date, commits, source: 'github' });
});

// コミット履歴の全文検索
app.get('/api/repositories/search/commits', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    return jsonUtf8({ error: 'Unauthorized' }, 401);
  }

  const q = (c.req.query('q') ?? '').trim();
  if (!q || q.length < 2) {
    return jsonUtf8({ error: 'Search query must be at least 2 characters' }, 400);
  }

  if (!c.env.DB) {
    return jsonUtf8({ error: 'Database not available' }, 500);
  }

  const wsInfo = await getCurrentWorkspace(c.env.DB, user.sub);
  const workspaceId = wsInfo?.workspaceId ?? '';

  if (!workspaceId) {
    return jsonUtf8({ results: [], query: q, total: 0 });
  }

  try {
    // commit_list_cache の commits_json (JSON配列) を LIKE で全文検索
    const searchPattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    const rows = await c.env.DB.prepare(
      `SELECT owner, repo, date, commits_json, commit_count
       FROM commit_list_cache
       WHERE workspace_id = ?
         AND commits_json LIKE ? ESCAPE '\\'
       ORDER BY date DESC
       LIMIT 100`
    ).bind(workspaceId, searchPattern).all<{
      owner: string;
      repo: string;
      date: string;
      commits_json: string;
      commit_count: number;
    }>();

    // 各行の commits_json をパースして、マッチするコミットだけ抽出
    interface SearchResultCommit {
      sha: string;
      message: string;
      authorName: string;
      authorLogin: string;
      authorAvatarUrl: string;
      date: string;
      url: string;
    }
    interface SearchResultItem {
      owner: string;
      repo: string;
      date: string;
      commits: SearchResultCommit[];
    }

    const qLower = q.toLowerCase();
    const results: SearchResultItem[] = [];
    let totalMatches = 0;

    for (const row of rows.results ?? []) {
      try {
        const commits: SearchResultCommit[] = JSON.parse(row.commits_json);
        const matched = commits.filter((commit) => {
          const msg = (commit.message ?? '').toLowerCase();
          const author = (commit.authorName ?? '').toLowerCase();
          const login = (commit.authorLogin ?? '').toLowerCase();
          const sha = (commit.sha ?? '').toLowerCase();
          return msg.includes(qLower)
            || author.includes(qLower)
            || login.includes(qLower)
            || sha.includes(qLower);
        });
        if (matched.length > 0) {
          results.push({
            owner: row.owner,
            repo: row.repo,
            date: row.date,
            commits: matched,
          });
          totalMatches += matched.length;
        }
      } catch (_e) {
        // JSONパース失敗はスキップ
      }
    }

    // リポジトリごとのヒット数を集計
    const repoHitMap = new Map<string, number>();
    for (const item of results) {
      const repoKey = `${item.owner}/${item.repo}`;
      repoHitMap.set(repoKey, (repoHitMap.get(repoKey) ?? 0) + item.commits.length);
    }

    // テーブルA・Bに検索結果を保存
    if (totalMatches > 0) {
      try {
        const now = new Date().toISOString();
        const repoNamesList = JSON.stringify([...repoHitMap.keys()]);
        const insertA = await c.env.DB.prepare(
          `INSERT INTO commit_search_history (user_id, search_query, total_hits, repo_names, searched_at)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(user.sub, q, totalMatches, repoNamesList, now).run();

        const historyId = insertA.meta?.last_row_id;
        if (historyId) {
          const userName = user.name ?? user.sub;
          const stmts = [...repoHitMap.entries()].map(([repoName, hitCount]) =>
            c.env.DB!.prepare(
              `INSERT INTO commit_search_repo_stats (search_history_id, repo_name, hit_count, search_query, user_name)
               VALUES (?, ?, ?, ?, ?)`
            ).bind(historyId, repoName, hitCount, q, userName)
          );
          if (stmts.length > 0) {
            await c.env.DB.batch(stmts);
          }
        }
      } catch (saveErr) {
        logger.warn('Failed to save commit search history', {
          query: q,
          error: saveErr instanceof Error ? saveErr.message : 'Unknown error',
        });
      }
    }

    return jsonUtf8({ results, query: q, total: totalMatches });
  } catch (error) {
    logger.warn('Commit search failed', {
      query: q,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Search failed' }, 500);
  }
});

// コミット検索履歴一覧（テーブルA: ヒット総数降順）
app.get('/api/repositories/search/history', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return jsonUtf8({ error: 'Unauthorized' }, 401);
  if (!c.env.DB) return jsonUtf8({ error: 'Database not available' }, 500);

  try {
    const rows = await c.env.DB.prepare(
      `SELECT id, search_query, total_hits, repo_names, searched_at
       FROM commit_search_history
       WHERE user_id = ?
       ORDER BY total_hits DESC
       LIMIT 200`
    ).bind(user.sub).all<{
      id: number;
      search_query: string;
      total_hits: number;
      repo_names: string;
      searched_at: string;
    }>();
    return jsonUtf8({ history: rows.results ?? [] });
  } catch (error) {
    logger.warn('Failed to fetch commit search history', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch history' }, 500);
  }
});

// コミット検索履歴の詳細（テーブルA + テーブルBのリポジトリ別集計）
app.get('/api/repositories/search/history/:id', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return jsonUtf8({ error: 'Unauthorized' }, 401);
  if (!c.env.DB) return jsonUtf8({ error: 'Database not available' }, 500);

  const historyId = Number(c.req.param('id'));
  if (!Number.isFinite(historyId) || historyId <= 0) {
    return jsonUtf8({ error: 'Invalid history ID' }, 400);
  }

  try {
    const header = await c.env.DB.prepare(
      `SELECT id, search_query, total_hits, repo_names, searched_at
       FROM commit_search_history
       WHERE id = ? AND user_id = ?`
    ).bind(historyId, user.sub).first<{
      id: number;
      search_query: string;
      total_hits: number;
      repo_names: string;
      searched_at: string;
    }>();

    if (!header) {
      return jsonUtf8({ error: 'Not found' }, 404);
    }

    const details = await c.env.DB.prepare(
      `SELECT repo_name, hit_count, search_query, user_name
       FROM commit_search_repo_stats
       WHERE search_history_id = ?
       ORDER BY hit_count DESC`
    ).bind(historyId).all<{
      repo_name: string;
      hit_count: number;
      search_query: string;
      user_name: string;
    }>();

    return jsonUtf8({
      history: header,
      repoStats: details.results ?? [],
    });
  } catch (error) {
    logger.warn('Failed to fetch commit search history detail', {
      historyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch detail' }, 500);
  }
});

/**
 * Slack Interactivity エンドポイント
 * ボタンクリック等の対話イベントを受信し、モーダルを返す
 */
app.post('/slack/interactions', async (c) => {
  const db = c.env.DB;
  const logStep = async (step: string, detail?: string) => {
    if (!db) return;
    try {
      await db.prepare(
        'INSERT INTO slack_interaction_log (step, detail, created_at) VALUES (?, ?, ?)'
      ).bind(step, detail ?? null, new Date().toISOString()).run();
    } catch (_) { /* best effort */ }
  };

  const rawBody = await c.req.text();

  const result = await handleSlackInteraction({
    signingSecret: c.env.SLACK_SIGNING_SECRET,
    slackToken: c.env.SLACK_OAUTH_TOKEN,
    rawBody,
    timestamp: c.req.header('X-Slack-Request-Timestamp'),
    signature: c.req.header('X-Slack-Signature'),
    dbQuery: async (requestId: string) => {
      if (!db) return null;
      return db.prepare(
        'SELECT request_id, daily_seq, event_date, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, created_at FROM ai_summary_log WHERE request_id = ?'
      ).bind(requestId).first() as Promise<SummaryModalRow | null>;
    },
    logStep,
    verifySignature: verifySlackSignature,
  });

  if (result.status === 401) {
    return c.text('', 401);
  }
  return c.text('', 200);
});

/**
 * Resend webhook受信用エンドポイント
 * イベントタイプを/lib/resend-webhook.shtml?event=xxxへGETで通知し、Resendへのレスポンスを返す
 */
app.post('/webhook/resend/:sourceId', async (c) => {
  const sourceId = c.req.param('sourceId');

  const db = c.env.DB;
  if (!db) {
    logger.error('Database is not available for Resend webhook source validation');
    return c.json({ error: 'Webhook endpoint is not available' }, 500);
  }

  const sourceRow = await db.prepare(
    `SELECT id, label, webhook_secret FROM resend_webhook_sources WHERE id = ?`
  ).bind(sourceId).first<{ id: string; label: string; webhook_secret: string | null }>();

  if (!sourceRow) {
    logger.warn('Unknown Resend webhook source', { sourceId });
    return c.json({ error: 'Unknown webhook source' }, 404);
  }

  const webhookSecret = sourceRow.webhook_secret ?? c.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('Resend webhook secret is not configured', { sourceId });
    return c.json({ error: 'Webhook endpoint is not available' }, 500);
  }

  const rawBody = await c.req.text();

  const verification = await verifyResendWebhookSignature(rawBody, {
    id: c.req.header('svix-id'),
    timestamp: c.req.header('svix-timestamp'),
    signature: c.req.header('svix-signature'),
  }, webhookSecret);

  if (!verification.success) {
    logger.warn('Rejected Resend webhook', {
      reason: verification.reason,
      sourceId,
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: 'Unauthorized webhook' }, 401);
  }

  const resendEventId = c.req.header('svix-id')?.trim();
  if (resendEventId) {
    const dedupKey = `${sourceId}:${resendEventId}`;
    const nowMs = Date.now();
    const dedupTtlSeconds = resolveResendDedupTtlSeconds(c.env.RESEND_WEBHOOK_DEDUP_TTL_SECONDS);
    const expiresAt = nowMs + dedupTtlSeconds * 1000;

    for (const [key, expiry] of resendWebhookDedupCache.entries()) {
      if (expiry <= nowMs) {
        resendWebhookDedupCache.delete(key);
      }
    }

    if (resendWebhookDedupCache.has(dedupKey)) {
      logger.warn('Duplicate Resend webhook detected', { sourceId, resendEventId });
      return c.json({ error: 'Duplicate webhook' }, 409);
    }

    resendWebhookDedupCache.set(dedupKey, expiresAt);
  }

  let payload: ResendWebhookPayload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    logger.warn('Unable to parse Resend webhook payload', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'Invalid webhook payload' }, 400);
  }

  const eventType = typeof payload?.type === 'string' && payload.type.trim().length > 0
    ? payload.type
    : 'unknown';

  logger.info('Resend webhook received', { eventType });

  const webhookData = payload?.data ?? {};
  const resendEmailId = typeof webhookData.email_id === 'string' && webhookData.email_id.trim().length > 0
    ? webhookData.email_id
    : null;
  const emailTo = Array.isArray(webhookData.to) && webhookData.to.length > 0
    ? webhookData.to.join(', ')
    : (typeof webhookData.to === 'string' && webhookData.to.trim().length > 0 ? webhookData.to : null);
  const emailFrom = typeof webhookData.from === 'string' && webhookData.from.trim().length > 0
    ? webhookData.from
    : null;
  const bounceType = webhookData.bounce?.type ?? null;
  const errorDetail = webhookData.bounce?.message ?? webhookData.error?.message ?? null;

  const slackConfig = {
    signingSecret: c.env.SLACK_SIGNING_SECRET,
    oauthToken: c.env.SLACK_OAUTH_TOKEN,
    clientSecret: c.env.SLACK_CLIENT_SECRET,
    clientId: c.env.SLACK_CLIENT_ID,
    channelId: c.env.SLACK_CHANNEL_ID,
  };

  const deliveryStatus = eventType === 'email.delivered'
    ? '送信完了'
    : (eventType === 'email.failed' || eventType === 'email.bounced' ? '失敗' : null);

  let slackResultText: string | null = null;
  let slackResultAt: string | null = null;

  if (deliveryStatus) {
    const missingSlackVars = Object.entries(slackConfig)
      .filter(([, value]) => !value || value.trim().length === 0)
      .map(([key]) => key);

    if (missingSlackVars.length > 0) {
      logger.error('Slack notification skipped due to missing configuration', {
        missing: missingSlackVars,
      });
      slackResultText = 'skipped:missing_config';
      slackResultAt = new Date().toISOString();
    } else if (slackConfig.oauthToken && slackConfig.channelId) {
      try {
        const from = typeof webhookData.from === 'string' && webhookData.from.trim().length > 0 ? webhookData.from : 'unknown';
        const toDisplay = emailTo ?? 'unknown';
        const subject = typeof webhookData.subject === 'string' && webhookData.subject.trim().length > 0 ? webhookData.subject : 'unknown';

        const slackText = [
          `Resend: ${deliveryStatus}`,
          `from: ${from}`,
          `to: ${toDisplay}`,
          `件名: ${subject}`,
        ].join('\n');

        const slackResult = await postSlackMessage({
          token: slackConfig.oauthToken,
          channel: slackConfig.channelId,
          text: slackText,
        });

        slackResultAt = new Date().toISOString();
        if (!slackResult.ok) {
          logger.error('Slack notification failed for Resend webhook', {
            eventType,
            error: slackResult.error,
            status: slackResult.status,
          });
          slackResultText = `error:${slackResult.status ?? 'unknown'}`;
        } else {
          slackResultText = 'ok';
        }
      } catch (error) {
        logger.error('Slack notification errored for Resend webhook', {
          eventType,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        slackResultText = `exception:${error instanceof Error ? error.message : 'unknown'}`;
        slackResultAt = new Date().toISOString();
      }
    }
  }

  const notifyUrl = new URL('https://mynw.nekomaneki.work/lib/resend-webhook.shtml');
  notifyUrl.searchParams.set('event', eventType);

  let proxyResultText: string | null = null;
  let proxyResultAt: string | null = null;
  let proxyFailed = false;

  try {
    const proxyResponse = await fetch(notifyUrl.toString(), {
      method: 'GET',
    });

    proxyResultAt = new Date().toISOString();
    if (!proxyResponse.ok) {
      logger.error('Proxy notification failed for Resend webhook', {
        eventType,
        status: proxyResponse.status,
        statusText: proxyResponse.statusText,
      });
      proxyResultText = `error:${proxyResponse.status}`;
      proxyFailed = true;
    } else {
      proxyResultText = 'ok';
    }
  } catch (error) {
    logger.error('Failed to reach proxy target for Resend webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventType,
    });
    proxyResultText = `exception:${error instanceof Error ? error.message : 'unknown'}`;
    proxyResultAt = new Date().toISOString();
    proxyFailed = true;
  }

  const svixId = resendEventId ?? `noid_${Date.now()}`;
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO resend_webhook_log (source_id, svix_id, resend_email_id, event_type, email_from, email_to, bounce_type, error_detail, slack_result, slack_result_at, proxy_result, proxy_result_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      sourceId,
      svixId,
      resendEmailId,
      eventType,
      emailFrom,
      emailTo,
      bounceType,
      errorDetail,
      slackResultText,
      slackResultAt,
      proxyResultText,
      proxyResultAt
    ).run();
  } catch (dbError) {
    logger.error('Failed to insert resend_webhook_log', {
      error: dbError instanceof Error ? dbError.message : 'Unknown error',
      sourceId,
      svixId,
      eventType,
    });
  }

  if (proxyFailed) {
    return c.json({ error: 'Failed to notify proxy target' }, 502);
  }

  return c.json({ success: true, event: eventType }, 200);
});

/**
 * API情報
 */
app.get('/api', (c) => {
  return c.json({
    message: 'Cloudflare Workers GitHub OAuth API',
    version: '1.0.0',
    authentication: {
      github_oauth: 'GET /auth/github',
      logout: 'GET /auth/logout',
    },
    endpoints: {
      public: [
        'GET /api',
        'GET /api/public',
        'GET /health',
      ],
      protected: [
        'GET /api/protected',
        'GET /api/profile',
        'PUT /api/profile',
      ],
    },
  });
});

/**
 * 公開エンドポイント（オプショナル認証）
 */
app.get('/api/public', optionalAuthMiddleware, (c) => {
  const user = c.get('user');

  if (user) {
    return c.json({
      message: 'これは公開エンドポイントです（認証済み）',
      user: {
        username: user.sub,
        name: user.name,
        email: user.email,
      },
    });
  }

  return c.json({
    message: 'これは公開エンドポイントです（未認証）',
    info: 'このエンドポイントは誰でもアクセスできます',
  });
});

/**
 * 保護されたエンドポイント
 */
app.get('/api/protected', authMiddleware, (c) => {
  const user = c.get('user');

  return c.json({
    message: '保護されたリソースへのアクセスに成功しました',
    user: {
      username: user.sub,
      name: user.name,
      email: user.email,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * ユーザープロフィール取得
 */
app.get('/api/profile', authMiddleware, (c) => {
  const user = c.get('user');

  return c.json({
    profile: {
      username: user.sub,
      name: user.name,
      email: user.email,
      issuedAt: new Date(user.iat * 1000).toISOString(),
      expiresAt: new Date(user.exp * 1000).toISOString(),
    },
  });
});

/**
 * プロフィール更新（表示名をD1データベースに保存）
 */
app.put('/api/profile', authMiddleware, async (c) => {
  const user = c.get('user');

  let body: { name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディが不正です' }, 400);
  }

  const { name } = body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: '名前は必須です' }, 400);
  }

  if (name.length > 100) {
    return c.json({ error: '名前は100文字以内にしてください' }, 400);
  }

  const success = await updateUserSettings(c.env.DB, user.sub, 'display_name', name.trim());

  if (!success) {
    return c.json({ error: 'データベースの更新に失敗しました' }, 500);
  }

  return c.json({
    message: 'プロフィールを更新しました',
    profile: {
      username: user.sub,
      name: name.trim(),
      email: user.email,
    },
  });
});

/**
 * タイムゾーン設定変更
 */
app.post('/api/settings/timezone', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { timezone } = await c.req.json();

    if (timezone !== 'UTC' && timezone !== 'JST') {
      return c.json({ error: '無効なタイムゾーンです' }, 400);
    }

    const success = await updateUserSettings(c.env.DB, user.sub, 'timezone', timezone);

    if (!success) {
      return c.json({ error: 'データベースの更新に失敗しました' }, 500);
    }

    c.header('Set-Cookie', `user_timezone=${timezone}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: 'タイムゾーンを変更しました', timezone }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Timezone update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'タイムゾーンの変更に失敗しました' }, 500);
  }
});

/**
 * セッション有効期限設定変更
 */
app.post('/api/settings/session-duration', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { sessionDuration } = await c.req.json();

    const validDurations = ['1h', '3h', '8h', '1d', '3d', '1w'];
    if (!validDurations.includes(sessionDuration)) {
      return c.json({ error: '無効なセッション有効期限です' }, 400);
    }

    const success = await updateUserSettings(c.env.DB, user.sub, 'session_duration', sessionDuration);

    if (!success) {
      return c.json({ error: 'データベースの更新に失敗しました' }, 500);
    }

    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      return c.json({ error: 'サーバー設定エラー' }, 500);
    }

    const renewed = await renewSession({
      currentUser: user,
      newDuration: sessionDuration,
      jwtSecret,
      idleTimeoutEnv: c.env.SESSION_IDLE_TIMEOUT_SECONDS,
    });

    const headers = new Headers();
    for (const cookie of renewed.cookies) {
      headers.append('Set-Cookie', cookie);
    }
    headers.set('Content-Type', 'application/json; charset=utf-8');

    return new Response(
      JSON.stringify({ message: 'セッション有効期限を変更しました（即時反映）', sessionDuration }),
      { status: 200, headers }
    );
  } catch (error) {
    const user = c.get('user');
    logger.error('Session duration update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'セッション有効期限の変更に失敗しました' }, 500);
  }
});

/**
 * テーマ設定変更
 */
app.post('/api/settings/theme', authMiddleware, async (c) => {
  try {
    const { theme } = await c.req.json();

    const validThemes = ['light', 'dark'];
    if (!validThemes.includes(theme)) {
      return c.json({ error: '無効なテーマです' }, 400);
    }

    c.header('Set-Cookie', `user_theme=${theme}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: 'テーマを変更しました', theme }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Theme update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'テーマの変更に失敗しました' }, 500);
  }
});

/**
 * 最終コミット一覧の表示件数設定変更
 */
app.post('/api/settings/recent-commits-count', authMiddleware, async (c) => {
  try {
    const { count } = await c.req.json();
    const num = parseInt(count, 10);

    if (isNaN(num) || num < 5 || num > 100) {
      return c.json({ error: '表示件数は5〜100の範囲で指定してください' }, 400);
    }

    c.header('Set-Cookie', `user_recent_commits_count=${num}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: '表示件数を変更しました', count: num }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Recent commits count update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: '表示件数の変更に失敗しました' }, 500);
  }
});

/**
 * トースト通知の表示時間設定変更
 */
app.post('/api/settings/toast-duration', authMiddleware, async (c) => {
  try {
    const { duration } = await c.req.json();
    const num = parseInt(duration, 10);

    if (isNaN(num) || num < 1 || num > 60) {
      return c.json({ error: 'トースト表示時間は1〜60秒の範囲で指定してください' }, 400);
    }

    c.header('Set-Cookie', `user_toast_duration=${num}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: 'トースト表示時間を変更しました', duration: num }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Toast duration update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'トースト表示時間の変更に失敗しました' }, 500);
  }
});

/**
 * /status の月別コミットキャッシュ詳細ソート設定変更
 */
app.post('/api/settings/status-commit-cache-sort-mode', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();

    if (mode !== 'off' && mode !== 'toggle') {
      return c.json({ error: '無効な並び替え設定です' }, 400);
    }

    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
    headers.append('Set-Cookie', `user_status_commit_cache_sort_mode=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    if (mode === 'off') {
      headers.append('Set-Cookie', 'user_status_commit_cache_sort_state=cached_at_desc; Path=/; Secure; SameSite=Lax; Max-Age=31536000');
    }

    return new Response(JSON.stringify({ message: '月別コミットキャッシュ詳細の並び替え設定を変更しました', mode }), { status: 200, headers });
  } catch (error) {
    const user = c.get('user');
    logger.error('Status commit cache sort mode update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: '月別コミットキャッシュ詳細の並び替え設定変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/status-chart-mode', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();

    if (mode !== 'gradient' && mode !== 'repo') {
      return c.json({ error: '無効なチャート表示モードです' }, 400);
    }

    c.header('Set-Cookie', `user_status_chart_mode=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: '月別コミット量チャートの表示モードを変更しました', mode }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Status chart mode update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: '月別コミット量チャートの表示モード変更に失敗しました' }, 500);
  }
});

/**
 * リポジトリ色設定の同期
 * コミットキャッシュに存在するリポジトリをrepo_color_settingsに一括登録する。
 * 既存行は上書きしない（INSERT OR IGNORE）。
 */
app.post('/api/repo-colors/sync', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'D1 is not configured' }, 500);
  }

  try {
    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';

    const cacheRows = await db.prepare(
      'SELECT DISTINCT owner, repo FROM commit_calendar_cache WHERE workspace_id = ?'
    ).bind(workspaceId).all<{ owner: string; repo: string }>();

    const listRows = await db.prepare(
      'SELECT DISTINCT owner, repo FROM commit_list_cache WHERE workspace_id = ?'
    ).bind(workspaceId).all<{ owner: string; repo: string }>();

    const repoSet = new Set<string>();
    if (cacheRows.results) {
      for (const r of cacheRows.results) repoSet.add(`${r.owner}/${r.repo}`);
    }
    if (listRows.results) {
      for (const r of listRows.results) repoSet.add(`${r.owner}/${r.repo}`);
    }

    if (repoSet.size === 0) {
      return c.json({ message: 'コミットキャッシュにリポジトリが存在しません', registered: 0, total: 0 });
    }

    const existingRows = await db.prepare(
      'SELECT repo_name FROM repo_color_settings WHERE workspace_id = ?'
    ).bind(workspaceId).all<{ repo_name: string }>();

    const existingSet = new Set<string>();
    let maxOrder = -1;
    if (existingRows.results) {
      for (const r of existingRows.results) existingSet.add(r.repo_name);
    }
    if (existingSet.size > 0) {
      const orderRow = await db.prepare(
        'SELECT MAX(display_order) AS max_order FROM repo_color_settings WHERE workspace_id = ?'
      ).bind(workspaceId).first<{ max_order: number | null }>();
      maxOrder = orderRow?.max_order ?? -1;
    }

    const defaultPalette = [
      '#667eea', '#e53e3e', '#38a169', '#ed8936', '#9f7aea',
      '#dd6b20', '#319795', '#d53f8c', '#3182ce', '#d69e2e',
      '#805ad5', '#2b6cb0', '#c53030', '#2f855a', '#b7791f',
    ];

    const newRepos = Array.from(repoSet).filter(r => !existingSet.has(r)).sort();
    if (newRepos.length === 0) {
      return c.json({ message: '全リポジトリ登録済みです', registered: 0, total: existingSet.size });
    }

    const now = new Date().toISOString();
    const stmts = newRepos.map((repo, i) => {
      const colorIndex = (existingSet.size + i) % defaultPalette.length;
      const order = maxOrder + 1 + i;
      return db.prepare(
        'INSERT OR IGNORE INTO repo_color_settings (workspace_id, repo_name, color_code, display_order, tags, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
      ).bind(workspaceId, repo, defaultPalette[colorIndex], order, '', now, now);
    });

    await db.batch(stmts);

    logger.info(`Synced ${newRepos.length} repos to repo_color_settings`, {
      userId: user.sub,
      workspaceId,
      newRepos,
    });

    return c.json({
      message: `${newRepos.length} 件のリポジトリを登録しました`,
      registered: newRepos.length,
      total: existingSet.size + newRepos.length,
      repos: newRepos,
    });
  } catch (error) {
    logger.error('Failed to sync repo colors', {
      userId: user.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'リポジトリ色設定の同期に失敗しました' }, 500);
  }
});

/**
 * リポジトリ色設定の一覧取得
 */
app.get('/api/repo-colors', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) {
    return c.json({ colors: [] });
  }
  try {
    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';
    const rows = await db.prepare(
      'SELECT repo_name, color_code, display_order, tags, is_visible FROM repo_color_settings WHERE workspace_id = ? ORDER BY display_order ASC, repo_name ASC'
    ).bind(workspaceId).all<{
      repo_name: string; color_code: string; display_order: number; tags: string; is_visible: number;
    }>();
    const colors = (rows.results ?? []).map(r => ({
      repoName: r.repo_name,
      colorCode: r.color_code,
      displayOrder: r.display_order,
      tags: r.tags,
      isVisible: r.is_visible === 1,
    }));
    return c.json({ colors });
  } catch (error) {
    logger.error('Failed to fetch repo colors', {
      userId: user.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'リポジトリ色設定の取得に失敗しました' }, 500);
  }
});

/**
 * リポジトリ色設定の個別更新
 */
app.patch('/api/repo-colors/:repoName{.+}', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'D1 is not configured' }, 500);
  }
  const repoName = c.req.param('repoName');
  try {
    const body = await c.req.json<{ colorCode?: string; tags?: string; isVisible?: boolean; displayOrder?: number }>();
    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';

    const updates: string[] = [];
    const values: (string | number)[] = [];
    if (body.colorCode !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(body.colorCode)) {
        return c.json({ error: '無効なカラーコードです' }, 400);
      }
      updates.push('color_code = ?');
      values.push(body.colorCode);
    }
    if (body.tags !== undefined) {
      updates.push('tags = ?');
      values.push(body.tags);
    }
    if (body.isVisible !== undefined) {
      updates.push('is_visible = ?');
      values.push(body.isVisible ? 1 : 0);
    }
    if (body.displayOrder !== undefined) {
      updates.push('display_order = ?');
      values.push(body.displayOrder);
    }
    if (updates.length === 0) {
      return c.json({ error: '更新するフィールドがありません' }, 400);
    }
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(workspaceId, repoName);

    const result = await db.prepare(
      `UPDATE repo_color_settings SET ${updates.join(', ')} WHERE workspace_id = ? AND repo_name = ?`
    ).bind(...values).run();

    if (result.meta.changes === 0) {
      return c.json({ error: '対象のリポジトリ色設定が見つかりません' }, 404);
    }
    return c.json({ message: '色設定を更新しました', repoName });
  } catch (error) {
    logger.error('Failed to update repo color', {
      userId: user.sub,
      repoName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'リポジトリ色設定の更新に失敗しました' }, 500);
  }
});

/**
 * リポジトリグループ一覧取得
 */
app.get('/api/repo-groups', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) {
    return c.json({ groups: [] });
  }
  try {
    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';
    const groupRows = await db.prepare(
      'SELECT id, name, description, color_code, icon, slack_channel_id, display_order, created_at, updated_at FROM repo_groups WHERE workspace_id = ? ORDER BY display_order ASC, name ASC'
    ).bind(workspaceId).all<{
      id: string; name: string; description: string; color_code: string;
      icon: string; slack_channel_id: string; display_order: number;
      created_at: string; updated_at: string;
    }>();

    const groups = groupRows.results ?? [];
    if (groups.length === 0) {
      return c.json({ groups: [] });
    }

    const groupIds = groups.map(g => g.id);
    const memberRows = await db.prepare(
      `SELECT group_id, repo_name FROM repo_group_members WHERE workspace_id = ? AND group_id IN (${groupIds.map(() => '?').join(',')}) ORDER BY repo_name`
    ).bind(workspaceId, ...groupIds).all<{ group_id: string; repo_name: string }>();

    const memberMap = new Map<string, string[]>();
    if (memberRows.results) {
      for (const m of memberRows.results) {
        const list = memberMap.get(m.group_id) || [];
        list.push(m.repo_name);
        memberMap.set(m.group_id, list);
      }
    }

    return c.json({
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        colorCode: g.color_code,
        icon: g.icon,
        slackChannelId: g.slack_channel_id,
        displayOrder: g.display_order,
        repos: memberMap.get(g.id) || [],
      })),
    });
  } catch (error) {
    logger.error('Failed to fetch repo groups', {
      userId: user.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'リポジトリグループの取得に失敗しました' }, 500);
  }
});

/**
 * リポジトリグループ作成
 */
app.post('/api/repo-groups', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'D1 is not configured' }, 500);
  }
  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      colorCode?: string;
      icon?: string;
      slackChannelId?: string;
      repos?: string[];
    }>();

    if (!body.name || body.name.trim() === '') {
      return c.json({ error: 'グループ名は必須です' }, 400);
    }
    if (body.colorCode && !/^#[0-9a-fA-F]{6}$/.test(body.colorCode)) {
      return c.json({ error: '無効なカラーコードです' }, 400);
    }

    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const orderRow = await db.prepare(
      'SELECT MAX(display_order) AS max_order FROM repo_groups WHERE workspace_id = ?'
    ).bind(workspaceId).first<{ max_order: number | null }>();
    const displayOrder = (orderRow?.max_order ?? -1) + 1;

    const stmts: D1PreparedStatement[] = [
      db.prepare(
        'INSERT INTO repo_groups (id, workspace_id, name, description, color_code, icon, slack_channel_id, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id, workspaceId, body.name.trim(),
        body.description ?? '', body.colorCode ?? '#667eea',
        body.icon ?? '', body.slackChannelId ?? '',
        displayOrder, now, now,
      ),
    ];

    const repos = body.repos ?? [];
    for (const repo of repos) {
      stmts.push(
        db.prepare(
          'INSERT INTO repo_group_members (group_id, repo_name, workspace_id, added_at) VALUES (?, ?, ?, ?)'
        ).bind(id, repo, workspaceId, now),
      );
    }

    await db.batch(stmts);

    logger.info('Created repo group', { userId: user.sub, workspaceId, groupId: id, name: body.name });
    return c.json({
      message: 'グループを作成しました',
      group: {
        id,
        name: body.name.trim(),
        description: body.description ?? '',
        colorCode: body.colorCode ?? '#667eea',
        icon: body.icon ?? '',
        slackChannelId: body.slackChannelId ?? '',
        displayOrder,
        repos,
      },
    }, 201);
  } catch (error) {
    logger.error('Failed to create repo group', {
      userId: user.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'リポジトリグループの作成に失敗しました' }, 500);
  }
});

/**
 * リポジトリグループ更新
 */
app.patch('/api/repo-groups/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'D1 is not configured' }, 500);
  }
  const groupId = c.req.param('id');
  try {
    const body = await c.req.json<{
      name?: string;
      description?: string;
      colorCode?: string;
      icon?: string;
      slackChannelId?: string;
      displayOrder?: number;
      repos?: string[];
    }>();

    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';
    const now = new Date().toISOString();

    const updates: string[] = [];
    const values: (string | number)[] = [];
    if (body.name !== undefined) {
      if (body.name.trim() === '') {
        return c.json({ error: 'グループ名は空にできません' }, 400);
      }
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.colorCode !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(body.colorCode)) {
        return c.json({ error: '無効なカラーコードです' }, 400);
      }
      updates.push('color_code = ?');
      values.push(body.colorCode);
    }
    if (body.icon !== undefined) {
      updates.push('icon = ?');
      values.push(body.icon);
    }
    if (body.slackChannelId !== undefined) {
      updates.push('slack_channel_id = ?');
      values.push(body.slackChannelId);
    }
    if (body.displayOrder !== undefined) {
      updates.push('display_order = ?');
      values.push(body.displayOrder);
    }

    const stmts: D1PreparedStatement[] = [];

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now);
      values.push(workspaceId, groupId);
      stmts.push(
        db.prepare(
          `UPDATE repo_groups SET ${updates.join(', ')} WHERE workspace_id = ? AND id = ?`
        ).bind(...values),
      );
    }

    if (body.repos !== undefined) {
      stmts.push(
        db.prepare(
          'DELETE FROM repo_group_members WHERE group_id = ? AND workspace_id = ?'
        ).bind(groupId, workspaceId),
      );
      for (const repo of body.repos) {
        stmts.push(
          db.prepare(
            'INSERT INTO repo_group_members (group_id, repo_name, workspace_id, added_at) VALUES (?, ?, ?, ?)'
          ).bind(groupId, repo, workspaceId, now),
        );
      }
      if (updates.length === 0) {
        stmts.push(
          db.prepare(
            'UPDATE repo_groups SET updated_at = ? WHERE workspace_id = ? AND id = ?'
          ).bind(now, workspaceId, groupId),
        );
      }
    }

    if (stmts.length === 0) {
      return c.json({ error: '更新するフィールドがありません' }, 400);
    }

    await db.batch(stmts);

    logger.info('Updated repo group', { userId: user.sub, workspaceId, groupId });
    return c.json({ message: 'グループを更新しました', groupId });
  } catch (error) {
    logger.error('Failed to update repo group', {
      userId: user.sub,
      groupId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'リポジトリグループの更新に失敗しました' }, 500);
  }
});

/**
 * リポジトリグループ削除
 */
app.delete('/api/repo-groups/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'D1 is not configured' }, 500);
  }
  const groupId = c.req.param('id');
  try {
    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';

    await db.batch([
      db.prepare(
        'DELETE FROM repo_group_members WHERE group_id = ? AND workspace_id = ?'
      ).bind(groupId, workspaceId),
      db.prepare(
        'DELETE FROM repo_groups WHERE id = ? AND workspace_id = ?'
      ).bind(groupId, workspaceId),
    ]);

    logger.info('Deleted repo group', { userId: user.sub, workspaceId, groupId });
    return c.json({ message: 'グループを削除しました', groupId });
  } catch (error) {
    logger.error('Failed to delete repo group', {
      userId: user.sub,
      groupId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'リポジトリグループの削除に失敗しました' }, 500);
  }
});

// =====================================================
// AI要約 API
// =====================================================

/**
 * AI要約HTMLビューア (クエリパラメータ方式 — Slackモーダルからの直接リンク用)
 */
app.get('/view', async (c) => {
  const db = c.env.DB;
  if (!db) return c.text('DB not available', 500);

  const requestId = c.req.query('id');
  if (!requestId) return c.text('id parameter is required', 400);

  const row = await db.prepare(
    'SELECT request_id, daily_seq, event_date, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, created_at FROM ai_summary_log WHERE request_id = ?'
  ).bind(requestId).first() as SummaryModalRow | null;

  if (!row) return c.text('Not found', 404);

  await db.prepare(
    'UPDATE ai_summary_log SET view_count = view_count + 1 WHERE request_id = ?'
  ).bind(requestId).run();

  const reviews = await db.prepare(
    'SELECT rating, reviewer_type, reviewer_name, comment, created_at FROM ai_summary_reviews WHERE summary_request_id = ? ORDER BY created_at DESC'
  ).bind(requestId).all();

  const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const summaryText = row.summary ? sanitizeBoxDrawing(row.summary) : '(要約なし)';
  const prLink = row.pr_url ? `<a href="${escHtml(row.pr_url)}">PR #${row.pr_number}</a>` : `PR #${row.pr_number ?? '?'}`;

  const reviewRows = (reviews.results ?? []).map((r: any) =>
    `<tr><td>${escHtml(r.rating)}</td><td>${escHtml(r.reviewer_name ?? '')}</td><td>${escHtml(r.comment ?? '')}</td><td>${escHtml(r.created_at ?? '')}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI要約 #${row.daily_seq}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;background:#1a1a2e;color:#e0e0e0}
a{color:#6cb4ee}h1{font-size:1.4rem;color:#f0f0f0}h2{color:#d0d0d0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #3a3a5c;padding:8px;text-align:left}
th{background:#2a2a4a;color:#c0c0c0}td{background:#22223a}pre{background:#0d0d1a;color:#d4d4d4;padding:1rem;border-radius:6px;overflow-x:auto;white-space:pre-wrap;border:1px solid #3a3a5c}
.meta{display:grid;grid-template-columns:auto 1fr;gap:0.25rem 1rem;margin:1rem 0}.meta dt{font-weight:bold;color:#9090b0;text-align:right;white-space:nowrap}.meta dd{margin:0;color:#d0d0d0}
details{margin-bottom:1rem}summary{cursor:pointer;font-size:1.4rem;font-weight:bold;color:#f0f0f0;padding:0.5rem 0}summary:hover{color:#6cb4ee}</style>
</head><body>
<details><summary>AI要約 #${row.daily_seq} (${escHtml(row.event_date)}) — ${escHtml(row.repo_full_name ?? '(不明)')} ${prLink}</summary>
<dl class="meta">
<dt>リポジトリ</dt><dd>${escHtml(row.repo_full_name ?? '(不明)')}</dd>
<dt>PR</dt><dd>${prLink}</dd>
<dt>アクション</dt><dd>${escHtml(row.pr_action ?? '')}</dd>
<dt>モデル</dt><dd>${escHtml(row.model ?? '(不明)')}</dd>
<dt>Diff長</dt><dd>${row.diff_length ?? 0} 文字</dd>
<dt>日時</dt><dd>${escHtml(row.created_at)}</dd>
<dt>Request ID</dt><dd style="font-size:0.85rem">${escHtml(row.request_id)}</dd>
</dl>
</details>
<h2>要約</h2>
<pre>${escHtml(summaryText)}</pre>
${reviewRows ? `<details><summary>D1上のイメージ</summary><table><thead><tr><th>評価</th><th>レビュアー</th><th>コメント</th><th>日時</th></tr></thead><tbody>${reviewRows}</tbody></table></details>` : ''}
<footer style="margin-top:2rem;padding-top:1rem;border-top:1px solid #3a3a5c;font-size:0.85rem;color:#707090">AI要約時に生成された Request ID (UUIDv4) は <code>/ai-summary/{id}</code> でHTMLページとしてリクエストできます。</footer>
</body></html>`;

  return c.html(html);
});

/**
 * AI要約詳細ページ (パスパラメータ方式 — /view へのフォールバック)
 */
app.get('/ai-summary/:id', async (c) => {
  const db = c.env.DB;
  if (!db) return c.text('DB not available', 500);

  const requestId = c.req.param('id');
  const row = await db.prepare(
    'SELECT request_id, daily_seq, event_date, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, created_at FROM ai_summary_log WHERE request_id = ?'
  ).bind(requestId).first() as SummaryModalRow | null;

  if (!row) return c.text('Not found', 404);

  await db.prepare(
    'UPDATE ai_summary_log SET view_count = view_count + 1 WHERE request_id = ?'
  ).bind(requestId).run();

  const reviews = await db.prepare(
    'SELECT rating, reviewer_type, reviewer_name, comment, created_at FROM ai_summary_reviews WHERE summary_request_id = ? ORDER BY created_at DESC'
  ).bind(requestId).all();

  const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const summaryText = row.summary ? sanitizeBoxDrawing(row.summary) : '(要約なし)';
  const prLink = row.pr_url ? `<a href="${escHtml(row.pr_url)}">PR #${row.pr_number}</a>` : `PR #${row.pr_number ?? '?'}`;

  const reviewRows = (reviews.results ?? []).map((r: any) =>
    `<tr><td>${escHtml(r.rating)}</td><td>${escHtml(r.reviewer_name ?? '')}</td><td>${escHtml(r.comment ?? '')}</td><td>${escHtml(r.created_at ?? '')}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI要約 #${row.daily_seq}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;background:#1a1a2e;color:#e0e0e0}
a{color:#6cb4ee}h1{font-size:1.4rem;color:#f0f0f0}h2{color:#d0d0d0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #3a3a5c;padding:8px;text-align:left}
th{background:#2a2a4a;color:#c0c0c0}td{background:#22223a}pre{background:#0d0d1a;color:#d4d4d4;padding:1rem;border-radius:6px;overflow-x:auto;white-space:pre-wrap;border:1px solid #3a3a5c}
.meta{display:grid;grid-template-columns:auto 1fr;gap:0.25rem 1rem;margin:1rem 0}.meta dt{font-weight:bold;color:#9090b0;text-align:right;white-space:nowrap}.meta dd{margin:0;color:#d0d0d0}
details{margin-bottom:1rem}summary{cursor:pointer;font-size:1.4rem;font-weight:bold;color:#f0f0f0;padding:0.5rem 0}summary:hover{color:#6cb4ee}</style>
</head><body>
<details><summary>AI要約 #${row.daily_seq} (${escHtml(row.event_date)}) — ${escHtml(row.repo_full_name ?? '(不明)')} ${prLink}</summary>
<dl class="meta">
<dt>リポジトリ</dt><dd>${escHtml(row.repo_full_name ?? '(不明)')}</dd>
<dt>PR</dt><dd>${prLink}</dd>
<dt>アクション</dt><dd>${escHtml(row.pr_action ?? '')}</dd>
<dt>モデル</dt><dd>${escHtml(row.model ?? '(不明)')}</dd>
<dt>Diff長</dt><dd>${row.diff_length ?? 0} 文字</dd>
<dt>日時</dt><dd>${escHtml(row.created_at)}</dd>
<dt>Request ID</dt><dd style="font-size:0.85rem">${escHtml(row.request_id)}</dd>
</dl>
</details>
<h2>要約</h2>
<pre>${escHtml(summaryText)}</pre>
${reviewRows ? `<details><summary>D1上のイメージ</summary><table><thead><tr><th>評価</th><th>レビュアー</th><th>コメント</th><th>日時</th></tr></thead><tbody>${reviewRows}</tbody></table></details>` : ''}
<footer style="margin-top:2rem;padding-top:1rem;border-top:1px solid #3a3a5c;font-size:0.85rem;color:#707090">AI要約時に生成された Request ID (UUIDv4) は <code>/ai-summary/{id}</code> でHTMLページとしてリクエストできます。</footer>
</body></html>`;

  return c.html(html);
});

/**
 * AI要約詳細取得 + view_count インクリメント
 */
app.get('/api/ai-summary/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);

  const requestId = c.req.param('id');
  const row = await db.prepare(
    'SELECT * FROM ai_summary_log WHERE request_id = ?'
  ).bind(requestId).first();
  if (!row) return c.json({ error: 'Not found' }, 404);

  await db.prepare(
    'UPDATE ai_summary_log SET view_count = view_count + 1 WHERE request_id = ?'
  ).bind(requestId).run();

  const reviews = await db.prepare(
    'SELECT * FROM ai_summary_reviews WHERE summary_request_id = ? ORDER BY created_at DESC'
  ).bind(requestId).all();

  return c.json({ summary: { ...row, view_count: (row.view_count as number ?? 0) + 1 }, reviews: reviews.results ?? [] });
});

/**
 * AI要約レビュー登録
 */
app.post('/api/ai-summary/:id/feedback', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);

  const requestId = c.req.param('id');
  const body = await c.req.json<{
    rating: string;
    reviewer_type?: string;
    reviewer_name?: string;
    review_model?: string;
    comment?: string;
  }>();

  if (!body.rating || !['good', 'bad'].includes(body.rating)) {
    return c.json({ error: 'rating must be "good" or "bad"' }, 400);
  }

  const existing = await db.prepare(
    'SELECT request_id FROM ai_summary_log WHERE request_id = ?'
  ).bind(requestId).first();
  if (!existing) return c.json({ error: 'Summary not found' }, 404);

  const now = new Date().toISOString();
  const reviewerType = body.reviewer_type || 'human';

  await db.prepare(`
    INSERT INTO ai_summary_reviews
      (summary_request_id, rating, reviewer_type, reviewer_name, review_model, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    requestId,
    body.rating,
    reviewerType,
    body.reviewer_name || null,
    body.review_model || null,
    body.comment || null,
    now,
  ).run();

  return c.json({ success: true });
});

/**
 * AI要約 解決フラグ更新
 */
app.post('/api/ai-summary/:id/resolve', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);

  const requestId = c.req.param('id');
  const body = await c.req.json<{
    resolved: boolean;
    resolution_note?: string;
  }>();

  const existing = await db.prepare(
    'SELECT request_id FROM ai_summary_log WHERE request_id = ?'
  ).bind(requestId).first();
  if (!existing) return c.json({ error: 'Summary not found' }, 404);

  const now = new Date().toISOString();
  const resolved = body.resolved ? 1 : 0;

  await db.prepare(`
    UPDATE ai_summary_log
    SET resolved = ?, resolved_at = ?, resolution_note = ?
    WHERE request_id = ?
  `).bind(
    resolved,
    resolved ? now : null,
    body.resolution_note || null,
    requestId,
  ).run();

  return c.json({ success: true });
});

/**
 * ワークスペース一覧取得
 */
app.get('/api/workspaces', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) {
    return c.json({ workspaces: [], current: null });
  }

  const workspaces = await getUserWorkspaces(c.env.DB, user.sub);
  const current = await getCurrentWorkspace(c.env.DB, user.sub);

  return c.json({
    workspaces,
    current: current ? { workspaceId: current.workspaceId, workspaceName: current.workspaceName, teamId: current.teamId, teamName: current.teamName } : null,
  });
});

/**
 * ワークスペース切り替え
 */
app.post('/api/workspaces/switch', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) {
    return c.json({ error: 'Database not available' }, 500);
  }

  const { workspaceId } = await c.req.json<{ workspaceId: string }>();
  if (!workspaceId || typeof workspaceId !== 'string') {
    return c.json({ error: '無効なワークスペースIDです' }, 400);
  }

  const success = await switchWorkspace(c.env.DB, user.sub, workspaceId);
  if (!success) {
    return c.json({ error: 'ワークスペースの切り替えに失敗しました' }, 403);
  }

  return c.json({ message: 'ワークスペースを切り替えました', workspaceId });
});

/**
 * インストール権限の最新データを返す（ページ読み込み時の差分チェック用）
 */
app.get('/api/repo-permissions', authMiddleware, async (c) => {
  const user = c.get('user');

  // D1 から読み取り（Webhook で保存されたデータ）
  const d1Data = await getInstallationPermissionsFromD1(c.env.DB);
  if (d1Data) {
    return c.json({ permissions: d1Data.permissions, allPermissions: d1Data.allPermissions, source: 'd1' });
  }

  // D1 にデータがない場合は GitHub API にフォールバック
  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  if (!accessToken) {
    return c.json({ permissions: {} });
  }

  try {
    const installMap = await buildRepoInstallationPermissionsMap(accessToken);
    const result: Record<string, { permissions: Record<string, string>; repositorySelection: string }> = {};
    let allPerms: Record<string, string> | null = null;

    for (const [key, value] of installMap.entries()) {
      if (key.startsWith('__all__')) {
        allPerms = value.permissions;
      } else {
        result[key] = {
          permissions: value.permissions,
          repositorySelection: value.repositorySelection,
        };
      }
    }

    return c.json({ permissions: result, allPermissions: allPerms, source: 'api' });
  } catch (error) {
    logger.warn('Failed to fetch repo installation permissions', {
      userId: user.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ permissions: {} });
  }
});

// =====================================================
// 診断エンドポイント
// =====================================================

/**
 * D1接続診断（認証が必要）
 */
app.get('/api/debug/d1', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const result: Record<string, unknown> = {
    db_binding_exists: !!db,
    user: user.sub,
  };

  if (!db) {
    return c.json({ ...result, error: 'DB binding is undefined - D1 is not bound' }, 500);
  }

  try {
    // テーブル存在確認
    const tables = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'"
    ).first();
    result.table_exists = !!tables;

    // カラム確認
    const columns = await db.prepare("PRAGMA table_info(user_sessions)").all();
    result.columns = columns.results?.map((col: Record<string, unknown>) => col.name) ?? [];

    // ユーザーのレコード確認
    const userRecord = await db.prepare(
      'SELECT user_id, timezone, session_duration, last_login_at, current_login_at, updated_at, display_name, CASE WHEN github_access_token IS NOT NULL THEN \'[SET]\' ELSE \'[NULL]\' END as token_status FROM user_sessions WHERE user_id = ?'
    ).bind(user.sub).first();
    result.user_record = userRecord ?? 'NOT FOUND';

    // 全レコード数
    const count = await db.prepare('SELECT COUNT(*) as cnt FROM user_sessions').first<{ cnt: number }>();
    result.total_records = count?.cnt ?? 0;

    // テスト書き込み
    const now = new Date().toISOString();
    try {
      await db.prepare(`
        INSERT INTO user_sessions (user_id, timezone, session_duration, current_login_at, updated_at)
        VALUES (?, 'JST', '1h', ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET updated_at = ?
      `).bind(user.sub, now, now, now).run();
      result.test_write = 'SUCCESS';
    } catch (writeError) {
      result.test_write = 'FAILED';
      result.test_write_error = writeError instanceof Error ? writeError.message : 'Unknown error';
    }

    // テスト書き込み後の確認
    const afterWrite = await db.prepare(
      'SELECT user_id, timezone, session_duration, current_login_at, updated_at FROM user_sessions WHERE user_id = ?'
    ).bind(user.sub).first();
    result.after_test_write = afterWrite ?? 'NOT FOUND';
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.stack = error instanceof Error ? error.stack : undefined;
  }

  return c.json(result);
});

/**
 * GitHub App インストール権限の診断（認証が必要）
 * GET /user/installations の生レスポンスを確認できる
 */
app.get('/api/debug/installations', authMiddleware, async (c) => {
  const user = c.get('user');
  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  if (!accessToken) {
    return c.json({ error: 'アクセストークンが保存されていません', user: user.sub });
  }

  const result: Record<string, unknown> = { user: user.sub };

  // Step 1: GET /user/installations
  const diag = await getGitHubUserInstallationsWithDiag(accessToken);
  result.installations_api = {
    status: diag.status,
    error: diag.error,
    total_count: diag.totalCount,
    installation_count: diag.installationCount,
  };

  if (!diag.installations || diag.installations.length === 0) {
    result.installations = [];
    result.repo_permissions = {};
    return c.json(result);
  }

  // Step 2: 各インストールの詳細
  const installDetails: Record<string, unknown>[] = [];
  for (const inst of diag.installations) {
    const detail: Record<string, unknown> = {
      id: inst.id,
      app_id: inst.app_id,
      app_slug: inst.app_slug,
      repository_selection: inst.repository_selection,
      permissions: inst.permissions,
    };

    if (inst.repository_selection !== 'all') {
      const repos = await getGitHubInstallationRepos(accessToken, inst.id);
      detail.repos = repos.map(r => ({ name: r.name, full_name: r.full_name, private: r.private }));
      detail.repo_count = repos.length;
    } else {
      detail.repos = '(all repositories)';
    }

    installDetails.push(detail);
  }
  result.installations = installDetails;

  // Step 3: buildRepoInstallationPermissionsMap の結果
  try {
    const permMap = await buildRepoInstallationPermissionsMap(accessToken);
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of permMap.entries()) {
      serialized[key] = {
        installationId: value.installationId,
        permissions: value.permissions,
        repositorySelection: value.repositorySelection,
      };
    }
    result.repo_permissions = serialized;
  } catch (error) {
    result.repo_permissions_error = error instanceof Error ? error.message : 'Unknown error';
  }

  return c.json(result);
});

// =====================================================
// Cloudflare セットアップ通知 API
// =====================================================

/**
 * 未消化の Cloudflare セットアップ通知一覧を取得
 */
app.get('/api/cloudflare-setup-pending', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) {
    return c.json({ notifications: [] });
  }

  try {
    const rows = await db.prepare(`
      SELECT id, repo_owner, repo_name, repo_full_name, is_private, created_at
      FROM cloudflare_setup_pending
      WHERE user_id = ? AND dismissed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(user.sub).all<{
      id: number;
      repo_owner: string;
      repo_name: string;
      repo_full_name: string;
      is_private: number;
      created_at: string;
    }>();

    return c.json({
      notifications: (rows.results ?? []).map((row) => ({
        id: row.id,
        repoOwner: row.repo_owner,
        repoName: row.repo_name,
        repoFullName: row.repo_full_name,
        isPrivate: row.is_private === 1,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    logger.error('Failed to fetch Cloudflare setup pending notifications', {
      userId: user.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ notifications: [] });
  }
});

/**
 * Cloudflare セットアップ通知を消化（dismiss）する
 */
app.post('/api/cloudflare-setup-pending/:id/dismiss', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const notificationId = c.req.param('id');

  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    const now = new Date().toISOString();
    const result = await db.prepare(`
      UPDATE cloudflare_setup_pending
      SET dismissed_at = ?
      WHERE id = ? AND user_id = ? AND dismissed_at IS NULL
    `).bind(now, notificationId, user.sub).run();

    if (result.meta?.changes === 0) {
      return c.json({ error: '通知が見つかりません' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error('Failed to dismiss Cloudflare setup pending notification', {
      userId: user.sub,
      notificationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'Failed to dismiss notification' }, 500);
  }
});

/**
 * 全ての Cloudflare セットアップ通知を一括消化
 */
app.post('/api/cloudflare-setup-pending/dismiss-all', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE cloudflare_setup_pending
      SET dismissed_at = ?
      WHERE user_id = ? AND dismissed_at IS NULL
    `).bind(now, user.sub).run();

    return c.json({ success: true });
  } catch (error) {
    logger.error('Failed to dismiss all Cloudflare setup pending notifications', {
      userId: user.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'Failed to dismiss notifications' }, 500);
  }
});

// =====================================================
// リポジトリ作成API
// =====================================================

app.post('/api/repositories', authMiddleware, async (c) => {
  const user = c.get('user');
  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  const body = await c.req.json<{ name?: string; isPrivate?: boolean; description?: string }>();

  const result = await executeCreateRepo({
    accessToken,
    userId: user.sub,
    name: body.name,
    isPrivate: body.isPrivate ?? false,
    description: body.description,
    deps: {
      getUserRepos: (token) => getGitHubUserRepos({ accessToken: token }),
      createRepo: createGitHubRepo,
    },
  });

  if (result.ok) {
    // Cloudflare セットアップ通知を D1 に保存
    let cloudflareSetupPendingId: number | null = null;
    const db = c.env.DB;
    if (db) {
      const now = new Date().toISOString();
      const repoFullName = `${user.sub}/${result.repository.name}`;
      try {
        const insertResult = await db.prepare(`
          INSERT INTO cloudflare_setup_pending (user_id, repo_owner, repo_name, repo_full_name, is_private, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, repo_full_name) DO NOTHING
        `).bind(
          user.sub,
          user.sub,
          result.repository.name,
          repoFullName,
          body.isPrivate ? 1 : 0,
          now,
        ).run();
        if (insertResult.meta?.last_row_id) {
          cloudflareSetupPendingId = insertResult.meta.last_row_id as number;
        }
        logger.info('Saved Cloudflare setup pending notification (repo create)', {
          userId: user.sub,
          repoFullName,
        });
      } catch (error) {
        logger.error('Failed to save Cloudflare setup pending notification', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return c.json({
      message: `リポジトリ "${result.repository.name}" を作成しました。`,
      repository: result.repository,
      cloudflareSetupPending: cloudflareSetupPendingId ? {
        id: cloudflareSetupPendingId,
        repoFullName: `${user.sub}/${result.repository.name}`,
      } : null,
    }, result.status);
  }

  if (result.status === 403 || result.status === 422) {
    logger.error('Failed to create GitHub repository', {
      userId: user.sub,
      repoName: body.name,
      error: result.error,
    });
  }

  return c.json({
    error: result.error,
    ...(result.requireReauth ? { requireReauth: true } : {}),
  }, result.status);
});

// =====================================================
// エラーハンドリング
// =====================================================

app.notFound((c) => {
  return c.json({ error: 'エンドポイントが見つかりません' }, 404);
});

app.onError((err, c) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });

  logger.recordMetric(c.env.ANALYTICS, 'unhandled_error', {
    path: c.req.path,
    method: c.req.method,
    timestamp: Date.now(),
  });

  return jsonUtf8({ error: 'サーバーエラーが発生しました' }, 500);
});

export default app;
