# TypeScript 関数一覧

**対象リポジトリ**: `cloudflare-workers-github-oauth-1`
**生成日**: 2026-05-31
**対象**: `src/` 配下の実装ファイル（`.test.ts` 除外）のエクスポート・トップレベル関数

---

## テーブル

| # | ファイル | 関数名 | 主目的・機能 | ファイル作成日 | ファイル更新日 | 最新コミット内容 |
|---|---|---|---|---|---|---|
| 1 | `src/utils/cookie.ts` | `getCookieValue` | Cookieヘッダから指定キーの値を1件取得する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 2 | `src/utils/cookie.ts` | `getCookieValues` | Cookieヘッダから複数キーの値をまとめて取得する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 3 | `src/utils/html.ts` | `escapeHtml` | HTMLの特殊文字をエンティティにエスケープする | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 4 | `src/utils/returnTo.ts` | `validateReturnTo` | リダイレクト先URLが許可範囲内か検証する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 5 | `src/utils/session.ts` | `getSessionDurationSeconds` | セッション有効期間（秒）を設定から取得する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 6 | `src/utils/session.ts` | `renewSession` | JWTセッションを更新して新しいCookieをセットする | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 7 | `src/utils/slackSignature.ts` | `verifySlackSignature` | Slack Webhookのリクエスト署名を検証する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 8 | `src/utils/slackInteraction.ts` | `handleSlackInteraction` | SlackインタラクションペイロードをD1に記録する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 9 | `src/utils/githubWebhook.ts` | `verifyGitHubWebhookSignature` | GitHub WebhookのHMAC-SHA256署名を検証する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 10 | `src/utils/repoValidation.ts` | `validateRepoName` | GitHubリポジトリ名のフォーマットを検証する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 11 | `src/utils/repoValidation.ts` | `isTokenOrPermissionError` | GitHub APIエラーがトークン・権限由来かを判定する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 12 | `src/utils/repoValidation.ts` | `executeCreateRepo` | GitHubリポジトリを作成してレスポンスを返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 13 | `src/utils/commitAgentLog.ts` | `hasText` | 文字列が実質的なテキストを含むかを判定する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 14 | `src/utils/commitAgentLog.ts` | `buildCommitAgentLogEntry` | commit_agent_logへの挿入レコードを組み立てる | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 15 | `src/utils/logger.ts` | `log` | 任意レベルのログを構造化出力する基底関数 | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 16 | `src/utils/logger.ts` | `debug` | DEBUGレベルのログを出力する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 17 | `src/utils/logger.ts` | `info` | INFOレベルのログを出力する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 18 | `src/utils/logger.ts` | `warn` | WARNレベルのログを出力する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 19 | `src/utils/logger.ts` | `error` | ERRORレベルのログを出力する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 20 | `src/utils/logger.ts` | `recordMetric` | パフォーマンス指標をメトリクスとして記録する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 21 | `src/utils/jwt.ts` | `base64UrlEncode` | バイト列をBase64URL形式にエンコードする | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 22 | `src/utils/jwt.ts` | `base64UrlDecode` | Base64URL文字列をバイト列にデコードする | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 23 | `src/utils/jwt.ts` | `getKey` | JWT署名用のCryptoKeyをインポートする | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 24 | `src/utils/jwt.ts` | `createJWT` | ペイロードからHS256署名済みJWTを生成する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 25 | `src/utils/jwt.ts` | `verifyJWT` | JWTを検証してペイロードを返す（無効時はnull） | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 26 | `src/utils/jwt.ts` | `extractBearerToken` | AuthorizationヘッダからBearerトークンを抽出する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 27 | `src/utils/slack.ts` | `parseSlackResponse` | SlackAPIレスポンスJSONを型付きで解析する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 28 | `src/utils/slack.ts` | `fetchSlackApi` | Slack Web APIを呼び出してレスポンスを返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 29 | `src/utils/slack.ts` | `postSlackMessage` | Slackチャンネルにメッセージを投稿する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 30 | `src/utils/slack.ts` | `openSlackModal` | Slack Modalを新規オープンする | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 31 | `src/utils/slack.ts` | `updateSlackModal` | 既存のSlack Modalを更新する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 32 | `src/utils/slack.ts` | `respondToInteraction` | Slackインタラクションに即時レスポンスを返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 33 | `src/utils/theme.ts` | `getThemeCSS` | ダーク/ライトモード用CSSを返す | 2026-04-14 | 2026-05-30 | ダークモードをデフォルトONに変更・AIチャットページのコントラスト改善 |
| 34 | `src/utils/theme.ts` | `getThemeInitScript` | ページロード時にテーマを即時適用するスクリプトを返す | 2026-04-14 | 2026-05-30 | ダークモードをデフォルトONに変更・AIチャットページのコントラスト改善 |
| 35 | `src/utils/theme.ts` | `getThemeToggleHTML` | テーマ切替ボタンのHTMLを返す | 2026-04-14 | 2026-05-30 | ダークモードをデフォルトONに変更・AIチャットページのコントラスト改善 |
| 36 | `src/utils/theme.ts` | `getThemeToggleCSS` | テーマ切替ボタン用CSSを返す | 2026-04-14 | 2026-05-30 | ダークモードをデフォルトONに変更・AIチャットページのコントラスト改善 |
| 37 | `src/utils/theme.ts` | `getThemeToggleScript` | テーマ切替ボタンのクリックイベント処理スクリプトを返す | 2026-04-14 | 2026-05-30 | ダークモードをデフォルトONに変更・AIチャットページのコントラスト改善 |
| 38 | `src/utils/workspace.ts` | `getCurrentWorkspace` | 現在のワークスペース情報をD1から取得する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 39 | `src/utils/workspace.ts` | `getUserWorkspaces` | ユーザーが所属するワークスペース一覧を取得する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 40 | `src/utils/workspace.ts` | `ensureDefaultWorkspace` | デフォルトワークスペースが存在しなければ作成する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 41 | `src/utils/workspace.ts` | `switchWorkspace` | アクティブなワークスペースを切り替える | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 42 | `src/utils/workspace.ts` | `generateId` | ランダムなIDを生成して返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 43 | `src/utils/columnRelationStats.ts` | `aggregateColumnTables` | カラム名ごとにテーブル集合を集計する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 44 | `src/utils/columnRelationStats.ts` | `countRelationsByColumnName` | カラム名ごとのFK関係数をカウントする | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 45 | `src/utils/columnRelationStats.ts` | `computeColumnRelationStats` | カラムのリレーション統計情報を計算して返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 46 | `src/utils/columnRelationStats.ts` | `getMultiTableColumns` | 複数テーブルに存在するカラム名一覧を返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 47 | `src/utils/columnRelationStats.ts` | `findMissingRelations` | FK定義が抜けているカラムの組み合わせを検出する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 48 | `src/utils/columnRelationStats.ts` | `verifyColumnStats` | カラム統計の整合性を検証してレポートを返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 49 | `src/utils/aiSummary.ts` | `resolveAiModel` | 環境変数からAIモデル名を解決してフォールバックする | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 50 | `src/utils/aiSummary.ts` | `describeModelSwitch` | モデル切替の理由説明文字列を生成する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 51 | `src/utils/aiSummary.ts` | `fetchPrDiff` | GitHub APIからPRのdiffを取得する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 52 | `src/utils/aiSummary.ts` | `detectVersion` | diffテキストからバージョン番号を検出する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 53 | `src/utils/aiSummary.ts` | `detectCommitAgentFromText` | テキストからコミットエージェント起動を検出する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 54 | `src/utils/aiSummary.ts` | `detectCommitAgentFromPrText` | PRテキスト全体からコミットエージェントを検出する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 55 | `src/utils/aiSummary.ts` | `generateAiSummary` | Cloudflare AI APIでPRの要約テキストを生成する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 56 | `src/utils/aiSummary.ts` | `classifySummaryResult` | AI要約結果を分類タグ付きで返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 57 | `src/utils/aiSummary.ts` | `runSummaryPipeline` | PR要約の全パイプライン（取得→生成→保存）を実行する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 58 | `src/utils/aiSummary.ts` | `sanitizeBoxDrawing` | ボックス描画文字を除去してテキストを正規化する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 59 | `src/utils/aiSummary.ts` | `extractDesignDiff` | diffから設計変更に関する差分を抽出する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 60 | `src/utils/aiSummary.ts` | `buildSlackMessage` | AI要約結果からSlackメッセージブロックを生成する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 61 | `src/utils/aiSummary.ts` | `buildSummaryModal` | AI要約結果のSlackモーダルViewを構築する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 62 | `src/utils/aiSummary.ts` | `buildSummaryFallbackBlocks` | 要約失敗時のSlackフォールバックブロックを返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 63 | `src/middleware/auth.ts` | `getToken` | リクエストからJWTトークン文字列を取得する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 64 | `src/middleware/auth.ts` | `parseTimestampMs` | 秒またはミリ秒のタイムスタンプをミリ秒に正規化する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 65 | `src/middleware/auth.ts` | `authMiddleware` | JWT認証を強制するHonoミドルウェア | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 66 | `src/middleware/auth.ts` | `optionalAuthMiddleware` | 認証を試みるが未認証でも続行するミドルウェア | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 67 | `src/types.ts` | `resolveIdleTimeoutSeconds` | アイドルタイムアウト秒数を環境変数から解決する | 2026-04-14 | 2026-05-30 | AIチャットページの追加とナビメニューへの追加 |
| 68 | `src/utils/resendWebhook.ts` | `parseResendWebhookPayload` | Resend WebhookペイロードをJSONとして解析する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 69 | `src/utils/resendWebhook.ts` | `classifyBounceType` | バウンスタイプを分類して文字列を返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 70 | `src/utils/resendWebhook.ts` | `buildWebhookLogEntry` | Webhook受信ログのD1挿入レコードを組み立てる | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 71 | `src/utils/resendWebhook.ts` | `shouldSuppressEmail` | バウンス等でメール送信を抑制すべきか判定する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 72 | `src/utils/resendWebhook.ts` | `updateSuppressionList` | メール抑制リストをD1に保存・更新する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 73 | `src/utils/resendWebhook.ts` | `recordEmailAuditAnomaly` | メール監査の異常をD1に記録する | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 74 | `src/views/login.ts` | `getLoginPage` | ログインページのHTMLを生成して返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 75 | `src/views/session-expired.ts` | `getSessionExpiredPage` | セッション期限切れページのHTMLを返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 76 | `src/views/userinfo.ts` | `getUserInfoPage` | ユーザー情報ページのHTMLを生成して返す | 2026-04-14 | 2026-05-30 | AIチャットページの追加とナビメニューへの追加 |
| 77 | `src/views/welcome.ts` | `getWelcomePage` | ウェルカムページのHTMLを生成して返す | 2026-04-14 | 2026-05-30 | ウェルカムページのナビにAIチャットを追加（漏れ修正） |
| 78 | `src/views/columnStats.ts` | `escapeHtml` | HTMLの特殊文字をエスケープする（ビュー内ローカル版） | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 79 | `src/views/columnStats.ts` | `renderColumnStatsHtml` | カラム統計ページのHTMLを生成して返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 80 | `src/views/aichat-share.ts` | `getAiChatSharePage` | AIチャット共有リンクの閲覧ページHTMLを返す | 2026-05-30 | 2026-05-30 | AIチャット共有リンク機能を追加 |
| 81 | `src/views/aichat-share.ts` | `getAiChatShareNotFoundPage` | AIチャット共有リンクが無い場合の404ページを返す | 2026-05-30 | 2026-05-30 | AIチャット共有リンク機能を追加 |
| 82 | `src/views/markdown-preview.ts` | `getMarkdownPreviewPage` | Markdownプレビューページのe HTMLを生成して返す | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 83 | `src/views/markdown-preview.ts` | `greet` | 挨拶文字列を返すユーティリティ（開発用） | 2026-04-14 | 2026-04-14 | Merge pull request #253 from nekoserver/claude/fix-er-diagram-code-PCDtf |
| 84 | `src/views/settings.ts` | `getSettingsPage` | 設定ページのHTMLを生成して返す | 2026-04-14 | 2026-05-30 | AIチャット: サイドバーの余白タップ閉じを設定ページで制御できるようにする |
| 85 | `src/views/aichat.ts` | `getAiChatPage` | AIチャットページのHTMLを生成して返す | 2026-05-30 | 2026-05-30 | AIチャット: サイドバーの余白タップ閉じを設定ページで制御できるようにする |
| 86 | `src/views/repositories.ts` | `getRepositoriesPage` | リポジトリ一覧・検索履歴ページのHTMLを生成して返す | 2026-04-14 | 2026-05-31 | renderGroupList: ラベル変更・キーワード数表示・降順ソート |
| 87 | `src/views/status.ts` | `resolveTableStatus` | exists/rowCountからテーブルの3状態を判定する | 2026-04-14 | 2026-05-31 | /status テーブル一覧のレコード数列をクリックで昇順/降順ソート可能にする |
| 88 | `src/views/status.ts` | `renderTableStatusBadge` | テーブル状態に対応するHTMLバッジ文字列を返す | 2026-04-14 | 2026-05-31 | /status テーブル一覧のレコード数列をクリックで昇順/降順ソート可能にする |
| 89 | `src/views/status.ts` | `getCacheStatusPage` | ステータス・DBキャッシュ画面のHTMLを生成して返す | 2026-04-14 | 2026-05-31 | /status テーブル一覧のレコード数列をクリックで昇順/降順ソート可能にする |
| 90 | `src/utils/github.ts` | `getGitHubAccessToken` | GitHub OAuthコードをアクセストークンに交換する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 91 | `src/utils/github.ts` | `getGitHubUser` | アクセストークンでGitHubユーザー情報を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 92 | `src/utils/github.ts` | `getGitHubUserEmail` | GitHub APIからユーザーのプライマリEmailを取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 93 | `src/utils/github.ts` | `getGitHubUserRepos` | ユーザーがアクセス可能なリポジトリ一覧を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 94 | `src/utils/github.ts` | `createGitHubRepo` | GitHub APIで新しいリポジトリを作成する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 95 | `src/utils/github.ts` | `getGitHubLatestCommit` | リポジトリの最新コミット情報を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 96 | `src/utils/github.ts` | `parseLinkHeaderForLastPage` | LinkヘッダからGitHub APIの最終ページ番号を解析する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 97 | `src/utils/github.ts` | `getGitHubCommitCount` | リポジトリの総コミット数をLinkヘッダから推定する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 98 | `src/utils/github.ts` | `getGitHubCommits` | リポジトリのコミット一覧をページネーション付きで取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 99 | `src/utils/github.ts` | `getGitHubRepoOpenIssuesCount` | リポジトリのオープンIssue数を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 100 | `src/utils/github.ts` | `githubApiHeaders` | GitHub API呼び出し用の共通ヘッダを組み立てる | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 101 | `src/utils/github.ts` | `getGitHubUserInstallations` | ユーザーのGitHub Appインストール一覧を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 102 | `src/utils/github.ts` | `getGitHubUserInstallationsWithDiag` | インストール一覧を診断情報付きで取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 103 | `src/utils/github.ts` | `getGitHubInstallationRepos` | インストール配下のリポジトリ一覧を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 104 | `src/utils/github.ts` | `buildRepoInstallationPermissionsMap` | リポジトリごとのインストール権限マップを構築する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 105 | `src/utils/github.ts` | `getGitHubTokenScopes` | アクセストークンのOAuthスコープ一覧を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 106 | `src/utils/github.ts` | `computeCommitStats` | コミット一覧から追加/削除行数の統計を計算する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 107 | `src/utils/github.ts` | `sumCountsTotal` | 複数コミット統計の合計値を集計する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 108 | `src/utils/github.ts` | `buildPastMonthRange` | 過去N月の開始/終了日時を構築する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 109 | `src/utils/github.ts` | `getGitHubRepoInfo` | リポジトリの基本情報をGitHub APIから取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 110 | `src/utils/github.ts` | `getGitHubCommitsForStats` | 統計計算用のコミット一覧を日付範囲で取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 111 | `src/utils/github.ts` | `findInstallationByExactSlugs` | スラグ完全一致でGitHub Appインストールを検索する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 112 | `src/utils/github.ts` | `getLinkedReposByAppSlugs` | AppスラグでリンクされたリポジトリをD1から取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 113 | `src/utils/github.ts` | `getCloudflareLinkedRepos` | Cloudflare Workers連携済みリポジトリを取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 114 | `src/utils/github.ts` | `getVercelLinkedRepos` | Vercel連携済みリポジトリを取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 115 | `src/utils/github.ts` | `getExternalServiceLinkedRepos` | 外部サービス連携済みリポジトリ一覧を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 116 | `src/utils/github.ts` | `formatJstDateKey` | DateをJST基準のYYYYMMDD形式文字列に変換する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 117 | `src/utils/github.ts` | `getJstMonthRange` | JST基準で指定年月の開始/終了Dateを返す | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 118 | `src/utils/github.ts` | `getJstDayRange` | JST基準で指定日の開始/終了Dateを返す | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 119 | `src/utils/github.ts` | `getGitHubRepoCommitsByMonth` | リポジトリの月別コミット一覧をGitHub APIから取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 120 | `src/utils/github.ts` | `toClientCommit` | GitHub APIのコミットオブジェクトをクライアント用に変換する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 121 | `src/utils/github.ts` | `getGitHubRepoCommitsByDate` | 指定日のリポジトリコミット一覧を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 122 | `src/utils/github.ts` | `getGitHubRepoRecentCommits` | リポジトリの最近のコミット一覧を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 123 | `src/utils/github.ts` | `getGitHubRepoTotalCommitCount` | リポジトリの総コミット数を取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 124 | `src/utils/github.ts` | `getRepoWebhooks` | リポジトリのWebhook一覧をGitHub APIから取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 125 | `src/utils/github.ts` | `isWebhookUrlMatchingHosts` | WebhookURLが指定ホスト群と一致するか判定する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 126 | `src/utils/github.ts` | `getSlackLinkedReposByWebhooks` | Slack Webhook設定でリンクされたリポジトリを取得する | 2026-04-14 | 2026-05-21 | コミット履歴の日時「不明」表示を修正しキャッシュ済みリポジトリ数を表示 |
| 127 | `src/index.ts` | `ensureGroupTable` | keyword_category_groupsテーブルを冪等に作成・補完する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 128 | `src/index.ts` | `jsonUtf8` | UTF-8 JSON Responseオブジェクトを生成して返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 129 | `src/index.ts` | `resolveCommitHistoryPageSize` | コミット履歴の1ページあたり件数を環境変数から解決する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 130 | `src/index.ts` | `generateOAuthState` | GitHub OAuthのCSRF防止用stateパラメータを生成する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 131 | `src/index.ts` | `base64UrlEncode` | バイト列をBase64URL形式にエンコードする（index版） | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 132 | `src/index.ts` | `generatePkcePair` | OAuth PKCEのcodeVerifier/challengeペアを生成する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 133 | `src/index.ts` | `resolveResendDedupTtlSeconds` | Resendメール重複排除TTLを環境変数から解決する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 134 | `src/index.ts` | `normalizeGitHubApiMessage` | GitHub APIエラーメッセージを正規化して返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 135 | `src/index.ts` | `formatTimestampWithTimezone` | UNIXタイムスタンプをタイムゾーン付き文字列にフォーマットする | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 136 | `src/index.ts` | `mergeColumnsFromRows` | D1クエリ結果のcolumns+rowsを配列オブジェクトに変換する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 137 | `src/index.ts` | `getColumnKeyType` | テーブル・カラム名からPK/FK/UK/IDXのキー種別を返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 138 | `src/index.ts` | `isAiSummaryLinkColumn` | カラムがAI要約リンクとして表示すべきかを判定する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 139 | `src/index.ts` | `isFilterableColumn` | カラムがフィルタ可能かを判定する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 140 | `src/index.ts` | `getFilterableColumns` | テーブルのフィルタ可能カラム一覧を返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 141 | `src/index.ts` | `resolveLogicalFkTargetCol` | FK参照先カラム名を論理的に解決して返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 142 | `src/index.ts` | `mergeFkTargetsFromDb` | D1からFKターゲット情報を読み込んでマージする | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 143 | `src/index.ts` | `buildGroupErData` | グループ別ER図データを構築して返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 144 | `src/index.ts` | `getStatusTableDefinition` | テーブル名でステータス定義オブジェクトを取得する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 145 | `src/index.ts` | `getEffectiveStatusTableDefinitions` | 有効なステータステーブル定義一覧を返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 146 | `src/index.ts` | `inferMigrationFromAppliedNames` | 適用済みマイグレーション名からSQL文を推定する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 147 | `src/index.ts` | `inferGroupFromTableName` | テーブル名からグループ名を推定する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 148 | `src/index.ts` | `getStatusTablePreviewQuery` | ステータス画面用テーブルプレビュークエリを返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 149 | `src/index.ts` | `buildKeywordClassificationPrompt` | キーワード分類AIプロンプト文字列を生成する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 150 | `src/index.ts` | `pickBestLabelFromResponse` | AIレスポンスから最適なラベルを選択して返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 151 | `src/index.ts` | `classifyKeywordWithAI` | Cloudflare AIでキーワードをラベル分類する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 152 | `src/index.ts` | `buildPreviewQueryFromTemplate` | テンプレートからD1プレビュークエリを生成する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 153 | `src/index.ts` | `autoRegisterTablesFromSqliteMaster` | sqlite_masterから未登録テーブルをtable_catalogに自動登録する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 154 | `src/index.ts` | `getStatusTableQueryExample` | テーブルのプレビュークエリ例オブジェクトを返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 155 | `src/index.ts` | `getJstYearMonthParts` | DateをJST基準の年・月に分解して返す | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 156 | `src/index.ts` | `updateUserSession` | ユーザーセッション情報をD1に保存・更新する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 157 | `src/index.ts` | `getUserSession` | ユーザーセッション情報をD1から取得する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 158 | `src/index.ts` | `updateUserSettings` | ユーザー設定（テーマ等）をD1に保存・更新する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 159 | `src/index.ts` | `getInstallationPermissionsFromD1` | D1からGitHub Appインストール権限情報を取得する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 160 | `src/index.ts` | `loadSchemaRelations` | D1からDBスキーマのFKリレーション情報を読み込む | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |
| 161 | `src/index.ts` | `fetchLatestPrCommitInfo` | PRの最新コミット情報をGitHub APIから取得する | 2026-04-14 | 2026-05-31 | 全GETエンドポイントでensureGroupTable()を事前呼び出しに変更 |

