-- TypeScript 関数コミット影響分析スキーマ
-- 対象リポジトリ: cloudflare-workers-github-oauth-1
-- 設計日: 2026-05-31
--
-- 目標: 「どのコミットがどの関数を変更し、アプリの振る舞いにどう影響したか」を
--       集計・可視化できるデータ基盤を構築する。
--       将来的には「コミット粒度・ブランチタイミング・機能割り振り」の評価にも拡張する。
--
-- テーブル構成:
--   1. ts_function_catalog      - 関数の定義情報（マスター）
--   2. ts_commit_log            - コミットメタデータ（マスター）
--   3. ts_commit_function_map   - コミット↔関数の多対多関係（コアリレーション）
--   4. ts_function_impact       - 関数ごとの振る舞い影響評価（アノテーション）
--   5. ts_commit_quality        - コミット粒度・品質評価（アノテーション）

------------------------------------------------------------------------
-- 1. ts_function_catalog
--    関数の定義情報マスター。コミット履歴とは分離する。
--    「この関数が何をするか」の静的情報のみ保持。
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_function_catalog (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path       TEXT NOT NULL,
  function_name   TEXT NOT NULL,
  purpose         TEXT NOT NULL,
  is_exported     INTEGER NOT NULL DEFAULT 1,  -- 1=export, 0=internal
  is_async        INTEGER NOT NULL DEFAULT 0,  -- 1=async function
  first_commit_hash TEXT,                      -- 関数が初めて登場したコミット
  first_commit_at   TEXT,                      -- 関数の初出日 (YYYY-MM-DD)
  is_deleted      INTEGER NOT NULL DEFAULT 0,  -- 削除済み関数の論理フラグ
  deleted_at      TEXT,
  recorded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(file_path, function_name)
);

CREATE INDEX IF NOT EXISTS idx_tfc_file ON ts_function_catalog(file_path);
CREATE INDEX IF NOT EXISTS idx_tfc_name ON ts_function_catalog(function_name);

------------------------------------------------------------------------
-- 2. ts_commit_log
--    コミット1件ごとのメタデータ。git log から取り込む。
--    「何が・いつ・どのブランチで・どのPRから変更されたか」を記録。
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_commit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_hash     TEXT NOT NULL UNIQUE,
  commit_at       TEXT NOT NULL,               -- コミット日時 (ISO8601)
  author_email    TEXT,
  branch_name     TEXT,                        -- マージ前のブランチ名（取得可能な場合）
  pr_number       INTEGER,                     -- 関連PRナンバー（コミットメッセージから抽出）
  subject         TEXT NOT NULL,               -- コミットメッセージの件名
  body            TEXT,                        -- コミットメッセージの本文
  files_changed   INTEGER,                     -- 変更ファイル数
  insertions      INTEGER,                     -- 追加行数合計
  deletions       INTEGER,                     -- 削除行数合計
  is_merge_commit INTEGER NOT NULL DEFAULT 0,  -- マージコミットフラグ
  recorded_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tcl_commit_at ON ts_commit_log(commit_at);
CREATE INDEX IF NOT EXISTS idx_tcl_pr ON ts_commit_log(pr_number);
CREATE INDEX IF NOT EXISTS idx_tcl_branch ON ts_commit_log(branch_name);

------------------------------------------------------------------------
-- 3. ts_commit_function_map
--    コミット↔関数の多対多リレーション。
--    「このコミットはどの関数を変更したか」「この関数は何回変更されたか」
--    を集計するためのコアテーブル。
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_commit_function_map (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_hash     TEXT NOT NULL REFERENCES ts_commit_log(commit_hash),
  file_path       TEXT NOT NULL,
  function_name   TEXT NOT NULL,
  change_type     TEXT NOT NULL CHECK(change_type IN ('add','modify','delete')),
  lines_added     INTEGER NOT NULL DEFAULT 0,
  lines_deleted   INTEGER NOT NULL DEFAULT 0,
  recorded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(commit_hash, file_path, function_name)
);

CREATE INDEX IF NOT EXISTS idx_tcfm_commit ON ts_commit_function_map(commit_hash);
CREATE INDEX IF NOT EXISTS idx_tcfm_func   ON ts_commit_function_map(file_path, function_name);
CREATE INDEX IF NOT EXISTS idx_tcfm_type   ON ts_commit_function_map(change_type);

