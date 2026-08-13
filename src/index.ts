/**
 * Cloudflare Workers GitHub OAuth
 * GitHub OAuthとJWT認証の実装
 */

import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { createJWT, JWTPayload } from './utils/jwt';
// NOTE: レートリミットはCloudflare WAFのRate Limiting Rulesで設定することを推奨します
// Cloudflare Workersはステートレスなため、アプリ内でのレートリミットには
// Durable ObjectsやKVなどの外部ストアが必要です
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import { getSessionExpiredPage } from './views/session-expired';
import { getLoginPage } from './views/login';
import { getWelcomePage } from './views/welcome';
import { getAiChatPage, DEFAULT_AICHAT_MODELS } from './views/aichat';
import { getAiChatSharePage, getAiChatShareNotFoundPage } from './views/aichat-share';
import { getSettingsPage } from './views/settings';
import { getRepositoriesPage } from './views/repositories';
import { getUserInfoPage } from './views/userinfo';
import { getMarkdownPreviewPage } from './views/markdown-preview';
import { getCacheStatusPage, CacheStatusData, TableStatusEntry, UserContextInfo, RepoColorEntry, RepoGroupEntry } from './views/status';
import { renderColumnStatsHtml } from './views/columnStats';
import { getFunctionChangelogPage, type FunctionChangeRow, type CatalogFunctionRow } from './views/functionChangelog';
import { getKwArchitecturePage } from './views/kw-architecture';
import { getKwDrilldownPage } from './views/kw-drilldown';
import { getCfDashboardPage } from './views/cf-dashboard';
import { getApisPage } from './views/apis';
import { getHtmlRewriterDemoPage } from './views/htmlrewriterDemo';
import { getFetchTextStreamDemoPage } from './views/fetchTextStreamDemo';
import { getWebGLDemoPage } from './views/webglDemo';
import { getWebGLSpherePage } from './views/webglSphere';
import { getWebGLHeritagePage } from './views/webglHeritage';
import { getHeritageAccessPage } from './views/heritageAccess';
import { getHeritageAreaPage } from './views/heritageArea';
import { getHeritageJourneyPage } from './views/heritageJourney';
import { getWebGLLVSpherePage } from './views/webglLVSphere';
import { getWebGLCubePage } from './views/webglCube';
import { getWebGLSolarPage } from './views/webglSolar';
import { getMoondreamVlmPage } from './views/moondreamVlm';
import { getMoondreamAnalyzeLogPage, type MoondreamAnalyzeLogRow } from './views/moondreamAnalyzeLog';
import { getAichatImageGalleryPage } from './views/aichatImageGallery';
import { getEclipseTiltLessonPage } from './views/eclipseTiltLesson';
import { getWebGLFaultsPage } from './views/webglFaults';
import { getUuidGenPage } from './views/uuidGen';
import { getAnswerGraphPage } from './views/answerGraph';
import { getBase64Page } from './views/base64';
import { getHarnessLogPage, type HarnessHookLogRow, type HarnessLogResultCounts } from './views/harnessLog';
import { getMLBSpherePage } from './views/mlbSphere';
import { getWorldCupWdlPage } from './views/worldCupWdl';
import { getWorldCupKnockoutPage } from './views/worldCupKnockout';
import { getTdfPage } from './views/tdf';
import { getAirlineNetworkPage } from './views/airlineNetwork';
import { getChessTsumePage } from './views/chessBoard';
import { getMatrixRainPage } from './views/matrixRain';
import { getImageSpin3dPage } from './views/imageSpin3d';
import { getGalaxyPage } from './views/galaxy';
import { findNearbyCities } from './utils/worldCities';
import { getAuthFlowPage } from './views/authFlow';
import { getTsubuyakiPage } from './views/tsubuyaki';
import { validateFreeText, buildFreeTextSlackMessage, handleTsubuyakiSlashCommand } from './utils/freeTextSlackPost';
import { handleF1ScheduleSlashCommand } from './utils/f1ScheduleSlackPost';
import { resolveNotifyConfig, isNotifyConfigured, sendNotification as dispatchNotification } from './utils/notifyDispatch';
import { F1_CIRCUITS } from './data/f1Circuits';

import { computeColumnRelationStats, verifyColumnStats, type TableSchema, type Relation } from './utils/columnRelationStats';
import { ensureDefaultWorkspace, getCurrentWorkspace, getUserWorkspaces, switchWorkspace } from './utils/workspace';
import { getGitHubAccessToken, getGitHubLatestCommit, getGitHubCommitCount, getGitHubCommits, getGitHubCommitsForStats, computeCommitStats, getGitHubRepoOpenIssuesCount, getGitHubRepoCommitsByMonth, getGitHubRepoCommitsByDate, getGitHubRepoInfo, getGitHubTokenScopes, getGitHubUser, getGitHubUserEmail, getGitHubUserRepos, createGitHubRepo, GitHubTokenScopesError, buildRepoInstallationPermissionsMap, RepoInstallationPermissions, getGitHubUserInstallationsWithDiag, getGitHubInstallationRepos, getExternalServiceLinkedRepos, getSlackLinkedReposByWebhooks, sumCountsTotal, buildPastMonthRange, CommitDetail, toClientCommit } from './utils/github';
import { getCookieValue, getCookieValues } from './utils/cookie';
import { verifyResendWebhookSignature } from './utils/resendWebhook';
import { verifyGitHubWebhookSignature } from './utils/githubWebhook';
import { extractCfAuthUsername } from './utils/cfAuthAccess';
import { postSlackMessage, openSlackModal, respondToInteraction } from './utils/slack';
import { sendTestEmailResend } from './utils/emailVerify';
import { buildAuthRedirectHeaders } from './utils/emailConfirm';
import { runEmailConfirmGate, resolveEmailConfirmToken, renderLoginConfirmErrorPage, isEmailConfirmLoginEnabled } from './utils/emailConfirmGate';
import { fetchPrDiff, runSummaryPipeline, buildSlackMessage, buildSummaryModal, buildSummaryFallbackBlocks, classifySummaryResult, resolveAiModel, extractDesignDiff, sanitizeBoxDrawing, detectCommitAgentFromText, detectCommitAgentFromPrText, describeModelSwitch, WORKER_BASE_URL, DESIGN_SPEC_CHECKLIST, DEFAULT_AI_MODEL, FALLBACK_AI_MODEL, type SummaryModalRow } from './utils/aiSummary';
import { getSessionDurationSeconds, renewSession, resolveSessionDuration } from './utils/session';
import { buildCommitAgentLogEntry, classifyCommitAgentFetchError } from './utils/commitAgentLog';
import { verifySlackSignature } from './utils/slackSignature';
import { handleSlackInteraction, type SlackAiReplyTask } from './utils/slackInteraction';
import { handleSlackEvent } from './utils/slackEvent';
import { handleSlackAppMention } from './utils/slackMentionReply';
import { SLACK_AI_MODEL, type AiUsage } from './utils/slackAiReply';
import { buildAichatSourceTotals } from './utils/aichatSourceStats';
import { exchangeSlackOAuthCode } from './utils/slackOauth';
import { executeCreateRepo } from './utils/repoValidation';
import { validateReturnTo } from './utils/returnTo';
import * as logger from './utils/logger';
import { resolveIdleTimeoutSeconds, type Bindings, type Variables, type GitHubWebhookInstallationPayload, type GitHubWebhookRepositoryPayload, type GitHubWebhookPullRequestPayload, type ResendWebhookPayload } from './types';
import { withAiTimeout, AI_CLASSIFY_TIMEOUT_MS } from './utils/aiTimeout';
import { computeConversationHash, computeQuestionHash } from './utils/conversationHash';
import { buildAiMessages, ALLOWED_MODES, type SystemPromptMode } from './utils/buildAiMessages';
import { stripThinkTags } from './utils/stripThinkTags';
import { interpretAichatSlashCommand, type CommitAgentLogRow } from './utils/aichatSlashCommand';
import { AICHAT_MODEL_MAX_TOKENS, getModelRunParams, assignModelColors } from './utils/aichatModelConfig';
import { extractAiUsage } from './utils/aiUsage';
import { validateImageDataUrl, attachImageToLastUserMessage, resolveAichatModelsForRequest } from './utils/aichatImage';
import {
  MOONDREAM_MODEL,
  MOONDREAM_DEFAULT_PROMPT,
  validateMoondreamImageDataUrl,
  estimateImageByteLength,
  buildMoondreamRunParams,
  parseMoondreamResponse,
} from './utils/moondreamAnalyze';
import { extractFunctionSource } from './utils/extractFunctionSource';
import { listD1Databases, getD1Tables } from './utils/cloudflareApi';
import { validateRevokeRequest } from './utils/revoke';
import { HERITAGE_FLAG_MAP, HERITAGE_COUNTRY_MAP, HERITAGE_LIST } from './data/heritageList';
import { RAIL_LINES } from './data/railLines';
import { AIRPORT_LIST } from './data/airports';
import { findNearbyStationsAndHeritage, dedupeNearbyPoints, findNearbyHeritageForAirport, diffAirportNearbyHeritage, findNearbyAirports, diffAirportNearbyAirport } from './utils/railLineStations';
import { questionStartsWithHeritageBracket } from './utils/heritageQuestionMatch';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const resendWebhookDedupCache = new Map<string, number>();
const DEFAULT_TIMEZONE = 'JST';
const DEFAULT_COMMIT_HISTORY_PAGE_SIZE = 10;
const STATUS_TABLE_PREVIEW_LIMIT = 20;

type SyncPolicy = 'auto' | 'manual' | 'readonly';

function normalizeSyncPolicy(value: string): SyncPolicy {
  return value === 'auto' || value === 'manual' || value === 'readonly' ? value : 'manual';
}

export type StatusTableDefinition = {
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

export const STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [
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
  { name: 'ts_function_callers',     migration: '0053',       description: '関数カタログ: 関数呼び出し元マッピング',   syncPolicy: 'manual' },
  { name: 'aichat_rate_limit',       migration: '0055',       description: 'AIチャットレートリミットカウンタ',            syncPolicy: 'auto' },
  { name: 'api_endpoint_stats',      migration: '0056',       description: 'APIエンドポイント別アクセス集計',              syncPolicy: 'auto' },
  { name: 'api_search_keywords',     migration: '0057',       description: 'APIページ検索キーワード登録',                   syncPolicy: 'manual' },
  { name: 'api_search_keyword_sections', migration: '0058',   description: 'APIページ検索キーワードのセクション別件数',       syncPolicy: 'manual' },
  { name: 'webhook_log',               migration: '0061',   description: 'Webhook受信ログ（全ソース共通）',                   syncPolicy: 'auto' },
  { name: 'uuid_history',             migration: '0062',   description: 'UUID生成履歴',                                        syncPolicy: 'auto' },
  { name: 'heritage_cities',          migration: '0063',   description: '世界遺産周辺都市キャッシュ',                              syncPolicy: 'auto' },
  { name: 'heritage_city_fetched',    migration: '0063',   description: '世界遺産都市検索済みフラグ',                              syncPolicy: 'auto' },
  { name: 'rail_station_cities',      migration: '0067',   description: '鉄道駅周辺都市キャッシュ',                                syncPolicy: 'auto' },
  { name: 'rail_station_fetched',     migration: '0067',   description: '鉄道駅都市検索済みフラグ',                                syncPolicy: 'auto' },
  { name: 'cf_auth_access_log',       migration: '0068',   description: 'cf-authウェブフックのアクセス権限判定ログ（OK/NG）',        syncPolicy: 'auto' },
  { name: 'rail_line_stations',       migration: '0069',   description: '世界の鉄道路線サイドパネルの全駅データ（座標・国・国旗・順序）',    syncPolicy: 'manual' },
  { name: 'rail_station_nearby_points', migration: '0070', description: '駅から100km圏内の駅・世界遺産の距離キャッシュ',              syncPolicy: 'auto' },
  { name: 'rail_station_nearby_fetched', migration: '0070', description: '駅の近隣ポイント検索済みフラグ',                              syncPolicy: 'auto' },
  { name: 'heritage_ai_question_masters', migration: '0065', description: 'AI質問トピックのマスタ（交通手段・見どころ等）',              syncPolicy: 'manual' },
  { name: 'heritage_question_view_log', migration: '0066',   description: '世界遺産ページのAI質問閲覧ログ（トピック別）',                syncPolicy: 'auto' },
  { name: 'heritage_area_boxes',        migration: '0072',   description: '世界遺産ページの保存済みエリア範囲（テーブルA相当）',          syncPolicy: 'auto' },
  { name: 'heritage_area_items',        migration: '0073',   description: '保存済みエリア内の世界遺産・空港・駅・火山などの紐付け',      syncPolicy: 'auto' },
  { name: 'slack_installations',        migration: '0071',   description: 'Slack OAuthワークスペースインストール情報（botトークン等）',   syncPolicy: 'manual' },
  { name: 'notification_settings',      migration: '0075',   description: 'Slack通知ON/OFFのユーザーオプション設定（単一行）',            syncPolicy: 'auto' },
  { name: 'email_confirm_tokens',       migration: '0076',   description: 'RESEND_API_KEY設定時のログイン確認メール保留トークン（クリックで発行完了）', syncPolicy: 'auto' },
  { name: 'airport_nearby_heritage',    migration: '0078',   description: '空港から300km圏内の世界遺産の距離記録（着陸ボタンで記録）', syncPolicy: 'auto' },
  { name: 'airport_nearby_airport',     migration: '0079',   description: '空港から1500km圏内の他空港の距離記録（着陸ボタンで記録）', syncPolicy: 'auto' },
  { name: 'unresolved_airport_keywords', migration: '0080',  description: 'heritage-areaページで国旗・座標が判明しなかった空港名キーワードの記録', syncPolicy: 'auto' },
  { name: 'unresolved_castle_keywords', migration: '0081',   description: 'heritage-areaページで国旗・座標が判明しなかった「(カタカナ)城」キーワードの記録', syncPolicy: 'auto' },
  { name: 'unresolved_station_keywords', migration: '0082',  description: 'heritage-areaページで国旗・座標が判明しなかった駅名キーワードの記録', syncPolicy: 'auto' },
  { name: 'harness_hook_log',            migration: '0083',  description: 'Claude CodeのPostToolUseフック発火ログ（チェック名・結果フラグ・詳細）', syncPolicy: 'auto' },
  { name: 'aichat_keyword_categories',    migration: '0084',  description: 'AIチャットキーワード分類のカテゴリマスタ（名前・色）', syncPolicy: 'auto' },
  { name: 'aichat_keyword_category_map',  migration: '0085',  description: 'AIチャットキーワード↔カテゴリの紐付け', syncPolicy: 'auto' },
  { name: 'aichat_category_audit_log',    migration: '0086',  description: 'AIチャット分類グループ・キーワード分類の作成/更新/削除の監査ログ', syncPolicy: 'auto' },
  { name: 'aichat_keyword_embeddings',    migration: '0087',  description: 'AIチャットキーワードのbge-m3埋め込みベクトルキャッシュ（キーワード単位で最新1件のみ保持）', syncPolicy: 'auto' },
  { name: 'aichat_keyword_category_suggestions', migration: '0088', description: 'AIによるキーワード↔カテゴリ分類の推薦履歴（確定分類とは別テーブルで人間の最終判断を上書きしない）', syncPolicy: 'auto' },
  { name: 'aichat_answer_category_scores', migration: '0089', description: '回答伝播グラフ(/answer-graph)のノード色分け用: 回答ごとの中分類カテゴリ類似度スコアのキャッシュ', syncPolicy: 'auto' },
  { name: 'aichat_answer_vectors', migration: '0094', description: '回答文(ai_chat_shares)のplamo-embedding-1bベクトルキャッシュ。answer-graphの回答モーダル「この回答文をベクタ化する」ボタンで生成', syncPolicy: 'auto' },
  { name: 'aichat_answer_keyword_vectors', migration: '0095', description: '回答文からgemma-4-26b-a4b-itで抽出した予備知識キーワードのplamo-embedding-1bベクトルキャッシュ(回答文IDごと)。answer-graphの回答モーダル「この回答文をベクタ化する」ボタンで生成', syncPolicy: 'auto' },
  { name: 'moondream_analyze_log', migration: '0096', description: '/api/moondream-analyze呼び出しの成否ログ(モデル名・プロンプト長・画像バイト数・失敗時のエラー内容)', syncPolicy: 'auto' },
];

const REQUIRED_STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [
  { name: 'commit_agent_log', migration: '0025', description: 'コミットエージェント検出ログ', syncPolicy: 'auto' },
];

export const STATUS_MIGRATION_SQL: Record<string, string> = {
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
  '0042': `ALTER TABLE aichat_search_log ADD COLUMN deleted_at TEXT;
ALTER TABLE aichat_search_log ADD COLUMN result_count INTEGER;`,
  '0043': `ALTER TABLE aichat_search_history ADD COLUMN result_count INTEGER;`,
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
  '0051': `CREATE TABLE IF NOT EXISTS aichat_category_groups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  category_ids TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_aichat_cat_groups_user ON aichat_category_groups(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_cat_groups_name ON aichat_category_groups(user_id, group_name);
INSERT OR IGNORE INTO table_catalog (table_name, group_name, description, migration, sync_policy, display_order) VALUES
('aichat_category_groups', 'ai', 'AIチャット分類カテゴリグループ', '0051', 'auto', 0);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_category_groups', 'id', 'pk', NULL);
INSERT OR REPLACE INTO table_column_keys (table_name, column_name, key_type, fk_target_table) VALUES
('aichat_category_groups', 'user_id', 'idx', NULL);`,
  '0052': `ALTER TABLE user_sessions ADD COLUMN recent_commits_count INTEGER NOT NULL DEFAULT 20;
ALTER TABLE user_sessions ADD COLUMN toast_duration INTEGER NOT NULL DEFAULT 10;`,
  '0053': `ALTER TABLE ts_function_catalog ADD COLUMN start_line INTEGER;
ALTER TABLE ts_function_catalog ADD COLUMN end_line INTEGER;
CREATE TABLE IF NOT EXISTS ts_function_callers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id     INTEGER NOT NULL REFERENCES ts_repository(id),
  callee_id   INTEGER NOT NULL REFERENCES ts_function_catalog(id),
  caller_file TEXT NOT NULL,
  caller_line INTEGER NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(callee_id, caller_file, caller_line)
);
CREATE INDEX IF NOT EXISTS idx_tfcr_callee ON ts_function_callers(callee_id);
CREATE INDEX IF NOT EXISTS idx_tfcr_file   ON ts_function_callers(repo_id, caller_file);`,
  '0054': `ALTER TABLE user_sessions ADD COLUMN last_activity_at TEXT;`,
  '0055': `CREATE TABLE IF NOT EXISTS aichat_rate_limit (
  user_id TEXT NOT NULL,
  window_key TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, window_key)
);
CREATE INDEX IF NOT EXISTS idx_aichat_rl_window ON aichat_rate_limit(window_key);`,
  '0056': `CREATE TABLE IF NOT EXISTS api_endpoint_stats (
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 1,
  last_called_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (endpoint, status_code)
);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_stats_endpoint ON api_endpoint_stats(endpoint);`,
  '0057': `CREATE TABLE IF NOT EXISTS api_search_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  section_count INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_search_keywords_keyword ON api_search_keywords(keyword);`,
  '0058': `CREATE TABLE IF NOT EXISTS api_search_keyword_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL REFERENCES api_search_keywords(id),
  section_name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_api_search_keyword_sections_keyword_id ON api_search_keyword_sections(keyword_id);`,

  '0059': `ALTER TABLE user_sessions ADD COLUMN revoked_at TEXT;
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked_at ON user_sessions(revoked_at);`,

  '0060': `ALTER TABLE user_sessions ADD COLUMN idle_timeout_seconds INTEGER;`,

  '0061': `CREATE TABLE IF NOT EXISTS webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  event_type TEXT,
  status TEXT NOT NULL,
  payload TEXT,
  error TEXT,
  received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_log_source ON webhook_log(source);
CREATE INDEX IF NOT EXISTS idx_webhook_log_received_at ON webhook_log(received_at);`,

  '0068': `CREATE TABLE IF NOT EXISTS cf_auth_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  event TEXT,
  action TEXT,
  result TEXT NOT NULL,
  reason TEXT,
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cf_auth_access_log_username ON cf_auth_access_log(username);
CREATE INDEX IF NOT EXISTS idx_cf_auth_access_log_checked_at ON cf_auth_access_log(checked_at);`,

  '0069': `CREATE TABLE IF NOT EXISTS rail_line_stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_name TEXT NOT NULL,
  line_flag TEXT NOT NULL,
  line_country TEXT NOT NULL,
  station_name TEXT NOT NULL,
  station_order INTEGER NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  station_country TEXT NOT NULL,
  station_flag TEXT NOT NULL,
  distance_from_origin_km REAL NOT NULL DEFAULT 0,
  distance_to_prev_km REAL NOT NULL DEFAULT 0,
  distance_to_next_km REAL NOT NULL DEFAULT 0,
  distance_to_terminal_km REAL NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rail_line_stations_line_order ON rail_line_stations(line_name, station_order);
CREATE INDEX IF NOT EXISTS idx_rail_line_stations_line_name ON rail_line_stations(line_name);
CREATE INDEX IF NOT EXISTS idx_rail_line_stations_country ON rail_line_stations(station_country);`,

  '0070': `CREATE TABLE IF NOT EXISTS rail_station_nearby_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_name TEXT NOT NULL,
  point_type TEXT NOT NULL,
  point_name TEXT NOT NULL,
  point_lat REAL NOT NULL,
  point_lon REAL NOT NULL,
  distance_km REAL NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rail_station_nearby_points_unique ON rail_station_nearby_points(station_name, point_type, point_name);
CREATE INDEX IF NOT EXISTS idx_rail_station_nearby_points_station ON rail_station_nearby_points(station_name);
CREATE TABLE IF NOT EXISTS rail_station_nearby_fetched (
  station_name TEXT PRIMARY KEY,
  fetched_at TEXT DEFAULT (datetime('now')),
  point_count INTEGER DEFAULT 0
);`,

  '0072': `CREATE TABLE IF NOT EXISTS heritage_area_boxes (
  area_seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  box TEXT NOT NULL DEFAULT 'box',
  top_left_lat REAL NOT NULL,
  top_left_lon REAL NOT NULL,
  bottom_right_lat REAL NOT NULL,
  bottom_right_lon REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_heritage_area_boxes_user_created
  ON heritage_area_boxes(user_id, created_at DESC);`,
  '0073': `CREATE TABLE IF NOT EXISTS heritage_area_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_seq INTEGER NOT NULL,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  lat REAL,
  lon REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (area_seq) REFERENCES heritage_area_boxes(area_seq) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_heritage_area_items_area_seq
  ON heritage_area_items(area_seq);
CREATE INDEX IF NOT EXISTS idx_heritage_area_items_category
  ON heritage_area_items(category, item_name);`,
  '0071': `CREATE TABLE IF NOT EXISTS slack_installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL UNIQUE,
  team_name TEXT,
  bot_user_id TEXT,
  access_token TEXT NOT NULL,
  scope TEXT,
  authed_user_id TEXT,
  installed_by_user TEXT,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_slack_installations_team_id ON slack_installations(team_id);`,

  '0062': `CREATE TABLE IF NOT EXISTS uuid_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  uuid TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_uuid_history_user_id ON uuid_history(user_id);
CREATE INDEX IF NOT EXISTS idx_uuid_history_uuid ON uuid_history(uuid);
CREATE INDEX IF NOT EXISTS idx_uuid_history_created_at ON uuid_history(created_at DESC);`,

  '0063': `CREATE TABLE IF NOT EXISTS heritage_cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  heritage_name TEXT NOT NULL,
  city_name TEXT NOT NULL,
  city_lat REAL NOT NULL,
  city_lon REAL NOT NULL,
  population INTEGER,
  distance_km REAL NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_heritage_cities_unique ON heritage_cities(heritage_name, city_name);
CREATE INDEX IF NOT EXISTS idx_heritage_cities_name ON heritage_cities(heritage_name);
CREATE TABLE IF NOT EXISTS heritage_city_fetched (
  heritage_name TEXT PRIMARY KEY,
  fetched_at TEXT DEFAULT (datetime('now')),
  city_count INTEGER DEFAULT 0
);`,

  '0064': `INSERT OR IGNORE INTO aichat_model_colors (model_id, color, label) VALUES
  ('@cf/zai-org/glm-5.2', '#f97316', 'glm-5.2'),
  ('@cf/ibm-granite/granite-4.0-h-micro', '#06b6d4', 'granite-4.0-h-micro');`,

  '0065': `CREATE TABLE IF NOT EXISTS heritage_ai_question_masters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO heritage_ai_question_masters (topic) VALUES
  ('交通手段'),
  ('見どころ'),
  ('最寄り空港'),
  ('鉄道でのアクセス'),
  ('宿泊施設'),
  ('スポーツ施設');`,
  '0066': `CREATE TABLE IF NOT EXISTS heritage_question_view_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  country_name TEXT,
  heritage_name TEXT NOT NULL,
  question_master_id INTEGER NOT NULL REFERENCES heritage_ai_question_masters(id),
  searched_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hqvl_user_heritage_qm ON heritage_question_view_log(user_id, heritage_name, question_master_id);`,
  '0067': `CREATE TABLE IF NOT EXISTS rail_station_cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_name TEXT NOT NULL,
  city_name TEXT NOT NULL,
  city_lat REAL NOT NULL,
  city_lon REAL NOT NULL,
  population INTEGER,
  distance_km REAL NOT NULL,
  country_code TEXT,
  fetched_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rail_station_cities_unique ON rail_station_cities(station_name, city_name);
CREATE INDEX IF NOT EXISTS idx_rail_station_cities_name ON rail_station_cities(station_name);
CREATE TABLE IF NOT EXISTS rail_station_fetched (
  station_name TEXT PRIMARY KEY,
  fetched_at TEXT DEFAULT (datetime('now')),
  city_count INTEGER DEFAULT 0
);`,

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
CREATE INDEX IF NOT EXISTS idx_tcq_score ON ts_commit_quality(repo_id, granularity_score);

CREATE TABLE IF NOT EXISTS ts_function_callers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id     INTEGER NOT NULL REFERENCES ts_repository(id),
  callee_id   INTEGER NOT NULL REFERENCES ts_function_catalog(id),
  caller_file TEXT NOT NULL,
  caller_line INTEGER NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(callee_id, caller_file, caller_line)
);
CREATE INDEX IF NOT EXISTS idx_tfcr_callee ON ts_function_callers(callee_id);
CREATE INDEX IF NOT EXISTS idx_tfcr_file   ON ts_function_callers(repo_id, caller_file);`,
  '0075': `CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  slack_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO notification_settings (id, slack_enabled) VALUES (1, 0);`,
  '0076': `CREATE TABLE IF NOT EXISTS email_confirm_tokens (
  token TEXT PRIMARY KEY,
  github_login TEXT NOT NULL,
  github_name TEXT,
  github_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  github_access_token TEXT NOT NULL,
  granted_scopes TEXT NOT NULL,
  timezone TEXT NOT NULL,
  session_duration TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);`,
  '0077': `ALTER TABLE notification_settings ADD COLUMN email_confirm_login_enabled INTEGER NOT NULL DEFAULT 0;`,
  '0078': `CREATE TABLE IF NOT EXISTS airport_nearby_heritage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  airport_name TEXT NOT NULL,
  heritage_name TEXT NOT NULL,
  distance_km REAL NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_nearby_heritage_unique ON airport_nearby_heritage(airport_name, heritage_name);
CREATE INDEX IF NOT EXISTS idx_airport_nearby_heritage_airport ON airport_nearby_heritage(airport_name);`,
  '0079': `CREATE TABLE IF NOT EXISTS airport_nearby_airport (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  airport_name TEXT NOT NULL,
  other_airport_name TEXT NOT NULL,
  distance_km REAL NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airport_nearby_airport_unique ON airport_nearby_airport(airport_name, other_airport_name);
CREATE INDEX IF NOT EXISTS idx_airport_nearby_airport_airport ON airport_nearby_airport(airport_name);`,
  '0080': `CREATE TABLE IF NOT EXISTS unresolved_airport_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  airport_name TEXT NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unresolved_airport_keywords_unique ON unresolved_airport_keywords(airport_name);`,
  '0081': `CREATE TABLE IF NOT EXISTS unresolved_castle_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  castle_name TEXT NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unresolved_castle_keywords_unique ON unresolved_castle_keywords(castle_name);`,
  '0082': `CREATE TABLE IF NOT EXISTS unresolved_station_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_name TEXT NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unresolved_station_keywords_unique ON unresolved_station_keywords(station_name);`,
  '0083': `CREATE TABLE IF NOT EXISTS harness_hook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hook_event TEXT NOT NULL,
  check_name TEXT NOT NULL,
  tool_name TEXT,
  file_path TEXT,
  result TEXT NOT NULL,
  detail TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_harness_hook_log_created ON harness_hook_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_harness_hook_log_result ON harness_hook_log(result, created_at DESC);`,
  '0084': `CREATE TABLE IF NOT EXISTS aichat_keyword_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_keyword_categories_user_name ON aichat_keyword_categories(user_id, name);`,
  '0085': `CREATE TABLE IF NOT EXISTS aichat_keyword_category_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_keyword_category_map_unique ON aichat_keyword_category_map(user_id, keyword, category_id);
CREATE INDEX IF NOT EXISTS idx_aichat_keyword_category_map_category ON aichat_keyword_category_map(category_id);`,
  '0086': `CREATE TABLE IF NOT EXISTS aichat_category_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_aichat_category_audit_log_user_created ON aichat_category_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aichat_category_audit_log_entity ON aichat_category_audit_log(entity_type, entity_id);`,
  '0087': `CREATE TABLE IF NOT EXISTS aichat_keyword_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_keyword_embeddings_user_keyword ON aichat_keyword_embeddings(user_id, keyword);`,
  '0088': `CREATE TABLE IF NOT EXISTS aichat_keyword_category_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  suggested_category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
  similarity REAL NOT NULL,
  model TEXT NOT NULL,
  accepted INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_aichat_keyword_category_suggestions_user_keyword ON aichat_keyword_category_suggestions(user_id, keyword, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aichat_keyword_category_suggestions_category ON aichat_keyword_category_suggestions(suggested_category_id);`,
  '0089': `CREATE TABLE IF NOT EXISTS aichat_answer_category_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
  score REAL NOT NULL,
  model TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_answer_category_scores_unique ON aichat_answer_category_scores(user_id, share_id, category_id);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_category_scores_share ON aichat_answer_category_scores(share_id);`,
  '0090': `ALTER TABLE aichat_keyword_embeddings ADD COLUMN plamo_vector BLOB;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN plamo_dim INTEGER;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN plamo_updated_at TEXT;`,
  '0091': `ALTER TABLE aichat_keyword_embeddings ADD COLUMN plamo_model TEXT;`,
  '0092': `ALTER TABLE aichat_keyword_embeddings ADD COLUMN source TEXT;`,
  '0093': `ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_vector BLOB;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_dim INTEGER;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_model TEXT;
ALTER TABLE aichat_keyword_embeddings ADD COLUMN gemma_updated_at TEXT;`,
  '0094': `CREATE TABLE IF NOT EXISTS aichat_answer_vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_answer_vectors_unique ON aichat_answer_vectors(user_id, share_id, model);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_vectors_share ON aichat_answer_vectors(share_id);`,
  '0095': `CREATE TABLE IF NOT EXISTS aichat_answer_keyword_vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aichat_answer_keyword_vectors_unique ON aichat_answer_keyword_vectors(user_id, share_id, keyword, model);
CREATE INDEX IF NOT EXISTS idx_aichat_answer_keyword_vectors_share ON aichat_answer_keyword_vectors(share_id);`,
  '0096': `CREATE TABLE IF NOT EXISTS moondream_analyze_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_length INTEGER NOT NULL,
  image_bytes INTEGER NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_moondream_analyze_log_user_created ON moondream_analyze_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moondream_analyze_log_status ON moondream_analyze_log(status);`,
  '0097': `ALTER TABLE moondream_analyze_log ADD COLUMN image_data_url TEXT;`,
  '0098': `ALTER TABLE ai_chat_shares ADD COLUMN image_data_url TEXT;`,
  '0099': `ALTER TABLE moondream_analyze_log ADD COLUMN prompt_text TEXT;
ALTER TABLE moondream_analyze_log ADD COLUMN analysis_text TEXT;`,
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
export type ColumnKeyType = 'pk' | 'fk' | 'pk+fk' | 'pk+idx' | 'fk+idx' | 'uk' | 'idx' | null;

export interface ColumnKeyInfo {
  [columnName: string]: ColumnKeyType;
}

export const TABLE_COLUMN_KEYS: Record<string, ColumnKeyInfo> = {
  user_sessions: { id: 'pk', user_id: 'uk', current_workspace_id: 'fk', revoked_at: 'idx' },
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
  aichat_category_groups: { id: 'pk', user_id: 'idx' },
  keyword_category_groups: { id: 'pk', user_id: 'fk' },
  keyword_multi_labels: { id: 'pk', user_id: 'fk', search_query: 'idx' },
  ts_repository:          { id: 'pk', full_name: 'uk' },
  ts_function_catalog:    { id: 'pk', repo_id: 'fk', file_path: 'idx', function_name: 'idx' },
  ts_commit_log:          { id: 'pk', repo_id: 'fk', commit_hash: 'uk', commit_at: 'idx', pr_number: 'idx', branch_name: 'idx' },
  ts_commit_function_map: { id: 'pk', repo_id: 'pk+fk', commit_hash: 'pk+fk', file_path: 'idx', function_name: 'idx', change_type: 'idx' },
  ts_function_impact:     { id: 'pk', repo_id: 'fk', commit_hash: 'fk', file_path: 'idx', function_name: 'idx', impact_type: 'idx', contribution: 'idx' },
  ts_commit_quality:      { id: 'pk', repo_id: 'pk+fk', commit_hash: 'pk+fk', granularity_score: 'idx' },
  ts_function_callers:    { id: 'pk', repo_id: 'fk', callee_id: 'fk', caller_file: 'idx' },
  aichat_rate_limit:      { user_id: 'pk+fk', window_key: 'pk+idx' },
  api_endpoint_stats:         { endpoint: 'pk+idx', status_code: 'pk' },
  api_search_keywords:        { id: 'pk', keyword: 'idx' },
  api_search_keyword_sections: { id: 'pk', keyword_id: 'fk+idx' },
  webhook_log: { id: 'pk', source: 'idx', received_at: 'idx' },
  cf_auth_access_log: { id: 'pk', username: 'fk', result: 'idx', checked_at: 'idx' },
  uuid_history: { id: 'pk', user_id: 'idx', uuid: 'idx', created_at: 'idx' },
  heritage_cities: { id: 'pk', heritage_name: 'idx', city_name: 'uk' },
  heritage_city_fetched: { heritage_name: 'pk' },
  rail_station_cities: { id: 'pk', station_name: 'idx', city_name: 'uk' },
  rail_station_fetched: { station_name: 'pk' },
  rail_line_stations: { id: 'pk', line_name: 'idx', station_order: 'idx', station_country: 'idx' },
  rail_station_nearby_points: { id: 'pk', station_name: 'idx', point_type: 'idx', point_name: 'idx' },
  rail_station_nearby_fetched: { station_name: 'pk' },
  slack_installations: { id: 'pk', team_id: 'uk', installed_by_user: 'fk' },
  notification_settings: { id: 'pk' },
  email_confirm_tokens: { token: 'pk', github_login: 'idx', email: 'idx' },
  airport_nearby_heritage: { id: 'pk', airport_name: 'idx', heritage_name: 'idx' },
  airport_nearby_airport: { id: 'pk', airport_name: 'idx', other_airport_name: 'idx' },
  unresolved_airport_keywords: { id: 'pk', airport_name: 'uk' },
  unresolved_castle_keywords: { id: 'pk', castle_name: 'uk' },
  unresolved_station_keywords: { id: 'pk', station_name: 'uk' },
  heritage_ai_question_masters: { id: 'pk', topic: 'uk' },
  heritage_question_view_log: { id: 'pk', user_id: 'idx', heritage_name: 'idx', question_master_id: 'fk' },
  heritage_area_boxes: { area_seq: 'pk', user_id: 'idx' },
  heritage_area_items: { id: 'pk', area_seq: 'fk', category: 'idx' },
  harness_hook_log: { id: 'pk', hook_event: 'idx', result: 'idx', created_at: 'idx' },
  aichat_keyword_categories: { id: 'pk', user_id: 'uk', name: 'uk' },
  aichat_keyword_category_map: { id: 'pk', user_id: 'uk', keyword: 'uk', category_id: 'fk+idx' },
  aichat_category_audit_log: { id: 'pk', user_id: 'idx', entity_type: 'idx', entity_id: 'idx' },
  aichat_keyword_embeddings: { id: 'pk', user_id: 'uk', keyword: 'uk' },
  aichat_keyword_category_suggestions: { id: 'pk', user_id: 'idx', keyword: 'idx', suggested_category_id: 'fk+idx' },
  aichat_answer_category_scores: { id: 'pk', user_id: 'uk', share_id: 'uk', category_id: 'fk+idx' },
  aichat_answer_vectors: { id: 'pk', user_id: 'uk', share_id: 'uk', model: 'uk' },
  aichat_answer_keyword_vectors: { id: 'pk', user_id: 'uk', share_id: 'uk', keyword: 'uk', model: 'uk' },
  moondream_analyze_log: { id: 'pk', user_id: 'fk+idx' },
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
  email_confirm_tokens: 'auth',
  slack_interaction_log: 'config', slack_installations: 'config', notification_settings: 'config',
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
  aichat_category_groups: 'ai',
  aichat_rate_limit: 'ai',
  api_endpoint_stats: 'system',
  api_search_keywords: 'system',
  api_search_keyword_sections: 'system',
  webhook_log: 'system',
  cf_auth_access_log: 'system',
  uuid_history: 'system',
  heritage_cities: 'system',
  heritage_city_fetched: 'system',
  rail_station_cities: 'system',
  rail_station_fetched: 'system',
  rail_line_stations: 'system',
  rail_station_nearby_points: 'system',
  rail_station_nearby_fetched: 'system',
  airport_nearby_heritage: 'system',
  airport_nearby_airport: 'system',
  unresolved_airport_keywords: 'system',
  unresolved_castle_keywords: 'system',
  unresolved_station_keywords: 'system',
  heritage_ai_question_masters: 'system',
  heritage_question_view_log: 'system',
  heritage_area_boxes: 'system',
  heritage_area_items: 'system',
  harness_hook_log: 'system',
  aichat_keyword_categories: 'ai',
  aichat_keyword_category_map: 'ai',
  aichat_category_audit_log: 'ai',
  aichat_keyword_embeddings: 'ai',
  aichat_keyword_category_suggestions: 'ai',
  aichat_answer_category_scores: 'ai',
  aichat_answer_vectors: 'ai',
  aichat_answer_keyword_vectors: 'ai',
  moondream_analyze_log: 'ai',
  keyword_category_groups: 'search',
  keyword_multi_labels: 'search',
  ts_repository:          'ts-catalog',
  ts_function_catalog:    'ts-catalog',
  ts_function_callers:    'ts-catalog',
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
  ts_function_callers:    { repo_id: 'ts_repository', callee_id: 'ts_function_catalog' },
  ts_commit_log:          { repo_id: 'ts_repository' },
  ts_commit_function_map: { repo_id: 'ts_repository', commit_hash: 'ts_commit_log' },
  ts_function_impact:     { repo_id: 'ts_repository', commit_hash: 'ts_commit_log' },
  ts_commit_quality:      { repo_id: 'ts_repository', commit_hash: 'ts_commit_log' },
  api_search_keyword_sections: { keyword_id: 'api_search_keywords' },
  aichat_rate_limit: { user_id: 'user_sessions' },
  cf_auth_access_log: { username: 'user_sessions' },
  slack_installations: { installed_by_user: 'user_sessions' },

  // ========================================================================
  // AIチャット キーワード分類・監査ログ系
  // ========================================================================
  aichat_keyword_categories: { user_id: 'user_sessions' },
  aichat_keyword_category_map: { user_id: 'user_sessions', category_id: 'aichat_keyword_categories' },
  aichat_category_audit_log: { user_id: 'user_sessions' },
  aichat_keyword_embeddings: { user_id: 'user_sessions' },
  aichat_keyword_category_suggestions: { user_id: 'user_sessions', suggested_category_id: 'aichat_keyword_categories' },
  aichat_answer_category_scores: { user_id: 'user_sessions', category_id: 'aichat_keyword_categories' },
  aichat_answer_vectors: { user_id: 'user_sessions' },
  aichat_answer_keyword_vectors: { user_id: 'user_sessions' },
  moondream_analyze_log: { user_id: 'user_sessions' },

  // ========================================================================
  // 世界遺産ページ AI質問ログ・保存済みエリア系
  // ========================================================================
  heritage_question_view_log: { question_master_id: 'heritage_ai_question_masters' },
  heritage_area_items: { area_seq: 'heritage_area_boxes' },
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
  // 異名FK: username も意味的には user_id
  'cf_auth_access_log.username': 'user_id',
  // 異名FK: installed_by_user も意味的には user_id
  'slack_installations.installed_by_user': 'user_id',

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

export { extractAiUsage };

/** AI チャットの 1 分間あたり最大リクエスト数 */
const AICHAT_RATE_LIMIT_PER_MIN = 10;

/**
 * D1 ベースのレートリミットチェック。
 * window_key = "userId:YYYYMMDDHHMI" (1 分ウィンドウ) で集計し、
 * 上限を超えていれば true を返す。DB がない場合は制限しない。
 */
async function checkAiChatRateLimit(db: D1Database | undefined, userId: string): Promise<boolean> {
  if (!db) return false;
  const now = new Date();
  const windowKey = `${userId}:${now.toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
  try {
    const result = await db.prepare(
      `INSERT INTO aichat_rate_limit (user_id, window_key, request_count, updated_at)
       VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, window_key) DO UPDATE SET
         request_count = request_count + 1,
         updated_at = datetime('now')
       RETURNING request_count`
    ).bind(userId, windowKey).first<{ request_count: number }>();
    return (result?.request_count ?? 1) > AICHAT_RATE_LIMIT_PER_MIN;
  } catch {
    return false;
  }
}

async function logWebhookEvent(
  db: D1Database | undefined,
  source: string,
  eventType: string | null,
  status: 'ok' | 'rejected' | 'error',
  payload: Record<string, unknown> | null,
  error?: string
): Promise<void> {
  if (!db) return;
  try {
    await db.prepare(
      'INSERT INTO webhook_log (source, event_type, status, payload, error, received_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      source,
      eventType ?? null,
      status,
      payload ? JSON.stringify(payload) : null,
      error ?? null,
      new Date().toISOString()
    ).run();
  } catch (e) {
    logger.error('Failed to log webhook event', { source, error: e instanceof Error ? e.message : 'Unknown' });
  }
}

/**
 * Slack通知のON/OFFユーザーオプション(デフォルトOFF)。notification_settingsテーブルが
 * 無い/行が無い場合もデフォルトOFFとして扱う。
 */
export async function isSlackNotifyEnabled(db: D1Database | undefined): Promise<boolean> {
  if (!db) return false;
  try {
    const row = await db.prepare(
      'SELECT slack_enabled FROM notification_settings WHERE id = 1'
    ).first<{ slack_enabled: number }>();
    return !!row?.slack_enabled;
  } catch {
    return false;
  }
}

/**
 * resolveNotifyConfig に、D1で管理するSlack通知ON/OFFユーザーオプションを合成する。
 * target='worker'のときはこのフラグを参照しない(isNotifyConfigured側の挙動と対応)。
 */
async function resolveNotifyConfigWithSetting(env: Bindings): Promise<ReturnType<typeof resolveNotifyConfig>> {
  const config = resolveNotifyConfig(env);
  config.enabled = await isSlackNotifyEnabled(env.DB);
  return config;
}

async function logCfAuthAccessResult(
  db: D1Database | undefined,
  username: string,
  event: string | null,
  action: string | null,
  result: 'OK' | 'NG',
  reason?: string
): Promise<void> {
  if (!db) return;
  try {
    await db.prepare(
      'INSERT INTO cf_auth_access_log (username, event, action, result, reason, checked_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      username,
      event,
      action || null,
      result,
      reason ?? null,
      new Date().toISOString()
    ).run();
  } catch (e) {
    logger.error('Failed to log cf-auth access result', { username, error: e instanceof Error ? e.message : 'Unknown' });
  }
}

async function recordApiAccess(db: D1Database | undefined, method: string, routePath: string, statusCode: number): Promise<void> {
  if (!db || !routePath) return;
  const endpoint = `${method} ${routePath}`;
  try {
    await db.prepare(
      `INSERT INTO api_endpoint_stats (endpoint, status_code, count, last_called_at)
       VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(endpoint, status_code) DO UPDATE SET
         count = count + 1,
         last_called_at = datetime('now')`
    ).bind(endpoint, statusCode).run();
  } catch {}
}

async function recordMoondreamAnalyzeLog(
  db: D1Database | undefined,
  payload: {
    userId: string;
    status: 'ok' | 'error';
    model: string;
    promptLength: number;
    imageBytes: number;
    errorMessage?: string | null;
    imageDataUrl?: string | null;
    promptText?: string | null;
    analysisText?: string | null;
  },
): Promise<void> {
  if (!db) return;
  try {
    await db.prepare(
      `INSERT INTO moondream_analyze_log (user_id, status, model, prompt_length, image_bytes, error_message, image_data_url, prompt_text, analysis_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      payload.userId,
      payload.status,
      payload.model,
      payload.promptLength,
      payload.imageBytes,
      payload.errorMessage ?? null,
      payload.imageDataUrl ?? null,
      payload.promptText ?? null,
      payload.analysisText ?? null,
    ).run();
  } catch {}
}

async function recordAichatCategoryAudit(
  db: D1Database | undefined,
  payload: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    entityName?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  if (!db) return;
  try {
    await db.prepare(
      `INSERT INTO aichat_category_audit_log (user_id, action, entity_type, entity_id, entity_name, detail) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      payload.userId,
      payload.action,
      payload.entityType,
      payload.entityId === undefined || payload.entityId === null ? null : String(payload.entityId),
      payload.entityName ?? null,
      payload.detail ?? null,
    ).run();
  } catch (error) {
    logger.warn('Failed to record aichat_category_audit_log', {
      action: payload.action,
      entityType: payload.entityType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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

export interface KeywordClassifyDebug {
  prompt: string;
  rawResponse: string;
  resolvedLabel: string;
  model: string;
  fallback: { model: string; rawResponse: string; label: string } | null;
}

export async function runKeywordAutoClassification(
  env: { AI?: Ai; DB?: D1Database; AI_MODEL?: string },
  userId: string,
  q: string,
  classifyDebugEnabled: boolean
): Promise<{ autoLabel: string; classifyDebug: KeywordClassifyDebug | null }> {
  if (!env.AI || !env.DB) {
    logger.warn('auto-classify skipped: AI binding not available', { query: q });
    return { autoLabel: 'uncategorized', classifyDebug: null };
  }
  const DEFAULT_CLASSIFY_LABELS = ['feature', 'ui', 'tech', 'database', 'bugfix', 'ops'];
  let classifyLabels = DEFAULT_CLASSIFY_LABELS;
  try {
    const userLabelRows = await env.DB.prepare(
      `SELECT DISTINCT label FROM commit_search_keyword_labels WHERE user_id = ? AND label != 'uncategorized' ORDER BY label`
    ).bind(userId).all<{ label: string }>();
    const userLabels = (userLabelRows.results ?? []).map((r) => r.label).filter(Boolean);
    if (userLabels.length > 0) {
      classifyLabels = [...new Set([...DEFAULT_CLASSIFY_LABELS, ...userLabels])];
    }
  } catch { /* デフォルトラベルを使用 */ }
  const model = resolveAiModel(env.AI_MODEL);
  const classifyResult = await classifyKeywordWithAI(env.AI, model, q, classifyLabels);
  let autoLabel = classifyResult.label;
  let classifyDebug: KeywordClassifyDebug | null = null;
  if (classifyDebugEnabled) {
    classifyDebug = {
      prompt: classifyResult.prompt,
      rawResponse: classifyResult.rawResponse,
      resolvedLabel: classifyResult.label,
      model: classifyResult.model,
      fallback: classifyResult.fallback ?? null,
    };
  }
  const classifyStatus = classifyResult.fallback ? 'ai_fallback' : 'ai_success';
  const usedModel = classifyResult.fallback ? classifyResult.fallback.model : classifyResult.model;
  let labelSaved = false;
  try {
    await env.DB.prepare(
      `UPDATE commit_search_keyword_labels SET label = ?, ai_model = ?, classify_status = ?, updated_at = datetime('now') WHERE user_id = ? AND search_query = ?`
    ).bind(autoLabel, usedModel, classifyStatus, userId, q).run();
    labelSaved = true;
  } catch {
    try {
      await env.DB.prepare(
        `UPDATE commit_search_keyword_labels SET label = ?, ai_model = ?, updated_at = datetime('now') WHERE user_id = ? AND search_query = ?`
      ).bind(autoLabel, usedModel, userId, q).run();
      labelSaved = true;
    } catch {
      try {
        await env.DB.prepare(
          `UPDATE commit_search_keyword_labels SET label = ?, updated_at = datetime('now') WHERE user_id = ? AND search_query = ?`
        ).bind(autoLabel, userId, q).run();
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
  return { autoLabel, classifyDebug };
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
  lastActivityAt: string | null;
  githubAccessToken?: string | null;
  githubGrantedScopes?: string | null;
  recentCommitsCount: number | null;
  toastDuration: number | null;
  idleTimeoutSeconds: number | null;
} | null> {
  if (!db) {
    return null;
  }

  try {
    const result = await db.prepare(
      'SELECT timezone, session_duration, last_login_at, last_activity_at, github_access_token, github_granted_scopes, recent_commits_count, toast_duration, idle_timeout_seconds FROM user_sessions WHERE user_id = ?'
    ).bind(userId).first<{
      timezone: string;
      session_duration: string;
      last_login_at: string | null;
      last_activity_at: string | null;
      github_access_token: string | null;
      github_granted_scopes: string | null;
      recent_commits_count: number | null;
      toast_duration: number | null;
      idle_timeout_seconds: number | null;
    }>();

    if (!result) {
      return null;
    }

    return {
      timezone: result.timezone,
      sessionDuration: result.session_duration,
      lastLoginAt: result.last_login_at,
      lastActivityAt: result.last_activity_at ?? null,
      githubAccessToken: result.github_access_token,
      githubGrantedScopes: result.github_granted_scopes,
      recentCommitsCount: result.recent_commits_count ?? null,
      toastDuration: result.toast_duration ?? null,
      idleTimeoutSeconds: result.idle_timeout_seconds ?? null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    // migration 未適用でカラムが存在しない場合はフォールバッククエリで継続
    if (msg.includes('no such column') || msg.includes('no column')) {
      logger.warn('getUserSession fallback: column missing, retrying without new columns', { userId, error: msg });
      try {
        const fallback = await db.prepare(
          'SELECT timezone, session_duration, last_login_at, last_activity_at, github_access_token, github_granted_scopes, recent_commits_count, toast_duration FROM user_sessions WHERE user_id = ?'
        ).bind(userId).first<{
          timezone: string;
          session_duration: string;
          last_login_at: string | null;
          last_activity_at: string | null;
          github_access_token: string | null;
          github_granted_scopes: string | null;
          recent_commits_count: number | null;
          toast_duration: number | null;
        }>();
        if (!fallback) return null;
        return {
          timezone: fallback.timezone,
          sessionDuration: fallback.session_duration,
          lastLoginAt: fallback.last_login_at,
          lastActivityAt: fallback.last_activity_at ?? null,
          githubAccessToken: fallback.github_access_token,
          githubGrantedScopes: fallback.github_granted_scopes,
          recentCommitsCount: fallback.recent_commits_count ?? null,
          toastDuration: fallback.toast_duration ?? null,
          idleTimeoutSeconds: null,
        };
      } catch (fallbackError) {
        logger.error('getUserSession fallback also failed', { userId, error: fallbackError instanceof Error ? fallbackError.message : 'Unknown' });
        return null;
      }
    }
    logger.error('Error getting user session', {
      userId,
      error: msg,
    });
    return null;
  }
}

// ログイン確定処理（D1保存・JWT発行・Cookieセット）。
// 即時ログイン(/auth/github/callback)とメール確認後ログイン(/auth/email-confirm)の
// 両方から共通利用する。
async function finalizeGithubLogin(c: Context<{ Bindings: Bindings; Variables: Variables }>, params: {
  githubLogin: string;
  githubName: string;
  email?: string;
  githubId: number;
  accessToken: string;
  grantedScopes: string;
  timezone: string;
  sessionDuration: string;
  returnToPath: string;
  jwtSecret: string;
}): Promise<Response> {
  const sessionResult = await updateUserSession(c.env.DB, params.githubLogin, params.timezone, params.sessionDuration, params.accessToken, params.grantedScopes);
  if (!sessionResult.saved) {
    logger.warn('D1 session save failed, access_token is included in JWT as fallback', { userId: params.githubLogin });
  }

  if (c.env.DB) {
    await ensureDefaultWorkspace(c.env.DB, params.githubLogin);
  }

  const sessionDurationSeconds = getSessionDurationSeconds(params.sessionDuration);
  const idleTimeoutSeconds = resolveIdleTimeoutSeconds(c.env.SESSION_IDLE_TIMEOUT_SECONDS, sessionDurationSeconds, sessionDurationSeconds);

  const token = await createJWT(
    {
      sub: params.githubLogin,
      name: params.githubName || params.githubLogin,
      email: params.email || undefined,
      github_id: params.githubId,
      github_access_token: params.accessToken,
    },
    params.jwtSecret,
    sessionDurationSeconds
  );

  logger.info('GitHub OAuth authentication successful', {
    userId: params.githubLogin,
    sessionDuration: params.sessionDuration,
  });

  logger.recordMetric(c.env.ANALYTICS, 'auth_github_success', {
    userId: params.githubLogin,
    timestamp: Date.now(),
  });

  const redirectHeaders = buildAuthRedirectHeaders({
    token,
    sessionDurationSeconds,
    idleTimeoutSeconds,
    sessionDuration: params.sessionDuration,
    returnToPath: params.returnToPath,
  });

  return new Response(null, { status: 302, headers: redirectHeaders });
}

// D1データベースのユーザー設定を更新
async function updateUserSettings(
  db: D1Database | undefined,
  userId: string,
  field: 'timezone' | 'session_duration' | 'display_name' | 'recent_commits_count' | 'toast_duration',
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

// CORSの設定: 自オリジンと開発環境のみ許可
const ALLOWED_ORIGINS = [
  'https://cloudflare-workers-github-oauth-1.nekoflare.workers.dev',
  'http://localhost:8787',
];
app.use('/*', cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
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

// /api/* へのリクエストをすべてエンドポイント別に集計する（成否含む）
// 新規APIルートを追加しても自動的に記録される
app.use('/api/*', async (c, next) => {
  await next();
  try {
    const ctx = c.executionCtx;
    if (ctx?.waitUntil && c.env.DB) {
      ctx.waitUntil(recordApiAccess(c.env.DB, c.req.method, c.req.routePath, c.res.status));
    }
  } catch {}
});

// /slack/* へのリクエストも/api/*と同様にエンドポイント別に集計する。
// routePathが/api/配下と異なるため、api_endpoint_stats上でも
// "POST /slack/event" 等の別枠のエンドポイントとして自動的に区別される
// （Slack経由のAI応答・スラッシュコマンド呼び出し回数を、Web(/api/aichat)からの
// 呼び出しと混ぜずに把握できるようにするため）。
app.use('/slack/*', async (c, next) => {
  await next();
  try {
    const ctx = c.executionCtx;
    if (ctx?.waitUntil && c.env.DB) {
      ctx.waitUntil(recordApiAccess(c.env.DB, c.req.method, c.req.routePath, c.res.status));
    }
  } catch {}
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

app.get('/fetch-text-stream-demo', (c) => {
  return c.html(getFetchTextStreamDemoPage());
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
      logger.warn('GitHub OAuth callback error', { error, phase: 'oauth-callback' });
      return jsonUtf8({ error: 'OAuth 認証に失敗しました' }, 400);
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
      // getUserSession が失敗した場合（migration未適用等）、session_duration だけ別クエリで取得
      let sessionDurationFromDB: string | null = null;
      if (c.env.DB) {
        try {
          const minimal = await c.env.DB.prepare(
            'SELECT session_duration FROM user_sessions WHERE user_id = ?'
          ).bind(userId).first<{ session_duration: string }>();
          sessionDurationFromDB = minimal?.session_duration ?? null;
        } catch {
          // テーブル未作成等の場合は無視
        }
      }

      const cookieVals = getCookieValues(cookieHeader, ['user_timezone', 'user_session_duration']);
      if (cookieVals['user_timezone']) {
        timezone = cookieVals['user_timezone'];
      }
      // 解決順序: D1再クエリ → Cookie → デフォルト '1h'
      sessionDuration = sessionDurationFromDB ?? cookieVals['user_session_duration'] ?? '1h';
    }

    phase = 'save-session';
    const returnToCookie = getCookieValue(c.req.header('Cookie'), 'oauth_return_to');
    const returnToPath = validateReturnTo(returnToCookie ? decodeURIComponent(returnToCookie) : null) ?? '/welcome';
    const grantedScopesStr = grantedScopes.join(' ');

    // ユーザーオプション(デフォルトOFF)がONかつRESEND_API_KEY設定時のみ、
    // JWT発行前にメール確認(Resend送信+クリック)を挟む。EVP関連のロジックは
    // すべて utils/emailConfirmGate.ts に集約されており、ここでは結果に従って
    // 分岐するだけでよい。
    phase = 'email-confirm-gate';
    const gateResult = await runEmailConfirmGate(c.env.DB, c.env.RESEND_API_KEY, `${url.protocol}//${url.host}`, {
      githubLogin: userId,
      githubName: githubUser.name || userId,
      githubId: githubUser.id,
      email: email || undefined,
      accessToken,
      grantedScopes: grantedScopesStr,
      timezone,
      sessionDuration,
      returnToPath,
    });

    if (gateResult.gated) {
      if ('errorStatus' in gateResult) {
        logger.error('Failed to send login confirmation email', { userId, error: gateResult.errorMessage });
        return jsonUtf8({ error: gateResult.errorMessage }, gateResult.errorStatus);
      }
      return c.html(gateResult.html);
    }

    phase = 'finalize-login';
    return await finalizeGithubLogin(c, {
      githubLogin: userId,
      githubName: githubUser.name || userId,
      email: email || undefined,
      githubId: githubUser.id,
      accessToken,
      grantedScopes: grantedScopesStr,
      timezone,
      sessionDuration,
      returnToPath,
      jwtSecret,
    });
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

    // ログイン失敗を通知（Slack/外部Workerの切替は NOTIFY_TARGET に従う）
    const loginFailureNotifyConfig = await resolveNotifyConfigWithSetting(c.env);
    if (isNotifyConfigured(loginFailureNotifyConfig)) {
      const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      dispatchNotification(loginFailureNotifyConfig, {
        text: `[セキュリティ警告] ログイン失敗\nフェーズ: ${phase}\nエラー: ${errMsg}\nIP: ${ip}`,
      }).catch(() => { /* 通知失敗は無視 */ });
    }

    return jsonUtf8({ error: 'Authentication failed' }, 500);
  }
});

/**
 * メール確認リンクのクリックを受け取り、保留中のログインを完了する。
 * /auth/github/callback がメール確認をかけた場合の受け皿。
 * トークンの検証・消費ロジックは utils/emailConfirmGate.ts に集約されている。
 */
app.get('/auth/email-confirm', async (c) => {
  const confirmToken = c.req.query('token');
  if (!confirmToken) {
    return c.html(renderLoginConfirmErrorPage('確認トークンが指定されていません。'), 400);
  }

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    return jsonUtf8({ error: 'JWT_SECRET is not configured' }, 500);
  }

  const resolved = await resolveEmailConfirmToken(c.env.DB, confirmToken);
  if (!resolved.ok) {
    return c.html(renderLoginConfirmErrorPage(resolved.message), 400);
  }

  const record = resolved.record;
  return await finalizeGithubLogin(c, {
    githubLogin: record.githubLogin,
    githubName: record.githubName,
    email: record.email,
    githubId: record.githubId,
    accessToken: record.githubAccessToken,
    grantedScopes: record.grantedScopes,
    timezone: record.timezone,
    sessionDuration: record.sessionDuration,
    returnToPath: record.returnToPath,
    jwtSecret,
  });
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

const SLACK_OAUTH_SCOPE = 'app_mentions:read,chat:write';

/**
 * Slack ワークスペースへのアプリインストール開始（Add to Slack）
 * CSRF対策のためstateパラメータを生成しクッキーに保存する
 */
app.get('/auth/slack/install', authMiddleware, async (c) => {
  const clientId = c.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return jsonUtf8({ error: 'Slack OAuth is not configured' }, 500);
  }

  const url = new URL(c.req.url);
  const redirectUri = `${url.protocol}//${url.host}/auth/v1/callback`;
  const state = generateOAuthState();

  const authUrl = new URL('https://slack.com/oauth/v2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('scope', SLACK_OAUTH_SCOPE);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  const redirectHeaders = new Headers({ 'Location': authUrl.toString() });
  redirectHeaders.append('Set-Cookie', `slack_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`);

  return new Response(null, { status: 302, headers: redirectHeaders });
});

/**
 * Slack OAuth コールバック
 * stateパラメータを検証してCSRF攻撃を防止し、認可コードをアクセストークンに交換して
 * slack_installations に保存する（team_idごとにUPSERT、再インストール時はトークンを更新）
 */
app.get('/auth/v1/callback', authMiddleware, async (c) => {
  const user = c.get('user');
  const code = c.req.query('code');
  const error = c.req.query('error');
  const state = c.req.query('state');

  if (error) {
    logger.warn('Slack OAuth callback error', { error });
    return jsonUtf8({ error: 'Slack OAuth 認証に失敗しました' }, 400);
  }
  if (!code) {
    return jsonUtf8({ error: 'No code provided' }, 400);
  }

  const cookieHeader = c.req.header('Cookie');
  const savedState = getCookieValue(cookieHeader, 'slack_oauth_state');
  if (!state || !savedState || state !== savedState) {
    logger.warn('Slack OAuth state mismatch - possible CSRF attempt', {
      hasState: !!state,
      hasSavedState: !!savedState,
    });
    return jsonUtf8({ error: 'Invalid state parameter. Please try installing again.' }, 400);
  }

  const clientId = c.env.SLACK_CLIENT_ID;
  const clientSecret = c.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return jsonUtf8({ error: 'Slack OAuth is not configured' }, 500);
  }

  const url = new URL(c.req.url);
  const redirectUri = `${url.protocol}//${url.host}/auth/v1/callback`;

  const exchangeResult = await exchangeSlackOAuthCode({
    code,
    clientId,
    clientSecret,
    redirectUri,
    fetchImpl: (url, init) => fetch(url, init),
  });

  const clearStateCookie = 'slack_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

  if (!exchangeResult.ok) {
    logger.error('Slack OAuth code exchange failed', { error: exchangeResult.error, userId: user.sub });
    return c.json({ error: `Slack連携に失敗しました: ${exchangeResult.error}` }, 502, {
      'Set-Cookie': clearStateCookie,
    });
  }

  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database is not available' }, 500, { 'Set-Cookie': clearStateCookie });
  }

  try {
    await db.prepare(
      `INSERT INTO slack_installations (team_id, team_name, bot_user_id, access_token, scope, authed_user_id, installed_by_user, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(team_id) DO UPDATE SET
         team_name = excluded.team_name,
         bot_user_id = excluded.bot_user_id,
         access_token = excluded.access_token,
         scope = excluded.scope,
         authed_user_id = excluded.authed_user_id,
         installed_by_user = excluded.installed_by_user,
         updated_at = excluded.updated_at`
    ).bind(
      exchangeResult.teamId,
      exchangeResult.teamName,
      exchangeResult.botUserId,
      exchangeResult.accessToken,
      exchangeResult.scope,
      exchangeResult.authedUserId,
      user.sub
    ).run();
  } catch (dbError) {
    logger.error('Failed to save Slack installation', {
      error: dbError instanceof Error ? dbError.message : 'Unknown error',
      teamId: exchangeResult.teamId,
    });
    return c.json({ error: 'Slack連携情報の保存に失敗しました' }, 500, { 'Set-Cookie': clearStateCookie });
  }

  logger.info('Slack workspace installed', { teamId: exchangeResult.teamId, installedBy: user.sub });

  const redirectHeaders = new Headers({ 'Location': '/settings?slack=connected' });
  redirectHeaders.append('Set-Cookie', clearStateCookie);
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

    const { merged, newAssignments } = assignModelColors(modelColors, DEFAULT_AICHAT_MODELS);
    modelColors = merged;
    for (const a of newAssignments) {
      c.executionCtx.waitUntil(
        c.env.DB.prepare('INSERT OR IGNORE INTO aichat_model_colors (model_id, color, label) VALUES (?, ?, ?)')
          .bind(a.model_id, a.color, a.label)
          .run()
          .catch(() => {})
      );
    }
  }
  return c.html(getAiChatPage({
    name: user.name,
    username: user.sub,
    aiChatModel,
    aiChatModelConfigured: !!configuredModel,
    fallbackModel,
    modelColors,
    aichatPreferMoondream: resolveAichatPreferMoondream(c.req.header('Cookie')),
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
  let body: { message?: string; model?: string; systemPromptMode?: string; source?: string; image?: string; preferMoondream?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return jsonUtf8({ error: 'リクエスト形式が不正です' }, 400);
  }
  let message = (body.message ?? '').trim();
  const image = (body.image ?? '').trim();
  if (!message && !image) {
    return jsonUtf8({ error: 'メッセージが空です' }, 400);
  }
  if (image) {
    const imageValidation = validateImageDataUrl(image);
    if (!imageValidation.ok) {
      return jsonUtf8({ error: imageValidation.reason }, 400);
    }
  }
  const rawMode = (body.systemPromptMode ?? '').trim();
  const systemPromptMode: SystemPromptMode = (ALLOWED_MODES.has(rawMode) ? rawMode : 'a') as SystemPromptMode;

  const slashCommand = await interpretAichatSlashCommand(message, new Date(), {
    fetchLatestCommitAgentLog: async () => {
      if (!c.env.DB) return null;
      const row = await c.env.DB.prepare(
        'SELECT commit_sha, commit_message, detected_agent_name, created_at FROM commit_agent_log ORDER BY id DESC LIMIT 1'
      ).first<CommitAgentLogRow>();
      return row ?? null;
    },
    searchShares: async (keyword) => {
      if (!c.env.DB) return { hitCount: 0, results: [] };
      const db = c.env.DB as unknown as D1Like;
      const { results } = await searchAiChatShares(db, user.sub, keyword);
      return { hitCount: results.length, results: results.map((r) => ({ id: r.id, question: r.question })) };
    },
    vectorizedAnswers: async () => {
      if (!c.env.DB) return { count: 0, totalCount: 0, results: [] };
      const countRow = await c.env.DB.prepare(
        'SELECT COUNT(DISTINCT share_id) AS cnt FROM aichat_answer_vectors WHERE user_id = ?'
      ).bind(user.sub).first<{ cnt: number }>();
      const totalRow = await c.env.DB.prepare(
        'SELECT COUNT(*) AS cnt FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL'
      ).bind(user.sub).first<{ cnt: number }>();
      const rows = await c.env.DB.prepare(
        `SELECT s.id AS id, s.question AS question, MAX(v.computed_at) AS computed_at
         FROM aichat_answer_vectors v
         JOIN ai_chat_shares s ON s.id = v.share_id
         WHERE v.user_id = ?
         GROUP BY s.id, s.question
         ORDER BY computed_at DESC
         LIMIT 30`
      ).bind(user.sub).all<{ id: string; question: string }>();
      return { count: countRow?.cnt ?? 0, totalCount: totalRow?.cnt ?? 0, results: rows.results ?? [] };
    },
  });
  if (slashCommand.handled) {
    return jsonUtf8({
      response: slashCommand.response,
      usedModel: 'local/neko',
      systemPromptMode,
      nekoResults: slashCommand.resultsForModal ?? null,
    });
  }

  if (!c.env.AI) {
    return jsonUtf8({ error: 'AI バインディングが未設定です' }, 503);
  }
  if (await checkAiChatRateLimit(c.env.DB, user.sub)) {
    return jsonUtf8({ error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' }, 429);
  }
  if (!message) {
    message = '添付した画像について説明してください。';
  }
  // 画像添付時、「moondreamを優先する」設定がONならユーザーが選択中のモデルより
  // 優先してMOONDREAM_MODEL(内部的にはAIチャット本体と同じ実績のあるvision
  // モデル)を使う。resolveAichatModelsForRequestへ渡すrequestedModelを
  // 差し替えるだけで、vision対応モデル同士のフォールバック関係(otherVisionModel)は
  // そのまま流用できる。
  const preferMoondream = !!body.preferMoondream && !!image;
  const requestedModel = preferMoondream ? MOONDREAM_MODEL : (body.model ?? '').trim();
  const configuredModel = (c.env.AI_CHAT_MODEL ?? '').trim();
  const textFallbackModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const { primaryModel, fallbackModel } = resolveAichatModelsForRequest({
    requestedModel,
    hasImage: !!image,
    allowedModels: AICHAT_ALLOWED_MODELS,
    configuredModel,
    textFallbackModel,
  });
  const rawSource = (body.source ?? '').trim();
  const source = rawSource === 'textbox' ? 'textbox' : 'api';

  type AiUsage = { input_tokens: number | null; output_tokens: number | null; total_tokens: number | null };
  const runAi = async (model: string): Promise<{ text: string; usage: AiUsage }> => {
    const maxTokens = AICHAT_MODEL_MAX_TOKENS[model] ?? 4096;
    const textMessages = buildAiMessages(message, systemPromptMode);
    const messages = image ? attachImageToLastUserMessage(textMessages, image) : textMessages;
    const baseParams = { messages, max_tokens: maxTokens };
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
        'INSERT INTO ai_chat_shares (id, user_id, user_hash, question, answer, model, created_at, conversation_hash, question_hash, input_tokens, output_tokens, total_tokens, source, image_data_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(shareId, user.sub, userHash, message, response, usedModel, now, conversationHash, questionHash, usage.input_tokens, usage.output_tokens, usage.total_tokens, source, image || null).run();
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

// SQLite(D1) の LIKE は非ASCII文字を正規化せずコードポイント単位の完全一致で
// 比較するため、全角中黒「・」(U+30FB) と半角中黒「･」(U+FF65) のように
// 見た目がほぼ同じでもコードポイントが異なる文字が入力側・保存側の
// どちらか一方でも混在すると一致しなくなる（日本語IME・スマートフォンの
// 日本語キーボードでは入力環境によってどちらの中黒になるかが変わる）。
// 検索文字列中の中黒をLIKEの"_"（任意の1文字）ワイルドカードに置き換えることで
// この表記ゆれを吸収する。ワイルドカード文字自体（%, _, \）はリテラル検索
// できるよう先にエスケープしてから中黒だけを非エスケープの"_"に変換する。
export function buildFuzzySearchLikePattern(q: string): string {
  const escaped = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const fuzzy = escaped.replace(/[・･]/g, '_');
  return `%${fuzzy}%`;
}

export async function searchAiChatShares(
  db: D1Like,
  userId: string,
  q: string,
): Promise<{ results: Array<{
  id: string; user_hash: string; question: string; answer: string;
  model: string; created_at: string; access_count: number; question_hash: string | null;
  image_data_url: string | null;
}> }> {
  // LIKEは(ワイルドカードの有無に関わらず)D1では約50バイト超のパターンで
  // "LIKE or GLOB pattern too complex" になるため、任意長になり得る自由入力の
  // 検索語はINSTR(長さ制限なし)を使い、中黒の表記ゆれはREPLACEで正規化する。
  const normalized = q.replace(/[・･]/g, '・');
  const rows = await db
    .prepare(
      `SELECT id, user_hash, question, answer, model, created_at, access_count, question_hash, image_data_url
       FROM ai_chat_shares
       WHERE user_id = ? AND deleted_at IS NULL AND (INSTR(REPLACE(question, '･', '・'), ?) > 0 OR INSTR(REPLACE(answer, '･', '・'), ?) > 0)
       ORDER BY created_at DESC LIMIT 30`
    )
    .bind(userId, normalized, normalized)
    .all<{
      id: string; user_hash: string; question: string; answer: string;
      model: string; created_at: string; access_count: number; question_hash: string | null;
      image_data_url: string | null;
    }>();
  return { results: rows.results ?? [] };
}

/**
 * /aichat-image-gallery ページ用。ai_chat_shares のうち画像添付(image_data_url
 * が非NULL)のものだけを対象に、質問文・回答文をキーワード検索する。
 * searchAiChatShares と同じINSTR/REPLACEベースの検索(中黒の全角/半角表記ゆれ
 * 吸収込み)に、画像添付フィルタを加えただけの派生版。
 */
export async function searchAiChatSharesWithImage(
  db: D1Like,
  userId: string,
  q: string,
): Promise<{ results: Array<{
  id: string; user_hash: string; question: string; answer: string;
  model: string; created_at: string; image_data_url: string | null;
}> }> {
  const normalized = q.replace(/[・･]/g, '・');
  const rows = await db
    .prepare(
      `SELECT id, user_hash, question, answer, model, created_at, image_data_url
       FROM ai_chat_shares
       WHERE user_id = ? AND deleted_at IS NULL AND image_data_url IS NOT NULL
         AND (INSTR(REPLACE(question, '･', '・'), ?) > 0 OR INSTR(REPLACE(answer, '･', '・'), ?) > 0)
       ORDER BY created_at DESC LIMIT 60`
    )
    .bind(userId, normalized, normalized)
    .all<{
      id: string; user_hash: string; question: string; answer: string;
      model: string; created_at: string; image_data_url: string | null;
    }>();
  return { results: rows.results ?? [] };
}

/**
 * テキストに含まれる登録済みキーワードだけを返す（大文字小文字を無視）。
 * /answer-graph の回答伝播グラフ構築で使う。
 */
export function extractContainedKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => kw && lower.indexOf(kw.toLowerCase()) !== -1);
}

/**
 * /answer-graph の起点検索結果それぞれに、その共有(回答)に aichat_search_log の
 * share_id で紐づくキーワードの総数(keywordCount)を付与する。回答伝播グラフの
 * 第1層キーワード群(findKeywordsForShares)と同じ出所・同じ定義に揃え、
 * 一人称モード最前列のキーワード数と一致することを保証する。
 */
export async function enrichSearchResultsWithKeywordCounts<T extends { id: string }>(
  db: D1Like,
  userId: string,
  results: T[],
): Promise<(T & { keywordCount: number })[]> {
  if (results.length === 0) return [];
  const countByShare = new Map<string, number>();
  for (const chunk of chunkBindValues(results.map((r) => r.id), D1_MAX_BOUND_PARAMS - 1)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT share_id, COUNT(DISTINCT keyword) AS cnt FROM aichat_search_log
       WHERE user_id = ? AND share_id IN (${placeholders})
       GROUP BY share_id`
    ).bind(userId, ...chunk).all<{ share_id: string; cnt: number }>();
    for (const r of (rows.results ?? [])) countByShare.set(r.share_id, r.cnt);
  }
  return results.map((r) => ({
    ...r,
    keywordCount: countByShare.get(r.id) ?? 0,
  }));
}

/**
 * answer-graphページの起点検索結果テーブルで、各質問行に対応する回答文が
 * 既にベクタ化済み(aichat_answer_vectors)かどうかを付与する。行の背景色を
 * 塗り分けるために使う(バインド上限に収まる単位でチャンク分割しN+1を回避)。
 */
export async function enrichSearchResultsWithVectorizedFlag<T extends { id: string }>(
  db: D1Like,
  userId: string,
  results: T[],
  model: string = PLAMO_EMBEDDING_MODEL,
): Promise<(T & { vectorized: boolean })[]> {
  if (results.length === 0) return [];
  const vectorizedIds = new Set<string>();
  for (const chunk of chunkBindValues(results.map((r) => r.id), D1_MAX_BOUND_PARAMS - 2)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT DISTINCT share_id FROM aichat_answer_vectors
       WHERE user_id = ? AND model = ? AND share_id IN (${placeholders})`
    ).bind(userId, model, ...chunk).all<{ share_id: string }>();
    for (const r of (rows.results ?? [])) vectorizedIds.add(r.share_id);
  }
  return results.map((r) => ({
    ...r,
    vectorized: vectorizedIds.has(r.id),
  }));
}

export interface AnswerGraphNode {
  id: string;
  type: 'answer' | 'keyword';
  label: string;
  depth: number;
  parentId: string | null;
  color?: string | null;
  dominantCategory?: string | null;
}

export interface AnswerGraphEdge {
  from: string;
  to: string;
}

export interface AnswerGraphResult {
  nodes: AnswerGraphNode[];
  edges: AnswerGraphEdge[];
}

const ANSWER_GRAPH_MAX_DEPTH = 6;
const ANSWER_GRAPH_MAX_NODES = 150;
const ANSWER_GRAPH_MAX_KEYWORDS_PER_LAYER = 12;
const ANSWER_GRAPH_MAX_ANSWERS_PER_KEYWORD = 10;

/**
 * 各共有(回答)に aichat_search_log の share_id で紐づくキーワードを取得する。
 * /api/aichat/share-keywords(回答モーダルのキーワード一覧)と同じ出所であり、
 * 回答伝播グラフの各層のキーワードはこの紐づけを唯一の情報源とする。
 * 検索履歴全体の人気キーワードを回答本文へ部分一致でぶつける方式は、
 * 実装・例外・設計のような汎用語がどの回答にもマッチしてしまうため使わない。
 */
async function findKeywordsForShares(
  db: D1Like,
  userId: string,
  shareIds: string[],
): Promise<Map<string, string[]>> {
  const byShare = new Map<string, string[]>();
  for (const chunk of chunkBindValues(shareIds, D1_MAX_BOUND_PARAMS - 1)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT share_id, keyword FROM aichat_search_log
       WHERE user_id = ? AND share_id IN (${placeholders})
       GROUP BY share_id, keyword
       ORDER BY SUM(select_count) DESC`
    ).bind(userId, ...chunk).all<{ share_id: string; keyword: string }>();
    for (const r of (rows.results ?? [])) {
      if (!r.keyword) continue;
      const list = byShare.get(r.share_id) ?? [];
      list.push(r.keyword);
      byShare.set(r.share_id, list);
    }
  }
  return byShare;
}

/**
 * 複数キーワードをまとめて1回(バインド上限に収まる単位でチャンク分割)の
 * クエリでai_chat_sharesを検索する。同じ層のキーワード数だけ個別に
 * INSTR検索クエリを発行するとD1への負荷がキーワード数に比例して増え、
 * グラフ取得が503(Worker/D1側の負荷超過)になる原因になっていたため、
 * キーワード1件ごとのクエリ発行(N+1)を避ける。
 */
async function findSharesContainingKeywords(
  db: D1Like,
  userId: string,
  keywords: string[],
  limitPerKeyword: number,
): Promise<Map<string, { id: string; question: string; answer: string }[]>> {
  const byKeyword = new Map<string, { id: string; question: string; answer: string }[]>();
  if (keywords.length === 0) return byKeyword;
  // 1キーワードにつきquestion用・answer用の2バインド値を使うため、
  // D1のバインド上限(userId分の1を除く)に収まる単位で分割する。
  const maxKeywordsPerChunk = Math.max(1, Math.floor((D1_MAX_BOUND_PARAMS - 1) / 2));
  for (const chunk of chunkBindValues(keywords, maxKeywordsPerChunk)) {
    if (chunk.length === 0) continue;
    const clause = chunk.map(() => '(INSTR(question, ?) > 0 OR INSTR(answer, ?) > 0)').join(' OR ');
    const binds: unknown[] = [userId];
    for (const kw of chunk) binds.push(kw, kw);
    const rows = await db.prepare(
      `SELECT id, question, answer FROM ai_chat_shares
       WHERE user_id = ? AND deleted_at IS NULL AND (${clause})
       ORDER BY created_at DESC`
    ).bind(...binds).all<{ id: string; question: string; answer: string }>();
    for (const row of (rows.results ?? [])) {
      for (const kw of chunk) {
        if (row.question.includes(kw) || row.answer.includes(kw)) {
          const list = byKeyword.get(kw) ?? [];
          if (list.length < limitPerKeyword) list.push(row);
          byKeyword.set(kw, list);
        }
      }
    }
  }
  return byKeyword;
}

/**
 * /answer-graph が使う回答伝播グラフの構築。起点の回答に含まれるキーワードを
 * 手がかりに関連する回答へ広げ、さらにその回答群から未処理のキーワードを
 * 抽出して繰り返す(ユーザー指定のBFSアルゴリズム)。
 *
 * 故障シナリオ対応:
 *   - 無限ループ防止のため maxDepth / maxNodes で必ず打ち切る
 *   - 既に訪問済みの回答・処理済みのキーワードは再度ノード化しない
 *   - 起点が存在しない/他ユーザーの回答の場合は null を返す(越境防止)
 */
export async function buildAnswerPropagationGraph(
  db: D1Like,
  userId: string,
  seedShareId: string,
  opts?: { maxDepth?: number; maxNodes?: number; maxKeywordsPerLayer?: number; maxAnswersPerKeyword?: number },
): Promise<AnswerGraphResult | null> {
  const maxDepth = opts?.maxDepth ?? ANSWER_GRAPH_MAX_DEPTH;
  const maxNodes = opts?.maxNodes ?? ANSWER_GRAPH_MAX_NODES;
  const maxKeywordsPerLayer = opts?.maxKeywordsPerLayer ?? ANSWER_GRAPH_MAX_KEYWORDS_PER_LAYER;
  const maxAnswersPerKeyword = opts?.maxAnswersPerKeyword ?? ANSWER_GRAPH_MAX_ANSWERS_PER_KEYWORD;

  const seedRows = await db.prepare(
    `SELECT id, question, answer FROM ai_chat_shares WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
  ).bind(seedShareId, userId).all<{ id: string; question: string; answer: string }>();
  const seed = (seedRows.results ?? [])[0];
  if (!seed) return null;

  const nodes: AnswerGraphNode[] = [];
  const edges: AnswerGraphEdge[] = [];
  const visitedShareIds = new Set<string>([seed.id]);
  const processedKeywords = new Set<string>();

  const seedNodeId = 'a:' + seed.id;
  nodes.push({ id: seedNodeId, type: 'answer', label: seed.question, depth: 0, parentId: null });

  type AnswerRec = { nodeId: string; question: string; answer: string };
  let currentAnswers: AnswerRec[] = [{ nodeId: seedNodeId, question: seed.question, answer: seed.answer }];
  let depth = 0;

  while (currentAnswers.length > 0 && depth < maxDepth && nodes.length < maxNodes) {
    // 各回答のキーワードは aichat_search_log の share_id 紐づけ(回答モーダルの
    // キーワード一覧と同じ出所)から取得する。検索履歴全体の人気キーワードを
    // 回答本文へ部分一致でぶつけると汎用語が混入するため行わない。
    // 第1層(起点回答の直下)は「その回答のキーワード群」そのものを表す必要が
    // あるため maxKeywordsPerLayer で打ち切らない。第2層以降は爆発防止のため打ち切る。
    const layerKeywordCap = depth === 0 ? Number.POSITIVE_INFINITY : maxKeywordsPerLayer;
    const keywordsByShare = await findKeywordsForShares(db, userId, currentAnswers.map((a) => a.nodeId.slice(2)));
    const newKeywordToParent = new Map<string, string>();
    for (const a of currentAnswers) {
      const found = (keywordsByShare.get(a.nodeId.slice(2)) ?? []).filter((k) => !processedKeywords.has(k));
      for (const kw of found) {
        if (newKeywordToParent.size >= layerKeywordCap) break;
        if (!newKeywordToParent.has(kw)) newKeywordToParent.set(kw, a.nodeId);
      }
      if (newKeywordToParent.size >= layerKeywordCap) break;
    }
    if (newKeywordToParent.size === 0) break;
    depth++;
    if (depth > maxDepth) break;

    const keywordNodeIds = new Map<string, string>();
    for (const [kw, parentNodeId] of newKeywordToParent) {
      if (nodes.length >= maxNodes) break;
      const kwNodeId = 'k:' + kw;
      nodes.push({ id: kwNodeId, type: 'keyword', label: kw, depth, parentId: parentNodeId });
      edges.push({ from: parentNodeId, to: kwNodeId });
      keywordNodeIds.set(kw, kwNodeId);
      processedKeywords.add(kw);
    }

    depth++;
    if (depth > maxDepth) {
      currentAnswers = [];
      break;
    }

    const nextAnswers: AnswerRec[] = [];
    const matchesByKeyword = await findSharesContainingKeywords(db, userId, [...keywordNodeIds.keys()], maxAnswersPerKeyword);
    for (const [kw, kwNodeId] of keywordNodeIds) {
      if (nodes.length >= maxNodes) break;
      const matches = matchesByKeyword.get(kw) ?? [];
      for (const m of matches) {
        if (visitedShareIds.has(m.id)) continue;
        if (nodes.length >= maxNodes) break;
        visitedShareIds.add(m.id);
        const aNodeId = 'a:' + m.id;
        nodes.push({ id: aNodeId, type: 'answer', label: m.question, depth, parentId: kwNodeId });
        edges.push({ from: kwNodeId, to: aNodeId });
        nextAnswers.push({ nodeId: aNodeId, question: m.question, answer: m.answer });
      }
    }
    nextAnswers.sort((x, y) => x.question.localeCompare(y.question, 'ja'));
    currentAnswers = nextAnswers;
  }

  return { nodes, edges };
}

/**
 * AIチャット共有履歴の全文検索 API（認証が必要）
 */
app.get('/api/aichat/shares/search', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);

  const q = (c.req.query('q') ?? '').trim();
  if (!q) return jsonUtf8({ results: [] });

  const { results } = await searchAiChatShares(c.env.DB as unknown as D1Like, user.sub, q);
  const withKeywordCounts = await enrichSearchResultsWithKeywordCounts(c.env.DB as unknown as D1Like, user.sub, results);
  const enriched = await enrichSearchResultsWithVectorizedFlag(c.env.DB as unknown as D1Like, user.sub, withKeywordCounts);
  return jsonUtf8({ results: enriched });
});

/**
 * /answer-graph ページ: 起点の回答からキーワードを手がかりに関連する回答へ
 * 広がっていく様子をBFSで構築して返す。
 */
app.post('/api/aichat/answer-propagation-graph', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const body = await c.req.json<{ shareId?: string }>();
  const shareId = typeof body.shareId === 'string' ? body.shareId.trim() : '';
  if (!shareId) return jsonUtf8({ error: 'shareId は必須です' }, 400);

  // グラフ構築で例外が起きるとHono既定の500(プレーンテキスト)になり、
  // クライアントは一律「通信エラー」としか表示できず原因が追えない。
  // 必ずJSONでエラー内容を返し、画面にそのまま表示できるようにする。
  let result: AnswerGraphResult | null;
  try {
    result = await buildAnswerPropagationGraph(c.env.DB, user.sub, shareId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('answer-propagation-graph: graph build failed', { shareId, error: message });
    return jsonUtf8({ error: 'グラフ構築でサーバーエラーが発生しました: ' + message }, 500);
  }
  if (!result) return jsonUtf8({ error: '指定された回答が見つかりません' }, 404);

  const autoVectorize = resolveAutoVectorizeSettings(c.req.header('Cookie'));
  if (!autoVectorize.enabled) {
    return jsonUtf8({ ...result, _colorWarning: 'キーワードの自動ベクタ化がOFFのため色分けは無効です' });
  }
  if (c.env.AI) {
    try {
      const colored = await enrichGraphWithCategoryColors(c.env.DB, c.env.AI, user.sub, result, autoVectorize.model);
      return jsonUtf8(colored);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('answer-propagation-graph: category color enrichment failed', { shareId, error: message });
      // ここでの失敗理由はサーバーログにしか残らずユーザー側から確認できないため、
      // レスポンス自体にも含めてフロントエンドで直接表示できるようにする。
      return jsonUtf8({ ...result, _colorWarning: message });
    }
  }
  return jsonUtf8({ ...result, _colorWarning: 'AIバインディングが未設定のため色分けは無効です' });
});

/**
 * ログインユーザー自身のメールアドレス宛にResendでテストメールを1通送るだけのエンドポイント。
 * RESEND_API_KEY 未設定時はデフォルトOFF（動作確認用オプション機能）。
 */
app.get('/api/email-verify-test', authMiddleware, async (c) => {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) return jsonUtf8({ enabled: false, message: 'メール送信テスト機能は現在無効です(RESEND_API_KEY未設定)' });

  const user = c.get('user');
  if (!user.email) return jsonUtf8({ enabled: true, error: 'ログインユーザーにメールアドレスが設定されていません' }, 400);

  const result = await sendTestEmailResend(apiKey, user.email);
  if (!result.ok) return jsonUtf8({ enabled: true, error: 'メール送信に失敗しました', detail: result.error }, 502);
  return jsonUtf8({ enabled: true, sent: true, to: user.email });
});

app.get('/api/aichat/check-heritage-questions', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const heritage = (c.req.query('heritage') ?? '').trim();
  if (!heritage) return jsonUtf8({ answered: {} });
  const country_name = (c.req.query('country_name') ?? '').trim() || null;
  const topics = ['交通手段', '見どころ', '最寄り空港', '鉄道でのアクセス', '宿泊施設', 'スポーツ施設'];
  // 遺産名の含有で候補行を取得し、トピックはJS側で同定する。LIKEは使わない
  // （D1のパターン長制限で本番のみ失敗するため）。
  const rows = await c.env.DB.prepare(
    `SELECT id, question FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND INSTR(REPLACE(question, '･', '・'), ?) > 0 ORDER BY created_at DESC`
  ).bind(user.sub, heritageNameNeedle(heritage)).all<{ id: string; question: string }>();
  const answeredMap = new Map<string, string>();
  for (const r of (rows.results ?? [])) {
    // 接頭辞「「国名」にある」を完全に除去してから同定処理へ進む。
    const stripped = stripHeritageQuestionCountryPrefix(r.question);
    const hit = matchHeritageQuestionTarget(stripped, [heritage], topics);
    if (hit && !answeredMap.has(hit.topic)) answeredMap.set(hit.topic, r.id);
  }
  const answered: Record<string, string | null> = {};
  topics.forEach((t) => { answered[t] = answeredMap.get(t) ?? null; });

  try {
    const masters = await c.env.DB.prepare(
      `SELECT id, topic FROM heritage_ai_question_masters WHERE topic IN (${topics.map(() => '?').join(', ')})`
    ).bind(...topics).all<{ id: number; topic: string }>();
    const topicIdMap = new Map<string, number>();
    for (const m of (masters.results ?? [])) topicIdMap.set(m.topic, m.id);

    const existingRows = await c.env.DB.prepare(
      `SELECT question_master_id FROM heritage_question_view_log WHERE user_id = ? AND heritage_name = ? AND deleted_at IS NULL`
    ).bind(user.sub, heritage).all<{ question_master_id: number }>();
    const existingIds = new Set((existingRows.results ?? []).map((r) => r.question_master_id));

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const qmId = topicIdMap.get(topic);
      const isCached = answeredMap.has(topic);
      if (qmId && isCached && !existingIds.has(qmId)) {
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO heritage_question_view_log (user_id, country_name, heritage_name, question_master_id, searched_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(user.sub, country_name, heritage, qmId, now).run();
      }
    }
  } catch (_e) {
    // heritage_ai_question_masters / heritage_question_view_log 未作成時はスキップ
  }

  return jsonUtf8({ answered });
});

// D1 は 1 クエリあたりのバインドパラメータ数に上限（100）があり、IN(...) 句へ
// 大量の値を渡すとクエリ全体が失敗する。この失敗は握りつぶされて「結果が空」に
// 化けるため、都市タップでアコーディオンを開いた際に近隣世界遺産が多い都市ほど
// 全件のキャッシュ判定が無言で機能しなくなる。値をチャンク分割して各クエリの
// バインド数を確実に上限未満へ抑えることで再発を防ぐ。
export const D1_MAX_BOUND_PARAMS = 90;

export function chunkBindValues<T>(values: T[], maxPerChunk: number = D1_MAX_BOUND_PARAMS): T[][] {
  const size = Math.max(1, Math.floor(maxPerChunk));
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): { all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> };
  };
}

// heritage-accessページの「AIに何を質問しますか」パネルは、同名で国が異なる
// 世界遺産（例: モンテ・サン・ジョルジョ）の誤回答を防ぐため、質問文の先頭に
// 「「国名」にある」を補足してから問い合わせている（heritageAccess.ts の askAI 参照）。
// その生プロンプトがそのまま ai_chat_shares.question へ保存されるため、DB上の
// question は「「国名」にある「遺産名」の「topic」について説明してください」という
// 形になり、接頭辞なしで組み立てた質問文とは完全一致しない。
//
// キャッシュ判定（👀👁️アイコン・トピックバッジ・🔑キーワードヒット数）は
// 接頭辞の有無を問わず該当行を拾えなければならないため、
//   1. SQL では「接頭辞なし質問文で終わる」末尾一致（LIKE '%' || ?）で候補行を取得し
//   2. 取得した question から接頭辞を事前に取り除いてから、接頭辞なし質問文との
//      完全一致で突き合わせる
// という2段構えにする。SQLの末尾一致は粗いフィルタに過ぎず、最終的な同定は
// stripHeritageQuestionCountryPrefix 後の完全一致が担うため、LIKE のワイルドカード
// （%・_）が遺産名に含まれていても取りこぼしは起きない。
export function stripHeritageQuestionCountryPrefix(question: string): string {
  // 「国名」にある が複数重なっても取りこぼさないよう、先頭から繰り返し除去する。
  let out = String(question || '');
  for (;;) {
    const next = out.replace(/^\s*「[^」]+」に(?:ある|所在する)[、,。\s]*/, '');
    if (next === out) return out;
    out = next;
  }
}

// D1(SQLite)は全角中黒「・」(U+30FB)と半角中黒「･」(U+FF65)をコードポイント単位で
// 区別するため、日本語IME・スマートフォンのキーボードによる表記ゆれを吸収する。
export function normalizeNakaguro(text: string): string {
  return String(text || '').replace(/[・･]/g, '・');
}

// Cloudflare D1 は(ワイルドカードの有無に関わらず)LIKEパターンが約50バイトを
// 超えると "LIKE or GLOB pattern too complex: SQLITE_ERROR" で失敗する
// （実機 wrangler dev で確認済み。src/heritage-area-search-instr.test.ts 参照）。
// 日本語の質問文は1文字3バイトのため「「遺産名」の「topic」について説明してください」
// は容易に100バイトを超え、LIKEを使うと本番D1で必ずクエリごと失敗する。
// その失敗は呼び出し元の catch で握りつぶされて「キャッシュ無し」に化けるため、
// アイコン・バッジが永遠に表示されない。長さ制限のない INSTR で部分一致を行う。
//
// 遺産名は「名前」のように括弧で囲んだ形で照合することで、「城」が「姫路城」に
// 誤ヒットするような境界の取り違えを防ぐ。
export function buildHeritageNameInstrConditions(column: string, count: number): string {
  return Array.from({ length: count }, () => `INSTR(REPLACE(${column}, '･', '・'), ?) > 0`).join(' OR ');
}

export function heritageNameNeedle(heritage: string): string {
  return `「${normalizeNakaguro(heritage)}」`;
}

// 質問文（接頭辞除去済み）が、どの遺産・どのトピックのものかを同定する。
// 候補が複数ある場合は最長一致を採用し、部分文字列関係にある名前の取り違えを防ぐ。
export function matchHeritageQuestionTarget(
  question: string,
  heritages: string[],
  topics: string[],
): { heritage: string; topic: string } | null {
  const normalized = normalizeNakaguro(question);
  let heritage: string | null = null;
  for (const h of heritages) {
    if (!normalized.includes(heritageNameNeedle(h))) continue;
    if (heritage === null || h.length > heritage.length) heritage = h;
  }
  if (heritage === null) return null;
  let topic: string | null = null;
  for (const t of topics) {
    if (!normalized.includes(`「${t}」`)) continue;
    if (topic === null || t.length > topic.length) topic = t;
  }
  if (topic === null) return null;
  return { heritage, topic };
}

// アコーディオン展開時、メニュー内すべての世界遺産名についてキャッシュ済み AI 回答
// （ai_chat_shares）の有無を一括判定する。IN(...) のバインド数が D1 上限を超えない
// よう質問文をチャンク分割して複数クエリで実行し、1チャンクでも失敗したら error を
// 返して呼び出し元（API レスポンス）が異常を検知できるようにする（握りつぶし禁止）。
export async function lookupHeritageQuestionAnswers(
  db: D1Like,
  userId: string,
  heritages: string[],
  topics: string[],
  maxBoundParams: number = D1_MAX_BOUND_PARAMS,
): Promise<{ answered: Record<string, Record<string, string | null>>; error?: string }> {
  const answered: Record<string, Record<string, string | null>> = {};
  for (const h of heritages) {
    answered[h] = {};
    for (const t of topics) answered[h][t] = null;
  }
  // 遺産名の含有だけで候補行を取得し、トピックはJS側で「トピック」の含有から
  // 同定する。LIKEは使わない（D1のパターン長制限で本番のみ失敗するため）。
  // user_id の 1 バインドを差し引いた数をチャンク上限にする。
  const chunkSize = Math.max(1, maxBoundParams - 1);
  let hadError = false;
  for (const chunk of chunkBindValues(heritages, chunkSize)) {
    try {
      const conditions = buildHeritageNameInstrConditions('question', chunk.length);
      const rows = await db
        .prepare(`SELECT id, question FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND (${conditions}) ORDER BY created_at DESC`)
        .bind(userId, ...chunk.map(heritageNameNeedle))
        .all<{ id: string; question: string }>();
      for (const r of (rows.results ?? [])) {
        // 接頭辞「「国名」にある」を完全に除去してから同定処理へ進む。
        const stripped = stripHeritageQuestionCountryPrefix(r.question);
        const hit = matchHeritageQuestionTarget(stripped, chunk, topics);
        if (!hit) continue;
        // created_at DESC 順なので最初に見つかった(最新の)行を採用する。
        if (answered[hit.heritage] && answered[hit.heritage][hit.topic] == null) {
          answered[hit.heritage][hit.topic] = r.id;
        }
      }
    } catch {
      hadError = true;
    }
  }
  return hadError ? { answered, error: 'partial_query_failure' } : { answered };
}

// 世界遺産名（キーワード）ごとに、閲覧ログ（heritage_question_view_log）由来の
// トピック一覧を一括取得する。こちらも IN(...) のバインド数をチャンク分割する。
//
// heritage_question_view_log は ai_chat_shares への参照を share_id では持たず
// heritage_name + question_master_id（トピック）でしか結び付いていない上、
// ai_chat_shares 側がソフトデリートされても連動して削除されない。そのため
// EXISTS 句で「同じ質問文の ai_chat_shares が deleted_at IS NULL で現存するか」
// を確認し、既に削除された回答のトピックバッジを表示しないようにする
// （表示だけが残り、クリックしても /api/aichat/shares/by-keyword が
// 何も見つけられない不整合を防ぐ）。
export async function lookupHeritageKeywordTopics(
  db: D1Like,
  userId: string,
  keywords: string[],
  maxBoundParams: number = D1_MAX_BOUND_PARAMS,
): Promise<{ hits: Record<string, string[]>; error?: string }> {
  const hits: Record<string, string[]> = {};
  for (const kw of keywords) hits[kw] = [];
  const chunkSize = Math.max(1, maxBoundParams - 1);
  let hadError = false;
  for (const chunk of chunkBindValues(keywords, chunkSize)) {
    try {
      const placeholders = chunk.map(() => '?').join(',');
      const rows = await db
        .prepare(
          `SELECT l.heritage_name, m.topic FROM heritage_question_view_log l
           JOIN heritage_ai_question_masters m ON l.question_master_id = m.id
           WHERE l.user_id = ? AND l.heritage_name IN (${placeholders}) AND l.deleted_at IS NULL
             AND EXISTS (
               SELECT 1 FROM ai_chat_shares s
               WHERE s.user_id = l.user_id AND s.deleted_at IS NULL
                 AND INSTR(REPLACE(s.question, '･', '・'), '「' || REPLACE(l.heritage_name, '･', '・') || '」') > 0
                 AND INSTR(s.question, '「' || m.topic || '」') > 0
             )`
        )
        .bind(userId, ...chunk)
        .all<{ heritage_name: string; topic: string }>();
      for (const r of (rows.results ?? [])) {
        if (hits[r.heritage_name] && !hits[r.heritage_name].includes(r.topic)) {
          hits[r.heritage_name].push(r.topic);
        }
      }
    } catch {
      hadError = true;
    }
  }
  return hadError ? { hits, error: 'partial_query_failure' } : { hits };
}

// 「キーワード」バッジの表記「キーワード (◯)」に使う◯（世界遺産ごとの
// distinctキーワード総数）をまとめて算出する。aichat_search_history
// （検索キーワード選択履歴）に紐づく ai_chat_shares が現存する（deleted_at IS NULL）
// 場合のみカウント対象にするよう、常に ai_chat_shares 側との JOIN 越しに判定する
// （lookupHeritageSearchKeywordCounts と同じ結合条件で揃えてあり、
// 「バッジは出るのに件数取得が空になる」という不整合が起きない）。
export async function lookupHeritageSearchKeywordCountsBatch(
  db: D1Like,
  userId: string,
  heritageNames: string[],
): Promise<{ keywordCounts: Record<string, number> }> {
  const keywordCounts: Record<string, number> = {};
  const seenPerName = new Map<string, Set<string>>();
  for (const name of heritageNames) {
    keywordCounts[name] = 0;
    seenPerName.set(name, new Set());
  }
  try {
    const rows = await db
      .prepare(
        `SELECT DISTINCT acs.question, ash.keyword
         FROM ai_chat_shares acs
         INNER JOIN aichat_search_history ash ON ash.share_id = acs.id AND ash.user_id = ? AND ash.deleted_at IS NULL
         WHERE acs.user_id = ? AND acs.deleted_at IS NULL`
      )
      .bind(userId, userId)
      .all<{ question: string; keyword: string }>();
    for (const row of (rows.results ?? [])) {
      const q = row.question || '';
      for (const name of heritageNames) {
        if (questionStartsWithHeritageBracket(q, name)) {
          seenPerName.get(name)!.add(row.keyword);
        }
      }
    }
    for (const name of heritageNames) keywordCounts[name] = seenPerName.get(name)!.size;
  } catch {
    // aichat_search_history 未作成時はスキップ
  }
  return { keywordCounts };
}

// 「キーワード」バッジをクリックした際に表示する、世界遺産1件分のキーワード内訳。
// lookupHeritageSearchKeywordCountsBatch と同じ ai_chat_shares 結合条件を使う。
export async function lookupHeritageSearchKeywordCounts(
  db: D1Like,
  userId: string,
  heritage: string,
): Promise<{ keywords: Array<{ keyword: string; count: number }> }> {
  try {
    const rows = await db
      .prepare(
        `SELECT ash.keyword, COUNT(*) as count
         FROM aichat_search_history ash
         INNER JOIN ai_chat_shares acs ON acs.id = ash.share_id AND acs.user_id = ? AND acs.deleted_at IS NULL
         WHERE ash.user_id = ? AND ash.deleted_at IS NULL
           AND acs.question LIKE ?
         GROUP BY ash.keyword
         ORDER BY count DESC, ash.keyword ASC`
      )
      .bind(userId, userId, '「' + heritage + '」%')
      .all<{ keyword: string; count: number }>();
    return { keywords: rows.results ?? [] };
  } catch {
    return { keywords: [] };
  }
}

/**
 * 世界遺産名一覧に対して「〇〇」の「topic」についてXXXという質問文が
 * 指定モデルでキャッシュ済みかどうかをまとめて調べ、share_id を返す。
 */

export function countKeywordHitsInText(
  text: string,
  keywordCandidates: string[],
): { keywords: string[]; hitCount: number } {
  const seen = new Set<string>();
  const keywords: string[] = [];
  const body = text || '';
  for (const raw of keywordCandidates) {
    const keyword = String(raw || '').trim();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    if (body.includes(keyword)) keywords.push(keyword);
  }
  return { keywords, hitCount: keywords.length };
}

export async function lookupHeritageMitokoroKeywordHits(
  db: D1Like,
  userId: string,
  heritage: string,
  model: string,
): Promise<{ keywords: string[]; hitCount: number }> {
  try {
    // 遺産名とトピックの含有で絞る。LIKEは使わない（D1のパターン長制限で
    // 本番のみ失敗するため。buildHeritageNameInstrConditions のコメント参照）。
    const rows = await db
      .prepare(
        `SELECT acs.answer, ash.keyword
         FROM ai_chat_shares acs
         INNER JOIN aichat_search_history ash ON ash.share_id = acs.id AND ash.user_id = ? AND ash.deleted_at IS NULL
         WHERE acs.user_id = ? AND acs.deleted_at IS NULL
           AND acs.model = ?
           AND INSTR(REPLACE(acs.question, '･', '・'), ?) > 0
           AND INSTR(acs.question, ?) > 0
         ORDER BY acs.created_at DESC`
      )
      .bind(userId, userId, model, heritageNameNeedle(heritage), `「${HERITAGE_TOOLTIP_GEMMA_TOPIC}」`)
      .all<{ answer: string; keyword: string }>();
    const results = rows.results ?? [];
    const answer = results[0]?.answer || '';
    return countKeywordHitsInText(answer, results.map((r) => r.keyword));
  } catch {
    return { keywords: [], hitCount: 0 };
  }
}

export async function lookupHeritageTopicModelCache(
  db: D1Like,
  userId: string,
  heritages: string[],
  topic: string,
  model: string,
  maxBoundParams: number = D1_MAX_BOUND_PARAMS,
): Promise<{ cached: Record<string, string | null>; error?: string }> {
  const cached: Record<string, string | null> = {};
  for (const h of heritages) cached[h] = null;
  // 「質問文にトピック(見どころ等)が含まれるか」×「質問文に遺産名が含まれるか」で
  // 候補行を絞り、モデル列で👀(gemma)/👁️(llama)を分岐する。LIKEは使わない
  // （D1のパターン長制限で本番のみ失敗するため。buildHeritageNameInstrConditions参照）。
  const topicNeedle = `「${topic}」`;
  // user_id・model・topic の 3 バインドを差し引いた数をチャンク上限にする。
  const chunkSize = Math.max(1, maxBoundParams - 3);
  let hadError = false;
  for (const chunk of chunkBindValues(heritages, chunkSize)) {
    try {
      const conditions = buildHeritageNameInstrConditions('question', chunk.length);
      const rows = await db
        .prepare(`SELECT id, question FROM ai_chat_shares WHERE user_id = ? AND deleted_at IS NULL AND model = ? AND INSTR(question, ?) > 0 AND (${conditions}) ORDER BY created_at DESC`)
        .bind(userId, model, topicNeedle, ...chunk.map(heritageNameNeedle))
        .all<{ id: string; question: string }>();
      for (const r of (rows.results ?? [])) {
        // 接頭辞「「国名」にある」を完全に除去してから同定処理へ進む。
        const stripped = stripHeritageQuestionCountryPrefix(r.question);
        const hit = matchHeritageQuestionTarget(stripped, chunk, [topic]);
        if (hit && cached[hit.heritage] == null) cached[hit.heritage] = r.id;
      }
    } catch {
      hadError = true;
    }
  }
  return hadError ? { cached, error: 'partial_query_failure' } : { cached };
}

const HERITAGE_TOOLTIP_GEMMA_TOPIC = '見どころ';
const HERITAGE_TOOLTIP_GEMMA_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const HERITAGE_TOOLTIP_LLAMA_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

app.post('/api/aichat/check-heritage-mitokoro-gemma-batch', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ cached: {} }, 503);
  let heritages: string[] = [];
  try {
    const body = await c.req.json<{ heritages?: unknown }>();
    if (Array.isArray(body.heritages)) {
      heritages = (body.heritages as unknown[]).map((h) => String(h).trim()).filter(Boolean).slice(0, 800);
    }
  } catch {
    return jsonUtf8({ cached: {} }, 400);
  }
  if (!heritages.length) return jsonUtf8({ cached: {} });
  const result = await lookupHeritageTopicModelCache(
    c.env.DB as unknown as D1Like, user.sub, heritages, HERITAGE_TOOLTIP_GEMMA_TOPIC, HERITAGE_TOOLTIP_GEMMA_MODEL
  );
  return jsonUtf8(result.error ? { cached: result.cached, error: result.error } : { cached: result.cached });
});

app.post('/api/aichat/check-heritage-mitokoro-llama-batch', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ cached: {} }, 503);
  let heritages: string[] = [];
  try {
    const body = await c.req.json<{ heritages?: unknown }>();
    if (Array.isArray(body.heritages)) {
      heritages = (body.heritages as unknown[]).map((h) => String(h).trim()).filter(Boolean).slice(0, 800);
    }
  } catch {
    return jsonUtf8({ cached: {} }, 400);
  }
  if (!heritages.length) return jsonUtf8({ cached: {} });
  const result = await lookupHeritageTopicModelCache(
    c.env.DB as unknown as D1Like, user.sub, heritages, HERITAGE_TOOLTIP_GEMMA_TOPIC, HERITAGE_TOOLTIP_LLAMA_MODEL
  );
  return jsonUtf8(result.error ? { cached: result.cached, error: result.error } : { cached: result.cached });
});

app.post('/api/aichat/check-heritage-questions-batch', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ answered: {} }, 503);
  let heritages: string[] = [];
  try {
    const body = await c.req.json<{ heritages?: unknown }>();
    if (Array.isArray(body.heritages)) {
      heritages = (body.heritages as unknown[]).map((h) => String(h).trim()).filter(Boolean).slice(0, 100);
    }
  } catch {
    return jsonUtf8({ answered: {} }, 400);
  }
  if (!heritages.length) return jsonUtf8({ answered: {} });
  const topics = ['交通手段', '見どころ', '最寄り空港', '鉄道でのアクセス', '宿泊施設', 'スポーツ施設'];
  const result = await lookupHeritageQuestionAnswers(c.env.DB as unknown as D1Like, user.sub, heritages, topics);
  return jsonUtf8(result.error ? { answered: result.answered, error: result.error } : { answered: result.answered });
});

app.get('/api/aichat/heritage-keywords-check', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ hits: {} }, 503);
  const raw = (c.req.query('keywords') ?? '').trim();
  if (!raw) return jsonUtf8({ hits: {} });
  const keywords = raw.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 200);
  if (!keywords.length) return jsonUtf8({ hits: {} });
  const result = await lookupHeritageKeywordTopics(c.env.DB as unknown as D1Like, user.sub, keywords);
  return jsonUtf8(result.error ? { hits: result.hits, error: result.error } : { hits: result.hits });
});

app.get('/api/aichat/heritage-search-keywords-check', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ keywordCounts: {} }, 503);
  const raw = (c.req.query('keywords') ?? '').trim();
  if (!raw) return jsonUtf8({ keywordCounts: {} });
  const keywords = raw.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 200);
  if (!keywords.length) return jsonUtf8({ keywordCounts: {} });
  const { keywordCounts } = await lookupHeritageSearchKeywordCountsBatch(c.env.DB as unknown as D1Like, user.sub, keywords);
  return jsonUtf8({ keywordCounts });
});

app.get('/api/aichat/heritage-search-keyword-counts', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ keywords: [] }, 503);
  const heritage = (c.req.query('heritage') ?? '').trim();
  if (!heritage) return jsonUtf8({ keywords: [] });
  const { keywords } = await lookupHeritageSearchKeywordCounts(c.env.DB as unknown as D1Like, user.sub, heritage);
  return jsonUtf8({ keywords });
});

app.get('/api/aichat/heritage-mitokoro-keyword-hits', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ keywords: [], hitCount: 0 }, 503);
  const heritage = (c.req.query('heritage') ?? '').trim();
  const model = (c.req.query('model') ?? '').trim();
  if (!heritage || !model) return jsonUtf8({ keywords: [], hitCount: 0 });
  const result = await lookupHeritageMitokoroKeywordHits(c.env.DB as unknown as D1Like, user.sub, heritage, model);
  return jsonUtf8(result);
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

  const [kwRows, qRows, apiModelRows, sourceRows] = await Promise.all([
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
    c.env.DB.prepare(
      `SELECT model, COUNT(*) as q_count
       FROM ai_chat_shares
       WHERE user_id=? AND deleted_at IS NULL AND created_at LIKE ? AND source='api'
       GROUP BY model ORDER BY q_count DESC`
    ).bind(user.sub, `${month}%`).all<{ model: string; q_count: number }>(),
    c.env.DB.prepare(
      `SELECT source, COUNT(*) as q_count
       FROM ai_chat_shares
       WHERE user_id=? AND deleted_at IS NULL AND created_at LIKE ?
       GROUP BY source ORDER BY q_count DESC`
    ).bind(user.sub, `${month}%`).all<{ source: string | null; q_count: number }>(),
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

  const apiModelTotals: Record<string, number> = {};
  (apiModelRows.results ?? []).forEach(r => { apiModelTotals[r.model] = r.q_count; });

  const sourceTotals = buildAichatSourceTotals(sourceRows.results ?? []);

  const allDates = new Set<string>([...Object.keys(kwMap), ...Object.keys(qMap)]);
  const days = Array.from(allDates).sort().map(date => ({
    date,
    kw_count: kwMap[date] ?? 0,
    models: qMap[date] ?? {},
  }));

  return jsonUtf8({ month, days, models: Array.from(modelSet), apiModelTotals, sourceTotals });
});

app.get('/api/aichat/shares/by-date', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);

  const date = (c.req.query('date') ?? '').slice(0, 10);
  if (!date) return jsonUtf8({ results: [] });

  const rows = await c.env.DB.prepare(
    `SELECT id, user_hash, question, answer, model, created_at, access_count, question_hash, image_data_url
     FROM ai_chat_shares
     WHERE user_id = ? AND deleted_at IS NULL AND created_at LIKE ?
     ORDER BY created_at DESC LIMIT 50`
  ).bind(user.sub, `${date}%`).all<{
    id: string; user_hash: string; question: string; answer: string;
    model: string; created_at: string; access_count: number; question_hash: string | null;
    image_data_url: string | null;
  }>();

  return jsonUtf8({ date, results: rows.results ?? [] });
});

app.get('/api/aichat/shares/by-keyword', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const keyword = (c.req.query('keyword') ?? '').trim();
  if (!keyword) return jsonUtf8({ results: [] });
  const topic = (c.req.query('topic') ?? '').trim();
  let rows;
  if (topic) {
    rows = await c.env.DB.prepare(
      `SELECT DISTINCT id, user_hash, question, answer, model, created_at, access_count, question_hash, image_data_url
       FROM ai_chat_shares
       WHERE user_id = ? AND deleted_at IS NULL
         AND question LIKE ? AND question LIKE ?
       ORDER BY created_at DESC LIMIT 50`
    ).bind(user.sub, `%「${keyword}」%`, `%「${topic}」%`).all<{
      id: string; user_hash: string; question: string; answer: string;
      model: string; created_at: string; access_count: number; question_hash: string | null;
      image_data_url: string | null;
    }>();
  } else {
    rows = await c.env.DB.prepare(
      `SELECT DISTINCT s.id, s.user_hash, s.question, s.answer, s.model, s.created_at, s.access_count, s.question_hash, s.image_data_url
       FROM aichat_search_log l
       JOIN ai_chat_shares s ON s.id = l.share_id AND s.user_id = l.user_id
       WHERE l.user_id = ? AND l.keyword = ? AND s.deleted_at IS NULL
       ORDER BY s.created_at DESC LIMIT 50`
    ).bind(user.sub, keyword).all<{
      id: string; user_hash: string; question: string; answer: string;
      model: string; created_at: string; access_count: number; question_hash: string | null;
      image_data_url: string | null;
    }>();
  }
  return jsonUtf8({ keyword, results: rows.results ?? [] });
});

app.get('/api/aichat/keywords/monthly', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const month = ((c.req.query('month') ?? '').slice(0, 7)) || new Date().toISOString().slice(0, 7);
  const rows = await c.env.DB.prepare(
    `SELECT l.keyword, SUM(l.select_count) AS total_count,
            GROUP_CONCAT(DISTINCT s.model) AS models
     FROM aichat_search_log l
     LEFT JOIN ai_chat_shares s ON s.id = l.share_id AND s.deleted_at IS NULL
     WHERE l.user_id = ? AND strftime('%Y-%m', l.last_searched_at) = ?
     GROUP BY l.keyword
     ORDER BY total_count DESC LIMIT 100`
  ).bind(user.sub, month).all<{ keyword: string; total_count: number; models: string | null }>();
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

app.post('/api/aichat/search-log/open-modal', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const body = await c.req.json<{ keyword?: string; shareIds?: string[] }>();
  const keyword = (body.keyword ?? '').trim().slice(0, 200);
  const shareIds = Array.isArray(body.shareIds) ? body.shareIds.slice(0, 50) : [];
  if (!keyword || !shareIds.length) return jsonUtf8({ entries: [] });
  const placeholders = shareIds.map(() => '?').join(',');
  const existing = await c.env.DB.prepare(
    `SELECT share_id FROM aichat_search_log WHERE user_id = ? AND keyword = ? AND share_id IN (${placeholders})`
  ).bind(user.sub, keyword, ...shareIds).all();
  const registeredSet = new Set(existing.results.map((r: any) => String(r.share_id)));
  const rows = await c.env.DB.prepare(
    `SELECT s.id, s.question, s.model FROM ai_chat_shares s WHERE s.id IN (${placeholders}) AND s.deleted_at IS NULL`
  ).bind(...shareIds).all();
  const shareMap = new Map(rows.results.map((r: any) => [String(r.id), r]));
  const entries = shareIds.map((id: string) => {
    const share = shareMap.get(id);
    return {
      shareId: id,
      model: share ? String(share.model) : '',
      question: share ? String(share.question).slice(0, 100) : '',
      isNew: !registeredSet.has(id),
    };
  });
  return jsonUtf8({ entries });
});

app.post('/api/aichat/search-log/approve', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const db = c.env.DB;
  const body = await c.req.json<{ keyword?: string; shareIds?: string[] }>();
  const keyword = (body.keyword ?? '').trim().slice(0, 200);
  const shareIds = Array.isArray(body.shareIds) ? body.shareIds.slice(0, 50) : [];
  if (!keyword || !shareIds.length) return jsonUtf8({ ok: true, count: 0 });
  const now = new Date().toISOString();
  const stmts = shareIds.map((shareId: string) =>
    db.prepare(
      `INSERT INTO aichat_search_log (user_id, keyword, share_id, first_searched_at, last_searched_at, select_count)
       VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(user_id, keyword, share_id) DO NOTHING`
    ).bind(user.sub, keyword, shareId, now, now)
  );
  try {
    await db.batch(stmts);
    return jsonUtf8({ ok: true, count: shareIds.length });
  } catch (e: any) {
    return jsonUtf8({ ok: false, error: String(e?.message ?? e) }, 500);
  }
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
  const db = c.env.DB;
  const body = await c.req.json<{ shareIds?: string[]; resultCount?: number }>();
  const shareIds = Array.isArray(body.shareIds) ? body.shareIds : [];
  const resultCount = typeof body.resultCount === 'number' ? body.resultCount : null;
  if (shareIds.length === 0) return jsonUtf8({ ok: true, inserted: 0 });
  const now = new Date().toISOString();
  const stmts = shareIds.map((shareId) =>
    db.prepare(
      `INSERT INTO aichat_search_impressions (user_id, share_id, result_count, searched_at) VALUES (?, ?, ?, ?)`
    ).bind(user.sub, String(shareId).slice(0, 100), resultCount, now)
  );
  await db.batch(stmts);
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
  try {
    const rows = await c.env.DB.prepare(
      `SELECT s.keyword, SUM(s.select_count) AS count,
              CASE WHEN COUNT(m.category_id) > 0 THEN 1 ELSE 0 END AS is_classified
       FROM aichat_search_log s
       LEFT JOIN aichat_keyword_category_map m ON m.keyword = s.keyword AND m.user_id = s.user_id
       WHERE s.share_id = ? AND s.user_id = ?
       GROUP BY s.keyword
       ORDER BY count DESC
       LIMIT 50`
    ).bind(shareId, user.sub).all<{ keyword: string; count: number; is_classified: number }>();
    return jsonUtf8({ keywords: (rows.results ?? []).map((r) => ({ keyword: r.keyword, count: r.count, is_classified: r.is_classified === 1 })) });
  } catch {
    const rows = await c.env.DB.prepare(
      `SELECT keyword, SUM(select_count) AS count
       FROM aichat_search_log
       WHERE share_id = ? AND user_id = ?
       GROUP BY keyword
       ORDER BY count DESC
       LIMIT 50`
    ).bind(shareId, user.sub).all<{ keyword: string; count: number }>();
    return jsonUtf8({ keywords: (rows.results ?? []).map((r) => ({ keyword: r.keyword, count: r.count, is_classified: false })) });
  }
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
      `SELECT s.keyword, s.cnt,
         CASE WHEN COUNT(m.category_id) > 0 THEN 1 ELSE 0 END AS is_classified,
         MIN(m.category_id) AS category_id,
         COALESCE(MIN(c.color), '#6366f1') AS category_color,
         GROUP_CONCAT(m.category_id || ':' || COALESCE(c.color, '#6366f1')) AS category_pairs
       FROM (SELECT user_id, keyword, SUM(select_count) AS cnt
             FROM aichat_search_log WHERE user_id = ? GROUP BY keyword) s
       LEFT JOIN aichat_keyword_category_map m ON m.keyword = s.keyword AND m.user_id = s.user_id
       LEFT JOIN aichat_keyword_categories c ON c.id = m.category_id AND c.user_id = ?
       GROUP BY s.keyword
       ORDER BY s.cnt DESC`
    ).bind(user.sub, user.sub).all<{ keyword: string; cnt: number; is_classified: number; category_id: number | null; category_color: string | null; category_pairs: string | null }>();
    return jsonUtf8({ keywords: rows.results ?? [] });
  } catch {
    const rows = await c.env.DB.prepare(
      `SELECT keyword, SUM(select_count) AS cnt
       FROM aichat_search_log
       WHERE user_id = ?
       GROUP BY keyword
       ORDER BY cnt DESC`
    ).bind(user.sub).all<{ keyword: string; cnt: number }>();
    return jsonUtf8({ keywords: (rows.results ?? []).map((r) => ({ ...r, is_classified: 0, category_id: null, category_color: null, category_pairs: null })) });
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

app.get('/api/aichat/category-groups', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ groups: [] });
  try {
    const rows = await c.env.DB.prepare(
      `SELECT ag.id, ag.group_name, ag.category_ids,
         COUNT(DISTINCT m.keyword) AS kw_count
       FROM aichat_category_groups ag
       LEFT JOIN json_each(ag.category_ids) je
       LEFT JOIN aichat_keyword_category_map m
         ON m.user_id = ag.user_id AND m.category_id = CAST(je.value AS INTEGER)
       WHERE ag.user_id = ? AND (ag.is_deleted = 0 OR ag.is_deleted IS NULL)
       GROUP BY ag.id
       ORDER BY kw_count DESC, ag.group_name ASC`
    ).bind(user.sub).all<{ id: string; group_name: string; category_ids: string; kw_count: number }>();
    const groups = (rows.results ?? []).map((r) => {
      let ids: number[] = [];
      try { ids = JSON.parse(r.category_ids); } catch { /* ignore */ }
      return { id: r.id, group_name: r.group_name, category_ids: ids, kw_count: r.kw_count ?? 0 };
    });
    return jsonUtf8({ groups });
  } catch {
    return jsonUtf8({ groups: [] });
  }
});

app.post('/api/aichat/category-groups', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  let body: { group_name?: string; category_ids?: number[] };
  try { body = await c.req.json(); } catch { return jsonUtf8({ error: 'Invalid JSON' }, 400); }
  const groupName = (body.group_name ?? '').trim();
  const categoryIds = Array.isArray(body.category_ids) ? body.category_ids.map(Number).filter((n) => !isNaN(n)) : [];
  if (!groupName) return jsonUtf8({ error: 'グループ名を入力してください' }, 400);
  if (categoryIds.length < 2) return jsonUtf8({ error: 'カテゴリは2つ以上必要です' }, 400);
  const id = crypto.randomUUID();
  const idsJson = JSON.stringify([...categoryIds].sort((a, b) => a - b));
  try {
    await c.env.DB.prepare(
      `INSERT INTO aichat_category_groups (id, user_id, group_name, category_ids, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(id, user.sub, groupName, idsJson).run();
    await recordAichatCategoryAudit(c.env.DB, {
      userId: user.sub,
      action: 'category_group_created',
      entityType: 'category_group',
      entityId: id,
      entityName: groupName,
      detail: idsJson,
    });
    return jsonUtf8({ ok: true, id, group_name: groupName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) return jsonUtf8({ error: '同じ名前のグループがすでに存在します' }, 409);
    return jsonUtf8({ error: 'グループの登録に失敗しました: ' + msg }, 500);
  }
});

app.post('/api/aichat/category-groups/:id/add-category', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const groupId = c.req.param('id');
  let body: { category_id?: number };
  try { body = await c.req.json(); } catch { return jsonUtf8({ error: 'Invalid JSON' }, 400); }
  const catId = Number(body.category_id);
  if (!catId || isNaN(catId)) return jsonUtf8({ error: 'category_id は必須です' }, 400);
  try {
    const row = await c.env.DB.prepare(
      `SELECT category_ids FROM aichat_category_groups WHERE id = ? AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`
    ).bind(groupId, user.sub).first<{ category_ids: string }>();
    if (!row) return jsonUtf8({ error: 'グループが見つかりません' }, 404);
    let ids: number[] = [];
    try { ids = JSON.parse(row.category_ids); } catch { /* ignore */ }
    if (!ids.includes(catId)) {
      ids.push(catId);
      ids.sort((a, b) => a - b);
    }
    await c.env.DB.prepare(
      `UPDATE aichat_category_groups SET category_ids = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).bind(JSON.stringify(ids), groupId, user.sub).run();
    await recordAichatCategoryAudit(c.env.DB, {
      userId: user.sub,
      action: 'category_added_to_group',
      entityType: 'category_group',
      entityId: groupId,
      detail: JSON.stringify({ added_category_id: catId, category_ids: ids }),
    });
    return jsonUtf8({ ok: true, category_ids: ids });
  } catch (err: any) {
    return jsonUtf8({ error: 'カテゴリの追加に失敗しました: ' + String(err?.message ?? err) }, 500);
  }
});

app.post('/api/aichat/category-groups/:id/remove-category', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const groupId = c.req.param('id');
  let body: { category_id?: number };
  try { body = await c.req.json(); } catch { return jsonUtf8({ error: 'Invalid JSON' }, 400); }
  const catId = Number(body.category_id);
  if (!catId || isNaN(catId)) return jsonUtf8({ error: 'category_id は必須です' }, 400);
  try {
    const row = await c.env.DB.prepare(
      `SELECT category_ids FROM aichat_category_groups WHERE id = ? AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`
    ).bind(groupId, user.sub).first<{ category_ids: string }>();
    if (!row) return jsonUtf8({ error: 'グループが見つかりません' }, 404);
    let ids: number[] = [];
    try { ids = JSON.parse(row.category_ids); } catch { /* ignore */ }
    ids = ids.filter((id) => id !== catId);
    await c.env.DB.prepare(
      `UPDATE aichat_category_groups SET category_ids = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).bind(JSON.stringify(ids), groupId, user.sub).run();
    await recordAichatCategoryAudit(c.env.DB, {
      userId: user.sub,
      action: 'category_removed_from_group',
      entityType: 'category_group',
      entityId: groupId,
      detail: JSON.stringify({ removed_category_id: catId, category_ids: ids }),
    });
    return jsonUtf8({ ok: true, category_ids: ids });
  } catch (err: any) {
    return jsonUtf8({ error: 'カテゴリの削除に失敗しました: ' + String(err?.message ?? err) }, 500);
  }
});

app.delete('/api/aichat/category-groups/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const groupId = c.req.param('id');
  try {
    await c.env.DB.prepare(
      `UPDATE aichat_category_groups SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).bind(groupId, user.sub).run();
    await recordAichatCategoryAudit(c.env.DB, {
      userId: user.sub,
      action: 'category_group_deleted',
      entityType: 'category_group',
      entityId: groupId,
    });
    return jsonUtf8({ ok: true });
  } catch (err) {
    return jsonUtf8({ error: 'グループの削除に失敗しました' }, 500);
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
  const wasInserted = (result.meta?.changes ?? 0) > 0;
  if (wasInserted && row) {
    await recordAichatCategoryAudit(c.env.DB, {
      userId: user.sub,
      action: 'keyword_category_created',
      entityType: 'keyword_category',
      entityId: row.id,
      entityName: row.name,
      detail: JSON.stringify({ color: row.color }),
    });
  }
  return jsonUtf8({ ok: true, inserted: wasInserted, category: row });
});

/**
 * キーワード分類カテゴリの色を変更する
 * 分類決定モーダルで既存カテゴリの識別色を変更したときに使用する
 */
app.patch('/api/aichat/keyword-categories/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return jsonUtf8({ error: '不正なIDです' }, 400);
  const body = await c.req.json<{ color?: string }>();
  const color = typeof body.color === 'string' ? body.color.trim() : '';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return jsonUtf8({ error: 'color は #RRGGBB 形式で指定してください' }, 400);
  const existing = await c.env.DB.prepare(
    `SELECT id, name, color FROM aichat_keyword_categories WHERE id = ? AND user_id = ?`
  ).bind(id, user.sub).first<{ id: number; name: string; color: string }>();
  if (!existing) return jsonUtf8({ error: 'カテゴリが見つかりません' }, 404);
  await c.env.DB.prepare(
    `UPDATE aichat_keyword_categories SET color = ? WHERE id = ? AND user_id = ?`
  ).bind(color, id, user.sub).run();
  if (existing.color !== color) {
    await recordAichatCategoryAudit(c.env.DB, {
      userId: user.sub,
      action: 'keyword_category_color_updated',
      entityType: 'keyword_category',
      entityId: id,
      entityName: existing.name,
      detail: JSON.stringify({ before: existing.color, after: color }),
    });
  }
  return jsonUtf8({ ok: true, category: { id, name: existing.name, color } });
});

export const BGE_M3_MODEL = '@cf/baai/bge-m3';
export const PLAMO_EMBEDDING_MODEL = '@cf/pfnet/plamo-embedding-1b';
export const GEMMA_EMBEDDING_MODEL = '@cf/google/embeddinggemma-300m';
export const KEYWORD_EMBEDDING_MODELS = [BGE_M3_MODEL, PLAMO_EMBEDDING_MODEL, GEMMA_EMBEDDING_MODEL];

export const AUTO_VECTORIZE_ENABLED_COOKIE = 'aichat_auto_vectorize_enabled';
export const AUTO_VECTORIZE_MODEL_COOKIE = 'aichat_auto_vectorize_model';

/**
 * answer-graphの色分け・キーワード分類提案など、ユーザーが明示的に
 * ボタンを押したわけではない箇所で自動的に行われるキーワードのベクタ化
 * (自動ベクタ化)の設定をCookieから解決する。
 * 「キーワードの自動ベクタ化」はデフォルトON、使用モデルはデフォルトで
 * plamo-embedding-1b(未設定/不正値はplamo-embedding-1bにフォールバックする。
 * bge-m3にフォールバックするresolveKeywordEmbeddingModelとは既定値が異なるため
 * 専用の解決関数とする)。
 */
export function resolveAutoVectorizeSettings(cookieHeader: string | undefined | null): { enabled: boolean; model: string } {
  const vals = getCookieValues(cookieHeader ?? undefined, [AUTO_VECTORIZE_ENABLED_COOKIE, AUTO_VECTORIZE_MODEL_COOKIE]);
  const enabled = vals[AUTO_VECTORIZE_ENABLED_COOKIE] !== 'off';
  const rawModel = vals[AUTO_VECTORIZE_MODEL_COOKIE];
  const model = rawModel && (KEYWORD_EMBEDDING_MODELS as string[]).includes(rawModel) ? rawModel : PLAMO_EMBEDDING_MODEL;
  return { enabled, model };
}

export const AICHAT_PREFER_MOONDREAM_COOKIE = 'aichat_prefer_moondream';

/**
 * AIチャットでテキストプロンプトに画像が添付されている場合、選択中の
 * チャットモデルより優先してmoondream(実体はMOONDREAM_MODEL、
 * Cloudflare側のMoondream本体スキーマが不安定なため内部的にはAIチャット
 * 本体と同じ実績のあるvisionモデルを使う)へ問い合わせるかどうかを
 * Cookieから解決する。デフォルトは有効(優先する)。
 */
export function resolveAichatPreferMoondream(cookieHeader: string | undefined | null): boolean {
  const vals = getCookieValues(cookieHeader ?? undefined, [AICHAT_PREFER_MOONDREAM_COOKIE]);
  return vals[AICHAT_PREFER_MOONDREAM_COOKIE] !== 'off';
}

export const ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE = 'answer_graph_hide_empty_rows';

/**
 * /answer-graph の起点検索結果テーブルで「キーワード数0」の行・経路が
 * 「ー」の行を表示しないようにする設定をCookieから解決する。デフォルトは
 * 有効(表示しない)。
 */
export function resolveAnswerGraphHideEmptyRows(cookieHeader: string | undefined | null): boolean {
  const vals = getCookieValues(cookieHeader ?? undefined, [ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE]);
  return vals[ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE] !== 'off';
}

export const ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE = 'answer_graph_trail_session_storage';

/**
 * /answer-graphのパン屑リスト(選択履歴の足跡)を、ブラウザのsessionStorage
 * (タブを閉じるまで保持・リロードでも復元される)へ保存するかどうかを
 * Cookieから解決する。足跡には検索履歴・回答内容に由来する情報が含まれる
 * ため、ユーザーが設定ページで明示的に同意しない限り保存してはならない。
 * 他のanswer-graph設定(例: resolveAnswerGraphHideEmptyRows)とは逆に、
 * デフォルトは無効(保存しない)。
 */
export function resolveAnswerGraphTrailSessionStorage(cookieHeader: string | undefined | null): boolean {
  const vals = getCookieValues(cookieHeader ?? undefined, [ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE]);
  return vals[ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE] === 'on';
}

/**
 * bge-m3以外のモデル(plamo-embedding-1b, embeddinggemma-300m)は、それぞれ
 * 専用の追加カラム(<prefix>_vector/<prefix>_dim/<prefix>_model/<prefix>_updated_at)
 * に書き込む。プレフィックスはresolveKeywordEmbeddingModelで検証済みの
 * モデル名だけをキーにした固定マップから引くため、SQL文字列への直接埋め込みでも
 * インジェクションの余地はない(未知のモデル名はこのマップに存在せずbge-m3経路に
 * フォールバックされる)。
 */
const SECONDARY_MODEL_COLUMN_PREFIX: Record<string, string> = {
  [PLAMO_EMBEDDING_MODEL]: 'plamo',
  [GEMMA_EMBEDDING_MODEL]: 'gemma',
};

/**
 * bge-m3問い合わせデータモーダルのドロップダウンで選んだモデル名を解決する。
 * 未対応のモデル名・null/undefinedはbge-m3にフォールバックする
 * （aichat_keyword_embeddings.model がnullの既存行の表示補完とも揃える）。
 */
export function resolveKeywordEmbeddingModel(model: string | null | undefined): string {
  if (model && (KEYWORD_EMBEDDING_MODELS as string[]).includes(model)) return model;
  return BGE_M3_MODEL;
}

export function floatsToBlob(vec: number[]): ArrayBuffer {
  return new Float32Array(vec).buffer;
}

export function blobToFloats(blob: ArrayBuffer): number[] {
  return Array.from(new Float32Array(blob));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function averageVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  return sum.map((s) => s / vectors.length);
}

export interface CategoryCentroid {
  categoryId: number;
  name: string;
  vector: number[];
}

export interface CategorySuggestion {
  categoryId: number;
  name: string;
  similarity: number;
}

/**
 * キーワードのベクトルと各中分類の代表ベクトル(centroid)から最も類似度が
 * 高い中分類を選ぶ。キーワードが1件も無くcentroidが空ベクトルの中分類は
 * 誤って推薦しないよう除外する。あくまで「提案」であり、この結果が
 * 確定分類(aichat_keyword_category_map)を書き換えることはない。
 */
export function pickBestCategorySuggestion(
  keywordVector: number[],
  centroids: CategoryCentroid[],
): CategorySuggestion | null {
  let best: CategorySuggestion | null = null;
  for (const c of centroids) {
    if (c.vector.length === 0) continue;
    const similarity = cosineSimilarity(keywordVector, c.vector);
    if (!best || similarity > best.similarity) {
      best = { categoryId: c.categoryId, name: c.name, similarity };
    }
  }
  return best;
}

export interface CategoryCentroidColored {
  categoryId: number;
  name: string;
  color: string;
  vector: number[];
}

export interface AnswerCategoryScore {
  categoryId: number;
  name: string;
  color: string;
  score: number;
}

/**
 * /answer-graph のノード色分け用。pickBestCategorySuggestionと違い最良1件に
 * 絞らず、全中分類とのコサイン類似度をそのまま返す。「旅行寄り」「コーディング
 * 寄り」のような連続的な傾向を色でブレンド表示するために使う。
 */
export function scoreAnswerAgainstCategories(
  answerVector: number[],
  centroids: CategoryCentroidColored[],
): AnswerCategoryScore[] {
  return centroids
    .filter((c) => c.vector.length > 0)
    .map((c) => ({ categoryId: c.categoryId, name: c.name, color: c.color, score: cosineSimilarity(answerVector, c.vector) }));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const num = parseInt(m[1], 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * カテゴリごとのスコアを重みとして色をブレンドする。負または0のスコアは
 * 無視し、正のスコアが1件も無ければ neutralColor を返す。不正な色コードは
 * neutralColor のRGBにフォールバックする(クラッシュさせない)。
 */
export function blendCategoryColors(scores: AnswerCategoryScore[], neutralColor: string): string {
  const positive = scores.filter((s) => s.score > 0);
  if (positive.length === 0) return neutralColor;
  const total = positive.reduce((sum, s) => sum + s.score, 0);
  if (total <= 0) return neutralColor;
  const neutralRgb = hexToRgb(neutralColor) ?? { r: 136, g: 136, b: 136 };
  let r = 0, g = 0, b = 0;
  for (const s of positive) {
    const rgb = hexToRgb(s.color) ?? neutralRgb;
    const w = s.score / total;
    r += rgb.r * w;
    g += rgb.g * w;
    b += rgb.b * w;
  }
  return rgbToHex(r, g, b);
}

/**
 * 中分類の代表ベクトル(centroid)を、キーワード→埋め込みのMapから
 * 純粋計算のみで組み立てる(DB/AI呼び出しを含まない)。
 */
export function buildCategoryCentroidsFromMap(
  categories: { id: number; name: string; color: string }[],
  keywordsByCategory: Map<number, string[]>,
  embeddingMap: Map<string, number[]>,
): CategoryCentroidColored[] {
  const centroids: CategoryCentroidColored[] = [];
  for (const cat of categories) {
    const kws = keywordsByCategory.get(cat.id) ?? [];
    const vectors = kws
      .map((k) => embeddingMap.get(k))
      .filter((v): v is number[] => !!v && v.length > 0);
    if (vectors.length === 0) continue;
    centroids.push({ categoryId: cat.id, name: cat.name, color: cat.color || '#6366f1', vector: averageVector(vectors) });
  }
  return centroids;
}

const KEYWORD_EMBEDDING_AI_BATCH_SIZE = 20;

async function embedTextsWithModelBatch(ai: Ai, model: string, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const result = await ai.run(
    model as Parameters<typeof ai.run>[0],
    { text: texts } as Parameters<typeof ai.run>[1],
  );
  const resultObj = (typeof result === 'object' && result !== null) ? result as Record<string, unknown> : {};
  const data = Array.isArray(resultObj.data) ? resultObj.data as number[][] : [];
  return texts.map((_, i) => (Array.isArray(data[i]) ? data[i] : []));
}

/**
 * 複数キーワードの埋め込みをまとめて取得する。Workers単一invocationあたりの
 * APIリクエスト数上限(D1/AIの呼び出しはいずれもこれにカウントされる)に
 * 引っかからないよう、キーワード1件ごとにgetOrComputeKeywordEmbeddingを
 * 呼ぶ(N回のD1読み取り+N回のAI呼び出し+N回のD1書き込み)のではなく、
 * キャッシュ読み取り・AI埋め込み・書き込みのそれぞれをバッチ化して
 * D1_MAX_BOUND_PARAMSに収まる単位でまとめて実行する。
 *
 * modelは主系列(model/dim/vector)に書き込むモデルを指定する
 * (省略時はbge-m3、既定の自動ベクタ化設定はplamo-embedding-1b)。
 * キャッシュヒット判定もこのmodelと一致する行のみを対象にする
 * (異なるモデルで書き込まれた行を誤って再利用しない)。
 */
export async function getOrComputeKeywordEmbeddingsBatch(
  db: D1Database,
  ai: Ai,
  userId: string,
  keywords: string[],
  source: string = 'auto',
  model: string = BGE_M3_MODEL,
): Promise<Map<string, number[]>> {
  const uniqueKeywords = Array.from(new Set(keywords.filter(Boolean)));
  const result = new Map<string, number[]>();
  if (uniqueKeywords.length === 0) return result;

  for (const chunk of chunkBindValues(uniqueKeywords, D1_MAX_BOUND_PARAMS - 1)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT keyword, vector, model FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword IN (${placeholders})`
    ).bind(userId, ...chunk).all<{ keyword: string; vector: ArrayBuffer; model: string }>();
    for (const r of (rows.results ?? [])) {
      if (r.model === model) result.set(r.keyword, blobToFloats(r.vector));
    }
  }

  const missing = uniqueKeywords.filter((kw) => !result.has(kw));
  if (missing.length === 0) return result;

  const newEntries: { keyword: string; vector: number[] }[] = [];
  for (let i = 0; i < missing.length; i += KEYWORD_EMBEDDING_AI_BATCH_SIZE) {
    const batchKws = missing.slice(i, i + KEYWORD_EMBEDDING_AI_BATCH_SIZE);
    const vectors = await embedTextsWithModelBatch(ai, model, batchKws);
    batchKws.forEach((kw, idx) => {
      const v = vectors[idx] ?? [];
      if (v.length > 0) {
        result.set(kw, v);
        newEntries.push({ keyword: kw, vector: v });
      }
    });
  }

  if (newEntries.length > 0) {
    const now = new Date().toISOString();
    const colsPerRow = 7;
    const rowsPerChunk = Math.max(1, Math.floor((D1_MAX_BOUND_PARAMS - 1) / colsPerRow));
    for (let i = 0; i < newEntries.length; i += rowsPerChunk) {
      const chunk = newEntries.slice(i, i + rowsPerChunk);
      const valuesSql = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const args: unknown[] = [];
      for (const e of chunk) {
        args.push(userId, e.keyword, model, e.vector.length, floatsToBlob(e.vector), source, now, now);
      }
      await db.prepare(
        `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, source, created_at, updated_at)
         VALUES ${valuesSql}
         ON CONFLICT(user_id, keyword) DO UPDATE SET
           model = excluded.model, dim = excluded.dim, vector = excluded.vector, source = excluded.source, updated_at = excluded.updated_at`
      ).bind(...args).run();
    }
  }

  return result;
}

async function getAnswerCategoryScoresCacheBatch(
  db: D1Database,
  userId: string,
  shareIds: string[],
): Promise<Map<string, { categoryId: number; score: number; model: string }[]>> {
  const map = new Map<string, { categoryId: number; score: number; model: string }[]>();
  for (const chunk of chunkBindValues(shareIds, D1_MAX_BOUND_PARAMS - 1)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT share_id, category_id, score, model FROM aichat_answer_category_scores WHERE user_id = ? AND share_id IN (${placeholders})`
    ).bind(userId, ...chunk).all<{ share_id: string; category_id: number; score: number; model: string }>();
    for (const r of (rows.results ?? [])) {
      const list = map.get(r.share_id) ?? [];
      list.push({ categoryId: r.category_id, score: r.score, model: r.model });
      map.set(r.share_id, list);
    }
  }
  return map;
}

async function saveAnswerCategoryScoresBatch(
  db: D1Database,
  userId: string,
  entries: { shareId: string; categoryId: number; score: number }[],
  model: string = BGE_M3_MODEL,
): Promise<void> {
  if (entries.length === 0) return;
  const now = new Date().toISOString();
  const colsPerRow = 6;
  const rowsPerChunk = Math.max(1, Math.floor((D1_MAX_BOUND_PARAMS - 1) / colsPerRow));
  for (let i = 0; i < entries.length; i += rowsPerChunk) {
    const chunk = entries.slice(i, i + rowsPerChunk);
    const valuesSql = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const args: unknown[] = [];
    for (const e of chunk) args.push(e.shareId, userId, e.categoryId, e.score, model, now);
    await db.prepare(
      `INSERT INTO aichat_answer_category_scores (share_id, user_id, category_id, score, model, computed_at)
       VALUES ${valuesSql}
       ON CONFLICT(user_id, share_id, category_id) DO UPDATE SET score = excluded.score, model = excluded.model, computed_at = excluded.computed_at`
    ).bind(...args).run();
  }
}

/**
 * 回答ノード群の色をまとめて計算する。グラフのノード数に関わらず、
 * D1/AI呼び出しの回数がおおよそ一定(バッチ数個)に収まるよう設計している
 * (Workers単一invocationのAPIリクエスト数上限を超えないため)。
 */
async function computeAnswerNodeColors(
  db: D1Database,
  ai: Ai,
  userId: string,
  answerNodes: AnswerGraphNode[],
  model: string = BGE_M3_MODEL,
): Promise<Map<string, { color: string; dominantCategory: string | null }>> {
  const result = new Map<string, { color: string; dominantCategory: string | null }>();
  if (answerNodes.length === 0) return result;

  const catsRows = await db.prepare(
    `SELECT id, name, color FROM aichat_keyword_categories WHERE user_id = ?`
  ).bind(userId).all<{ id: number; name: string; color: string }>();
  const categories = catsRows.results ?? [];
  if (categories.length === 0) return result;

  const keywordsByCategory = new Map<number, string[]>();
  for (const chunk of chunkBindValues(categories.map((c) => c.id), D1_MAX_BOUND_PARAMS - 1)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT category_id, keyword FROM aichat_keyword_category_map WHERE user_id = ? AND category_id IN (${placeholders})`
    ).bind(userId, ...chunk).all<{ category_id: number; keyword: string }>();
    for (const r of (rows.results ?? [])) {
      const list = keywordsByCategory.get(r.category_id) ?? [];
      if (list.length < 30) list.push(r.keyword);
      keywordsByCategory.set(r.category_id, list);
    }
  }

  const kwLogRows = await db.prepare(
    `SELECT keyword FROM aichat_search_log WHERE user_id = ? GROUP BY keyword ORDER BY SUM(select_count) DESC LIMIT 300`
  ).bind(userId).all<{ keyword: string }>();
  const allKeywords = (kwLogRows.results ?? []).map((r) => r.keyword).filter(Boolean);

  const answerTextById = new Map<string, string>();
  for (const chunk of chunkBindValues(answerNodes.map((n) => n.id.slice(2)), D1_MAX_BOUND_PARAMS - 1)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT id, question, answer FROM ai_chat_shares WHERE user_id = ? AND id IN (${placeholders})`
    ).bind(userId, ...chunk).all<{ id: string; question: string; answer: string }>();
    for (const r of (rows.results ?? [])) answerTextById.set(r.id, r.question + ' ' + r.answer);
  }

  const containedKeywordsByShareId = new Map<string, string[]>();
  const neededKeywords = new Set<string>();
  for (const kws of keywordsByCategory.values()) kws.forEach((k) => neededKeywords.add(k));
  for (const node of answerNodes) {
    const shareId = node.id.slice(2);
    const text = answerTextById.get(shareId) ?? node.label;
    const contained = extractContainedKeywords(text, allKeywords);
    containedKeywordsByShareId.set(shareId, contained);
    contained.forEach((k) => neededKeywords.add(k));
  }

  const embeddingMap = await getOrComputeKeywordEmbeddingsBatch(db, ai, userId, Array.from(neededKeywords), 'answer_graph_color', model);

  const centroids = buildCategoryCentroidsFromMap(categories, keywordsByCategory, embeddingMap);
  if (centroids.length === 0) return result;

  const cachedByShare = await getAnswerCategoryScoresCacheBatch(db, userId, answerNodes.map((n) => n.id.slice(2)));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const toSave: { shareId: string; categoryId: number; score: number }[] = [];

  for (const node of answerNodes) {
    const shareId = node.id.slice(2);
    const cached = cachedByShare.get(shareId) ?? [];
    let scores: AnswerCategoryScore[];
    if (cached.length > 0 && cached.length === centroids.length && cached.every((r) => r.model === model)) {
      scores = cached.map((r) => {
        const cat = categoryById.get(r.categoryId);
        return { categoryId: r.categoryId, name: cat ? cat.name : '', color: cat ? cat.color : '#888888', score: r.score };
      });
    } else {
      const contained = containedKeywordsByShareId.get(shareId) ?? [];
      const vectors = contained
        .map((k) => embeddingMap.get(k))
        .filter((v): v is number[] => !!v && v.length > 0);
      if (vectors.length === 0) continue;
      const answerVector = averageVector(vectors);
      scores = scoreAnswerAgainstCategories(answerVector, centroids);
      scores.forEach((s) => toSave.push({ shareId, categoryId: s.categoryId, score: s.score }));
    }
    if (scores.length === 0) continue;
    const best = scores.slice().sort((a, b) => b.score - a.score)[0];
    result.set(node.id, { color: blendCategoryColors(scores, '#888888'), dominantCategory: best.score > 0 ? best.name : null });
  }

  await saveAnswerCategoryScoresBatch(db, userId, toSave, model);

  return result;
}

/**
 * /answer-graph のグラフ結果へ、ノードごとの色(color)と代表カテゴリ名
 * (dominantCategory)を付与する。キーワードノードは既存の確定分類
 * (aichat_keyword_category_map)から直接色を得るため、AIの再計算は
 * 行わない(コスト削減)。回答ノードのみベクトル類似度でスコアを計算する。
 * 中分類が1件も登録されていない場合は色付けをスキップし元のグラフを返す。
 */
export async function enrichGraphWithCategoryColors(
  db: D1Database,
  ai: Ai,
  userId: string,
  graph: AnswerGraphResult,
  model: string = BGE_M3_MODEL,
): Promise<AnswerGraphResult> {
  // キーワードノードの色付けは確定分類(aichat_keyword_category_map)の
  // 直接参照だけで完結し、回答ノードのベクトル計算には依存しない。
  // 回答ノードの色付けが失敗しても、キーワードノードの色付けは独立して行う。
  const keywordNodes = graph.nodes.filter((n) => n.type === 'keyword');
  const keywordCategoryMap = new Map<string, { name: string; color: string }[]>();
  try {
    for (const chunk of chunkBindValues(keywordNodes.map((n) => n.label), D1_MAX_BOUND_PARAMS - 1)) {
      if (chunk.length === 0) continue;
      const placeholders = chunk.map(() => '?').join(',');
      const catRows = await db.prepare(
        `SELECT m.keyword AS keyword, c.name AS name, c.color AS color
         FROM aichat_keyword_category_map m
         JOIN aichat_keyword_categories c ON c.id = m.category_id AND c.user_id = m.user_id
         WHERE m.user_id = ? AND m.keyword IN (${placeholders})`
      ).bind(userId, ...chunk).all<{ keyword: string; name: string; color: string }>();
      for (const r of (catRows.results ?? [])) {
        const list = keywordCategoryMap.get(r.keyword) ?? [];
        list.push({ name: r.name, color: r.color });
        keywordCategoryMap.set(r.keyword, list);
      }
    }
  } catch (err) {
    logger.warn('enrichGraphWithCategoryColors: keyword category lookup failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const answerNodes = graph.nodes.filter((n) => n.type === 'answer');
  let answerColorById = new Map<string, { color: string; dominantCategory: string | null }>();
  try {
    answerColorById = await computeAnswerNodeColors(db, ai, userId, answerNodes, model);
  } catch (err) {
    logger.warn('enrichGraphWithCategoryColors: answer node scoring failed (falling back to keyword-only coloring)', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (keywordCategoryMap.size === 0 && answerColorById.size === 0) return graph;

  const enrichedNodes: AnswerGraphNode[] = graph.nodes.map((node) => {
    if (node.type === 'keyword') {
      const cats = keywordCategoryMap.get(node.label) ?? [];
      if (cats.length === 0) return node;
      const pseudoScores: AnswerCategoryScore[] = cats.map((c) => ({ categoryId: 0, name: c.name, color: c.color, score: 1 }));
      return { ...node, color: blendCategoryColors(pseudoScores, '#888888'), dominantCategory: cats.map((c) => c.name).join('/') };
    }
    const info = answerColorById.get(node.id);
    if (!info) return node;
    return { ...node, color: info.color, dominantCategory: info.dominantCategory };
  });

  return { nodes: enrichedNodes, edges: graph.edges };
}

export interface VectorAnalysis {
  dim: number;
  l2Norm: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  nearZeroRatio: number;
}

/**
 * 埋め込みキャッシュモーダルの🔍分析ボタンが表示する基本統計量を計算する。
 * 次元数・L2ノルム・平均・標準偏差・最小/最大値・ゼロに近い要素の割合を返す。
 */
export function analyzeVector(vector: number[]): VectorAnalysis {
  const dim = vector.length;
  if (dim === 0) {
    return { dim: 0, l2Norm: 0, mean: 0, std: 0, min: 0, max: 0, nearZeroRatio: 0 };
  }
  let sum = 0;
  let sumSq = 0;
  let min = vector[0];
  let max = vector[0];
  let nearZero = 0;
  for (const v of vector) {
    sum += v;
    sumSq += v * v;
    if (v < min) min = v;
    if (v > max) max = v;
    if (Math.abs(v) < 0.01) nearZero++;
  }
  const mean = sum / dim;
  const variance = Math.max(sumSq / dim - mean * mean, 0);
  return {
    dim,
    l2Norm: Math.sqrt(sumSq),
    mean,
    std: Math.sqrt(variance),
    min,
    max,
    nearZeroRatio: nearZero / dim,
  };
}

export interface SimilarKeywordCandidate {
  keyword: string;
  vector: number[];
}

export interface SimilarKeywordMatch {
  keyword: string;
  similarity: number;
}

/**
 * 埋め込みキャッシュモーダルの類似度閾値スライダーから渡される
 * threshold クエリパラメータを解析する。数値として解釈できない場合は
 * 例外を投げず fallback を返し、範囲外の値は0〜1にクランプする。
 */
export function parseSimilarityThreshold(raw: string | undefined, fallback: number): number {
  const n = parseFloat(raw ?? '');
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 0), 1);
}

/**
 * 対象ベクトルとの類似度が閾値以上の候補のみを、類似度降順で最大limit件返す。
 */
export function rankSimilarKeywords(
  targetVector: number[],
  candidates: SimilarKeywordCandidate[],
  threshold: number,
  limit: number,
): SimilarKeywordMatch[] {
  return candidates
    .map((c) => ({ keyword: c.keyword, similarity: cosineSimilarity(targetVector, c.vector) }))
    .filter((m) => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.max(0, limit));
}

export interface SimilarKeywordItem {
  keyword: string;
  similarity: number;
  analysis: VectorAnalysis;
}

export interface SimilarKeywordGroup {
  categoryId: number | null;
  categoryName: string;
  items: SimilarKeywordItem[];
}

/**
 * 埋め込みキャッシュモーダルの🔍分析ボタンから呼ばれる。対象キーワードと
 * コサイン類似度が近い登録済みキーワードを探し、それが属する中分類ごとに
 * グルーピングして返す。複数の中分類に属するキーワードは両方のグループに
 * 列挙し、どの中分類にも属さない場合は「未分類」グループへ入れる。
 *
 * 閾値は0.85としている。単語・短いキーワード単位の埋め込みは文単位の
 * 埋め込みに比べてコサイン類似度がベクトル空間の狭い領域に集まりやすく
 * (異方性/anisotropy)、0.75程度の閾値では地理的に無関係な固有名詞同士
 * (例: 「フランス」と「サンタ・マリア・ノヴェッラ駅」)まで「似ている」と
 * 誤って表示されてしまう実害が確認された一方、0.9まで上げると今度は
 * 実際に近いキーワードもほぼヒットしなくなり機能として成立しなくなった
 * ため、その中間の値としている。
 */
export async function findSimilarKeywordsGroupedByCategory(
  db: D1Database,
  userId: string,
  keyword: string,
  threshold = 0.85,
  limit = 20,
): Promise<{ target: VectorAnalysis | null; groups: SimilarKeywordGroup[] }> {
  const targetRow = await db.prepare(
    `SELECT vector FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ?`
  ).bind(userId, keyword).first<{ vector: ArrayBuffer }>();
  if (!targetRow) return { target: null, groups: [] };
  const targetVector = blobToFloats(targetRow.vector);

  const rows = await db.prepare(
    `SELECT keyword, vector FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword != ?`
  ).bind(userId, keyword).all<{ keyword: string; vector: ArrayBuffer }>();
  const candidates = (rows.results ?? []).map((r) => ({ keyword: r.keyword, vector: blobToFloats(r.vector) }));
  const matches = rankSimilarKeywords(targetVector, candidates, threshold, limit);
  const target = analyzeVector(targetVector);
  if (matches.length === 0) return { target, groups: [] };

  const matchKeywords = matches.map((m) => m.keyword);
  const placeholders = matchKeywords.map(() => '?').join(',');
  const catRows = await db.prepare(
    `SELECT m.keyword AS keyword, c.id AS category_id, c.name AS category_name
     FROM aichat_keyword_category_map m
     JOIN aichat_keyword_categories c ON c.id = m.category_id AND c.user_id = m.user_id
     WHERE m.user_id = ? AND m.keyword IN (${placeholders})`
  ).bind(userId, ...matchKeywords).all<{ keyword: string; category_id: number; category_name: string }>();
  const catByKeyword = new Map<string, { id: number; name: string }[]>();
  for (const r of (catRows.results ?? [])) {
    const list = catByKeyword.get(r.keyword) ?? [];
    list.push({ id: r.category_id, name: r.category_name });
    catByKeyword.set(r.keyword, list);
  }

  const vectorByKeyword = new Map(candidates.map((c) => [c.keyword, c.vector]));
  const groupsMap = new Map<string, SimilarKeywordGroup>();
  for (const m of matches) {
    const vec = vectorByKeyword.get(m.keyword) ?? [];
    const item: SimilarKeywordItem = { keyword: m.keyword, similarity: m.similarity, analysis: analyzeVector(vec) };
    const cats = catByKeyword.get(m.keyword);
    if (!cats || cats.length === 0) {
      const groupKey = 'unclassified';
      if (!groupsMap.has(groupKey)) groupsMap.set(groupKey, { categoryId: null, categoryName: '未分類', items: [] });
      groupsMap.get(groupKey)!.items.push(item);
    } else {
      for (const cat of cats) {
        const groupKey = String(cat.id);
        if (!groupsMap.has(groupKey)) groupsMap.set(groupKey, { categoryId: cat.id, categoryName: cat.name, items: [] });
        groupsMap.get(groupKey)!.items.push(item);
      }
    }
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) => b.items.length - a.items.length);
  return { target, groups };
}

/**
 * キーワード↔カテゴリ紐付けを送信された category_ids に完全一致させる。
 * INSERT OR IGNORE の追加のみだと分類モーダルでカテゴリのチェックを外しても
 * 既存マッピングが残り続け「修正しても更新されない」バグになるため、
 * category_ids に含まれなくなった既存マッピングは削除してから不足分を追加する。
 */
export async function replaceKeywordCategoryMap(
  db: D1Database,
  userId: string,
  keyword: string,
  categoryIds: number[],
  now: string,
): Promise<{ inserted: number; deleted: number }> {
  const existingRows = await db.prepare(
    `SELECT category_id FROM aichat_keyword_category_map WHERE user_id = ? AND keyword = ?`
  ).bind(userId, keyword).all<{ category_id: number }>();
  const existingIds = new Set((existingRows.results ?? []).map((r) => r.category_id));
  const nextIds = new Set(categoryIds);

  let deleted = 0;
  for (const id of existingIds) {
    if (nextIds.has(id)) continue;
    const result = await db.prepare(
      `DELETE FROM aichat_keyword_category_map WHERE user_id = ? AND keyword = ? AND category_id = ?`
    ).bind(userId, keyword, id).run();
    deleted += result.meta?.changes ?? 0;
  }

  let inserted = 0;
  for (const id of nextIds) {
    if (existingIds.has(id)) continue;
    const result = await db.prepare(
      `INSERT OR IGNORE INTO aichat_keyword_category_map (user_id, keyword, category_id, created_at) VALUES (?, ?, ?, ?)`
    ).bind(userId, keyword, id, now).run();
    inserted += result.meta?.changes ?? 0;
  }

  return { inserted, deleted };
}

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
  const { inserted, deleted } = await replaceKeywordCategoryMap(c.env.DB, user.sub, keyword.slice(0, 200), categoryIds, now);
  if (inserted > 0 || deleted > 0) {
    await recordAichatCategoryAudit(c.env.DB, {
      userId: user.sub,
      action: 'keyword_classified',
      entityType: 'keyword_category_map',
      entityName: keyword.slice(0, 200),
      detail: JSON.stringify({ category_ids: categoryIds, inserted, deleted }),
    });
  }
  return jsonUtf8({ ok: true, inserted, deleted });
});

async function embedTextWithModel(ai: Ai, model: string, text: string): Promise<number[]> {
  const result = await ai.run(
    model as Parameters<typeof ai.run>[0],
    { text: [text] } as Parameters<typeof ai.run>[1],
  );
  const resultObj = (typeof result === 'object' && result !== null) ? result as Record<string, unknown> : {};
  const data = Array.isArray(resultObj.data) ? resultObj.data as number[][] : [];
  return Array.isArray(data[0]) ? data[0] : [];
}

/**
 * キーワードの埋め込みベクトルをD1から読み出す。同じモデルでキャッシュ済み
 * ならAIを呼ばずそれを返し、未キャッシュ・モデル不一致の場合のみbge-m3へ
 * 問い合わせて aichat_keyword_embeddings を上書き保存する
 * （前回合意した「ベクトル本体はモデル不一致時のみ強制上書き」の実装）。
 *
 * sourceは「このベクトル化がどの機能によって行われたか」の記録
 * (📖ベクタ化済みデータ一覧の登録元ラベルに使う)。ZTモーダルの
 * 「登録する」ボタン(明示的な手動登録)からは'zt_manual'を渡す。それ以外
 * (answer-graphの色分け・キーワード分類のAI推薦等)は呼び出し元機能名、
 * 未指定時は既定値'auto'を渡す。
 *
 * ベクトル本体がキャッシュヒットしてAIを呼ばない場合でも、渡されたsourceが
 * 既存の値と異なるならsource列だけは更新する。そうしないと「以前は自動で
 * ベクタ化されていたキーワードを、いまZTモーダルから明示的に登録し直した」
 * という事実がDBに反映されず、一覧上「明示登録した」と分からなくなる
 * （実際に起きた不具合: 登録ボタンを押しても一覧に反映されない）。
 *
 * modelは主系列(model/dim/vector)に書き込むモデル(省略時bge-m3)。
 * answer-graph色分け・キーワード分類提案などの自動ベクタ化系呼び出しは
 * resolveAutoVectorizeSettingsで解決した値(既定plamo-embedding-1b)を渡す。
 */
export async function getOrComputeKeywordEmbedding(
  db: D1Database,
  ai: Ai,
  userId: string,
  keyword: string,
  source: string = 'auto',
  model: string = BGE_M3_MODEL,
): Promise<number[]> {
  const row = await db.prepare(
    `SELECT vector, model, source FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ?`
  ).bind(userId, keyword).first<{ vector: ArrayBuffer; model: string; source: string | null }>();
  if (row && row.model === model) {
    if (row.source !== source) {
      await db.prepare(
        `UPDATE aichat_keyword_embeddings SET source = ?, updated_at = ? WHERE user_id = ? AND keyword = ?`
      ).bind(source, new Date().toISOString(), userId, keyword).run();
    }
    return blobToFloats(row.vector);
  }
  const vector = await embedTextWithModel(ai, model, keyword);
  if (vector.length === 0) return [];
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, keyword) DO UPDATE SET
       model = excluded.model, dim = excluded.dim, vector = excluded.vector, source = excluded.source, updated_at = excluded.updated_at`
  ).bind(userId, keyword, model, vector.length, floatsToBlob(vector), source, now, now).run();
  return vector;
}

/**
 * answer-graphの回答モーダル「この回答文をベクタ化する」ボタン用。
 * 回答文(ai_chat_shares.answer)をplamo-embedding-1bでベクタ化し、
 * aichat_answer_vectorsにキャッシュする。同一モデルでキャッシュ済みなら
 * AIを呼ばずそれを返す(getOrComputeKeywordEmbeddingと同じ方針)。
 */
export async function getOrComputeAnswerEmbedding(
  db: D1Database,
  ai: Ai,
  userId: string,
  shareId: string,
  answerText: string,
  model: string = PLAMO_EMBEDDING_MODEL,
): Promise<number[]> {
  const row = await db.prepare(
    `SELECT vector FROM aichat_answer_vectors WHERE user_id = ? AND share_id = ? AND model = ?`
  ).bind(userId, shareId, model).first<{ vector: ArrayBuffer }>();
  if (row) return blobToFloats(row.vector);
  const vector = await embedTextWithModel(ai, model, answerText);
  if (vector.length === 0) return [];
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO aichat_answer_vectors (share_id, user_id, model, dim, vector, computed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, share_id, model) DO UPDATE SET
       dim = excluded.dim, vector = excluded.vector, computed_at = excluded.computed_at`
  ).bind(shareId, userId, model, vector.length, floatsToBlob(vector), now).run();
  return vector;
}

/**
 * 回答文(ai_chat_shares.answer)をキャッシュ済みかどうかをaichat_answer_vectors
 * から判定する。answer-graphの回答モーダルで「ベクタ化する」ボタンの
 * 表示/非表示切り替えに使う。
 */
export async function isAnswerVectorized(
  db: D1Database,
  userId: string,
  shareId: string,
  model: string = PLAMO_EMBEDDING_MODEL,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 as found FROM aichat_answer_vectors WHERE user_id = ? AND share_id = ? AND model = ?`
  ).bind(userId, shareId, model).first<{ found: number }>();
  return !!row;
}

/**
 * 回答文から抽出した予備知識キーワード1件が、その回答文(share_id)に
 * 紐付けてaichat_answer_keyword_vectorsに既にベクタ化・登録済みかどうかを
 * 判定する。同じキーワードでも回答文が異なれば別レコードとして扱う
 * (aichat_keyword_embeddingsのユーザー単位キャッシュとは別の紐付け単位)。
 */
export async function isAnswerKeywordVectorized(
  db: D1Database,
  userId: string,
  shareId: string,
  keyword: string,
  model: string = PLAMO_EMBEDDING_MODEL,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 as found FROM aichat_answer_keyword_vectors WHERE user_id = ? AND share_id = ? AND keyword = ? AND model = ?`
  ).bind(userId, shareId, keyword, model).first<{ found: number }>();
  return !!row;
}

/**
 * 予備知識キーワード1件を回答文ID(share_id)と紐付けてベクタ化し、
 * aichat_answer_keyword_vectorsにキャッシュする。同一(user_id, share_id,
 * keyword, model)で既に登録済みならAIを呼ばずそのベクトルを返す
 * (getOrComputeAnswerEmbeddingと同じキャッシュ方針)。
 */
export async function getOrComputeAnswerKeywordEmbedding(
  db: D1Database,
  ai: Ai,
  userId: string,
  shareId: string,
  keyword: string,
  model: string = PLAMO_EMBEDDING_MODEL,
): Promise<number[]> {
  const row = await db.prepare(
    `SELECT vector FROM aichat_answer_keyword_vectors WHERE user_id = ? AND share_id = ? AND keyword = ? AND model = ?`
  ).bind(userId, shareId, keyword, model).first<{ vector: ArrayBuffer }>();
  if (row) return blobToFloats(row.vector);
  const vector = await embedTextWithModel(ai, model, keyword);
  if (vector.length === 0) return [];
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO aichat_answer_keyword_vectors (share_id, user_id, keyword, model, dim, vector, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, share_id, keyword, model) DO UPDATE SET
       dim = excluded.dim, vector = excluded.vector, computed_at = excluded.computed_at`
  ).bind(shareId, userId, keyword, model, vector.length, floatsToBlob(vector), now).run();
  return vector;
}

/**
 * 回答文(share_id)に紐付けて予備知識キーワードが1件でも
 * aichat_answer_keyword_vectorsに登録済みかどうかを判定する。answer-graphの
 * 回答モーダルで「キーワード一覧」ボタンと「キーワード抽出」ボタンの
 * どちらを表示するかの切り替えに使う。
 */
export async function hasAnswerKeywordVectors(
  db: D1Database,
  userId: string,
  shareId: string,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 as found FROM aichat_answer_keyword_vectors WHERE user_id = ? AND share_id = ? LIMIT 1`
  ).bind(userId, shareId).first<{ found: number }>();
  return !!row;
}

/**
 * 回答文(share_id)に紐付けて登録済みの予備知識キーワード一覧(重複なし)を
 * 取得する。answer-graphの回答モーダル「キーワード一覧」ボタン用。
 */
export async function listAnswerKeywordVectors(
  db: D1Database,
  userId: string,
  shareId: string,
): Promise<string[]> {
  const rows = await db.prepare(
    `SELECT DISTINCT keyword FROM aichat_answer_keyword_vectors WHERE user_id = ? AND share_id = ? ORDER BY keyword`
  ).bind(userId, shareId).all<{ keyword: string }>();
  return (rows.results ?? []).map((r) => r.keyword);
}

/**
 * キーワード群それぞれについて、AIチャットのキーワードテーブル
 * (aichat_search_log。回答文への紐付け選択ログの集計値select_countの合計)
 * 内で何回出現しているかをまとめて取得する。バインド上限に収まる単位で
 * チャンク分割し、キーワード数に比例したクエリ発行(N+1)を避ける
 * (NOTICE.cloudflare-workers-github-oauth-1.20260806.md参照)。
 */
export async function getKeywordOccurrenceCounts(
  db: D1Database,
  userId: string,
  keywords: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (keywords.length === 0) return counts;
  for (const chunk of chunkBindValues(keywords, D1_MAX_BOUND_PARAMS - 1)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT keyword, SUM(select_count) AS cnt FROM aichat_search_log
       WHERE user_id = ? AND keyword IN (${placeholders})
       GROUP BY keyword`
    ).bind(userId, ...chunk).all<{ keyword: string; cnt: number }>();
    for (const r of (rows.results ?? [])) counts[r.keyword] = r.cnt;
  }
  return counts;
}

export type KeywordOccurrence = { keyword: string; count: number };

/**
 * キーワード1件ずつをループしてAIチャットのキーワードテーブル内での
 * 出現回数を「キーワード (出現回数)」のペアとして組み立て、ループが終わって
 * から出現回数の多い順に並べ替える(answer-graphの「キーワード一覧」
 * ボタン用)。未出現(ログに一度も現れていない)キーワードは0件として含める。
 */
export function buildKeywordOccurrenceList(
  keywords: string[],
  counts: Record<string, number>,
): KeywordOccurrence[] {
  const list: KeywordOccurrence[] = [];
  for (const keyword of keywords) {
    list.push({ keyword, count: counts[keyword] ?? 0 });
  }
  list.sort((a, b) => b.count - a.count);
  return list;
}

export type KeywordCategoryInfo = { categoryId: number; color: string };

/**
 * キーワード群それぞれについて、確定分類(aichat_keyword_category_map)から
 * 紐づくカテゴリのid・色を取得する。1キーワードが複数カテゴリに属する
 * 場合は代表として最初に見つかった1件のみを返す(バッジの枠線色は
 * 1色で表現するため)。バインド上限に収まる単位でチャンク分割する。
 */
export async function getKeywordCategoryColors(
  db: D1Database,
  userId: string,
  keywords: string[],
): Promise<Record<string, KeywordCategoryInfo>> {
  const result: Record<string, KeywordCategoryInfo> = {};
  if (keywords.length === 0) return result;
  for (const chunk of chunkBindValues(keywords, D1_MAX_BOUND_PARAMS - 1)) {
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT m.keyword AS keyword, c.id AS category_id, c.color AS color
       FROM aichat_keyword_category_map m
       JOIN aichat_keyword_categories c ON c.id = m.category_id AND c.user_id = m.user_id
       WHERE m.user_id = ? AND m.keyword IN (${placeholders})`
    ).bind(userId, ...chunk).all<{ keyword: string; category_id: number; color: string | null }>();
    for (const r of (rows.results ?? [])) {
      if (!(r.keyword in result)) {
        result[r.keyword] = { categoryId: r.category_id, color: r.color || '#6366f1' };
      }
    }
  }
  return result;
}

export type KeywordOccurrenceWithCategory = KeywordOccurrence & { classified: boolean; categoryColor: string | null };

/**
 * 出現回数リスト(buildKeywordOccurrenceListの結果)にカテゴリ分類情報を
 * マージする。出現回数の並び順はそのまま保つ。answer-graphの
 * 「キーワード一覧」ボタンで、バッジの枠線色(分類色/未分類色)を
 * 決めるために使う。
 */
export function mergeKeywordOccurrenceWithCategory(
  occurrences: KeywordOccurrence[],
  categoryInfo: Record<string, KeywordCategoryInfo>,
): KeywordOccurrenceWithCategory[] {
  return occurrences.map((o) => {
    const info = categoryInfo[o.keyword];
    return { keyword: o.keyword, count: o.count, classified: !!info, categoryColor: info ? info.color : null };
  });
}

export type AnswerKeywordVectorizationResult = { keyword: string; alreadyRegistered: boolean; error?: string };

/**
 * extractPrerequisiteTermsで抽出したキーワード群を1件ずつループし、
 * 各キーワードが既にその回答文(shareId)に紐付けてaichat_answer_keyword_vectors に
 * ベクタ化・登録済みかを判定する。未登録のものだけ新規にベクタ化して追記する。
 * 1件ずつ順番に処理した結果(登録済みだったか/新規登録したか)を、
 * 抽出順を保ったまま返す(フロントエンドがこの順序でループ演出を行うため)。
 */
export async function vectorizeAnswerKeywords(
  db: D1Database,
  ai: Ai,
  userId: string,
  shareId: string,
  keywords: string[],
  model: string = PLAMO_EMBEDDING_MODEL,
): Promise<AnswerKeywordVectorizationResult[]> {
  const results: AnswerKeywordVectorizationResult[] = [];
  for (const keyword of keywords) {
    try {
      const alreadyRegistered = await isAnswerKeywordVectorized(db, userId, shareId, keyword, model);
      if (!alreadyRegistered) {
        await getOrComputeAnswerKeywordEmbedding(db, ai, userId, shareId, keyword, model);
      }
      results.push({ keyword, alreadyRegistered });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('vectorize-answer: keyword embedding failed', { shareId, keyword, error: message });
      results.push({ keyword, alreadyRegistered: false, error: message });
    }
  }
  return results;
}

export const ANSWER_PREREQUISITE_TERMS_MODEL = '@cf/google/gemma-4-26b-a4b-it';

/**
 * gemma-4-26b-a4b-itの応答テキストから「予備知識として抽出された用語」の
 * 一覧を作る純粋関数。1行1語を基本としつつ、モデルが箇条書き記号
 * (- ・ * 数字.)や読点区切りで返してきても拾えるようにし、前後の空白と
 * 重複を取り除く。
 */
export function parsePrerequisiteTermsResponse(raw: string): string[] {
  const cleaned = stripThinkTags(raw || '');
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const line of cleaned.split(/[\n、,]/)) {
    const term = line.replace(/^[\s\-*・0-9.、)）]+/, '').trim();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

/**
 * 回答文を理解するのに必要な予備知識(用語・概念)をgemma-4-26b-a4b-itに
 * 単語単位で抽出させる。gemma-4-26b-a4b-itはsystem messageが含まれると
 * enable_thinking:falseを無視して思考過程を応答に混入させる既知の制限が
 * あるため(AICHAT_MODEL_EXTRA_PARAMS参照)、system messageは使わずuser
 * メッセージ1件に指示と回答文をまとめて渡す。
 */
export async function extractPrerequisiteTerms(ai: Ai, answerText: string): Promise<string[]> {
  const prompt = '次の文章を理解するのに必要な用語や概念を単語単位で抽出してください。前置きや説明文は不要です。1行に1つ、単語のみを出力してください。\n\n' + answerText;
  const baseParams = { messages: [{ role: 'user', content: prompt }], max_tokens: 1024 };
  const runParams = getModelRunParams(ANSWER_PREREQUISITE_TERMS_MODEL, baseParams);
  const result = await ai.run(
    ANSWER_PREREQUISITE_TERMS_MODEL as Parameters<typeof ai.run>[0],
    runParams as Parameters<typeof ai.run>[1],
  );
  const resultObj = (typeof result === 'object' && result !== null) ? result as Record<string, unknown> : {};
  const rawResponse = 'response' in resultObj ? String(resultObj['response'] ?? '') : '';
  const choices = Array.isArray(resultObj['choices']) ? resultObj['choices'] as Array<Record<string, unknown>> : [];
  const choiceMsg = choices.length > 0 ? (choices[0]['message'] as Record<string, unknown> | undefined) ?? {} : {};
  const rawChoices = String(choiceMsg['content'] ?? '');
  const raw = rawResponse || rawChoices;
  return parsePrerequisiteTermsResponse(raw);
}

/**
 * bge-m3問い合わせデータモーダルのドロップダウンで選んだモデルに応じて、
 * 実際に問い合わせるAIモデルを動的に切り替える。
 *   - bge-m3: 従来通り model/dim/vector 列（主系列）を使う
 *   - plamo-embedding-1b: plamo_vector/plamo_dim/plamo_model/plamo_updated_at
 *     列（追加カラム）に書き足す。主系列(model/dim/vector)はNOT NULL制約が
 *     あるため、行が未作成の場合は先にbge-m3側を確保してから追加カラムを
 *     埋める（bge-m3側のデータを上書き・破壊しない）。
 *
 * 「差分が発生した場合どちらのモデルで補完すべきか」という問いへの回答:
 * 主系列(bge-m3)側で既に採用している方針
 * 「同じモデルでキャッシュ済みならAIを呼ばずそれを返し、未キャッシュ・
 * モデル不一致の場合のみ問い合わせて上書き保存する」を追加カラム側にも
 * 揃える。つまりplamo_model(実際に格納されているモデル名)と今回要求された
 * resolvedModelを比較し、一致しなければキャッシュを信用せず「今呼び出し側が
 * 指定したモデル」で再取得・上書きする。dim/vectorが入っているというだけで
 * キャッシュ命中とみなさない（別モデルの結果を誤って返す事故を防ぐ）。
 */
export async function getOrComputeKeywordEmbeddingForModel(
  db: D1Database,
  ai: Ai,
  userId: string,
  keyword: string,
  model: string | null | undefined,
): Promise<number[]> {
  const resolvedModel = resolveKeywordEmbeddingModel(model);
  if (resolvedModel === BGE_M3_MODEL) {
    return getOrComputeKeywordEmbedding(db, ai, userId, keyword, 'zt_manual');
  }
  const prefix = SECONDARY_MODEL_COLUMN_PREFIX[resolvedModel];
  const row = await db.prepare(
    `SELECT ${prefix}_vector AS sec_vector, ${prefix}_dim AS sec_dim, ${prefix}_model AS sec_model
     FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ?`
  ).bind(userId, keyword).first<{ sec_vector: ArrayBuffer | null; sec_dim: number | null; sec_model: string | null }>();
  // 主系列(bge-m3)の行を確保し、sourceを'zt_manual'に揃える（既にあれば
  // getOrComputeKeywordEmbedding内でAIを呼ばずsource列だけ更新される）。
  // 追加カラム側がキャッシュ命中で早期returnする場合もこの呼び出しは必ず
  // 通す必要がある。そうしないと「追加カラム側は既にキャッシュ済みだが
  // 他機能の自動ベクタ化由来のsourceのまま」というケースで、ZTモーダルから
  // 明示登録した事実がsource列に反映されない不具合になる。
  await getOrComputeKeywordEmbedding(db, ai, userId, keyword, 'zt_manual');
  if (row && row.sec_vector && row.sec_dim && row.sec_model === resolvedModel) {
    return blobToFloats(row.sec_vector);
  }
  const vector = await embedTextWithModel(ai, resolvedModel, keyword);
  if (vector.length === 0) return [];
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE aichat_keyword_embeddings
     SET ${prefix}_vector = ?, ${prefix}_dim = ?, ${prefix}_model = ?, ${prefix}_updated_at = ?
     WHERE user_id = ? AND keyword = ?`
  ).bind(floatsToBlob(vector), vector.length, resolvedModel, now, userId, keyword).run();
  return vector;
}

export interface RegisterEmbeddingResult {
  keyword: string;
  ok: boolean;
  dim: number;
}

/**
 * bge-m3問い合わせデータモーダルの「登録する」ボタンから呼ばれる。
 * 渡された text 配列を重複排除・空文字除去したうえで、キーワードごとに
 * getOrComputeKeywordEmbeddingForModel を呼ぶ（キャッシュ済みならAIを呼ばない）。
 * model省略時はbge-m3（従来通り）。1件の失敗が他のキーワードの登録を
 * 止めないよう、失敗はresultsに記録して処理を継続する
 * （握りつぶさず戻り値で確認可能にする）。
 */
export async function registerKeywordEmbeddings(
  db: D1Database,
  ai: Ai,
  userId: string,
  texts: string[],
  model?: string | null,
): Promise<{ registered: number; failed: number; results: RegisterEmbeddingResult[] }> {
  const resolvedModel = resolveKeywordEmbeddingModel(model);
  const seen = new Set<string>();
  const results: RegisterEmbeddingResult[] = [];
  for (const raw of texts) {
    const text = (typeof raw === 'string' ? raw : '').trim().slice(0, 200);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const vector = await getOrComputeKeywordEmbeddingForModel(db, ai, userId, text, resolvedModel);
    results.push({ keyword: text, ok: vector.length > 0, dim: vector.length });
  }
  const registered = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return { registered, failed, results };
}

export interface KeywordEmbeddingInfo {
  keyword: string;
  model: string;
  dim: number;
  createdAt: string;
  updatedAt: string;
  preview: number[];
  analysis: VectorAnalysis;
}

/**
 * Zanzibarツリー検索窓の📖アイコン表示・キャッシュ内容表示に使う。
 * ベクトル全体(1024次元)をそのまま返すとレスポンスが肥大化するため、
 * 先頭12件のみをpreviewとして返す。基本統計量(analysis)はサーバー側で
 * 全次元を使って計算してから返す（クライアントには全次元を送らない）。
 */
export async function lookupKeywordEmbedding(
  db: D1Database,
  userId: string,
  keyword: string,
): Promise<KeywordEmbeddingInfo | null> {
  const row = await db.prepare(
    `SELECT keyword, model, dim, vector, created_at, updated_at FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ?`
  ).bind(userId, keyword).first<{ keyword: string; model: string; dim: number; vector: ArrayBuffer; created_at: string; updated_at: string }>();
  if (!row) return null;
  const fullVector = blobToFloats(row.vector);
  return {
    keyword: row.keyword,
    model: row.model,
    dim: row.dim,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preview: fullVector.slice(0, 12),
    analysis: analyzeVector(fullVector),
  };
}

export interface KeywordEmbeddingOverviewItem {
  keyword: string;
  model: string;
  dim: number;
  updatedAt: string;
  source: string;
  plamoModel: string | null;
  plamoDim: number | null;
  plamoUpdatedAt: string | null;
  gemmaModel: string | null;
  gemmaDim: number | null;
  gemmaUpdatedAt: string | null;
}

/**
 * ZTモーダルヘッダの📖アイコンから開く一覧。既存のベクタ化済みキーワードを
 * すべて列挙する。answer-graphの色分けやキーワード分類のAI推薦など、ユーザーが
 * 明示的に指示したわけではない内部キャッシュ利用も同じテーブルに書き込まれる
 * ため、以前は source='zt_manual' の行だけに絞り込んでいたが、この移行より前に
 * 登録された行(sourceが未設定=NULL)まで一覧から消えてしまい、実際に登録した
 * データが見えなくなる regression になっていた。データを隠すのではなく、
 * source(どの機能が書き込んだか。未設定はunknownとして返す)をそのまま返し、
 * どの経路のデータかをクライアント側で表示できるようにする。
 *
 * modelがnull（未設定の既存行）はbge-m3で補完する。plamo系は実際に
 * 格納されているplamo_modelをそのまま表示する（「dimがあるからplamo」と
 * いう推測はしない。将来別モデルがこの列を使った場合でも、記録されている
 * モデル名を偽らないため）。plamo_modelが欠損しているのにplamo_dimだけ
 * 入っている異常データに備え、その場合のみ防御的にPLAMO_EMBEDDING_MODELへ
 * フォールバックする。
 */
export async function listKeywordEmbeddingsOverview(
  db: D1Database,
  userId: string,
): Promise<KeywordEmbeddingOverviewItem[]> {
  const rows = await db.prepare(
    `SELECT keyword, model, dim, updated_at, source, plamo_dim, plamo_model, plamo_updated_at,
            gemma_dim, gemma_model, gemma_updated_at
     FROM aichat_keyword_embeddings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 500`
  ).bind(userId).all<{
    keyword: string; model: string | null; dim: number; updated_at: string; source: string | null;
    plamo_dim: number | null; plamo_model: string | null; plamo_updated_at: string | null;
    gemma_dim: number | null; gemma_model: string | null; gemma_updated_at: string | null;
  }>();
  return (rows.results ?? []).map((r) => ({
    keyword: r.keyword,
    model: r.model || BGE_M3_MODEL,
    dim: r.dim,
    updatedAt: r.updated_at,
    source: r.source || 'unknown',
    plamoModel: r.plamo_dim != null ? (r.plamo_model || PLAMO_EMBEDDING_MODEL) : null,
    plamoDim: r.plamo_dim,
    plamoUpdatedAt: r.plamo_updated_at,
    gemmaModel: r.gemma_dim != null ? (r.gemma_model || GEMMA_EMBEDDING_MODEL) : null,
    gemmaDim: r.gemma_dim,
    gemmaUpdatedAt: r.gemma_updated_at,
  }));
}

export interface KeywordEmbeddingModelCounts {
  bge: number;
  plamo: number;
  gemma: number;
}

/**
 * 埋め込みモデル別 登録済みキーワード率の円グラフ(ZTモーダルの📖一覧・
 * 📈日次統計モーダル)が参照する、ユーザーの全登録件数。
 *
 * listKeywordEmbeddingsOverview は一覧表示用に `ORDER BY updated_at DESC
 * LIMIT 500` で取得しており、この結果配列の長さ・フィルタ件数をそのまま
 * 円グラフの分母/分子に使うと、登録件数が500件を超えた状態で新規登録を
 * 行うたびに「新しく更新された行が上位500件に入り、更新されていない古い
 * 行(plamo/gemmaサブ系列を持つものを含む)が枠外に押し出される」ため、
 * 実際には増えているはずの登録件数が見かけ上減って表示される不具合になる。
 * 円グラフには LIMIT を付けない集計専用クエリの結果を使う。
 */
export async function getKeywordEmbeddingModelCounts(
  db: D1Database,
  userId: string,
): Promise<KeywordEmbeddingModelCounts> {
  const row = await db.prepare(
    `SELECT COUNT(*) AS bge,
            SUM(CASE WHEN plamo_dim IS NOT NULL THEN 1 ELSE 0 END) AS plamo,
            SUM(CASE WHEN gemma_dim IS NOT NULL THEN 1 ELSE 0 END) AS gemma
     FROM aichat_keyword_embeddings WHERE user_id = ?`
  ).bind(userId).first<{ bge: number; plamo: number | null; gemma: number | null }>();
  return {
    bge: row?.bge ?? 0,
    plamo: row?.plamo ?? 0,
    gemma: row?.gemma ?? 0,
  };
}

/**
 * 未分類キーワードに対し、既存の中分類の代表ベクトル(centroid)との
 * コサイン類似度からAI分類を「提案」する。確定分類テーブル
 * (aichat_keyword_category_map)には一切書き込まず、推薦内容は履歴として
 * aichat_keyword_category_suggestions に積み上げるのみ。実際の分類確定は
 * 常にユーザーが分類モーダルの「分類決定」を押した時だけ行われる。
 */
app.post('/api/aichat/keyword-category-suggest', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  if (!c.env.AI) return jsonUtf8({ suggestion: null, _warning: 'AIバインディングが未設定です' });
  const autoVectorize = resolveAutoVectorizeSettings(c.req.header('Cookie'));
  if (!autoVectorize.enabled) return jsonUtf8({ suggestion: null, _warning: 'キーワードの自動ベクタ化がOFFです' });
  const body = await c.req.json<{ keyword?: string }>();
  const keyword = (typeof body.keyword === 'string' ? body.keyword.trim() : '').slice(0, 200);
  if (!keyword) return jsonUtf8({ error: 'keyword は必須です' }, 400);

  const catsRows = await c.env.DB.prepare(
    `SELECT id, name FROM aichat_keyword_categories WHERE user_id = ?`
  ).bind(user.sub).all<{ id: number; name: string }>();
  const categories = catsRows.results ?? [];
  if (categories.length === 0) return jsonUtf8({ suggestion: null });

  const keywordVector = await getOrComputeKeywordEmbedding(c.env.DB, c.env.AI, user.sub, keyword, 'category_suggest', autoVectorize.model);
  if (keywordVector.length === 0) return jsonUtf8({ suggestion: null, _warning: '埋め込み取得に失敗しました' });

  const centroids: CategoryCentroid[] = [];
  for (const cat of categories) {
    const kwRows = await c.env.DB.prepare(
      `SELECT DISTINCT keyword FROM aichat_keyword_category_map WHERE user_id = ? AND category_id = ? LIMIT 30`
    ).bind(user.sub, cat.id).all<{ keyword: string }>();
    const kws = (kwRows.results ?? []).map((r) => r.keyword).filter((k) => k !== keyword);
    if (kws.length === 0) continue;
    const vectors: number[][] = [];
    for (const kw of kws) {
      const v = await getOrComputeKeywordEmbedding(c.env.DB, c.env.AI, user.sub, kw, 'category_suggest', autoVectorize.model);
      if (v.length > 0) vectors.push(v);
    }
    if (vectors.length === 0) continue;
    centroids.push({ categoryId: cat.id, name: cat.name, vector: averageVector(vectors) });
  }

  const best = pickBestCategorySuggestion(keywordVector, centroids);
  if (best) {
    await c.env.DB.prepare(
      `INSERT INTO aichat_keyword_category_suggestions (user_id, keyword, suggested_category_id, similarity, model, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(user.sub, keyword, best.categoryId, best.similarity, autoVectorize.model, new Date().toISOString()).run();
  }
  return jsonUtf8({ suggestion: best });
});

/**
 * 問い合わせデータモーダルの「登録する」ボタン: 渡された text を
 * モーダルのドロップダウンで選ばれたモデル(bge-m3 / plamo-embedding-1b、
 * 省略・未対応値はbge-m3)へ実際に問い合わせ、aichat_keyword_embeddings
 * へ保存する。
 */
app.post('/api/aichat/keyword-embeddings/register', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  if (!c.env.AI) return jsonUtf8({ error: 'AIバインディングが未設定です' }, 503);
  const body = await c.req.json<{ texts?: string[]; model?: string }>();
  const texts = Array.isArray(body.texts) ? body.texts.filter((t) => typeof t === 'string') : [];
  if (texts.length === 0) return jsonUtf8({ error: 'texts は必須です' }, 400);
  const model = resolveKeywordEmbeddingModel(body.model);
  // D1のスキーマ不整合(マイグレーション未適用でカラムが無い等)がHonoの
  // 汎用500ハンドラに丸め込まれ「サーバーエラーが発生しました」としか
  // 表示されず原因が追えなかった実例があるため、実際のエラー内容を返す。
  try {
    const result = await registerKeywordEmbeddings(c.env.DB, c.env.AI, user.sub, texts.slice(0, 50), model);
    return jsonUtf8({ ok: true, model, registered: result.registered, failed: result.failed, results: result.results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('keyword-embeddings/register failed', { userId: user.sub, model, error: message });
    return jsonUtf8({ error: '登録処理でサーバーエラーが発生しました: ' + message }, 500);
  }
});

/**
 * Zanzibarツリー検索窓の📖アイコン: 入力中のキーワードが
 * aichat_keyword_embeddings にキャッシュ済みかどうかを返す。
 */
app.get('/api/aichat/keyword-embeddings/lookup', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ cached: false });
  const keyword = (c.req.query('keyword') ?? '').trim().slice(0, 200);
  if (!keyword) return jsonUtf8({ cached: false });
  const info = await lookupKeywordEmbedding(c.env.DB, user.sub, keyword);
  return jsonUtf8({ cached: !!info, embedding: info });
});

/**
 * ZTモーダルヘッダの📖アイコン: 既存のベクタ化済みキーワードと、
 * それぞれのベクタ化に使った埋め込みモデルを列挙する。
 */
app.get('/api/aichat/keyword-embeddings/list', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ items: [] });
  try {
    const items = await listKeywordEmbeddingsOverview(c.env.DB, user.sub);
    return jsonUtf8({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('keyword-embeddings/list failed', { userId: user.sub, error: message });
    return jsonUtf8({ items: [], error: '一覧取得でサーバーエラーが発生しました: ' + message }, 500);
  }
});

/**
 * 埋め込みモデル別 登録済みキーワード率の円グラフ用。keyword-embeddings/list は
 * 一覧表示用にLIMIT 500を掛けているため件数の分子・分母には使えない
 * (getKeywordEmbeddingModelCountsのコメント参照)。LIMIT無しの集計結果を返す。
 */
app.get('/api/aichat/keyword-embeddings/model-counts', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ bge: 0, plamo: 0, gemma: 0 });
  try {
    const counts = await getKeywordEmbeddingModelCounts(c.env.DB, user.sub);
    return jsonUtf8(counts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('keyword-embeddings/model-counts failed', { userId: user.sub, error: message });
    return jsonUtf8({ bge: 0, plamo: 0, gemma: 0, error: '集計取得でサーバーエラーが発生しました: ' + message }, 500);
  }
});

/**
 * 埋め込みキャッシュモーダルの🔍分析ボタン: 対象キーワードと似ている
 * 登録済みキーワードを、それが属する中分類ごとにグルーピングして返す。
 */
app.get('/api/aichat/keyword-embeddings/similar', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ target: null, groups: [] });
  const keyword = (c.req.query('keyword') ?? '').trim().slice(0, 200);
  if (!keyword) return jsonUtf8({ target: null, groups: [] });
  const threshold = parseSimilarityThreshold(c.req.query('threshold'), 0.85);
  try {
    const result = await findSimilarKeywordsGroupedByCategory(c.env.DB, user.sub, keyword, threshold);
    return jsonUtf8(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('keyword-embeddings/similar failed', { keyword, threshold, error: message });
    return jsonUtf8({ target: null, groups: [], _warning: message });
  }
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
            input_tokens, output_tokens, total_tokens, image_data_url
     FROM ai_chat_shares WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
  ).bind(id, user.sub).first<{
    id: string; user_hash: string; question: string; answer: string;
    model: string; created_at: string; access_count: number; question_hash: string | null;
    input_tokens: number | null; output_tokens: number | null; total_tokens: number | null;
    image_data_url: string | null;
  }>();
  if (!row) return jsonUtf8({ error: 'Not found' }, 404);
  const vectorized = await isAnswerVectorized(c.env.DB, user.sub, id);
  const keywordsRegistered = vectorized ? await hasAnswerKeywordVectors(c.env.DB, user.sub, id) : false;
  return jsonUtf8({ ...row, vectorized, keywordsRegistered });
});

/**
 * 回答文(share_id)に紐付けて登録済みの予備知識キーワード一覧を返す。
 * answer-graphの回答モーダルの「キーワード一覧」ボタン用（認証が必要）。
 */
app.get('/api/aichat/answer-keywords', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  const shareId = (c.req.query('shareId') ?? '').trim();
  if (!shareId) return jsonUtf8({ error: 'shareId は必須です' }, 400);
  const keywords = await listAnswerKeywordVectors(c.env.DB, user.sub, shareId);
  const counts = await getKeywordOccurrenceCounts(c.env.DB, user.sub, keywords);
  const occurrenceList = buildKeywordOccurrenceList(keywords, counts);
  const categoryInfo = await getKeywordCategoryColors(c.env.DB, user.sub, keywords);
  const keywordOccurrences = mergeKeywordOccurrenceWithCategory(occurrenceList, categoryInfo);
  return jsonUtf8({ shareId, keywords, keywordOccurrences });
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
 * answer-graphの回答モーダル「この回答文をベクタ化する」ボタン用API。
 * 回答文をplamo-embedding-1bでベクタ化してaichat_answer_vectorsに保存し、
 * さらにgemma-4-26b-a4b-itに「この文章を理解するのに必要な予備知識」を
 * 単語単位で抽出させて返す。予備知識抽出の失敗はベクタ化そのものの失敗とは
 * 独立して扱い、_keywordsWarningに理由を入れて返す(ベクタ化自体は成功のまま)。
 */
app.post('/api/aichat/vectorize-answer', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);
  if (!c.env.AI) return jsonUtf8({ error: 'AIバインディングが未設定です' }, 503);

  let body: { shareId?: string };
  try {
    body = await c.req.json();
  } catch {
    return jsonUtf8({ error: 'リクエスト形式が不正です' }, 400);
  }
  const shareId = (body.shareId ?? '').trim();
  if (!shareId) return jsonUtf8({ error: 'shareId は必須です' }, 400);

  const share = await c.env.DB.prepare(
    `SELECT id, answer FROM ai_chat_shares WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
  ).bind(shareId, user.sub).first<{ id: string; answer: string }>();
  if (!share) return jsonUtf8({ error: '指定された回答が見つかりません' }, 404);

  let vector: number[];
  try {
    vector = await getOrComputeAnswerEmbedding(c.env.DB, c.env.AI, user.sub, shareId, share.answer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('vectorize-answer: embedding failed', { shareId, error: message });
    return jsonUtf8({ error: 'ベクタ化に失敗しました: ' + message }, 500);
  }
  if (vector.length === 0) {
    return jsonUtf8({ error: 'ベクタ化に失敗しました(埋め込みモデルから結果が返りませんでした)' }, 500);
  }

  let keywords: string[] = [];
  let keywordsWarning: string | null = null;
  try {
    keywords = await extractPrerequisiteTerms(c.env.AI, share.answer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('vectorize-answer: prerequisite term extraction failed', { shareId, error: message });
    keywordsWarning = '予備知識キーワードの抽出に失敗しました: ' + message;
  }

  const keywordVectorization = keywords.length > 0
    ? await vectorizeAnswerKeywords(c.env.DB, c.env.AI, user.sub, shareId, keywords)
    : [];

  return jsonUtf8({
    vectorized: true,
    model: PLAMO_EMBEDDING_MODEL,
    dim: vector.length,
    keywords,
    keywordVectorization,
    _keywordsWarning: keywordsWarning,
  });
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
 * WebGL デモページ
 */
app.get('/webgl-demo', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getWebGLDemoPage(user.sub));
});

/**
 * WebGL 球体デモページ（テキストスクロール）
 */
app.get('/webgl-sphere', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getWebGLSpherePage(user.sub));
});

app.get('/webgl-heritage', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getWebGLHeritagePage(user.sub));
});

app.get('/heritage-journey', authMiddleware, async (c) => {
  return c.html(getHeritageJourneyPage());
});

app.get('/tsubuyaki', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getTsubuyakiPage(user.sub));
});

app.post('/api/tsubuyaki', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ text?: string }>().catch(() => null);
  const validated = validateFreeText(body?.text);
  if (!validated.ok) {
    return c.json({ ok: false, error: validated.error }, 400);
  }

  const displayName = user.name || user.sub;
  const message = buildFreeTextSlackMessage(displayName, validated.text);
  const notifyConfig = await resolveNotifyConfigWithSetting(c.env);
  const result = await dispatchNotification(notifyConfig, { text: message });
  if (!result.ok) {
    // status未設定 = 送信先が未設定（503）、status設定あり = 送信を試みて失敗した（502）
    const status = result.status === undefined ? 503 : 502;
    return c.json({ ok: false, error: result.error || 'Slackへの投稿に失敗しました' }, status);
  }
  return c.json({ ok: true });
});

app.get('/webgl-faults', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getWebGLFaultsPage(user.sub));
});

const IATA_TO_ICAO: Record<string, string> = {
  NRT:'RJAA', HND:'RJTT', KIX:'RJBB', ICN:'RKSI', PVG:'ZSPD', PEK:'ZBAA', HKG:'VHHH',
  SIN:'WSSS', BKK:'VTBS', KUL:'WMKK', CGK:'WIII', SYD:'YSSY', MEL:'YMML', AKL:'NZAA',
  DEL:'VIDP', BOM:'VABB', DXB:'OMDB', DOH:'OTHH', IST:'LTFM',
  LHR:'EGLL', CDG:'LFPG', FRA:'EDDF', AMS:'EHAM', MAD:'LEMD', FCO:'LIRF',
  LAX:'KLAX', JFK:'KJFK', ORD:'KORD', YYZ:'CYYZ', MEX:'MMMX', MIA:'KMIA',
  GRU:'SBGR', EZE:'SAEZ', BOG:'SKBO', LIM:'SPJC', SCL:'SCEL', CCS:'SVMI', PTY:'MPTO',
  JNB:'FAOR', NBO:'HKJK', CAI:'HECA', LOS:'DNMM', ADD:'HAAB',
};
const ICAO_TO_IATA: Record<string, string> = Object.fromEntries(
  Object.entries(IATA_TO_ICAO).map(([k, v]) => [v, k])
);
const flightStatusCache = new Map<string, { ts: number; data: unknown }>();

app.get('/api/flight-status', authMiddleware, async (c) => {
  const code = (c.req.query('code') || '').toUpperCase().trim();
  if (!code || !IATA_TO_ICAO[code]) {
    return c.json({ error: 'unknown airport code' }, 400);
  }
  const icao = IATA_TO_ICAO[code];
  const cached = flightStatusCache.get(icao);
  const now = Math.floor(Date.now() / 1000);
  if (cached && now - (cached.ts as number) < 300) {
    return c.json(cached.data);
  }
  const end = now;
  const begin = end - 7200;
  try {
    const url = `https://opensky-network.org/api/flights/departure?airport=${icao}&begin=${begin}&end=${end}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      const result = { code, icao, flights: [], error: `OpenSky ${res.status}`, fetchedAt: now };
      return c.json(result);
    }
    const raw = await res.json() as Array<{
      icao24: string; callsign: string; firstSeen: number; lastSeen: number;
      estDepartureAirport: string; estArrivalAirport: string | null;
    }>;
    const flights = (raw || [])
      .map(f => ({
        callsign: (f.callsign || '').trim(),
        departed: f.firstSeen,
        arrivalIcao: f.estArrivalAirport || null,
        arrivalIata: f.estArrivalAirport ? (ICAO_TO_IATA[f.estArrivalAirport] || null) : null,
      }))
      .filter(f => f.callsign)
      .sort((a, b) => b.departed - a.departed);
    const result = { code, icao, flights, fetchedAt: now };
    flightStatusCache.set(icao, { ts: now, data: result });
    return c.json(result);
  } catch (e) {
    return c.json({ code, icao, flights: [], error: String(e), fetchedAt: now });
  }
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


app.post('/api/heritage-area-boxes', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const body = await c.req.json<{
    box?: string;
    topLeft?: { lat?: number; lon?: number };
    bottomRight?: { lat?: number; lon?: number };
    items?: Array<{ category?: string; name?: string; lat?: number; lon?: number }>;
  }>().catch(() => null);
  if (!body || !body.topLeft || !body.bottomRight) return c.json({ error: 'topLeft and bottomRight required' }, 400);
  const topLeftLat = Number(body.topLeft.lat);
  const topLeftLon = Number(body.topLeft.lon);
  const bottomRightLat = Number(body.bottomRight.lat);
  const bottomRightLon = Number(body.bottomRight.lon);
  if (![topLeftLat, topLeftLon, bottomRightLat, bottomRightLon].every(Number.isFinite)) {
    return c.json({ error: 'invalid coordinates' }, 400);
  }
  const areaResult = await db.prepare(
    'INSERT INTO heritage_area_boxes (user_id, box, top_left_lat, top_left_lon, bottom_right_lat, bottom_right_lon) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.sub, body.box || 'box', topLeftLat, topLeftLon, bottomRightLat, bottomRightLon).run();
  const areaSeq = areaResult.meta.last_row_id;
  const allowedCategories = new Set(['heritage-access', 'airport', 'station', 'volcano', 'fault', 'f1', 'other']);
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
  const items = rawItems
    .map((item) => ({
      category: allowedCategories.has(item.category || '') ? item.category! : 'other',
      name: String(item.name || '').slice(0, 300),
      lat: item.lat == null ? null : Number(item.lat),
      lon: item.lon == null ? null : Number(item.lon),
    }))
    .filter((item) => item.name.length > 0);
  if (items.length > 0) {
    const stmt = db.prepare('INSERT INTO heritage_area_items (area_seq, category, item_name, lat, lon) VALUES (?, ?, ?, ?, ?)');
    await db.batch(items.map((item) => stmt.bind(areaSeq, item.category, item.name, Number.isFinite(item.lat) ? item.lat : null, Number.isFinite(item.lon) ? item.lon : null)));
  }
  return c.json({ ok: true, areaSeq, itemCount: items.length });
});


app.get('/api/heritage-area-boxes', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const rows = await db.prepare(
    `SELECT area_seq AS areaSeq, box, NULL AS areaName, top_left_lat AS topLeftLat, top_left_lon AS topLeftLon,
            bottom_right_lat AS bottomRightLat, bottom_right_lon AS bottomRightLon, created_at AS createdAt
       FROM heritage_area_boxes
      WHERE user_id = ?
      ORDER BY created_at DESC, area_seq DESC
      LIMIT 100`
  ).bind(user.sub).all();
  const areas = (rows.results || []) as Array<Record<string, unknown>>;
  if (areas.length === 0) return c.json({ ok: true, areas: [] });
  const seqs = areas.map((area) => Number(area.areaSeq)).filter(Number.isFinite);
  const placeholders = seqs.map(() => '?').join(',');
  const itemRows = placeholders
    ? await db.prepare(
        `SELECT area_seq AS areaSeq, category, item_name AS name, lat, lon
           FROM heritage_area_items
          WHERE area_seq IN (${placeholders})
          ORDER BY area_seq DESC, id ASC`
      ).bind(...seqs).all()
    : { results: [] };
  const itemsByArea = new Map<number, Array<Record<string, unknown>>>();
  for (const item of (itemRows.results || []) as Array<Record<string, unknown>>) {
    const seq = Number(item.areaSeq);
    if (!itemsByArea.has(seq)) itemsByArea.set(seq, []);
    itemsByArea.get(seq)!.push(item);
  }
  return c.json({ ok: true, areas: areas.map((area) => ({ ...area, items: itemsByArea.get(Number(area.areaSeq)) || [] })) });
});

app.delete('/api/heritage-area-boxes/:areaSeq', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const areaSeq = Number(c.req.param('areaSeq'));
  if (!Number.isInteger(areaSeq) || areaSeq <= 0) return c.json({ error: '無効なエリア番号です' }, 400);
  const row = await db.prepare(
    'SELECT area_seq FROM heritage_area_boxes WHERE area_seq = ? AND user_id = ?'
  ).bind(areaSeq, user.sub).first<{ area_seq: number }>();
  if (!row) return c.json({ error: '見つかりません' }, 404);
  await db.batch([
    db.prepare('DELETE FROM heritage_area_items WHERE area_seq = ?').bind(areaSeq),
    db.prepare('DELETE FROM heritage_area_boxes WHERE area_seq = ? AND user_id = ?').bind(areaSeq, user.sub),
  ]);
  return c.json({ ok: true });
});

export function normalizeHeritageAreaName(value: string): string {
  return String(value || '').trim().replace(/[・･]/g, '・');
}

export type HeritageAreaBoxBounds = { latMin: number; latMax: number; lonMin: number; lonMax: number; lonCross: boolean };

/**
 * heritage_area_boxesに保存された対角2点(topLeft/bottomRight)から、
 * 緯度経度の範囲判定用の矩形を組み立てる。エリア枠が経度180度線をまたぐ場合は
 * lonCrossをtrueにし、経度は「lonMin以上」または「lonMax以下」のOR条件で判定する
 * (webglHeritage.tsのinAreaBoundsと同じロジック)。
 */
export function heritageAreaBoxBounds(topLeftLat: number, topLeftLon: number, bottomRightLat: number, bottomRightLon: number): HeritageAreaBoxBounds {
  const lonCross = topLeftLon > bottomRightLon;
  return {
    latMin: Math.min(topLeftLat, bottomRightLat),
    latMax: Math.max(topLeftLat, bottomRightLat),
    lonMin: lonCross ? topLeftLon : Math.min(topLeftLon, bottomRightLon),
    lonMax: lonCross ? bottomRightLon : Math.max(topLeftLon, bottomRightLon),
    lonCross,
  };
}

/**
 * 座標(lat, lon)がheritageAreaBoxBoundsの矩形範囲内に収まっているかどうかを判定する。
 */
export function isPointInHeritageAreaBoxBounds(lat: number, lon: number, bounds: HeritageAreaBoxBounds): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (bounds.lonCross) return lat >= bounds.latMin && lat <= bounds.latMax && (lon >= bounds.lonMin || lon <= bounds.lonMax);
  return lat >= bounds.latMin && lat <= bounds.latMax && lon >= bounds.lonMin && lon <= bounds.lonMax;
}

/**
 * 検索キーワードから座標付きの地点情報を引く。世界遺産(HERITAGE_LIST)に無ければ
 * 空港(AIRPORT_LIST)、それにも無ければ鉄道駅(RAIL_LINES)もフォールバックで探す。
 * AIチャットの検索キーワードには「〇〇空港」「〇〇駅」のような名前も大量に
 * 含まれるため、世界遺産のみを対象にするとそれらのボタンにだけ国旗が
 * 一切表示されない状態になる。
 */
export function findHeritageAreaPoint(keyword: string): { name: string; flag: string; country: string; lat: number; lon: number; code?: string } | null {
  const normalized = normalizeHeritageAreaName(keyword);
  const item = HERITAGE_LIST.find((h) => normalizeHeritageAreaName(h.n) === normalized);
  if (item && Number.isFinite(item.lat) && Number.isFinite(item.lon)) {
    return { name: item.n, flag: item.f, country: item.c, lat: item.lat, lon: item.lon };
  }
  const airport = AIRPORT_LIST.find((a) => normalizeHeritageAreaName(a.name) === normalized);
  if (airport && Number.isFinite(airport.lat) && Number.isFinite(airport.lon)) {
    const cityParts = (airport.city || '').split(' ');
    return { name: airport.name, flag: cityParts[0] || '', country: cityParts.slice(1).join(' '), lat: airport.lat, lon: airport.lon, code: airport.code };
  }
  for (const line of RAIL_LINES) {
    const station = line.stations.find((s) => normalizeHeritageAreaName(s.name) === normalized);
    if (station && Number.isFinite(station.lat) && Number.isFinite(station.lon)) {
      return { name: station.name, flag: station.flag || line.flag, country: station.country || line.country, lat: station.lat, lon: station.lon };
    }
  }
  return null;
}

const HERITAGE_AREA_GENERIC_AIRPORT_KEYWORD_PATTERNS = [/^空港$/, /^国内空港$/, /^最寄り駅$/, /^国際空港$/, /^スイス国際空港協会$/];

/**
 * heritage-areaページのキーワード表示に現れる「空港」「国内空港」「最寄り駅」「国際空港」は
 * 個別の空港名ではなく汎用的なカテゴリラベルのため、国旗・座標が判明しなくても
 * unresolved_airport_keywords への記録対象から除外する。「スイス国際空港協会」は
 * 調査の結果、実在する空港名ではなく組織名であると確認済みのため同様に除外する
 * (キーワード一覧自体の表示からは除外しない。unresolved_airport_keywords記録の
 * 要否判定にのみ使う)。
 */
export function isGenericAirportCategoryKeyword(keyword: string): boolean {
  return HERITAGE_AREA_GENERIC_AIRPORT_KEYWORD_PATTERNS.some((re) => re.test(keyword));
}

/**
 * findHeritageAreaPointで国旗・座標が判明しなかった空港名候補を記録する。
 * AIRPORT_LISTへ追加すべき空港を後から調査で洗い出すためのログ用途であり、
 * 失敗してもキーワード表示自体には影響させないためエラーは握りつぶす。
 */
async function recordUnresolvedAirportKeywords(db: D1Database, names: string[]): Promise<void> {
  if (!names.length) return;
  try {
    await db.batch(
      names.map((name) => db.prepare('INSERT OR IGNORE INTO unresolved_airport_keywords (airport_name) VALUES (?)').bind(name))
    );
  } catch {}
}

const HERITAGE_AREA_CASTLE_KATAKANA_KEYWORD_PATTERN = /^[ァ-ー]+城$/;

/**
 * キーワードが「(全角カタカナ1文字以上)城」の形(海外の城の日本語表記に多いパターン、
 * 例:「ノイシュヴァンシュタイン城」)に一致するかどうかを判定する。該当するキーワードは
 * 空港名候補ではないため unresolved_airport_keywords への記録対象からは除外し、
 * 代わりに unresolved_castle_keywords へ記録する。
 */
export function isCastleNameKeywordPattern(keyword: string): boolean {
  return HERITAGE_AREA_CASTLE_KATAKANA_KEYWORD_PATTERN.test(keyword);
}

/**
 * findHeritageAreaPointで国旗・座標が判明しなかった「(カタカナ)城」名候補を記録する。
 * HERITAGE_LISTへ追加すべき城を後から調査で洗い出すためのログ用途であり、
 * 失敗してもキーワード表示自体には影響させないためエラーは握りつぶす。
 */
async function recordUnresolvedCastleKeywords(db: D1Database, names: string[]): Promise<void> {
  if (!names.length) return;
  try {
    await db.batch(
      names.map((name) => db.prepare('INSERT OR IGNORE INTO unresolved_castle_keywords (castle_name) VALUES (?)').bind(name))
    );
  } catch {}
}

const HERITAGE_AREA_STATION_KEYWORD_PATTERN = /^.+駅$/;

/**
 * キーワードが「(任意の文字列)駅」の形(具体的な駅名、例:「姫路駅」「パリ・リヨン駅」の
 * ような漢字・カタカナ双方の駅名表記を含む)に一致するかどうかを判定する。
 * 「最寄り駅」はisGenericAirportCategoryKeywordで判定する汎用カテゴリラベルのため
 * ここでは除外し、駅名候補と誤って記録されないようにする。
 */
export function isStationNameKeywordPattern(keyword: string): boolean {
  return HERITAGE_AREA_STATION_KEYWORD_PATTERN.test(keyword) && !isGenericAirportCategoryKeyword(keyword);
}

/**
 * findHeritageAreaPointで国旗・座標が判明しなかった駅名候補を記録する。
 * RAIL_LINESへ追加すべき駅を後から調査で洗い出すためのログ用途であり、
 * 失敗してもキーワード表示自体には影響させないためエラーは握りつぶす。
 */
async function recordUnresolvedStationKeywords(db: D1Database, names: string[]): Promise<void> {
  if (!names.length) return;
  try {
    await db.batch(
      names.map((name) => db.prepare('INSERT OR IGNORE INTO unresolved_station_keywords (station_name) VALUES (?)').bind(name))
    );
  } catch {}
}

app.get('/api/heritage-area/travel-categories', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  try {
    const group = await db.prepare(
      `SELECT category_ids
       FROM aichat_category_groups
       WHERE user_id = ? AND lower(group_name) = lower(?) AND (is_deleted = 0 OR is_deleted IS NULL)
       ORDER BY updated_at DESC
       LIMIT 1`
    ).bind(user.sub, 'Travel').first<{ category_ids: string }>();
    if (!group) return c.json({ categories: [] });
    let categoryIds: number[] = [];
    try { categoryIds = JSON.parse(group.category_ids); } catch { categoryIds = []; }
    categoryIds = categoryIds.map(Number).filter((id) => Number.isFinite(id));
    if (!categoryIds.length) return c.json({ categories: [] });
    const placeholders = categoryIds.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT c.id, c.name, COALESCE(c.color, '#6366f1') AS color,
              COUNT(DISTINCT m.keyword) AS kw_count
       FROM aichat_keyword_categories c
       LEFT JOIN aichat_keyword_category_map m ON m.user_id = c.user_id AND m.category_id = c.id
       WHERE c.user_id = ? AND c.id IN (${placeholders})
       GROUP BY c.id, c.name, c.color
       ORDER BY kw_count DESC, c.name ASC`
    ).bind(user.sub, ...categoryIds).all<{ id: number; name: string; color: string; kw_count: number }>();
    return c.json({ categories: rows.results ?? [] });
  } catch (err) {
    return c.json({ error: 'Travelカテゴリの取得に失敗しました', detail: String((err as Error)?.message ?? err) }, 500);
  }
});

app.get('/api/heritage-area/travel-categories/:id/keywords', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const categoryId = Number(c.req.param('id'));
  if (!Number.isFinite(categoryId)) return c.json({ error: 'invalid category id' }, 400);
  try {
    const rows = await db.prepare(
      `SELECT m.keyword, COUNT(DISTINCT i.id) AS count
       FROM aichat_keyword_category_map m
       LEFT JOIN aichat_search_log s ON s.user_id = m.user_id AND s.keyword = m.keyword AND s.deleted_at IS NULL
       LEFT JOIN aichat_search_impressions i ON i.user_id = m.user_id AND i.share_id = s.share_id AND i.deleted_at IS NULL
       WHERE m.user_id = ? AND m.category_id = ?
       GROUP BY m.keyword
       ORDER BY count DESC, m.keyword ASC`
    ).bind(user.sub, categoryId).all<{ keyword: string; count: number }>();
    const unresolvedAirportNames: string[] = [];
    const unresolvedCastleNames: string[] = [];
    const unresolvedStationNames: string[] = [];
    const keywords = (rows.results ?? []).map((row) => {
      const point = findHeritageAreaPoint(row.keyword);
      if (point) return { ...row, heritage_point: point };
      if (isCastleNameKeywordPattern(row.keyword)) {
        unresolvedCastleNames.push(row.keyword);
      } else if (isStationNameKeywordPattern(row.keyword)) {
        unresolvedStationNames.push(row.keyword);
      } else if (!isGenericAirportCategoryKeyword(row.keyword)) {
        unresolvedAirportNames.push(row.keyword);
      }
      return row;
    });
    if (unresolvedAirportNames.length || unresolvedCastleNames.length || unresolvedStationNames.length) {
      const ctx = c.executionCtx;
      if (ctx?.waitUntil) {
        if (unresolvedAirportNames.length) ctx.waitUntil(recordUnresolvedAirportKeywords(db, unresolvedAirportNames));
        if (unresolvedCastleNames.length) ctx.waitUntil(recordUnresolvedCastleKeywords(db, unresolvedCastleNames));
        if (unresolvedStationNames.length) ctx.waitUntil(recordUnresolvedStationKeywords(db, unresolvedStationNames));
      }
    }
    return c.json({ keywords });
  } catch (err) {
    return c.json({ error: 'キーワードの取得に失敗しました', detail: String((err as Error)?.message ?? err) }, 500);
  }
});

// 実際に生成される質問文のtopicと完全一致する文字列のみを書くこと（存在しない文字列は永遠に無マッチになる）
export const HERITAGE_AREA_SEARCH_TOPICS = ['見どころ', '最寄り空港', '鉄道でのアクセス', '宿泊施設'];

/**
 * HTTP QUERY(draft-ietf-httpbis-safe-method-w-body)でも呼べるように、
 * ハンドラをapp.post/app.onの両方から参照できる名前付き関数として切り出す。
 * この検索は副作用のない読み取り専用操作で、キーワード配列(最大20件)という
 * URLに載せづらい条件を渡すため、GETと同じ安全なセマンティクスを持つQUERYに
 * 適した典型例。既存のPOST呼び出し元(heritageArea.ts)はそのまま動作する。
 */
async function heritageAreaSearchHandler(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const body = await c.req.json<{ keywords?: unknown }>().catch(() => null);
  const keywords = Array.from(new Set((Array.isArray(body?.keywords) ? body!.keywords : [])
    .map((kw) => String(kw).trim())
    .filter(Boolean)))
    .slice(0, 20);
  if (!keywords.length) return c.json({ items: [] });
  const selectedHeritagePoints = keywords.map(findHeritageAreaPoint).filter((p): p is NonNullable<ReturnType<typeof findHeritageAreaPoint>> => !!p);
  const distanceOrigin = selectedHeritagePoints.length === 1 ? selectedHeritagePoints[0] : null;
  const topics = HERITAGE_AREA_SEARCH_TOPICS;
  // D1のLIKEパターンは(ワイルドカードの有無に関わらず)約50バイトを超えると
  // "LIKE or GLOB pattern too complex" で失敗するため、任意長になり得る
  // キーワードはLIKEではなくINSTR(長さ制限なし)で中黒(全角/半角)表記ゆれを
  // 吸収して検索する。トピックは固定の短い文字列のみなのでLIKEのままで安全。
  const keywordWhere = keywords.map(() => `(INSTR(REPLACE(s.question, '･', '・'), ?) > 0 OR INSTR(REPLACE(s.answer, '･', '・'), ?) > 0)`).join(' OR ');
  const topicWhere = topics.map(() => `s.question LIKE ? ESCAPE '\\'`).join(' OR ');
  const keywordParams = keywords.flatMap((kw) => {
    const normalized = kw.replace(/[・･]/g, '・');
    return [normalized, normalized];
  });
  const topicParams = topics.map((topic) => buildFuzzySearchLikePattern(topic));
  try {
    const rows = await db.prepare(
      `SELECT NULL AS area_seq,
              'aichat_search_impressions' AS category,
              s.question AS item_name,
              s.answer AS answer,
              i.share_id,
              COUNT(DISTINCT i.id) AS impression_count,
              MAX(i.result_count) AS max_result_count,
              MAX(i.searched_at) AS last_searched_at
       FROM aichat_search_impressions i
       JOIN ai_chat_shares s ON s.id = i.share_id AND s.user_id = i.user_id AND s.deleted_at IS NULL
       WHERE i.user_id = ? AND i.deleted_at IS NULL AND (${keywordWhere}) AND (${topicWhere})
       GROUP BY i.share_id, s.question, s.answer
       ORDER BY impression_count DESC, last_searched_at DESC, s.question ASC
       LIMIT 500`
    ).bind(user.sub, ...keywordParams, ...topicParams).all<{
      area_seq: null; category: string; item_name: string; answer: string | null; share_id: string;
      impression_count: number; max_result_count: number | null; last_searched_at: string;
    }>();

    const itemByQuoteKey = new Map<string, {
      area_seq: null; category: string; item_name: string; share_id: string;
      impression_count: number; max_result_count: number | null; last_searched_at: string;
      matched_keywords: string; quote_keys: string[]; area_matches: { key: string; areas: string }[];
      heritage_point: ReturnType<typeof findHeritageAreaPoint>; distance_km: number | null;
    }>();
    for (const row of rows.results ?? []) {
      const question = String(row.item_name ?? '');
      const firstQuoteMatch = question.match(/「([^」]+)」/);
      const firstQuoteKey = String(firstQuoteMatch?.[1] ?? '').trim();
      if (!firstQuoteKey) continue;
      const answer = String(row.answer ?? '');
      const searchableText = `${question} ${answer}`.toLowerCase();
      const matchedKeywords = keywords.filter((kw) => searchableText.includes(kw.toLowerCase()));
      const existing = itemByQuoteKey.get(firstQuoteKey);
      if (existing) {
        existing.impression_count += Number(row.impression_count ?? 0);
        existing.max_result_count = Math.max(Number(existing.max_result_count ?? 0), Number(row.max_result_count ?? 0));
        if (String(row.last_searched_at ?? '') > String(existing.last_searched_at ?? '')) existing.last_searched_at = row.last_searched_at;
        const keywordSet = new Set(existing.matched_keywords.split(',').filter(Boolean));
        matchedKeywords.forEach((kw) => keywordSet.add(kw));
        existing.matched_keywords = Array.from(keywordSet).join(',');
        continue;
      }
      const heritagePoint = findHeritageAreaPoint(firstQuoteKey);
      itemByQuoteKey.set(firstQuoteKey, {
        area_seq: null,
        category: row.category,
        item_name: firstQuoteKey,
        share_id: row.share_id,
        impression_count: Number(row.impression_count ?? 0),
        max_result_count: row.max_result_count,
        last_searched_at: row.last_searched_at,
        matched_keywords: matchedKeywords.join(','),
        quote_keys: [firstQuoteKey],
        area_matches: [],
        heritage_point: heritagePoint,
        distance_km: distanceOrigin && heritagePoint ? Math.round(haversineKm(distanceOrigin.lat, distanceOrigin.lon, heritagePoint.lat, heritagePoint.lon)) : null,
      });
    }
    const items = Array.from(itemByQuoteKey.values())
      .sort((a, b) => {
        if (distanceOrigin) {
          const ad = a.distance_km == null ? Number.POSITIVE_INFINITY : Number(a.distance_km);
          const bd = b.distance_km == null ? Number.POSITIVE_INFINITY : Number(b.distance_km);
          if (ad !== bd) return ad - bd;
        }
        return (Number(b.impression_count) - Number(a.impression_count)) || String(b.last_searched_at ?? '').localeCompare(String(a.last_searched_at ?? '')) || a.item_name.localeCompare(b.item_name);
      })
      .slice(0, 500);

    // ここも同じD1のLIKEパターン長制限(約50バイト)に引っかかるため、
    // 動的に組み立てるLIKEパターンはINSTR(長さ制限なし)に置き換える。
    const areaLookup = db.prepare(
      `SELECT i.item_name AS key,
              i.area_seq,
              i.category,
              b.box
       FROM heritage_area_items i
       JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ?
       WHERE i.item_name = ?
          OR INSTR(?, i.item_name) > 0
          OR INSTR(i.item_name, ?) > 0
       ORDER BY i.area_seq ASC, i.category ASC, i.item_name ASC
       LIMIT 50`
    );
    // エリア確定(保存)後にHERITAGE_LIST等へ追加された地点は heritage_area_items に
    // 存在しないため、上記の名前ベースの紐付けだけでは検出できず、実際には範囲内
    // にあるのにarea_matchesが空のまま(エリア確定時点の判定結果が固定表示される)
    // 不具合があった。エリア枠(heritage_area_boxes)の矩形範囲と地点の座標を
    // 都度再判定し、名前ベースではまだ紐付いていないエリアがあれば追加する。
    const areaBoxRows = await db.prepare(
      `SELECT area_seq AS areaSeq, top_left_lat AS topLeftLat, top_left_lon AS topLeftLon,
              bottom_right_lat AS bottomRightLat, bottom_right_lon AS bottomRightLon
         FROM heritage_area_boxes
        WHERE user_id = ?`
    ).bind(user.sub).all<{ areaSeq: number; topLeftLat: number; topLeftLon: number; bottomRightLat: number; bottomRightLon: number }>();
    const areaBoxes = (areaBoxRows.results ?? [])
      .filter((row) => [row.topLeftLat, row.topLeftLon, row.bottomRightLat, row.bottomRightLon].every(Number.isFinite))
      .map((row) => ({ areaSeq: row.areaSeq, bounds: heritageAreaBoxBounds(row.topLeftLat, row.topLeftLon, row.bottomRightLat, row.bottomRightLon) }));
    for (const item of items) {
      const quoteKeyMatches: { key: string; areas: string }[] = [];
      for (const key of item.quote_keys) {
        const normalizedKey = String(key ?? '').trim();
        if (!normalizedKey) continue;
        const areaRows = await areaLookup.bind(user.sub, normalizedKey, normalizedKey, normalizedKey).all<{
          key: string; area_seq: number; category: string; box: string | null;
        }>();
        const labels: string[] = [];
        const matchedAreaSeqs = new Set<number>();
        for (const row of areaRows.results ?? []) {
          matchedAreaSeqs.add(row.area_seq);
          const label = `エリア#${row.area_seq}${row.category ? `/${row.category}` : ''}${row.box ? ` (${row.box})` : ''}`;
          if (!labels.includes(label)) labels.push(label);
        }
        if (item.heritage_point) {
          for (const box of areaBoxes) {
            if (matchedAreaSeqs.has(box.areaSeq)) continue;
            if (isPointInHeritageAreaBoxBounds(item.heritage_point.lat, item.heritage_point.lon, box.bounds)) {
              matchedAreaSeqs.add(box.areaSeq);
              labels.push(`エリア#${box.areaSeq}(座標範囲内・エリア確定後に追加)`);
            }
          }
        }
        if (labels.length) quoteKeyMatches.push({ key: normalizedKey, areas: labels.join(' / ') });
      }
      item.area_matches = quoteKeyMatches;
    }
    return c.json({ items, distance_origin: distanceOrigin });
  } catch (err) {
    return c.json({ error: '検索露出ログの検索に失敗しました', detail: String((err as Error)?.message ?? err) }, 500);
  }
}

app.post('/api/heritage-area/search', authMiddleware, heritageAreaSearchHandler);
app.on('QUERY', '/api/heritage-area/search', authMiddleware, heritageAreaSearchHandler);

/**
 * heritage-areaページで「カテゴリ選択…」(未選択)の状態でも、検索結果テーブルの
 * エリア番号列見出しの本数をデータベース上に実在する最大エリア番号に合わせて
 * 描画できるようにするための最大area_seq取得エンドポイント。
 */
app.get('/api/heritage-area/max-area-seq', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const row = await db.prepare('SELECT MAX(area_seq) AS maxSeq FROM heritage_area_boxes WHERE user_id = ?').bind(user.sub).first<{ maxSeq: number | null }>();
  return c.json({ max: Number(row?.maxSeq ?? 0) || 0 });
});

/**
 * heritage-areaページで「カテゴリ選択…」(未選択)の状態のまま検索結果テーブルの
 * エリア番号列見出しをタップした際に、キーワード検索を経由せず直接そのエリアに
 * 保存済みの世界遺産・空港・駅などのアイテム名を一覧表示するためのエンドポイント。
 * area_matchesは既存のareaNumbersOf(クライアント)がそのまま解釈できる
 * 「エリア#N」形式の文字列で返す。
 */
app.get('/api/heritage-area/areas/:areaSeq/items', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const areaSeq = Number(c.req.param('areaSeq'));
  if (!Number.isInteger(areaSeq) || areaSeq <= 0) return c.json({ error: '無効なエリア番号です' }, 400);
  try {
    const nameRows = await db.prepare(
      `SELECT DISTINCT i.item_name AS item_name
       FROM heritage_area_items i
       JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ?
       WHERE i.area_seq = ?
       ORDER BY i.item_name ASC
       LIMIT 500`
    ).bind(user.sub, areaSeq).all<{ item_name: string }>();
    const names = (nameRows.results ?? []).map((r) => r.item_name);
    if (!names.length) return c.json({ items: [] });
    const areaLookup = db.prepare(
      `SELECT i.area_seq AS area_seq
       FROM heritage_area_items i
       JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ?
       WHERE i.item_name = ?
       ORDER BY i.area_seq ASC`
    );
    const items: Array<{
      item_name: string; category: string; area_matches: { key: string; areas: string }[];
      heritage_point: ReturnType<typeof findHeritageAreaPoint>;
    }> = [];
    for (const name of names) {
      const areaRows = await areaLookup.bind(user.sub, name).all<{ area_seq: number }>();
      const labels = Array.from(new Set((areaRows.results ?? []).map((r) => `エリア#${r.area_seq}`)));
      items.push({ item_name: name, category: 'エリア一覧', area_matches: labels.length ? [{ key: name, areas: labels.join(' / ') }] : [], heritage_point: findHeritageAreaPoint(name) });
    }
    return c.json({ items });
  } catch (err) {
    return c.json({ error: 'エリア内アイテムの取得に失敗しました', detail: String((err as Error)?.message ?? err) }, 500);
  }
});

app.get('/api/heritage-cities', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const name = c.req.query('name') || '';
  if (!name) return c.json({ error: 'name required' }, 400);
  const fetched = await db.prepare('SELECT city_count FROM heritage_city_fetched WHERE heritage_name = ?').bind(name).first<{ city_count: number }>();
  if (!fetched) return c.json({ fetched: false });
  const result = await db.prepare(
    'SELECT city_name, city_lat, city_lon, population, distance_km, country_code FROM heritage_cities WHERE heritage_name = ? ORDER BY distance_km'
  ).bind(name).all<{ city_name: string; city_lat: number; city_lon: number; population: number | null; distance_km: number; country_code: string | null }>();
  return c.json({ fetched: true, cities: result.results });
});

app.post('/api/heritage-cities', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const body = await c.req.json<{ name: string; lat: number; lon: number; force?: boolean }>().catch(() => null);
  if (!body || !body.name || body.lat == null || body.lon == null) return c.json({ error: 'name, lat, lon required' }, 400);
  const { name, lat, lon, force } = body;

  if (force) {
    await db.prepare('DELETE FROM heritage_city_fetched WHERE heritage_name = ?').bind(name).run();
  }

  const cities = findNearbyCities(lat, lon, 1500, 45);

  if (cities.length > 0) {
    const stmt = db.prepare('INSERT OR IGNORE INTO heritage_cities (heritage_name, city_name, city_lat, city_lon, population, distance_km, country_code) VALUES (?, ?, ?, ?, ?, ?, ?)');
    await db.batch(cities.map(city => stmt.bind(name, city.city_name, city.city_lat, city.city_lon, city.population, city.distance_km, city.country_code)));
  }

  const allCities = await db.prepare(
    'SELECT city_name, city_lat, city_lon, population, distance_km, country_code FROM heritage_cities WHERE heritage_name = ? ORDER BY distance_km'
  ).bind(name).all<{ city_name: string; city_lat: number; city_lon: number; population: number | null; distance_km: number; country_code: string | null }>();
  await db.prepare('INSERT OR REPLACE INTO heritage_city_fetched (heritage_name, city_count) VALUES (?, ?)').bind(name, allCities.results.length).run();

  return c.json({ fetched: true, cities: allCities.results });
});

app.get('/api/heritage-city-fetched-list', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ names: [] });
  const rows = await db.prepare('SELECT heritage_name FROM heritage_city_fetched WHERE city_count > 0').all<{ heritage_name: string }>();
  return c.json({ names: rows.results.map(r => r.heritage_name) });
});

app.get('/api/rail-station-cities', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const name = c.req.query('name') || '';
  if (!name) return c.json({ error: 'name required' }, 400);
  const fetched = await db.prepare('SELECT city_count FROM rail_station_fetched WHERE station_name = ?').bind(name).first<{ city_count: number }>();
  if (!fetched) return c.json({ fetched: false });
  const result = await db.prepare(
    'SELECT city_name, city_lat, city_lon, population, distance_km, country_code FROM rail_station_cities WHERE station_name = ? ORDER BY distance_km'
  ).bind(name).all<{ city_name: string; city_lat: number; city_lon: number; population: number | null; distance_km: number; country_code: string | null }>();
  return c.json({ fetched: true, cities: result.results });
});

app.post('/api/rail-station-cities', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const body = await c.req.json<{ name: string; lat: number; lon: number; force?: boolean }>().catch(() => null);
  if (!body || !body.name || body.lat == null || body.lon == null) return c.json({ error: 'name, lat, lon required' }, 400);
  const { name, lat, lon, force } = body;

  if (force) {
    await db.prepare('DELETE FROM rail_station_fetched WHERE station_name = ?').bind(name).run();
  }

  const cities = findNearbyCities(lat, lon, 1500, 45);

  if (cities.length > 0) {
    const stmt = db.prepare('INSERT OR IGNORE INTO rail_station_cities (station_name, city_name, city_lat, city_lon, population, distance_km, country_code) VALUES (?, ?, ?, ?, ?, ?, ?)');
    await db.batch(cities.map(city => stmt.bind(name, city.city_name, city.city_lat, city.city_lon, city.population, city.distance_km, city.country_code)));
  }

  const allCities = await db.prepare(
    'SELECT city_name, city_lat, city_lon, population, distance_km, country_code FROM rail_station_cities WHERE station_name = ? ORDER BY distance_km'
  ).bind(name).all<{ city_name: string; city_lat: number; city_lon: number; population: number | null; distance_km: number; country_code: string | null }>();
  await db.prepare('INSERT OR REPLACE INTO rail_station_fetched (station_name, city_count) VALUES (?, ?)').bind(name, allCities.results.length).run();

  return c.json({ fetched: true, cities: allCities.results });
});

app.get('/api/rail-station-fetched-list', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ names: [] });
  const rows = await db.prepare('SELECT station_name FROM rail_station_fetched WHERE city_count > 0').all<{ station_name: string }>();
  return c.json({ names: rows.results.map(r => r.station_name) });
});

const RAIL_STATION_NEARBY_RADIUS_KM = 100;

type NearbyPointRow = { point_type: string; point_name: string; point_lat: number; point_lon: number; distance_km: number };

function dedupeNearbyPointRows(rows: NearbyPointRow[]): NearbyPointRow[] {
  const deduped = dedupeNearbyPoints(rows.map(r => ({ pointType: r.point_type as 'station' | 'heritage', pointName: r.point_name, lat: r.point_lat, lon: r.point_lon, distanceKm: r.distance_km })));
  return deduped.map(p => ({ point_type: p.pointType, point_name: p.pointName, point_lat: p.lat, point_lon: p.lon, distance_km: p.distanceKm }));
}

app.get('/api/rail-station-nearby', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const name = c.req.query('name') || '';
  if (!name) return c.json({ error: 'name required' }, 400);
  const fetched = await db.prepare('SELECT point_count FROM rail_station_nearby_fetched WHERE station_name = ?').bind(name).first<{ point_count: number }>();
  if (!fetched) return c.json({ fetched: false });
  const result = await db.prepare(
    'SELECT point_type, point_name, point_lat, point_lon, distance_km FROM rail_station_nearby_points WHERE station_name = ? ORDER BY distance_km'
  ).bind(name).all<{ point_type: string; point_name: string; point_lat: number; point_lon: number; distance_km: number }>();
  // ツールチップに重複データを表示しないよう、同じ point_type+point_name は最も近い1件のみ返す
  return c.json({ fetched: true, points: dedupeNearbyPointRows(result.results) });
});

app.post('/api/rail-station-nearby', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const body = await c.req.json<{ name: string; lat: number; lon: number; force?: boolean }>().catch(() => null);
  if (!body || !body.name || body.lat == null || body.lon == null) return c.json({ error: 'name, lat, lon required' }, 400);
  const { name, lat, lon, force } = body;

  if (force) {
    await db.prepare('DELETE FROM rail_station_nearby_fetched WHERE station_name = ?').bind(name).run();
  }

  const points = findNearbyStationsAndHeritage(RAIL_LINES, HERITAGE_LIST, lat, lon, RAIL_STATION_NEARBY_RADIUS_KM, name);

  // 既存データベースに同じ point_type+point_name のキャッシュが無いものだけを新規に書き込む
  const existing = await db.prepare(
    'SELECT point_type, point_name FROM rail_station_nearby_points WHERE station_name = ?'
  ).bind(name).all<{ point_type: string; point_name: string }>();
  const existingKeys = new Set(existing.results.map(r => r.point_type + '|' + r.point_name));
  const newPoints = points.filter(p => !existingKeys.has(p.pointType + '|' + p.pointName));

  if (newPoints.length > 0) {
    const stmt = db.prepare('INSERT OR IGNORE INTO rail_station_nearby_points (station_name, point_type, point_name, point_lat, point_lon, distance_km) VALUES (?, ?, ?, ?, ?, ?)');
    await db.batch(newPoints.map(p => stmt.bind(name, p.pointType, p.pointName, p.lat, p.lon, p.distanceKm)));
  }

  const allPoints = await db.prepare(
    'SELECT point_type, point_name, point_lat, point_lon, distance_km FROM rail_station_nearby_points WHERE station_name = ? ORDER BY distance_km'
  ).bind(name).all<{ point_type: string; point_name: string; point_lat: number; point_lon: number; distance_km: number }>();
  // ツールチップに重複データを表示しないよう、返却前にも同じ point_type+point_name を1件に絞る
  const dedupedPoints = dedupeNearbyPointRows(allPoints.results);
  await db.prepare('INSERT OR REPLACE INTO rail_station_nearby_fetched (station_name, point_count) VALUES (?, ?)').bind(name, dedupedPoints.length).run();

  return c.json({ fetched: true, points: dedupedPoints });
});

const AIRPORT_NEARBY_HERITAGE_RADIUS_KM = 300;

app.post('/api/airport-nearby-heritage', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const body = await c.req.json<{ name: string; lat: number; lon: number }>().catch(() => null);
  if (!body || !body.name || body.lat == null || body.lon == null) return c.json({ error: 'name, lat, lon required' }, 400);
  const { name, lat, lon } = body;

  try {
    const nearby = findNearbyHeritageForAirport(HERITAGE_LIST, lat, lon, AIRPORT_NEARBY_HERITAGE_RADIUS_KM);

    // 組がDBに存在するかどうかではなく、distance_kmが既存値と異なる（＝差分がある）組だけを書き込む
    const existing = await db.prepare(
      'SELECT heritage_name, distance_km FROM airport_nearby_heritage WHERE airport_name = ?'
    ).bind(name).all<{ heritage_name: string; distance_km: number }>();
    const existingMap = new Map(existing.results.map(r => [r.heritage_name, r.distance_km]));
    const diffHeritage = diffAirportNearbyHeritage(nearby, existingMap);

    if (diffHeritage.length > 0) {
      const stmt = db.prepare(
        'INSERT INTO airport_nearby_heritage (airport_name, heritage_name, distance_km) VALUES (?, ?, ?) ' +
        'ON CONFLICT(airport_name, heritage_name) DO UPDATE SET distance_km = excluded.distance_km'
      );
      await db.batch(diffHeritage.map(h => stmt.bind(name, h.heritageName, h.distanceKm)));
    }

    const all = await db.prepare(
      'SELECT heritage_name, distance_km FROM airport_nearby_heritage WHERE airport_name = ? ORDER BY distance_km'
    ).bind(name).all<{ heritage_name: string; distance_km: number }>();

    return c.json({ heritage: all.results, recordedCount: diffHeritage.length });
  } catch (err) {
    return c.json({ error: '空港周辺世界遺産の取得・記録に失敗しました', detail: String((err as Error)?.message ?? err) }, 500);
  }
});

const AIRPORT_NEARBY_AIRPORT_RADIUS_KM = 1500;

app.post('/api/airport-nearby-airports', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const body = await c.req.json<{ name: string; code: string; lat: number; lon: number }>().catch(() => null);
  if (!body || !body.name || !body.code || body.lat == null || body.lon == null) return c.json({ error: 'name, code, lat, lon required' }, 400);
  const { name, code, lat, lon } = body;

  try {
    const nearby = findNearbyAirports(AIRPORT_LIST, lat, lon, AIRPORT_NEARBY_AIRPORT_RADIUS_KM, code);

    // 組がDBに存在するかどうかではなく、distance_kmが既存値と異なる（＝差分がある）組だけを書き込む
    const existing = await db.prepare(
      'SELECT other_airport_name, distance_km FROM airport_nearby_airport WHERE airport_name = ?'
    ).bind(name).all<{ other_airport_name: string; distance_km: number }>();
    const existingMap = new Map(existing.results.map(r => [r.other_airport_name, r.distance_km]));
    const diffAirports = diffAirportNearbyAirport(nearby, existingMap);

    if (diffAirports.length > 0) {
      const stmt = db.prepare(
        'INSERT INTO airport_nearby_airport (airport_name, other_airport_name, distance_km) VALUES (?, ?, ?) ' +
        'ON CONFLICT(airport_name, other_airport_name) DO UPDATE SET distance_km = excluded.distance_km'
      );
      await db.batch(diffAirports.map(a => stmt.bind(name, a.otherAirportName, a.distanceKm)));
    }

    const all = await db.prepare(
      'SELECT other_airport_name, distance_km FROM airport_nearby_airport WHERE airport_name = ? ORDER BY distance_km'
    ).bind(name).all<{ other_airport_name: string; distance_km: number }>();

    return c.json({ airports: all.results, recordedCount: diffAirports.length });
  } catch (err) {
    return c.json({ error: '空港周辺の他空港の取得・記録に失敗しました', detail: String((err as Error)?.message ?? err) }, 500);
  }
});

app.get('/api/airport-nearby-heritage-airports', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ names: [] });
  try {
    const rows = await db.prepare('SELECT DISTINCT airport_name FROM airport_nearby_heritage').all<{ airport_name: string }>();
    return c.json({ names: rows.results.map(r => r.airport_name) });
  } catch (err) {
    return c.json({ error: '記録済み空港一覧の取得に失敗しました', detail: String((err as Error)?.message ?? err), names: [] }, 500);
  }
});

app.get('/api/airport-nearby-heritage-ranking', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ rows: [] });
  try {
    const rows = await db.prepare(
      'SELECT airport_name, heritage_name, distance_km FROM airport_nearby_heritage ORDER BY airport_name, distance_km'
    ).all<{ airport_name: string; heritage_name: string; distance_km: number }>();
    return c.json({ rows: rows.results });
  } catch (err) {
    return c.json({ error: '空港周辺世界遺産ランキングの取得に失敗しました', detail: String((err as Error)?.message ?? err), rows: [] }, 500);
  }
});

app.get('/api/heritage-country-stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ rows: [] });
  const rows = await db.prepare(
    'SELECT country_code, COUNT(DISTINCT heritage_name) AS heritage_count FROM heritage_cities WHERE country_code IS NOT NULL GROUP BY country_code ORDER BY heritage_count DESC'
  ).all<{ country_code: string; heritage_count: number }>();
  return c.json({ rows: rows.results });
});

app.post('/api/heritage-country-city-stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ counts: {}, uniqueTotal: 0 });
  const body = await c.req.json<{ names: string[] }>().catch(() => null);
  if (!body || !Array.isArray(body.names) || body.names.length === 0) {
    return c.json({ counts: {}, uniqueTotal: 0 });
  }
  const names = body.names.slice(0, 200);
  const placeholders = names.map(() => '?').join(',');
  const fetched = await db.prepare(
    `SELECT heritage_name, city_count FROM heritage_city_fetched WHERE heritage_name IN (${placeholders})`
  ).bind(...names).all<{ heritage_name: string; city_count: number }>();
  const counts: Record<string, number> = {};
  for (const row of fetched.results) counts[row.heritage_name] = row.city_count;
  const uniqueRow = await db.prepare(
    `SELECT COUNT(DISTINCT city_name || '|' || CAST(ROUND(city_lat,3) AS TEXT) || '|' || CAST(ROUND(city_lon,3) AS TEXT)) AS total FROM heritage_cities WHERE heritage_name IN (${placeholders})`
  ).bind(...names).first<{ total: number }>();
  return c.json({ counts, uniqueTotal: uniqueRow?.total ?? 0 });
});

app.post('/api/heritage-country-unique-cities', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ cities: [] });
  const body = await c.req.json<{ names: string[] }>().catch(() => null);
  if (!body || !Array.isArray(body.names) || body.names.length === 0) {
    return c.json({ cities: [] });
  }
  const names = body.names.slice(0, 200);
  const placeholders = names.map(() => '?').join(',');
  const rows = await db.prepare(
    `SELECT city_name, ROUND(city_lat,3) AS lat, ROUND(city_lon,3) AS lon,
            country_code, MAX(population) AS population,
            COUNT(DISTINCT heritage_name) AS near_count
     FROM heritage_cities
     WHERE heritage_name IN (${placeholders})
     GROUP BY city_name, ROUND(city_lat,3), ROUND(city_lon,3)
     ORDER BY near_count DESC, population DESC`
  ).bind(...names).all<{ city_name: string; lat: number; lon: number; country_code: string | null; population: number | null; near_count: number }>();
  return c.json({ cities: rows.results });
});

app.post('/api/heritage-city-heritages', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ heritages: [] });
  const body = await c.req.json<{ city_name: string; lat: number; lon: number; names: string[] }>().catch(() => null);
  if (!body || !body.city_name || body.lat == null || body.lon == null || !Array.isArray(body.names) || body.names.length === 0) {
    return c.json({ heritages: [] });
  }
  const names = body.names.slice(0, 200);
  const placeholders = names.map(() => '?').join(',');
  const lat3 = Math.round(body.lat * 1000) / 1000;
  const lon3 = Math.round(body.lon * 1000) / 1000;
  const rows = await db.prepare(
    `SELECT heritage_name, MIN(distance_km) AS distance_km
     FROM heritage_cities
     WHERE city_name = ?
       AND ROUND(city_lat,3) = ?
       AND ROUND(city_lon,3) = ?
       AND heritage_name IN (${placeholders})
     GROUP BY heritage_name
     ORDER BY distance_km`
  ).bind(body.city_name, lat3, lon3, ...names).all<{ heritage_name: string; distance_km: number }>();
  return c.json({ heritages: rows.results });
});

app.post('/api/city-all-heritages', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ heritages: [] });
  const body = await c.req.json<{ city_name: string; lat: number; lon: number }>().catch(() => null);
  if (!body || !body.city_name || body.lat == null || body.lon == null) {
    return c.json({ heritages: [] });
  }
  const lat3 = Math.round(body.lat * 1000) / 1000;
  const lon3 = Math.round(body.lon * 1000) / 1000;
  const rows = await db.prepare(
    `SELECT heritage_name, MIN(distance_km) AS distance_km
     FROM heritage_cities
     WHERE city_name = ?
       AND ROUND(city_lat,3) = ?
       AND ROUND(city_lon,3) = ?
     GROUP BY heritage_name
     ORDER BY distance_km
     LIMIT 100`
  ).bind(body.city_name, lat3, lon3).all<{ heritage_name: string; distance_km: number }>();
  const heritages = (rows.results ?? []).map((r) => ({
    ...r,
    country_flag: HERITAGE_FLAG_MAP[r.heritage_name] ?? '',
    country_name: HERITAGE_COUNTRY_MAP[r.heritage_name] ?? '',
  }));
  return c.json({ heritages });
});

app.get('/api/heritage-access-ranking', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ rows: [] });
  const maxDist = Math.min(2000, parseInt(c.req.query('max_dist') || '500', 10) || 500);
  const limit = Math.min(500, parseInt(c.req.query('limit') || '200', 10) || 200);
  const rows = await db.prepare(
    `SELECT
       city_name,
       country_code,
       ROUND(AVG(city_lat), 4) AS city_lat,
       ROUND(AVG(city_lon), 4) AS city_lon,
       MAX(population) AS population,
       COUNT(DISTINCT heritage_name) AS heritage_count,
       ROUND(MIN(distance_km), 1) AS nearest_km
     FROM heritage_cities
     WHERE distance_km <= ?
     GROUP BY city_name, country_code
     ORDER BY heritage_count DESC, nearest_km ASC
     LIMIT ?`
  ).bind(maxDist, limit).all<{
    city_name: string;
    country_code: string | null;
    city_lat: number;
    city_lon: number;
    population: number | null;
    heritage_count: number;
    nearest_km: number;
  }>();
  return c.json({ rows: rows.results, max_dist: maxDist });
});

app.get('/api/heritage-access/nearby-cities', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB unavailable' }, 503);
  const lat = Number(c.req.query('lat'));
  const lon = Number(c.req.query('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return c.json({ error: '緯度・経度が不正です' }, 400);
  const RADIUS_KM = 500;
  const rows = await db.prepare(
    `SELECT city_name, country_code, ROUND(AVG(city_lat), 4) AS city_lat, ROUND(AVG(city_lon), 4) AS city_lon, MAX(population) AS population
       FROM heritage_cities
      GROUP BY city_name, country_code`
  ).all<{ city_name: string; country_code: string | null; city_lat: number; city_lon: number; population: number | null }>();
  const cities = (rows.results || [])
    .map((r) => ({ ...r, distance_km: Math.round(haversineKm(lat, lon, r.city_lat, r.city_lon) * 10) / 10 }))
    .filter((r) => r.distance_km <= RADIUS_KM)
    .sort((a, b) => a.distance_km - b.distance_km);
  return c.json({ cities, count: cities.length, radius_km: RADIUS_KM });
});

app.get('/heritage-access', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getHeritageAccessPage(user.sub));
});

app.get('/heritage-area', authMiddleware, async (c) => {
  const user = c.get('user');
  const userSession = await getUserSession(c.env.DB, user.sub);
  if (!userSession) {
    return c.html(getSessionExpiredPage(), 403);
  }
  return c.html(getHeritageAreaPage());
});

app.get('/webgl-lv-sphere', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getWebGLLVSpherePage(user.sub));
});

app.get('/webgl-cube', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getWebGLCubePage(user.sub));
});

app.get('/webgl-solar', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getWebGLSolarPage(user.sub));
});

app.get('/moondream-vlm', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getMoondreamVlmPage(user.sub));
});

// /api/moondream-analyze の呼び出し履歴を確認するための内部用ログ閲覧ページ。
// c.env.AI.run() が失敗した場合の原因調査に使う(rule 10: D1の診断データを最初に見る)。
app.get('/moondream-analyze-log', authMiddleware, async (c) => {
  const user = c.get('user');
  let rows: MoondreamAnalyzeLogRow[] = [];
  if (c.env.DB) {
    const result = await c.env.DB.prepare(
      `SELECT id, status, model, prompt_length, image_bytes, error_message, created_at, image_data_url, prompt_text, analysis_text
       FROM moondream_analyze_log
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 100`
    ).bind(user.sub).all<MoondreamAnalyzeLogRow>();
    rows = result.results ?? [];
  }
  return c.html(getMoondreamAnalyzeLogPage(user.sub, rows));
});

// AIチャットの左サイドパネル(スワイプ削除)と同様の操作でmoondream-analyze-logの
// 行を削除するAPI。ai_chat_sharesと異なりdeleted_at列を持たないテーブルのため、
// 論理削除ではなくDELETE FROMで該当行そのものをD1から取り除く。
app.delete('/api/moondream-analyze-log/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);

  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) return jsonUtf8({ error: '無効なIDです' }, 400);

  const row = await c.env.DB.prepare(
    'SELECT id FROM moondream_analyze_log WHERE id = ? AND user_id = ?'
  ).bind(id, user.sub).first<{ id: number }>();
  if (!row) return jsonUtf8({ error: '見つかりません' }, 404);

  await c.env.DB.prepare('DELETE FROM moondream_analyze_log WHERE id = ?').bind(id).run();

  return jsonUtf8({ ok: true });
});

// 画像添付付きAIチャット会話を質問文・回答文のキーワードでギャラリー検索する
// 閲覧専用ページ。ai_chat_shares(正式な会話記録)をそのまま参照するのみで、
// 新規テーブルは作らない。
app.get('/aichat-image-gallery', authMiddleware, async (c) => {
  const user = c.get('user');
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
  return c.html(getAichatImageGalleryPage(user.sub, modelColors));
});

app.get('/api/aichat/image-gallery-search', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);

  const q = (c.req.query('q') ?? '').trim();
  if (!q) return jsonUtf8({ results: [] });

  const { results } = await searchAiChatSharesWithImage(c.env.DB as unknown as D1Like, user.sub, q);
  return jsonUtf8({ results });
});

// /moondream-vlm ページとAIチャットの画像添付機能の両方から呼ばれる内部用API。
// Workers AI の画像分析VLM(@cf/moondream/moondream3.1-9B-A2B)へ画像とプロンプトを渡し、
// 分析結果のテキストを返す。
app.post('/api/moondream-analyze', authMiddleware, async (c) => {
  const user = c.get('user');
  let body: { image?: string; prompt?: string };
  try {
    body = await c.req.json();
  } catch {
    return jsonUtf8({ error: 'リクエスト形式が不正です' }, 400);
  }
  const image = (body.image ?? '').trim();
  if (!image) {
    return jsonUtf8({ error: '画像が指定されていません' }, 400);
  }
  const imageValidation = validateMoondreamImageDataUrl(image);
  if (!imageValidation.ok) {
    return jsonUtf8({ error: imageValidation.reason }, 400);
  }
  if (!c.env.AI) {
    return jsonUtf8({ error: 'AI バインディングが未設定です' }, 503);
  }
  if (await checkAiChatRateLimit(c.env.DB, user.sub)) {
    return jsonUtf8({ error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' }, 429);
  }

  const runParams = buildMoondreamRunParams(image, body.prompt);
  const promptText = body.prompt && body.prompt.trim() ? body.prompt.trim() : MOONDREAM_DEFAULT_PROMPT;
  const promptLength = promptText.length;
  const imageByteLength = estimateImageByteLength(image);

  try {
    const result = await c.env.AI.run(
      MOONDREAM_MODEL as Parameters<typeof c.env.AI.run>[0],
      runParams as Parameters<typeof c.env.AI.run>[1]
    );
    const analysis = parseMoondreamResponse(result);
    if (!analysis) {
      const resultKeys = typeof result === 'object' && result !== null ? Object.keys(result as object).join(',') : 'non-object';
      logger.warn('[moondream-analyze] 空の応答', { resultKeys });
      c.executionCtx?.waitUntil(recordMoondreamAnalyzeLog(c.env.DB, {
        userId: user.sub, status: 'error', model: MOONDREAM_MODEL,
        promptLength, imageBytes: imageByteLength,
        errorMessage: `空の応答(resultKeys=${resultKeys})`, imageDataUrl: image, promptText,
      }));
      return jsonUtf8({ error: '分析結果を取得できませんでした' }, 502);
    }
    c.executionCtx?.waitUntil(recordMoondreamAnalyzeLog(c.env.DB, {
      userId: user.sub, status: 'ok', model: MOONDREAM_MODEL,
      promptLength, imageBytes: imageByteLength,
      imageDataUrl: image, promptText, analysisText: analysis,
    }));
    return jsonUtf8({ analysis, usedModel: MOONDREAM_MODEL });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('[moondream-analyze] 呼び出し失敗', { error: errorMessage });
    c.executionCtx?.waitUntil(recordMoondreamAnalyzeLog(c.env.DB, {
      userId: user.sub, status: 'error', model: MOONDREAM_MODEL,
      promptLength, imageBytes: imageByteLength,
      errorMessage, imageDataUrl: image, promptText,
    }));
    return jsonUtf8({ error: '画像分析に失敗しました' }, 502);
  }
});

app.get('/eclipse-tilt-lesson', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getEclipseTiltLessonPage(user.sub));
});

app.get('/matrix', (c) => {
  return c.html(getMatrixRainPage());
});

app.get('/image3d', (c) => {
  return c.html(getImageSpin3dPage());
});

app.get('/galaxy', (c) => {
  return c.html(getGalaxyPage());
});

/**
 * PostToolUseフック(scripts/check-migration-table-registry.js)からのharness_hook_log書き込み。
 * wranglerのCLI(CLOUDFLARE_API_TOKEN必須)経由ではなく、デプロイ済みWorker自身のD1バインディングを
 * 使うことで、CLOUDFLARE_API_TOKENが無いあらゆる環境(このリポジトリのClaude Codeセッション含む)
 * からでも書き込めるようにする。HARNESS_HOOK_SECRETが設定されている場合のみBearer認証を必須にする
 * (未設定の間は認証なしで受け付ける。harness_hook_logは低リスクな内部テレメトリのため、
 * シークレット未設定でも書き込みテストを継続できることを優先し、設定済みになった時点で
 * 自動的に認証必須へ切り替わる)。
 */
app.post('/internal/harness-hook-log', async (c) => {
  const secret = c.env.HARNESS_HOOK_SECRET;
  if (secret) {
    const authHeader = c.req.header('Authorization') ?? '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!bearer || bearer !== secret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }
  if (!c.env.DB) return c.json({ error: 'DB未設定です' }, 503);

  let body: {
    hookEvent?: string; checkName?: string; toolName?: string | null;
    filePath?: string | null; result?: string; detail?: string | null; sessionId?: string | null;
  };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const hookEvent = typeof body.hookEvent === 'string' ? body.hookEvent.slice(0, 100) : '';
  const checkName = typeof body.checkName === 'string' ? body.checkName.slice(0, 100) : '';
  const result = typeof body.result === 'string' ? body.result.slice(0, 20) : '';
  if (!hookEvent || !checkName || !result) {
    return c.json({ error: 'hookEvent/checkName/result は必須です' }, 400);
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO harness_hook_log (hook_event, check_name, tool_name, file_path, result, detail, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      hookEvent,
      checkName,
      typeof body.toolName === 'string' ? body.toolName.slice(0, 100) : null,
      typeof body.filePath === 'string' ? body.filePath.slice(0, 500) : null,
      result,
      typeof body.detail === 'string' ? body.detail.slice(0, 2000) : null,
      typeof body.sessionId === 'string' ? body.sessionId.slice(0, 100) : null,
    ).run();
    return c.json({ ok: true });
  } catch (error) {
    logger.warn('Failed to insert harness_hook_log via /internal/harness-hook-log', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'harness_hook_logへの書き込みに失敗しました' }, 500);
  }
});

app.get('/harness-log', authMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) {
    return new Response('DB not available', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const selectedResult = ['ok', 'ng', 'error'].includes(c.req.query('result') ?? '') ? (c.req.query('result') as string) : 'all';

  try {
    const countsResult = await db.prepare(
      `SELECT result, COUNT(*) AS cnt FROM harness_hook_log GROUP BY result`
    ).all<{ result: string; cnt: number }>();
    const counts: HarnessLogResultCounts = { ok: 0, ng: 0, error: 0 };
    for (const row of countsResult.results ?? []) {
      if (row.result === 'ok' || row.result === 'ng' || row.result === 'error') {
        counts[row.result] = row.cnt;
      }
    }

    const rowsResult = selectedResult === 'all'
      ? await db.prepare(
          `SELECT id, hook_event, check_name, tool_name, file_path, result, detail, session_id, created_at
           FROM harness_hook_log ORDER BY created_at DESC LIMIT 200`
        ).all<HarnessHookLogRow>()
      : await db.prepare(
          `SELECT id, hook_event, check_name, tool_name, file_path, result, detail, session_id, created_at
           FROM harness_hook_log WHERE result = ? ORDER BY created_at DESC LIMIT 200`
        ).bind(selectedResult).all<HarnessHookLogRow>();

    const html = getHarnessLogPage({
      rows: rowsResult.results ?? [],
      counts,
      selectedResult,
      tableMissing: false,
    });
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    logger.warn('Failed to render harness-log (table may not exist yet)', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    const html = getHarnessLogPage({
      rows: [],
      counts: { ok: 0, ng: 0, error: 0 },
      selectedResult,
      tableMissing: true,
    });
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
});

app.get('/uuid', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getUuidGenPage(user.sub));
});

app.get('/answer-graph', authMiddleware, async (c) => {
  const user = c.get('user');
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
  const hideEmptyRows = resolveAnswerGraphHideEmptyRows(c.req.header('Cookie'));
  const trailSessionStorage = resolveAnswerGraphTrailSessionStorage(c.req.header('Cookie'));
  return c.html(getAnswerGraphPage(user.sub, modelColors, hideEmptyRows, trailSessionStorage));
});

app.get('/base64', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.html(getBase64Page(user.sub));
});

app.post('/api/uuid/save', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return c.json({ error: 'DB未設定です' }, 503);
  const db = c.env.DB;
  const body = await c.req.json<{ uuids: { uuid: string; version: string }[] }>().catch(() => null);
  if (!body || !Array.isArray(body.uuids) || body.uuids.length === 0) {
    return c.json({ error: 'uuids required' }, 400);
  }
  const items = body.uuids.slice(0, 100);
  const validVersions = new Set(['v4', 'v7']);
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const valid = items.filter(it => validVersions.has(it.version) && uuidRe.test(it.uuid));
  if (valid.length === 0) return c.json({ saved: 0 });
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO uuid_history (user_id, uuid, version, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
  );
  const batch = valid.map(it => stmt.bind(user.sub, it.uuid.toLowerCase(), it.version));
  await db.batch(batch);
  return c.json({ saved: valid.length });
});

app.get('/api/uuid/search', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return c.json({ error: 'DB未設定です' }, 503);
  const db = c.env.DB;
  const q = (c.req.query('q') || '').trim();
  const limit = Math.min(100, parseInt(c.req.query('limit') || '50', 10) || 50);
  if (q.length === 0) {
    const rows = await db.prepare(
      'SELECT id, uuid, version, created_at FROM uuid_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(user.sub, limit).all();
    return c.json({ results: rows.results ?? [], query: q });
  }
  const pattern = '%' + q.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';
  const rows = await db.prepare(
    "SELECT id, uuid, version, created_at FROM uuid_history WHERE user_id = ? AND uuid LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?"
  ).bind(user.sub, pattern, limit).all();
  return c.json({ results: rows.results ?? [], query: q });
});

app.delete('/api/uuid/history', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return c.json({ error: 'DB未設定です' }, 503);
  await c.env.DB.prepare('DELETE FROM uuid_history WHERE user_id = ?').bind(user.sub).run();
  return c.json({ ok: true });
});

app.get('/api/uuid/count', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!c.env.DB) return c.json({ error: 'DB未設定です' }, 503);
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS cnt FROM uuid_history WHERE user_id = ?').bind(user.sub).first<{ cnt: number }>();
  return c.json({ count: row?.cnt ?? 0 });
});

const MEXICO_VENUE_KEYWORDS = ['Harp', 'Monterrey', 'Mexico', 'Estadio'];

function buildMonthGameDates(rawDates: any[]): Record<string, {US: boolean, CA: boolean, MX: boolean}> {
  const result: Record<string, {US: boolean, CA: boolean, MX: boolean}> = {};
  for (const d of rawDates) {
    const countries = {US: false, CA: false, MX: false};
    for (const g of d.games || []) {
      const hid = g.teams?.home?.team?.id;
      const vname: string = g.venue?.name || '';
      if (hid === 141) {
        countries.CA = true;
      } else if (MEXICO_VENUE_KEYWORDS.some(k => vname.includes(k))) {
        countries.MX = true;
      } else {
        countries.US = true;
      }
    }
    result[d.date] = countries;
  }
  return result;
}

app.get('/mlb', authMiddleware, async (c) => {
  const user = c.get('user');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const mm = month < 10 ? '0' + month : String(month);
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-${lastDay < 10 ? '0' + lastDay : lastDay}`;
  let preload: {key: string, dates: Record<string, {US: boolean, CA: boolean, MX: boolean}>} | null = null;
  try {
    const mlbUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&hydrate=team,venue`;
    const res = await fetch(mlbUrl, {headers: {'User-Agent': 'Mozilla/5.0'}});
    if (res.ok) {
      const raw: any = await res.json();
      preload = {key: `${year}-${mm}`, dates: buildMonthGameDates(raw.dates || [])};
    }
  } catch (_) {}
  return c.html(getMLBSpherePage(user.sub, preload));
});

app.get('/api/mlb-schedule', authMiddleware, async (c) => {
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const date = c.req.query('date');
  let url: string;
  if (startDate && endDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return c.json({error: 'invalid date'}, 400);
    }
    url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&hydrate=team,venue`;
  } else {
    const d = date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return c.json({error: 'invalid date'}, 400);
    url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${d}&hydrate=team,venue,lineups,linescore`;
  }
  try {
    const res = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0'}});
    if (!res.ok) return c.json({error: 'upstream error', status: res.status}, 502);
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    return c.json({error: 'fetch failed', detail: String(e)}, 502);
  }
});

app.get('/api/mlb-boxscore', authMiddleware, async (c) => {
  const gamePk = c.req.query('gamePk');
  if (!gamePk || !/^\d+$/.test(gamePk)) return c.json({error: 'invalid gamePk'}, 400);
  try {
    const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`;
    const res = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0'}});
    if (!res.ok) return c.json({error: 'upstream error', status: res.status}, 502);
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    return c.json({error: 'fetch failed', detail: String(e)}, 502);
  }
});

app.get('/api/mlb-player-stats', authMiddleware, async (c) => {
  const playerId = c.req.query('playerId');
  const group = c.req.query('group') || 'hitting';
  if (!playerId || !/^\d+$/.test(playerId)) return c.json({error: 'invalid playerId'}, 400);
  if (group !== 'hitting' && group !== 'pitching') return c.json({error: 'invalid group'}, 400);
  try {
    const season = new Date().getFullYear();
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=${group}&season=${season}`;
    const res = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0'}});
    if (!res.ok) return c.json({error: 'upstream error', status: res.status}, 502);
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    return c.json({error: 'fetch failed', detail: String(e)}, 502);
  }
});

app.get('/api/mlb-next-start', authMiddleware, async (c) => {
  const teamId = c.req.query('teamId');
  if (!teamId || !/^\d+$/.test(teamId)) return c.json({error: 'invalid teamId'}, 400);
  try {
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const end = new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000);
    const endDate = end.toISOString().split('T')[0];
    const url = `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&hydrate=probablePitcher&startDate=${startDate}&endDate=${endDate}&sportId=1`;
    const res = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0'}});
    if (!res.ok) return c.json({error: 'upstream error', status: res.status}, 502);
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    return c.json({error: 'fetch failed', detail: String(e)}, 502);
  }
});

app.get('/worldcup-wdl', authMiddleware, async (c) => {
  return c.html(getWorldCupWdlPage());
});

app.get('/worldcup-knockout', authMiddleware, async (c) => {
  return c.html(getWorldCupKnockoutPage());
});

app.get('/tdf', authMiddleware, async (c) => {
  return c.html(getTdfPage());
});

app.get('/airline-network', authMiddleware, async (c) => {
  return c.html(getAirlineNetworkPage());
});

app.get('/chess-tsume-17te', authMiddleware, async (c) => {
  return c.html(getChessTsumePage());
});

/**
 * HTMLRewriter デモページ
 */
app.get('/htmlrewriter-demo', authMiddleware, async (c) => {
  const user = c.get('user');

  // 変換前の「外部HTMLのつもり」サンプル
  const sourceHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>外部ページのタイトル</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .highlight { background: yellow; }
    a { color: blue; }
  </style>
</head>
<body>
  <header>
    <h1>ようこそ</h1>
    <p class="greeting">こんにちは、<span class="username">（未注入）</span> さん</p>
  </header>
  <main>
    <section data-section="links">
      <h2>リンク集</h2>
      <ul>
        <li><a href="https://developers.cloudflare.com">Cloudflare Docs（外部）</a></li>
        <li><a href="https://github.com">GitHub（外部）</a></li>
        <li><a href="/settings">設定ページ（内部）</a></li>
      </ul>
    </section>
    <section data-section="items">
      <h2>アイテム一覧</h2>
      <ul>
        <li class="item">🍎 Apple</li>
        <li class="item">🍌 Banana</li>
        <li class="item">🍒 Cherry</li>
      </ul>
    </section>
    <section>
      <h2>コードブロック</h2>
      <pre><code>const rewriter = new HTMLRewriter()
  .on('title', handler)
  .transform(response);</code></pre>
    </section>
  </main>
  <footer>
    <p class="footer-note">フッター（置換対象）</p>
  </footer>
</body>
</html>`;

  const rules: { selector: string; action: string; description: string }[] = [
    { selector: 'title',         action: 'element.setInnerContent()',  description: '<title> をサービス名 + ユーザー名に書き換え' },
    { selector: '.username',     action: 'element.setInnerContent()',  description: '.username スパンにログイン中のユーザー名を注入' },
    { selector: 'a[href^="http"]', action: 'element.setAttribute()',  description: '外部リンクに target="_blank" rel="noopener noreferrer" を付与' },
    { selector: '.item',         action: 'element.setAttribute()',     description: '.item の style を変更してハイライト表示' },
    { selector: 'code',          action: 'element.before()',           description: '<code> の前に 📋 アイコンを挿入（HTML として）' },
    { selector: '.footer-note',  action: 'element.setInnerContent()',  description: 'フッターに変換日時を注入' },
    { selector: 'body',          action: 'element.prepend()',          description: '<body> の先頭に「HTMLRewriter適用済み」バナーを挿入' },
  ];

  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const safeUser = (user.name || user.sub).replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let transformedHtml: string;
  try {
    const res = new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(`HTMLRewriter デモ | ${user.sub}`);
        },
      })
      .on('.username', {
        element(el) {
          el.setInnerContent(safeUser, { html: false });
        },
      })
      .on('a[href^="http"]', {
        element(el) {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
          el.setAttribute('style', 'color:#0969da;font-weight:600');
        },
      })
      .on('.item', {
        element(el) {
          el.setAttribute('style', 'background:#ddf4ff;padding:4px 10px;border-radius:6px;margin:3px 0;display:inline-block;font-weight:600');
        },
      })
      .on('code', {
        element(el) {
          el.before('<span style="font-size:14px;margin-right:4px">📋</span>', { html: true });
          el.setAttribute('style', 'background:#f0f0f0;padding:12px;display:block;border-radius:6px;font-size:12px;line-height:1.6');
        },
      })
      .on('.footer-note', {
        element(el) {
          el.setInnerContent(`HTMLRewriter によって変換されました — ${now} (JST)`, { html: false });
          el.setAttribute('style', 'color:#57606a;font-size:11px');
        },
      })
      .on('body', {
        element(el) {
          el.prepend(
            '<div style="background:#dafbe1;border:1px solid #4ac26b;border-radius:6px;padding:8px 14px;margin:16px;font-size:12px;font-weight:600;color:#1a7f37">✅ このページは Cloudflare Workers HTMLRewriter によって変換されました</div>',
            { html: true }
          );
        },
      })
      .transform(new Response(sourceHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    transformedHtml = await res.text();
  } catch {
    transformedHtml = '（この環境では HTMLRewriter が利用できません）';
  }

  return c.html(getHtmlRewriterDemoPage({
    username: user.sub,
    sourceHtml,
    transformedHtml,
    rules,
  }));
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
    'user_apis_sidebar_open',
    'user_apis_sidebar_accordion',
    'user_apis_desc_mode',
    'user_apis_nav_flash',
  ]);
  const timezone = cookieVals['user_timezone'] || DEFAULT_TIMEZONE;
  const statusCommitCacheSortMode = cookieVals['user_status_commit_cache_sort_mode'] === 'toggle' ? 'toggle' : 'off';
  const statusChartMode = cookieVals['user_status_chart_mode'] === 'repo' ? 'repo' : 'gradient';
  const statusChartSortOrder = cookieVals['user_status_chart_sort_order'] === 'date' ? 'date' : 'count';
  const statusTableAutoDetect = cookieVals['user_status_table_autodetect'] === 'off' ? 'off' : 'on';
  const statusShowAutoDetectedTables = cookieVals['user_status_show_autodetected_tables'] === 'on' ? 'on' : 'off';
  const statusIgnoreUnknownUnclassifiedWarning = cookieVals['user_status_ignore_unknown_unclassified_warning'] === 'off' ? 'off' : 'on';
  const rawSearchLabelMode = cookieVals['user_search_label_mode'];
  const searchLabelMode = rawSearchLabelMode && ['manual-modal', 'auto-classify'].includes(rawSearchLabelMode) ? rawSearchLabelMode : 'uncategorized';
  const apisSidebarOpen = cookieVals['user_apis_sidebar_open'] === 'on' ? 'on' : 'off';
  const apisSidebarAccordion = cookieVals['user_apis_sidebar_accordion'] === 'on' ? 'on' : 'off';
  const apisDescMode = cookieVals['user_apis_desc_mode'] === 'off' ? 'off' : 'on';
  const apisNavFlash = cookieVals['user_apis_nav_flash'] ?? '7';
  const autoVectorizeSettings = resolveAutoVectorizeSettings(cookieHeader);
  const answerGraphHideEmptyRows = resolveAnswerGraphHideEmptyRows(cookieHeader);
  const answerGraphTrailSessionStorage = resolveAnswerGraphTrailSessionStorage(cookieHeader);
  const aichatPreferMoondream = resolveAichatPreferMoondream(cookieHeader);

  let issuedAt: string;
  let expiresAt: string;

  const issuedDate = new Date(user.iat * 1000);
  const expiresDate = new Date(user.exp * 1000);
  issuedAt = formatTimestampWithTimezone(issuedDate, timezone);
  expiresAt = formatTimestampWithTimezone(expiresDate, timezone);

  const userSession = await getUserSession(c.env.DB, user.sub);
  const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;
  const resolvedTimezone = userSession?.timezone || getCookieValues(cookieHeader, ['user_timezone'])['user_timezone'] || DEFAULT_TIMEZONE;
  const sessionDuration = resolveSessionDuration(userSession?.sessionDuration, cookieVals['user_session_duration']);
  const recentCommitsCount = userSession?.recentCommitsCount ?? (parseInt(cookieVals['user_recent_commits_count'] ?? '', 10) || 20);
  const toastDuration = userSession?.toastDuration ?? (parseInt(cookieVals['user_toast_duration'] ?? '', 10) || 10);
  const emailConfirmLoginEnabled = await isEmailConfirmLoginEnabled(c.env.DB);

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
    idleTimeoutSeconds: userSession?.idleTimeoutSeconds ?? null,
    statusCommitCacheSortMode,
    statusChartMode,
    statusChartSortOrder,
    statusTableAutoDetect,
    statusShowAutoDetectedTables,
    statusIgnoreUnknownUnclassifiedWarning,
    searchLabelMode,
    apisSidebarOpen,
    apisSidebarAccordion,
    apisDescMode,
    apisNavFlash,
    aichatAutoVectorizeEnabled: autoVectorizeSettings.enabled ? 'on' : 'off',
    aichatAutoVectorizeModel: autoVectorizeSettings.model,
    answerGraphHideEmptyRows: answerGraphHideEmptyRows ? 'on' : 'off',
    answerGraphTrailSessionStorage: answerGraphTrailSessionStorage ? 'on' : 'off',
    aichatPreferMoondream: aichatPreferMoondream ? 'on' : 'off',
    emailConfirmLoginEnabled,
    githubScopes: GITHUB_OAUTH_SCOPE,
    githubGrantedScopes: grantedScopes,
    githubScopeError: scopesError,
  }));
});

app.get('/auth-flow', authMiddleware, (c) => c.html(getAuthFlowPage()));

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

app.get('/kw-drilldown', authMiddleware, async (c) => {
  const user = c.get('user');
  const userSession = await getUserSession(c.env.DB, user.sub);
  if (!userSession) {
    return c.html(getSessionExpiredPage(), 403);
  }
  return c.html(getKwDrilldownPage());
});

app.get('/kw-architecture', authMiddleware, async (c) => {
  const user = c.get('user');
  const userSession = await getUserSession(c.env.DB, user.sub);
  if (!userSession) {
    return c.html(getSessionExpiredPage(), 403);
  }
  return c.html(getKwArchitecturePage());
});

/**
 * Cloudflare D1 ダッシュボード API
 * D1 データベース一覧と各テーブルの行数を返す
 */
app.get('/api/cf-dashboard/d1', authMiddleware, async (c) => {
  const token = c.env.CLOUDFLARE_API_TOKEN;
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    return jsonUtf8({ error: 'CLOUDFLARE_API_TOKEN または CLOUDFLARE_ACCOUNT_ID が未設定です', configured: false }, 200);
  }
  try {
    const databases = await listD1Databases(token, accountId);
    return jsonUtf8({ configured: true, databases });
  } catch (err) {
    return jsonUtf8({ error: err instanceof Error ? err.message : 'Unknown error', configured: true }, 500);
  }
});

app.get('/api/cf-dashboard/d1/:dbId/tables', authMiddleware, async (c) => {
  const token = c.env.CLOUDFLARE_API_TOKEN;
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    return jsonUtf8({ error: 'CLOUDFLARE_API_TOKEN または CLOUDFLARE_ACCOUNT_ID が未設定です' }, 503);
  }
  const dbId = c.req.param('dbId');
  try {
    const tables = await getD1Tables(token, accountId, dbId);
    return jsonUtf8({ tables });
  } catch (err) {
    return jsonUtf8({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

/**
 * Cloudflare D1 ダッシュボードページ（認証が必要）
 */
app.get('/cf-dashboard', authMiddleware, async (c) => {
  const user = c.get('user');
  const userSession = await getUserSession(c.env.DB, user.sub);
  if (!userSession) {
    return c.html(getSessionExpiredPage(), 403);
  }
  return c.html(getCfDashboardPage());
});

/**
 * API テスターページ（認証が必要）
 */
app.get('/apis', authMiddleware, async (c) => {
  const user = c.get('user');
  const userSession = await getUserSession(c.env.DB, user.sub);
  if (!userSession) {
    return c.html(getSessionExpiredPage(), 403);
  }
  return c.html(getApisPage());
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

  // カラムマイグレーション未適用チェック定義
  const REQUIRED_COLUMNS: { migration: string; table: string; column: string; sql: string }[] = [
    { migration: '0059', table: 'user_sessions', column: 'revoked_at',           sql: 'ALTER TABLE user_sessions ADD COLUMN revoked_at TEXT;' },
    { migration: '0060', table: 'user_sessions', column: 'idle_timeout_seconds', sql: 'ALTER TABLE user_sessions ADD COLUMN idle_timeout_seconds INTEGER;' },
    { migration: '0028', table: 'ai_summary_log', column: 'fallback_used',       sql: 'ALTER TABLE ai_summary_log ADD COLUMN fallback_used INTEGER DEFAULT 0;' },
    { migration: '0028', table: 'ai_summary_log', column: 'primary_model',      sql: 'ALTER TABLE ai_summary_log ADD COLUMN primary_model TEXT;' },
  ];

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
    pendingColumnMigrations: [],
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

    // カラムマイグレーション未適用チェック（PRAGMA table_info でカラム実在確認）
    try {
      const tableColumnCache: Record<string, Set<string>> = {};
      for (const req of REQUIRED_COLUMNS) {
        if (!tableColumnCache[req.table]) {
          const pragma = await db.prepare(`PRAGMA table_info(${req.table})`).all<{ name: string }>();
          tableColumnCache[req.table] = new Set((pragma.results ?? []).map(r => r.name));
        }
        if (!tableColumnCache[req.table].has(req.column)) {
          data.pendingColumnMigrations.push(req);
        }
      }
    } catch {
      // PRAGMA 失敗は無視
    }

    // 新テーブルを table_catalog へ自動登録（マイグレーション実行後の初回 /status ロードで反映）
    try {
      await autoRegisterTablesFromSqliteMaster(db, appliedMigrationNames);
    } catch {
      // table_catalog が存在しない等の場合は無視
    }

    // table_catalog を一次情報源としてテーブル一覧を取得（フォールバック: ハードコード定数）
    let effectiveTableDefs: Array<{ name: string; migration: string; description: string; syncPolicy: SyncPolicy }>;
    try {
      const catalogRows = await db.prepare(
        'SELECT table_name, migration, description, sync_policy FROM table_catalog ORDER BY display_order ASC, table_name ASC'
      ).all<{ table_name: string; migration: string; description: string; sync_policy: string }>();
      effectiveTableDefs = (catalogRows.results ?? []).map((r) => ({
        name: r.table_name,
        migration: r.migration,
        description: r.description,
        syncPolicy: normalizeSyncPolicy(r.sync_policy),
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
    let catalogRows: CatalogFunctionRow[] = [];
    let indexedFiles: string[] = [];

    if (selectedRepoId !== null && !isNaN(selectedRepoId)) {
      const [rowResult, fileResult, funcResult, catalogResult, indexedResult] = await Promise.all([
        db.prepare(`
          SELECT
            m.commit_at, m.commit_hash, m.commit_subject AS subject,
            m.file_path, m.function_name,
            COALESCE(f.purpose, '') AS purpose,
            m.change_type, m.lines_added, m.lines_deleted,
            i.impact_type, i.severity, i.contribution, i.notes,
            r.full_name AS repo_full_name
          FROM ts_function_activity_log m
          JOIN ts_repository r ON m.repo_id = r.id
          LEFT JOIN ts_function_catalog f
                 ON m.repo_id = f.repo_id AND m.file_path = f.file_path AND m.function_name = f.function_name
          LEFT JOIN ts_function_impact i
                 ON m.repo_id = i.repo_id AND m.commit_hash = i.commit_hash
                AND m.file_path = i.file_path AND m.function_name = i.function_name
          WHERE m.repo_id = ?
          ORDER BY m.commit_at DESC, m.file_path, m.function_name
          LIMIT 1000
        `).bind(selectedRepoId).all<FunctionChangeRow>(),
        db.prepare(
          `SELECT DISTINCT file_path FROM ts_function_catalog WHERE repo_id = ? ORDER BY file_path`
        ).bind(selectedRepoId).all<{ file_path: string }>(),
        db.prepare(
          `SELECT file_path, function_name, COALESCE(purpose,'') AS purpose FROM ts_function_catalog WHERE repo_id = ? ORDER BY file_path, function_name`
        ).bind(selectedRepoId).all<{ file_path: string; function_name: string; purpose: string }>(),
        db.prepare(`
          SELECT f.file_path, f.function_name, COALESCE(f.purpose,'') AS purpose,
            f.is_exported, f.is_async, f.start_line, f.end_line,
            COUNT(c.id) AS caller_count
          FROM ts_function_catalog f
          LEFT JOIN ts_function_callers c ON c.callee_id = f.id
          WHERE f.repo_id = ?
          GROUP BY f.id
          ORDER BY f.file_path, f.function_name
        `).bind(selectedRepoId).all<CatalogFunctionRow>(),
        db.prepare(
          `SELECT DISTINCT file_path FROM ts_function_catalog WHERE repo_id = ? AND start_line IS NOT NULL ORDER BY file_path`
        ).bind(selectedRepoId).all<{ file_path: string }>(),
      ]);
      rows = rowResult.results ?? [];
      availableFiles = (fileResult.results ?? []).map(r => r.file_path);
      availableFunctions = funcResult.results ?? [];
      catalogRows = catalogResult.results ?? [];
      indexedFiles = (indexedResult.results ?? []).map(r => r.file_path);
    }

    const html = getFunctionChangelogPage({
      rows,
      repos,
      selectedRepoId,
      availableFiles,
      availableFunctions,
      generatedAt: new Date().toISOString(),
      catalogRows,
      indexedFiles,
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
  const maxLinesStr  = c.req.query('max_lines');
  const maxLines: number | null =
    maxLinesStr === 'unlimited' || maxLinesStr === '0'
      ? null
      : maxLinesStr && !isNaN(parseInt(maxLinesStr, 10))
        ? parseInt(maxLinesStr, 10)
        : 10000;

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
    let startLine: number | null = null;
    let endLine: number | null = null;

    try {
      const row = await db.prepare(
        `SELECT COALESCE(purpose,'') AS purpose, source_snippet, start_line, end_line FROM ts_function_catalog
         WHERE repo_id = ? AND file_path = ? AND function_name = ? LIMIT 1`
      ).bind(repoId, filePath, functionName).first<{ purpose: string; source_snippet: string | null; start_line: number | null; end_line: number | null }>();
      purpose = row?.purpose ?? '';
      sourceSnippet = row?.source_snippet ?? null;
      startLine = row?.start_line ?? null;
      endLine = row?.end_line ?? null;
    } catch {
      const row = await db.prepare(
        `SELECT COALESCE(purpose,'') AS purpose, start_line, end_line FROM ts_function_catalog
         WHERE repo_id = ? AND file_path = ? AND function_name = ? LIMIT 1`
      ).bind(repoId, filePath, functionName).first<{ purpose: string; start_line: number | null; end_line: number | null }>();
      purpose = row?.purpose ?? '';
      sourceSnippet = null;
      startLine = row?.start_line ?? null;
      endLine = row?.end_line ?? null;
    }

    // source_snippet が未登録の場合は GitHub API からファイルを取得して抽出する
    if (sourceSnippet === null && repoFullName && filePath) {
      try {
        const user = c.get('user');
        const userSession = await getUserSession(db, user.sub);
        const accessToken = userSession?.githubAccessToken ?? user.github_access_token ?? undefined;
        if (accessToken) {
          const contentsUrl = `https://api.github.com/repos/${repoFullName}/contents/${filePath}`;
          const resp = await fetch(contentsUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3.raw',
              'User-Agent': 'cloudflare-workers-github-oauth',
            },
          });
          if (resp.ok) {
            const fileContent = await resp.text();
            sourceSnippet = extractFunctionSource(fileContent, functionName, maxLines);
          }
        }
      } catch {
        // GitHub 取得失敗は無視して github_url フォールバックを返す
      }
    }

    return c.json({
      ok: true,
      repo_id: repoId,
      file_path: filePath,
      function_name: functionName,
      purpose,
      source_snippet: sourceSnippet,
      start_line: startLine,
      end_line: endLine,
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
    c.executionCtx?.waitUntil(logWebhookEvent(c.env.DB, 'github', null, 'rejected', null, verification.reason));
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
  c.executionCtx?.waitUntil(logWebhookEvent(c.env.DB, 'github', eventType, 'ok', { action, deliveryId }));

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

    // 通知: GitHub App インストール変更（Slack/外部Workerの切替は NOTIFY_TARGET に従う）
    const installNotifyConfig = await resolveNotifyConfigWithSetting(c.env);
    if (isNotifyConfigured(installNotifyConfig)) {
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
        await dispatchNotification(installNotifyConfig, { text: slackText });
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
      const prNotifyConfig = await resolveNotifyConfigWithSetting(c.env);
      const ai = c.env.AI;
      const githubToken = c.env.GITHUB_TOKEN;

      if (!pr) {
        logger.warn('pull_request payload is missing pr object', { repoFullName });
      } else if (!isNotifyConfigured(prNotifyConfig)) {
        // 通知先未設定でもAI要約・DBへの記録は継続する（Slack依存を減らすための常時書き込み方式）
        logger.warn('Notification destination is not configured, skipping notification only (AI summary and DB logging still proceed)', {
          repoFullName,
          notifyTarget: prNotifyConfig.target,
        });
      }
      if (pr) {
        try {
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
          let commitAgentFetchError: unknown = null;
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
              commitAgentFetchError = error;
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
          if (isNotifyConfigured(prNotifyConfig)) {
            try {
              const slackResult = await dispatchNotification(prNotifyConfig, { text: slackPayload.text, blocks: slackPayload.blocks });
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

              // GITHUB_TOKEN失効時などにcommit_agent_logへの記録が静かに止まる問題を防ぐため、
              // コミット取得の失敗もai_summary_reviewsへ記録しD1から気づけるようにする
              if (commitAgentFetchError !== null) {
                const commitFetchDiagnosis = classifyCommitAgentFetchError(commitAgentFetchError);
                try {
                  await db.prepare(`
                    INSERT INTO ai_summary_reviews
                      (summary_request_id, rating, reviewer_type, reviewer_name, review_model, comment, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                  `).bind(
                    requestId,
                    commitFetchDiagnosis.rating,
                    'system',
                    'auto-diagnosis',
                    null,
                    commitFetchDiagnosis.comment,
                    now.toISOString(),
                  ).run();
                } catch (commitFetchLogError) {
                  logger.warn('Failed to insert commit-agent fetch diagnosis', {
                    error: commitFetchLogError instanceof Error ? commitFetchLogError.message : 'Unknown error',
                    requestId,
                  });
                }
              }
            } catch (error) {
              logger.error('Failed to insert ai_summary_log', {
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
              });
            }
          }
        } catch (unexpectedPrError) {
          const unexpectedPrErrorMessage = unexpectedPrError instanceof Error ? unexpectedPrError.message : 'Unknown error';
          logger.error('Unexpected error while processing pull_request webhook (opened/synchronize)', {
            error: unexpectedPrErrorMessage,
            prUrl: pr.html_url,
          });
          await logWebhookEvent(c.env.DB, 'github', eventType, 'error', { action, deliveryId, phase: 'pull_request_processing' }, unexpectedPrErrorMessage);
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
      const classifyOutcome = await runKeywordAutoClassification(c.env, user.sub, q, classifyDebugEnabled);
      autoLabel = classifyOutcome.autoLabel;
      classifyDebug = classifyOutcome.classifyDebug;
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

app.get('/api/repositories/search/keyword-classify-check', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  if (!db) return jsonUtf8({ error: 'Database not available' }, 500);
  const q = (c.req.query('q') ?? '').trim();
  if (!q || q.length < 2) {
    return jsonUtf8({ error: '2文字以上のキーワードを指定してください' }, 400);
  }
  const cookieHeader = c.req.header('Cookie');
  const classifyDebugEnabled = getCookieValues(cookieHeader, ['keyword_classify_debug'])['keyword_classify_debug'] === 'on';
  try {
    let row: { label: string; classify_status: string | null } | null = null;
    try {
      row = await db.prepare(
        `SELECT label, classify_status FROM commit_search_keyword_labels WHERE user_id = ? AND search_query = ?`
      ).bind(user.sub, q).first<{ label: string; classify_status: string | null }>();
    } catch {
      try {
        const legacy = await db.prepare(
          `SELECT label FROM commit_search_keyword_labels WHERE user_id = ? AND search_query = ?`
        ).bind(user.sub, q).first<{ label: string }>();
        row = legacy ? { label: legacy.label, classify_status: null } : null;
      } catch {
        row = null;
      }
    }
    const registered = row !== null;
    if (row && !shouldReclassifyKeyword(row)) {
      return jsonUtf8({ query: q, registered: true, skipped: true, label: row.label, autoLabel: null, classifyDebug: null });
    }
    if (!registered) {
      try {
        await db.prepare(
          `INSERT OR IGNORE INTO commit_search_keyword_labels (user_id, search_query, label, created_at, updated_at) VALUES (?, ?, 'uncategorized', datetime('now'), datetime('now'))`
        ).bind(user.sub, q).run();
      } catch (insertErr) {
        logger.warn('keyword classify check: insert failed', { query: q, error: insertErr instanceof Error ? insertErr.message : 'Unknown error' });
      }
    }
    const { autoLabel, classifyDebug } = await runKeywordAutoClassification(c.env, user.sub, q, classifyDebugEnabled);
    return jsonUtf8({ query: q, registered, skipped: false, label: autoLabel, autoLabel, classifyDebug });
  } catch (error) {
    logger.warn('keyword classify check failed', { query: q, error: error instanceof Error ? error.message : 'Unknown error' });
    return jsonUtf8({ error: '分類チェックに失敗しました' }, 500);
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
/**
 * Slackメンション/メッセージショートカットからのAI応答依頼を処理する共通処理。
 * トークン解決順序: D1のslack_installations（OAuthで動的取得したbotトークン）優先
 * → 環境変数SLACK_OAUTH_TOKENにフォールバック。
 * /slack/event（app_mention）と /slack/interactions（message_action）の両方から呼ばれる。
 */
/**
 * Slackの@メンション経由で得られたAI応答を、AIチャットページ(/aichat)から
 * 参照できるようai_chat_sharesへ保存する。Webのログイン認証を経由しない
 * (誰が投げたSlackメッセージかを本アプリのuser_idに直接紐づけられない)ため、
 * そのSlackワークスペースを最初にインストールしたユーザー
 * (slack_installations.installed_by_user)の持ち物として保存する。
 * 紐づくユーザーが見つからない場合は保存をスキップする(記録はlogger.warn、
 * 通知はSlack応答自体には影響させない付随機能のため、ここでは例外を投げない)。
 */
export async function saveSlackAiShare(
  db: D1Database,
  teamId: string | undefined,
  params: { question: string; answer: string; model: string; usage: AiUsage },
): Promise<void> {
  if (!teamId) {
    logger.warn('Slack AI reply save skipped: teamId is missing');
    return;
  }
  try {
    const owner = await db.prepare(
      'SELECT installed_by_user FROM slack_installations WHERE team_id = ?'
    ).bind(teamId).first<{ installed_by_user: string | null }>();
    const userId = owner?.installed_by_user;
    if (!userId) {
      logger.warn('Slack AI reply save skipped: no installed_by_user for team', { teamId });
      return;
    }

    const usernameBytes = new TextEncoder().encode(userId);
    const hashBuf = await crypto.subtle.digest('SHA-256', usernameBytes);
    const userHash = Array.from(new Uint8Array(hashBuf).slice(0, 4))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    const tokenBytes = new Uint8Array(8);
    crypto.getRandomValues(tokenBytes);
    const shareId = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const now = new Date().toISOString();
    const conversationHash = await computeConversationHash(userId, params.question, params.answer, params.model, now);
    const questionHash = await computeQuestionHash(userId, params.question);
    await db.prepare(
      'INSERT INTO ai_chat_shares (id, user_id, user_hash, question, answer, model, created_at, conversation_hash, question_hash, input_tokens, output_tokens, total_tokens, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      shareId, userId, userHash, params.question, params.answer, params.model, now,
      conversationHash, questionHash, params.usage.input_tokens, params.usage.output_tokens, params.usage.total_tokens, 'slack',
    ).run();
  } catch (err) {
    logger.warn('Slack AI reply save failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      teamId,
    });
  }
}

async function dispatchSlackAiReply(
  env: Bindings,
  task: SlackAiReplyTask
): Promise<void> {
  let slackToken = env.SLACK_OAUTH_TOKEN;
  const db = env.DB;
  if (db && task.teamId) {
    try {
      const row = await db.prepare(
        'SELECT access_token FROM slack_installations WHERE team_id = ?'
      ).bind(task.teamId).first<{ access_token: string }>();
      if (row?.access_token) {
        slackToken = row.access_token;
      }
    } catch (dbError) {
      logger.warn('Failed to look up Slack installation token, falling back to env', {
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        teamId: task.teamId,
      });
    }
  }

  const mentionResult = await handleSlackAppMention({
    text: task.text,
    channel: task.channel,
    threadTs: task.threadTs,
    slackToken,
    configuredModel: SLACK_AI_MODEL,
    aiRun: env.AI
      ? (model, params) => env.AI!.run(model as Parameters<typeof env.AI.run>[0], params as Parameters<typeof env.AI.run>[1])
      : () => Promise.reject(new Error('AI バインディングが未設定です')),
    postMessage: postSlackMessage,
    saveShare: db ? (params) => saveSlackAiShare(db, task.teamId, params) : undefined,
  });
  if (!mentionResult.posted) {
    logger.error('Slack AI reply failed', { error: mentionResult.error, channel: task.channel });
  }
}

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

  if (result.aiReplyTask) {
    c.executionCtx?.waitUntil(dispatchSlackAiReply(c.env, result.aiReplyTask));
  }

  return c.text('', 200);
});

/**
 * Slack Events API の受信エンドポイント。
 * Event Subscriptions 設定の Request URL 登録時に送られる url_verification に
 * challenge値を返して疎通確認する。それ以外のイベントは200で確認応答する。
 */
app.post('/slack/event', async (c) => {
  const rawBody = await c.req.text();

  const result = await handleSlackEvent({
    rawBody,
    timestamp: c.req.header('X-Slack-Request-Timestamp'),
    signature: c.req.header('X-Slack-Signature'),
    signingSecret: c.env.SLACK_SIGNING_SECRET,
    verifySignature: verifySlackSignature,
  });

  if (result.status === 401) {
    return c.text('', 401);
  }
  if (result.status === 400) {
    return c.text('', 400);
  }
  if (result.body) {
    return c.json(result.body, 200);
  }

  const mentionEvent = result.eventCallback?.event;
  if (mentionEvent && mentionEvent.type === 'app_mention' && !mentionEvent.bot_id && mentionEvent.channel) {
    c.executionCtx?.waitUntil(dispatchSlackAiReply(c.env, {
      text: mentionEvent.text ?? '',
      channel: mentionEvent.channel,
      threadTs: mentionEvent.thread_ts ?? mentionEvent.ts ?? '',
      teamId: result.eventCallback?.team_id,
    }));
  }

  return c.text('', 200);
});

/**
 * Slack スラッシュコマンドの受信エンドポイント。
 * Slack App の Slash Commands 設定で Request URL をこのパスに向け、
 * command フィールドで各コマンドにディスパッチする（今後コマンドが増えても1つのURLで済む）。
 */
app.post('/slack/commands', async (c) => {
  const rawBody = await c.req.text();
  const form = new URLSearchParams(rawBody);
  const command = form.get('command');

  if (command === '/pts') {
    const text = (form.get('text') || '').trim();
    const notifyConfig = await resolveNotifyConfigWithSetting(c.env);
    const sendNotification = (message: { text: string }) => dispatchNotification(notifyConfig, message);

    if (text.toLowerCase() === 'f1') {
      const result = await handleF1ScheduleSlashCommand({
        rawBody,
        timestamp: c.req.header('X-Slack-Request-Timestamp'),
        signature: c.req.header('X-Slack-Signature'),
        signingSecret: c.env.SLACK_SIGNING_SECRET,
        circuits: F1_CIRCUITS,
        now: new Date(),
        verifySignature: verifySlackSignature,
        sendNotification,
      });
      if (!result.body) {
        return c.text('', 401);
      }
      return c.json(result.body, 200);
    }

    const result = await handleTsubuyakiSlashCommand({
      rawBody,
      timestamp: c.req.header('X-Slack-Request-Timestamp'),
      signature: c.req.header('X-Slack-Signature'),
      signingSecret: c.env.SLACK_SIGNING_SECRET,
      verifySignature: verifySlackSignature,
      sendNotification,
    });
    if (!result.body) {
      return c.text('', 401);
    }
    return c.json(result.body, 200);
  }

  return c.json({ response_type: 'ephemeral', text: `未対応のコマンドです: ${command ?? '(不明)'}` }, 200);
});

/**
 * cf-auth.nekoflare.workers.dev からのwebhook受信エンドポイント
 * ログイン等のイベントを受け取りSlackへ通知する
 */
app.post('/webhook/cf-auth', async (c) => {
  const webhookSecret = c.env.CF_AUTH_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('CF_AUTH_WEBHOOK_SECRET is not configured');
    return c.json({ error: 'Webhook endpoint is not available' }, 500);
  }

  const rawBody = await c.req.text();
  const signatureHeader = c.req.header('X-Hub-Signature-256');

  const verification = await verifyGitHubWebhookSignature(rawBody, signatureHeader, webhookSecret);
  if (!verification.success) {
    logger.warn('Rejected cf-auth webhook', { reason: verification.reason });
    c.executionCtx?.waitUntil(logWebhookEvent(c.env.DB, 'cf-auth', null, 'rejected', null, verification.reason));
    return c.json({ error: 'Unauthorized webhook' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return c.json({ error: 'Invalid webhook payload' }, 400);
  }

  const event = typeof payload.event === 'string' ? payload.event : 'unknown';
  const usernameFromPayload = extractCfAuthUsername(payload);
  const user = usernameFromPayload ?? 'unknown';
  const action = typeof payload.action === 'string' ? payload.action : '';

  logger.info('cf-auth webhook received', { event, user, action });
  c.executionCtx?.waitUntil(logWebhookEvent(c.env.DB, 'cf-auth', event, 'ok', { user, action }));

  // ユーザー名が特定できない場合はアクセス権限を判定できないためNG
  if (!usernameFromPayload) {
    logger.warn('cf-auth webhook payload missing username', { event, action });
    c.executionCtx?.waitUntil(
      logCfAuthAccessResult(c.env.DB, user, event, action, 'NG', 'username not found in payload')
    );
    return c.json({ result: 'NG', reason: 'username not found in payload' }, 400);
  }

  const userSession = await getUserSession(c.env.DB, usernameFromPayload);
  const hasAccess = userSession !== null;

  logger.info('cf-auth access check result', { user: usernameFromPayload, hasAccess });
  c.executionCtx?.waitUntil(
    logCfAuthAccessResult(
      c.env.DB,
      usernameFromPayload,
      event,
      action,
      hasAccess ? 'OK' : 'NG',
      hasAccess ? undefined : 'user_sessions に登録がありません'
    )
  );

  const cfAuthNotifyConfig = await resolveNotifyConfigWithSetting(c.env);
  if (isNotifyConfigured(cfAuthNotifyConfig)) {
    const lines = [
      `cf-auth: ${event}${action ? ' / ' + action : ''}`,
      `ユーザー: ${user}`,
      `アクセス権限判定: ${hasAccess ? 'OK' : 'NG'}`,
    ];
    const extra = Object.entries(payload)
      .filter(([k]) => !['event', 'action', 'user', 'username', 'login', 'email'].includes(k))
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    if (extra.length > 0) lines.push(...extra.slice(0, 5));

    try {
      await dispatchNotification(cfAuthNotifyConfig, { text: lines.join('\n') });
    } catch (error) {
      logger.error('Slack notification failed for cf-auth webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.json({ result: hasAccess ? 'OK' : 'NG', user: usernameFromPayload });
});

/**
 * Resend webhookのペイロード検証・重複排除・通知・ログ記録を行う共通処理。
 * sourceIdがnull（/webhook/resend からの呼び出し）の場合はresend_webhook_sourcesに依存しない
 * 単一アカウント運用として扱い、resend_webhook_log.source_idはNULLで記録される。
 */
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

async function handleResendWebhookCore(
  c: AppContext,
  sourceId: string | null,
  webhookSecret: string
) {
  const logSourceLabel = sourceId ?? 'default';
  const rawBody = await c.req.text();

  const verification = await verifyResendWebhookSignature(rawBody, {
    id: c.req.header('svix-id'),
    timestamp: c.req.header('svix-timestamp'),
    signature: c.req.header('svix-signature'),
  }, webhookSecret);

  if (!verification.success) {
    logger.warn('Rejected Resend webhook', {
      reason: verification.reason,
      sourceId: logSourceLabel,
      path: c.req.path,
      method: c.req.method,
    });
    c.executionCtx?.waitUntil(logWebhookEvent(c.env.DB, `resend:${logSourceLabel}`, null, 'rejected', null, verification.reason));
    return c.json({ error: 'Unauthorized webhook' }, 401);
  }

  const resendEventId = c.req.header('svix-id')?.trim();
  if (resendEventId) {
    const dedupKey = `${logSourceLabel}:${resendEventId}`;
    const nowMs = Date.now();
    const dedupTtlSeconds = resolveResendDedupTtlSeconds(c.env.RESEND_WEBHOOK_DEDUP_TTL_SECONDS);
    const expiresAt = nowMs + dedupTtlSeconds * 1000;

    for (const [key, expiry] of resendWebhookDedupCache.entries()) {
      if (expiry <= nowMs) {
        resendWebhookDedupCache.delete(key);
      }
    }

    if (resendWebhookDedupCache.has(dedupKey)) {
      logger.warn('Duplicate Resend webhook detected', { sourceId: logSourceLabel, resendEventId });
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
  c.executionCtx?.waitUntil(logWebhookEvent(c.env.DB, `resend:${logSourceLabel}`, eventType, 'ok', null));

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

  const resendNotifyConfig = await resolveNotifyConfigWithSetting(c.env);

  const deliveryStatus = eventType === 'email.delivered'
    ? '送信完了'
    : (eventType === 'email.failed' || eventType === 'email.bounced' ? '失敗' : null);

  let slackResultText: string | null = null;
  let slackResultAt: string | null = null;

  if (deliveryStatus) {
    if (!isNotifyConfigured(resendNotifyConfig)) {
      logger.error('Slack notification skipped due to missing configuration', {
        notifyTarget: resendNotifyConfig.target,
      });
      slackResultText = 'skipped:missing_config';
      slackResultAt = new Date().toISOString();
    } else {
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

        const slackResult = await dispatchNotification(resendNotifyConfig, { text: slackText });

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
  const db = c.env.DB;
  if (!db) {
    logger.error('Database is not available for resend_webhook_log insert', {
      sourceId: logSourceLabel,
      svixId,
      eventType,
    });
  } else {
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
        sourceId: logSourceLabel,
        svixId,
        eventType,
      });
    }
  }

  if (proxyFailed && eventType !== 'email.delivered') {
    return c.json({ error: 'Failed to notify proxy target' }, 502);
  }

  return c.json({ success: true, event: eventType }, 200);
}

/**
 * Resend webhook受信用エンドポイント（複数ソース管理向け、D1のresend_webhook_sourcesでソースを識別）
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

  return handleResendWebhookCore(c, sourceId, webhookSecret);
});

/**
 * Resend webhook受信用エンドポイント（sourceId省略・単一アカウント向け）
 * RESEND_WEBHOOK_SECRET環境変数のみで署名検証する。resend_webhook_log.source_idはNULLで記録される。
 */
app.post('/webhook/resend', async (c) => {
  const webhookSecret = c.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('Resend webhook secret is not configured');
    return c.json({ error: 'Webhook endpoint is not available' }, 500);
  }

  return handleResendWebhookCore(c, null, webhookSecret);
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
        'POST /api/uuid/save',
        'GET /api/uuid/search',
        'DELETE /api/uuid/history',
        'GET /api/uuid/count',
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
    const user = c.get('user');
    const { count } = await c.req.json();
    const num = parseInt(count, 10);

    if (isNaN(num) || num < 5 || num > 100) {
      return c.json({ error: '表示件数は5〜100の範囲で指定してください' }, 400);
    }

    await updateUserSettings(c.env.DB, user.sub, 'recent_commits_count', String(num));
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
    const user = c.get('user');
    const { duration } = await c.req.json();
    const num = parseInt(duration, 10);

    if (isNaN(num) || num < 1 || num > 60) {
      return c.json({ error: 'トースト表示時間は1〜60秒の範囲で指定してください' }, 400);
    }

    await updateUserSettings(c.env.DB, user.sub, 'toast_duration', String(num));
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
 * アイドルタイムアウト設定変更
 */
app.post('/api/settings/idle-timeout', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!c.env.DB) return c.json({ error: 'DBが利用できません' }, 503);
    const { idleTimeoutSeconds } = await c.req.json() as { idleTimeoutSeconds: number | null };
    if (idleTimeoutSeconds !== null && (typeof idleTimeoutSeconds !== 'number' || !Number.isFinite(idleTimeoutSeconds) || idleTimeoutSeconds < 0)) {
      return c.json({ error: 'idleTimeoutSeconds は正の整数またはnullを指定してください' }, 400);
    }
    await c.env.DB.prepare(
      'UPDATE user_sessions SET idle_timeout_seconds = ? WHERE user_id = ?'
    ).bind(idleTimeoutSeconds ?? null, user.sub).run();
    return c.json({ ok: true, idleTimeoutSeconds });
  } catch (error) {
    const user = c.get('user');
    logger.error('Idle timeout update error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'アイドルタイムアウトの変更に失敗しました' }, 500);
  }
});

/**
 * Slack通知ON/OFFのユーザーオプション設定(デフォルトOFF)を変更する。
 */
app.post('/api/settings/slack-notify', authMiddleware, async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: 'DBが利用できません' }, 503);
    const { enabled } = await c.req.json() as { enabled: unknown };
    if (typeof enabled !== 'boolean') {
      return c.json({ error: 'enabled はboolean値で指定してください' }, 400);
    }
    await c.env.DB.prepare(
      `INSERT INTO notification_settings (id, slack_enabled, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET slack_enabled = excluded.slack_enabled, updated_at = excluded.updated_at`
    ).bind(enabled ? 1 : 0, new Date().toISOString()).run();
    return c.json({ ok: true, enabled });
  } catch (error) {
    logger.error('Slack notify setting update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'Slack通知設定の変更に失敗しました' }, 500);
  }
});

/**
 * Slack通知ON/OFFの現在値を返す。cf-authアプリ等の外部サービスから参照できるよう、
 * ログインCookieではなくCF_AUTH_WEBHOOK_SECRETの共有シークレットで認証する。
 */
app.get('/api/settings/slack-notify', async (c) => {
  const secret = c.env.CF_AUTH_WEBHOOK_SECRET;
  const authHeader = c.req.header('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!secret || !bearer || bearer !== secret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const enabled = await isSlackNotifyEnabled(c.env.DB);
  return c.json({ enabled });
});

/**
 * OAuthログイン時のメール確認ゲート(EVP)ON/OFFユーザーオプション(デフォルトOFF)。
 * ONにするとログインの都度Resend経由の確認メール+リンククリックが必須になるため、
 * Resend側の障害等でメールが届かない場合にログイン不能になりうる。
 * デフォルトOFFで、設定ページから明示的にONにした場合のみ有効になる。
 */
app.post('/api/settings/email-confirm-login', authMiddleware, async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: 'DBが利用できません' }, 503);
    const { enabled } = await c.req.json() as { enabled: unknown };
    if (typeof enabled !== 'boolean') {
      return c.json({ error: 'enabled はboolean値で指定してください' }, 400);
    }
    await c.env.DB.prepare(
      `INSERT INTO notification_settings (id, email_confirm_login_enabled, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email_confirm_login_enabled = excluded.email_confirm_login_enabled, updated_at = excluded.updated_at`
    ).bind(enabled ? 1 : 0, new Date().toISOString()).run();
    return c.json({ ok: true, enabled });
  } catch (error) {
    logger.error('Email confirm login gate setting update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'ログイン確認メールゲート設定の変更に失敗しました' }, 500);
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

app.post('/api/settings/aichat-auto-vectorize-enabled', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();
    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な設定値です' }, 400);
    }
    c.header('Set-Cookie', `${AUTO_VECTORIZE_ENABLED_COOKIE}=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: 'キーワードの自動ベクタ化設定を変更しました', mode }, 200);
  } catch {
    return c.json({ error: 'キーワードの自動ベクタ化設定の変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/aichat-prefer-moondream', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();
    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な設定値です' }, 400);
    }
    c.header('Set-Cookie', `${AICHAT_PREFER_MOONDREAM_COOKIE}=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: '画像添付時にmoondreamを優先する設定を変更しました', mode }, 200);
  } catch {
    return c.json({ error: '画像添付時にmoondreamを優先する設定の変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/answer-graph-hide-empty-rows', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();
    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な設定値です' }, 400);
    }
    c.header('Set-Cookie', `${ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE}=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: 'answer-graphの空行非表示設定を変更しました', mode }, 200);
  } catch {
    return c.json({ error: 'answer-graphの空行非表示設定の変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/answer-graph-trail-session-storage', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();
    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な設定値です' }, 400);
    }
    c.header('Set-Cookie', `${ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE}=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: 'answer-graphのパン屑リストのsessionStorage保存設定を変更しました', mode }, 200);
  } catch {
    return c.json({ error: 'answer-graphのパン屑リストのsessionStorage保存設定の変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/aichat-auto-vectorize-model', authMiddleware, async (c) => {
  try {
    const { model } = await c.req.json();
    if (typeof model !== 'string' || !(KEYWORD_EMBEDDING_MODELS as string[]).includes(model)) {
      return c.json({ error: '無効なモデルです' }, 400);
    }
    c.header('Set-Cookie', `${AUTO_VECTORIZE_MODEL_COOKIE}=${model}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: '自動ベクタ化に使う埋め込みモデルを変更しました', model }, 200);
  } catch {
    return c.json({ error: '自動ベクタ化に使う埋め込みモデルの変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/apis-sidebar-open', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();
    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な値です' }, 400);
    }
    c.header('Set-Cookie', `user_apis_sidebar_open=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: 'APIページサイドバー設定を変更しました', mode }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('APIs sidebar open setting error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'APIページサイドバー設定の変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/apis-sidebar-accordion', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();
    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な値です' }, 400);
    }
    c.header('Set-Cookie', `user_apis_sidebar_accordion=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: 'APIページアコーディオン設定を変更しました', mode }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('APIs sidebar accordion setting error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'APIページアコーディオン設定の変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/apis-desc-mode', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();
    if (mode !== 'on' && mode !== 'off') {
      return c.json({ error: '無効な値です' }, 400);
    }
    c.header('Set-Cookie', `user_apis_desc_mode=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: 'APIページ表示モード設定を変更しました', mode }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('APIs desc mode setting error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'APIページ表示モード設定の変更に失敗しました' }, 500);
  }
});

app.post('/api/settings/apis-nav-flash', authMiddleware, async (c) => {
  try {
    const { mode } = await c.req.json();
    const valid = mode === 'off' || /^[0-9]+$/.test(mode);
    if (!valid) {
      return c.json({ error: '無効な値です' }, 400);
    }
    c.header('Set-Cookie', `user_apis_nav_flash=${mode}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`);
    return c.json({ message: 'ナビバー点滅設定を変更しました', mode }, 200);
  } catch (error) {
    const user = c.get('user');
    logger.error('APIs nav flash setting error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'ナビバー点滅設定の変更に失敗しました' }, 500);
  }
});

app.get('/api/search-keywords', authMiddleware, async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: 'DBが利用できません' }, 503);
    const rows = await c.env.DB.prepare(
      `SELECT id, keyword, total_count, section_count, recorded_at FROM api_search_keywords ORDER BY total_count DESC, recorded_at DESC LIMIT 20`
    ).all();
    return c.json({ keywords: rows.results ?? [] });
  } catch (error) {
    return c.json({ error: '取得に失敗しました' }, 500);
  }
});

app.post('/api/search-keywords', authMiddleware, async (c) => {
  try {
    const { keyword, totalCount, sections } = await c.req.json() as {
      keyword: string;
      totalCount: number;
      sections: { name: string; count: number }[];
    };
    if (!keyword || typeof totalCount !== 'number' || !Array.isArray(sections)) {
      return c.json({ error: '無効なリクエストです' }, 400);
    }
    if (!c.env.DB) return c.json({ error: 'DBが利用できません' }, 503);
    const hitSections = sections.filter(s => s.count > 0);
    const result = await c.env.DB.prepare(
      `INSERT INTO api_search_keywords (keyword, total_count, section_count, recorded_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).bind(keyword.trim(), totalCount, hitSections.length).run();
    const keywordId = result.meta.last_row_id;
    if (hitSections.length > 0) {
      const stmts = hitSections.map(s =>
        c.env.DB!.prepare(
          `INSERT INTO api_search_keyword_sections (keyword_id, section_name, count) VALUES (?, ?, ?)`
        ).bind(keywordId, s.name, s.count)
      );
      await c.env.DB.batch(stmts);
    }
    return c.json({ id: keywordId, keyword: keyword.trim(), totalCount, sectionCount: hitSections.length }, 201);
  } catch (error) {
    const user = c.get('user');
    logger.error('Search keyword save error', {
      userId: user?.sub,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: '検索キーワードの登録に失敗しました' }, 500);
  }
});

app.delete('/api/search-keywords/:id', authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: '無効なIDです' }, 400);
    if (!c.env.DB) return c.json({ error: 'DBが利用できません' }, 503);
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM api_search_keyword_sections WHERE keyword_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM api_search_keywords WHERE id = ?').bind(id),
    ]);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: '削除に失敗しました' }, 500);
  }
});

app.post('/api/admin/revoke-session', authMiddleware, async (c) => {
  const actor = c.get('user');
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DBが利用できません' }, 503);
  let body: { userId?: unknown; reason?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'JSONの解析に失敗しました' }, 400);
  }
  const validation = validateRevokeRequest(body as { userId: unknown; reason?: unknown });
  if (!validation.ok) return c.json({ error: validation.error }, 400);
  const targetUserId = (body.userId as string).trim();
  const reason = typeof body.reason === 'string' ? body.reason.trim() : null;
  const revokedAt = new Date().toISOString();
  const result = await db.prepare(
    'UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'
  ).bind(revokedAt, targetUserId).run();
  if (result.meta.changes === 0) {
    return c.json({ error: 'セッションが見つからないか既にrevoke済みです' }, 404);
  }
  const revokeNotifyConfig = await resolveNotifyConfigWithSetting(c.env);
  if (isNotifyConfigured(revokeNotifyConfig)) {
    dispatchNotification(revokeNotifyConfig, {
      text: `[管理操作] セッション強制revoke\n対象ユーザー: ${targetUserId}\n操作者: ${actor.sub}\n理由: ${reason ?? '（未記入）'}`,
    }).catch(() => {});
  }
  return c.json({ ok: true, revokedAt, targetUserId, reason });
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