---

## 集計

| ファイル | 関数数 |
|---|---|
| `src/utils/github.ts` | 37 |
| `src/index.ts` | 35 |
| `src/utils/aiSummary.ts` | 14 |
| `src/utils/slack.ts` | 6 |
| `src/utils/logger.ts` | 6 |
| `src/utils/jwt.ts` | 6 |
| `src/utils/resendWebhook.ts` | 6 |
| `src/utils/columnRelationStats.ts` | 6 |
| `src/utils/theme.ts` | 5 |
| `src/utils/workspace.ts` | 5 |
| `src/middleware/auth.ts` | 4 |
| `src/utils/repoValidation.ts` | 3 |
| `src/views/status.ts` | 3 |
| `src/utils/cookie.ts` | 2 |
| `src/utils/session.ts` | 2 |
| `src/utils/commitAgentLog.ts` | 2 |
| `src/views/columnStats.ts` | 2 |
| `src/views/aichat-share.ts` | 2 |
| `src/views/markdown-preview.ts` | 2 |
| `src/utils/html.ts` | 1 |
| `src/utils/returnTo.ts` | 1 |
| `src/utils/slackSignature.ts` | 1 |
| `src/utils/slackInteraction.ts` | 1 |
| `src/utils/githubWebhook.ts` | 1 |
| `src/types.ts` | 1 |
| `src/views/login.ts` | 1 |
| `src/views/session-expired.ts` | 1 |
| `src/views/userinfo.ts` | 1 |
| `src/views/welcome.ts` | 1 |
| `src/views/settings.ts` | 1 |
| `src/views/aichat.ts` | 1 |
| `src/views/repositories.ts` | 1 |
| **合計** | **161** |