------------------------------------------------------------------------
-- 4. ts_function_impact
--    コミット単位での「振る舞いへの影響」評価。
--    手動レビューまたはAIアノテーションで投入する。
--
--    impact_type の定義:
--      feature    - 新機能追加
--      bugfix     - バグ修正（正の影響）
--      regression - デグレード（負の影響）
--      refactor   - 振る舞い変更なしのリファクタ
--      perf       - パフォーマンス改善
--      test       - テスト追加・修正（間接的な品質向上）
--      docs       - ドキュメント・コメントのみ
--      chore      - 設定・ビルドのみ（アプリ振る舞いへの影響なし）
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_function_impact (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_hash     TEXT NOT NULL REFERENCES ts_commit_log(commit_hash),
  file_path       TEXT NOT NULL,
  function_name   TEXT NOT NULL,
  impact_type     TEXT NOT NULL CHECK(impact_type IN (
                    'feature','bugfix','regression','refactor',
                    'perf','test','docs','chore'
                  )),
  severity        INTEGER NOT NULL DEFAULT 2 CHECK(severity BETWEEN 1 AND 5),
  -- severity: 1=trivial, 2=minor, 3=moderate, 4=major, 5=critical
  contribution    INTEGER NOT NULL DEFAULT 3 CHECK(contribution BETWEEN 1 AND 5),
  -- contribution: 1=negative, 2=low, 3=neutral, 4=positive, 5=high-positive
  notes           TEXT,
  evaluator       TEXT NOT NULL DEFAULT 'manual',
  -- evaluator: 'manual' | 'auto-ai' | 'auto-test' など
  evaluated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tfi_commit   ON ts_function_impact(commit_hash);
CREATE INDEX IF NOT EXISTS idx_tfi_func     ON ts_function_impact(file_path, function_name);
CREATE INDEX IF NOT EXISTS idx_tfi_type     ON ts_function_impact(impact_type);
CREATE INDEX IF NOT EXISTS idx_tfi_contrib  ON ts_function_impact(contribution);

------------------------------------------------------------------------
-- 5. ts_commit_quality
--    コミット粒度・ブランチ切りタイミング・機能割り振りの評価。
--    「すべてのコミットに対してコミット粒度やブランチを切るタイミングや
--    機能の割り振り方までをも評価」するための拡張テーブル。
--
--    granularity_score の基準（自動計算の目安）:
--      5 = 1関数/1目的に集中（理想的なアトミックコミット）
--      4 = 2-3関数、単一の機能単位
--      3 = 複数ファイルだが一貫した目的
--      2 = 複数の無関係な変更が混在
--      1 = 大量の変更・目的が不明瞭
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_commit_quality (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_hash           TEXT NOT NULL UNIQUE REFERENCES ts_commit_log(commit_hash),
  functions_touched     INTEGER NOT NULL DEFAULT 0,  -- このコミットで触った関数数
  files_touched         INTEGER NOT NULL DEFAULT 0,  -- このコミットで触ったファイル数
  granularity_score     INTEGER CHECK(granularity_score BETWEEN 1 AND 5),
  -- コミットがアトミックかどうかの評価
  is_atomic             INTEGER,  -- 1=単一目的, 0=複数目的が混在
  branch_was_needed     INTEGER,  -- 1=ブランチを切るべき変更量だった, 0=直pushで適切
  branch_timing_note    TEXT,     -- ブランチを切るタイミングの評価メモ
  feature_allocation    TEXT,     -- 機能割り振りの評価（「認証・UI・データ層が混在」等）
  evaluator             TEXT NOT NULL DEFAULT 'manual',
  evaluated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tcq_score ON ts_commit_quality(granularity_score);

------------------------------------------------------------------------
-- 参照用ビュー: 関数ごとのコミット回数・最終影響サマリ
------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_function_commit_summary AS
SELECT
  f.file_path,
  f.function_name,
  f.purpose,
  f.is_exported,
  f.is_async,
  COUNT(DISTINCT m.commit_hash)        AS total_commits,
  SUM(m.lines_added)                   AS total_lines_added,
  SUM(m.lines_deleted)                 AS total_lines_deleted,
  MAX(cl.commit_at)                    AS last_modified_at,
  SUM(CASE WHEN i.impact_type = 'bugfix'     THEN 1 ELSE 0 END) AS bugfix_count,
  SUM(CASE WHEN i.impact_type = 'regression' THEN 1 ELSE 0 END) AS regression_count,
  SUM(CASE WHEN i.impact_type = 'feature'    THEN 1 ELSE 0 END) AS feature_count,
  AVG(i.contribution)                  AS avg_contribution
FROM ts_function_catalog f
LEFT JOIN ts_commit_function_map m
  ON f.file_path = m.file_path AND f.function_name = m.function_name
LEFT JOIN ts_commit_log cl ON m.commit_hash = cl.commit_hash
LEFT JOIN ts_function_impact i
  ON m.commit_hash = i.commit_hash
  AND f.file_path = i.file_path
  AND f.function_name = i.function_name
GROUP BY f.file_path, f.function_name;

------------------------------------------------------------------------
-- 参照用ビュー: コミットごとの品質サマリ（粒度・影響タイプ分布）
------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_commit_quality_summary AS
SELECT
  cl.commit_hash,
  cl.commit_at,
  cl.subject,
  cl.branch_name,
  cl.pr_number,
  cl.files_changed,
  cl.insertions,
  cl.deletions,
  cq.functions_touched,
  cq.granularity_score,
  cq.is_atomic,
  cq.branch_was_needed,
  COUNT(DISTINCT i.function_name)      AS functions_with_impact,
  SUM(CASE WHEN i.impact_type = 'bugfix'     THEN 1 ELSE 0 END) AS bugfixes,
  SUM(CASE WHEN i.impact_type = 'regression' THEN 1 ELSE 0 END) AS regressions,
  SUM(CASE WHEN i.impact_type = 'feature'    THEN 1 ELSE 0 END) AS features,
  AVG(i.contribution)                  AS avg_contribution
FROM ts_commit_log cl
LEFT JOIN ts_commit_quality cq ON cl.commit_hash = cq.commit_hash
LEFT JOIN ts_function_impact i ON cl.commit_hash = i.commit_hash
GROUP BY cl.commit_hash;

------------------------------------------------------------------------
-- ts_function_catalog の初期データ投入（161関数）
------------------------------------------------------------------------
INSERT OR IGNORE INTO ts_function_catalog
  (file_path, function_name, purpose, is_exported, is_async, first_commit_hash, first_commit_at)
VALUES
  ('src/utils/cookie.ts','getCookieValue','Cookieヘッダから指定キーの値を1件取得する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/cookie.ts','getCookieValues','Cookieヘッダから複数キーの値をまとめて取得する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/html.ts','escapeHtml','HTMLの特殊文字をエンティティにエスケープする',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/returnTo.ts','validateReturnTo','リダイレクト先URLが許可範囲内か検証する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/session.ts','getSessionDurationSeconds','セッション有効期間（秒）を設定から取得する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/session.ts','renewSession','JWTセッションを更新して新しいCookieをセットする',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/slackSignature.ts','verifySlackSignature','Slack Webhookのリクエスト署名を検証する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/slackInteraction.ts','handleSlackInteraction','SlackインタラクションペイロードをD1に記録する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/githubWebhook.ts','verifyGitHubWebhookSignature','GitHub WebhookのHMAC-SHA256署名を検証する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/repoValidation.ts','validateRepoName','GitHubリポジトリ名のフォーマットを検証する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/repoValidation.ts','isTokenOrPermissionError','GitHub APIエラーがトークン・権限由来かを判定する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/repoValidation.ts','executeCreateRepo','GitHubリポジトリを作成してレスポンスを返す',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/commitAgentLog.ts','hasText','文字列が実質的なテキストを含むかを判定する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/commitAgentLog.ts','buildCommitAgentLogEntry','commit_agent_logへの挿入レコードを組み立てる',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/logger.ts','log','任意レベルのログを構造化出力する基底関数',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/logger.ts','debug','DEBUGレベルのログを出力する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/logger.ts','info','INFOレベルのログを出力する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/logger.ts','warn','WARNレベルのログを出力する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/logger.ts','error','ERRORレベルのログを出力する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/logger.ts','recordMetric','パフォーマンス指標をメトリクスとして記録する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/jwt.ts','base64UrlEncode','バイト列をBase64URL形式にエンコードする',0,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/jwt.ts','base64UrlDecode','Base64URL文字列をバイト列にデコードする',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/jwt.ts','getKey','JWT署名用のCryptoKeyをインポートする',0,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/jwt.ts','createJWT','ペイロードからHS256署名済みJWTを生成する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/jwt.ts','verifyJWT','JWTを検証してペイロードを返す（無効時はnull）',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/jwt.ts','extractBearerToken','AuthorizationヘッダからBearerトークンを抽出する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/slack.ts','parseSlackResponse','SlackAPIレスポンスJSONを型付きで解析する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/slack.ts','fetchSlackApi','Slack Web APIを呼び出してレスポンスを返す',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/slack.ts','postSlackMessage','Slackチャンネルにメッセージを投稿する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/slack.ts','openSlackModal','Slack Modalを新規オープンする',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/slack.ts','updateSlackModal','既存のSlack Modalを更新する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/slack.ts','respondToInteraction','Slackインタラクションに即時レスポンスを返す',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/theme.ts','getThemeCSS','ダーク/ライトモード用CSSを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/theme.ts','getThemeInitScript','ページロード時にテーマを即時適用するスクリプトを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/theme.ts','getThemeToggleHTML','テーマ切替ボタンのHTMLを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/theme.ts','getThemeToggleCSS','テーマ切替ボタン用CSSを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/theme.ts','getThemeToggleScript','テーマ切替ボタンのクリックイベント処理スクリプトを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/workspace.ts','getCurrentWorkspace','現在のワークスペース情報をD1から取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/workspace.ts','getUserWorkspaces','ユーザーが所属するワークスペース一覧を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/workspace.ts','ensureDefaultWorkspace','デフォルトワークスペースが存在しなければ作成する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/workspace.ts','switchWorkspace','アクティブなワークスペースを切り替える',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/workspace.ts','generateId','ランダムなIDを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/columnRelationStats.ts','aggregateColumnTables','カラム名ごとにテーブル集合を集計する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/columnRelationStats.ts','countRelationsByColumnName','カラム名ごとのFK関係数をカウントする',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/columnRelationStats.ts','computeColumnRelationStats','カラムのリレーション統計情報を計算して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/columnRelationStats.ts','getMultiTableColumns','複数テーブルに存在するカラム名一覧を返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/columnRelationStats.ts','findMissingRelations','FK定義が抜けているカラムの組み合わせを検出する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/columnRelationStats.ts','verifyColumnStats','カラム統計の整合性を検証してレポートを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','resolveAiModel','環境変数からAIモデル名を解決してフォールバックする',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','describeModelSwitch','モデル切替の理由説明文字列を生成する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','fetchPrDiff','GitHub APIからPRのdiffを取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','detectVersion','diffテキストからバージョン番号を検出する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','detectCommitAgentFromText','テキストからコミットエージェント起動を検出する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','detectCommitAgentFromPrText','PRテキスト全体からコミットエージェントを検出する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','generateAiSummary','Cloudflare AI APIでPRの要約テキストを生成する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','classifySummaryResult','AI要約結果を分類タグ付きで返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','runSummaryPipeline','PR要約の全パイプライン（取得→生成→保存）を実行する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','sanitizeBoxDrawing','ボックス描画文字を除去してテキストを正規化する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','extractDesignDiff','diffから設計変更に関する差分を抽出する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','buildSlackMessage','AI要約結果からSlackメッセージブロックを生成する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','buildSummaryModal','AI要約結果のSlackモーダルViewを構築する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/aiSummary.ts','buildSummaryFallbackBlocks','要約失敗時のSlackフォールバックブロックを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/middleware/auth.ts','getToken','リクエストからJWTトークン文字列を取得する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/middleware/auth.ts','parseTimestampMs','秒またはミリ秒のタイムスタンプをミリ秒に正規化する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/middleware/auth.ts','authMiddleware','JWT認証を強制するHonoミドルウェア',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/middleware/auth.ts','optionalAuthMiddleware','認証を試みるが未認証でも続行するミドルウェア',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/types.ts','resolveIdleTimeoutSeconds','アイドルタイムアウト秒数を環境変数から解決する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/resendWebhook.ts','parseResendWebhookPayload','Resend WebhookペイロードをJSONとして解析する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/resendWebhook.ts','classifyBounceType','バウンスタイプを分類して文字列を返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/resendWebhook.ts','buildWebhookLogEntry','Webhook受信ログのD1挿入レコードを組み立てる',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/resendWebhook.ts','shouldSuppressEmail','バウンス等でメール送信を抑制すべきか判定する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/resendWebhook.ts','updateSuppressionList','メール抑制リストをD1に保存・更新する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/resendWebhook.ts','recordEmailAuditAnomaly','メール監査の異常をD1に記録する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/login.ts','getLoginPage','ログインページのHTMLを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/session-expired.ts','getSessionExpiredPage','セッション期限切れページのHTMLを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/userinfo.ts','getUserInfoPage','ユーザー情報ページのHTMLを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/welcome.ts','getWelcomePage','ウェルカムページのHTMLを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/columnStats.ts','escapeHtml','HTMLの特殊文字をエスケープする（ビュー内ローカル版）',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/columnStats.ts','renderColumnStatsHtml','カラム統計ページのHTMLを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/aichat-share.ts','getAiChatSharePage','AIチャット共有リンクの閲覧ページHTMLを返す',1,0,'c0cb3f72ac70b189534c0b1c9674bd1f6b07122e','2026-05-30'),
  ('src/views/aichat-share.ts','getAiChatShareNotFoundPage','AIチャット共有リンクが無い場合の404ページを返す',1,0,'c0cb3f72ac70b189534c0b1c9674bd1f6b07122e','2026-05-30'),
  ('src/views/markdown-preview.ts','getMarkdownPreviewPage','Markdownプレビューページのe HTMLを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/markdown-preview.ts','greet','挨拶文字列を返すユーティリティ（開発用）',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/settings.ts','getSettingsPage','設定ページのHTMLを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/aichat.ts','getAiChatPage','AIチャットページのHTMLを生成して返す',1,0,'045488138e8b0f7cbff62da9766cb6ae1c8c7c48','2026-05-30'),
  ('src/views/repositories.ts','getRepositoriesPage','リポジトリ一覧・検索履歴ページのHTMLを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/status.ts','resolveTableStatus','exists/rowCountからテーブルの3状態を判定する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/status.ts','renderTableStatusBadge','テーブル状態に対応するHTMLバッジ文字列を返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/views/status.ts','getCacheStatusPage','ステータス・DBキャッシュ画面のHTMLを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubAccessToken','GitHub OAuthコードをアクセストークンに交換する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubUser','アクセストークンでGitHubユーザー情報を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubUserEmail','GitHub APIからユーザーのプライマリEmailを取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubUserRepos','ユーザーがアクセス可能なリポジトリ一覧を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','createGitHubRepo','GitHub APIで新しいリポジトリを作成する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubLatestCommit','リポジトリの最新コミット情報を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','parseLinkHeaderForLastPage','LinkヘッダからGitHub APIの最終ページ番号を解析する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubCommitCount','リポジトリの総コミット数をLinkヘッダから推定する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubCommits','リポジトリのコミット一覧をページネーション付きで取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubRepoOpenIssuesCount','リポジトリのオープンIssue数を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','githubApiHeaders','GitHub API呼び出し用の共通ヘッダを組み立てる',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubUserInstallations','ユーザーのGitHub Appインストール一覧を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubUserInstallationsWithDiag','インストール一覧を診断情報付きで取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubInstallationRepos','インストール配下のリポジトリ一覧を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','buildRepoInstallationPermissionsMap','リポジトリごとのインストール権限マップを構築する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubTokenScopes','アクセストークンのOAuthスコープ一覧を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','computeCommitStats','コミット一覧から追加/削除行数の統計を計算する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','sumCountsTotal','複数コミット統計の合計値を集計する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','buildPastMonthRange','過去N月の開始/終了日時を構築する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubRepoInfo','リポジトリの基本情報をGitHub APIから取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubCommitsForStats','統計計算用のコミット一覧を日付範囲で取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','findInstallationByExactSlugs','スラグ完全一致でGitHub Appインストールを検索する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getLinkedReposByAppSlugs','AppスラグでリンクされたリポジトリをD1から取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getCloudflareLinkedRepos','Cloudflare Workers連携済みリポジトリを取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getVercelLinkedRepos','Vercel連携済みリポジトリを取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getExternalServiceLinkedRepos','外部サービス連携済みリポジトリ一覧を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','formatJstDateKey','DateをJST基準のYYYYMMDD形式文字列に変換する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getJstMonthRange','JST基準で指定年月の開始/終了Dateを返す',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getJstDayRange','JST基準で指定日の開始/終了Dateを返す',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubRepoCommitsByMonth','リポジトリの月別コミット一覧をGitHub APIから取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','toClientCommit','GitHub APIのコミットオブジェクトをクライアント用に変換する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubRepoCommitsByDate','指定日のリポジトリコミット一覧を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubRepoRecentCommits','リポジトリの最近のコミット一覧を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getGitHubRepoTotalCommitCount','リポジトリの総コミット数を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getRepoWebhooks','リポジトリのWebhook一覧をGitHub APIから取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','isWebhookUrlMatchingHosts','WebhookURLが指定ホスト群と一致するか判定する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/utils/github.ts','getSlackLinkedReposByWebhooks','Slack Webhook設定でリンクされたリポジトリを取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','ensureGroupTable','keyword_category_groupsテーブルを冪等に作成・補完する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','jsonUtf8','UTF-8 JSON Responseオブジェクトを生成して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','resolveCommitHistoryPageSize','コミット履歴の1ページあたり件数を環境変数から解決する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','generateOAuthState','GitHub OAuthのCSRF防止用stateパラメータを生成する',0,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','base64UrlEncode','バイト列をBase64URL形式にエンコードする（index版）',0,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','generatePkcePair','OAuth PKCEのcodeVerifier/challengeペアを生成する',0,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','resolveResendDedupTtlSeconds','Resendメール重複排除TTLを環境変数から解決する',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','normalizeGitHubApiMessage','GitHub APIエラーメッセージを正規化して返す',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','formatTimestampWithTimezone','UNIXタイムスタンプをタイムゾーン付き文字列にフォーマットする',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','mergeColumnsFromRows','D1クエリ結果のcolumns+rowsを配列オブジェクトに変換する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','getColumnKeyType','テーブル・カラム名からPK/FK/UK/IDXのキー種別を返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','isAiSummaryLinkColumn','カラムがAI要約リンクとして表示すべきかを判定する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','isFilterableColumn','カラムがフィルタ可能かを判定する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','getFilterableColumns','テーブルのフィルタ可能カラム一覧を返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','resolveLogicalFkTargetCol','FK参照先カラム名を論理的に解決して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','mergeFkTargetsFromDb','D1からFKターゲット情報を読み込んでマージする',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','buildGroupErData','グループ別ER図データを構築して返す',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','getStatusTableDefinition','テーブル名でステータス定義オブジェクトを取得する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','getEffectiveStatusTableDefinitions','有効なステータステーブル定義一覧を返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','inferMigrationFromAppliedNames','適用済みマイグレーション名からSQL文を推定する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','inferGroupFromTableName','テーブル名からグループ名を推定する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','getStatusTablePreviewQuery','ステータス画面用テーブルプレビュークエリを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','buildKeywordClassificationPrompt','キーワード分類AIプロンプト文字列を生成する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','pickBestLabelFromResponse','AIレスポンスから最適なラベルを選択して返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','classifyKeywordWithAI','Cloudflare AIでキーワードをラベル分類する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','buildPreviewQueryFromTemplate','テンプレートからD1プレビュークエリを生成する',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','autoRegisterTablesFromSqliteMaster','sqlite_masterから未登録テーブルをtable_catalogに自動登録する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','getStatusTableQueryExample','テーブルのプレビュークエリ例オブジェクトを返す',1,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','getJstYearMonthParts','DateをJST基準の年・月に分解して返す',0,0,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','updateUserSession','ユーザーセッション情報をD1に保存・更新する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','getUserSession','ユーザーセッション情報をD1から取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','updateUserSettings','ユーザー設定（テーマ等）をD1に保存・更新する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','getInstallationPermissionsFromD1','D1からGitHub Appインストール権限情報を取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','loadSchemaRelations','D1からDBスキーマのFKリレーション情報を読み込む',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14'),
  ('src/index.ts','fetchLatestPrCommitInfo','PRの最新コミット情報をGitHub APIから取得する',1,1,'9c895b3f3959f850663115ff95906ead46411010','2026-04-14');
