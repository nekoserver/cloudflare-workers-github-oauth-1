# テスト計画 (cloudflare-workers-github-oauth)

## 1. 目的
GitHub OAuth + JWT 認証を中心にした Cloudflare Workers 実装の品質を保証する。特に以下を重視する。
- 認証/認可フローの正当性
- セッション管理 (Cookie, D1) の整合性
- 外部連携 (GitHub/Resend/Slack) の失敗時挙動
- セキュリティヘッダー/CSRF/署名検証
- API/HTML のユーザー体験

## 2. 対象範囲
- Workers ルーティング/ハンドラ (`src/index.ts`)
- 認証ミドルウェア (`src/middleware/auth.ts`)
- ユーティリティ (`src/utils/*.ts`)
- D1 マイグレーション (`migrations/*.sql`)

## 3. 非対象 (Out of Scope)
- Cloudflare WAF のレートリミット設定検証
- GitHub/Slack/Resend 側のサービス品質
- UI の細かなデザイン・アクセシビリティ評価 (別途UIレビューで実施)

## 4. テスト環境
- ローカル: `wrangler dev` + `.dev.vars`
- D1: ローカル D1 とリモート D1 の双方
- 外部サービス:
  - GitHub OAuth App (テスト用アカウント)
  - Resend Webhook (テストイベント)
  - Slack App (テストチャンネル)

## 5. テストレベルと方針
- ユニットテスト: `utils`, `middleware` を中心に純粋関数/小さなロジックを検証
- 結合テスト: Workers ルート + D1 + Cookie の連携を検証
- E2E テスト: OAuth フローをブラウザ/HTTPクライアントで通し確認
- 手動テスト: 外部サービス連携・運用観点・ログ可視化

## 6. テストデータ
- GitHub: テスト用ユーザー (公開/非公開リポジトリを含む)
- D1: `user_sessions` テーブル (空/既存/不正データの状態)
- Cookie: `auth_token`, `oauth_state`, `oauth_pkce`, `last_activity` の有効/無効
- JWT: 期限切れ/改ざん/署名不一致

## 7. ユニットテスト項目
### 7.1 `src/utils/jwt.ts`
- `createJWT` が `iat/exp` を正しく設定する
- `verifyJWT` が署名不一致・期限切れを拒否する
- `extractBearerToken` が `Bearer` ヘッダーから正常抽出/不正抽出

### 7.2 `src/utils/cookie.ts`
- `getCookieValue` が対象キーを正しく取得
- `getCookieValues` が複数キーを正しく取得
- 空/不正 Cookie 文字列の耐性

### 7.3 `src/utils/github.ts`
- `getGitHubUserRepos` がページングを正しく追跡
- `getGitHubLatestCommit` が空レスポンス時に `null` を返す
- `getGitHubTokenScopes` のエラー処理 (`GitHubTokenScopesError`)

### 7.4 `src/utils/resendWebhook.ts`
- 正常署名で `success: true` を返す
- `timestamp` が許容範囲外なら失敗
- 署名ヘッダーが不正/欠落した場合の失敗理由

### 7.5 `src/utils/slack.ts`
- 成功レスポンス時 `ok: true`
- 失敗レスポンス/JSON パース失敗時の `ok: false` と `error`

### 7.6 `src/middleware/auth.ts`
- `Authorization` ヘッダー経由の認証成功
- Cookie 経由の認証成功と `last_activity` 更新
- セッションアイドルタイムアウトで 401 + Cookie クリア
- `optionalAuthMiddleware` が未認証でも通過

## 8. 結合テスト項目
### 8.1 OAuth フロー
- `/auth/github` が `state`/`pkce` Cookie を発行
- `/github/callback` が Cookie/クエリ一致時に JWT を発行
- `state` 不一致/PKCE 欠落時に 400

### 8.2 セッション管理 (D1)
- 新規ユーザーで `user_sessions` に INSERT
- 既存ユーザーで UPDATE (`last_login_at` 更新)
- D1 未設定時でも動作継続 (`null` 処理)

### 8.3 API 認可
- `/api/public` が認証なしで成功
- `/api/protected` が未認証で 401
- `/api/profile` で JWT payload を返す

### 8.4 設定 API
- `/api/settings/timezone` で `JST/UTC` のみ許可 (デフォルトJST)
- `/api/settings/session-duration` で許可リスト検証
- Cookie 設定が反映される

### 8.5 Webhook
- `/webhook/resend` が署名検証成功で 200
- 署名失敗で 401
- 重複イベントで 409
- JSON パース失敗で 400

## 9. E2E テスト項目
- ブラウザで `/` → GitHub 認可 → `/welcome` へ遷移
- `/settings` で JWT の `iat/exp` 表示が正しい
- `/repositories` で公開/非公開リポジトリ一覧表示
- ログアウト後に保護ページへアクセスすると 401

## 10. 非機能テスト
- セキュリティヘッダー: CSP/XFO/STS/Referrer-Policy 等が付与される
- CSRF: `state` 不一致で拒否
- JWT 秘密鍵未設定時のエラー処理
- ログ出力が JSON 形式で破綻しない
- D1 断絶時の graceful degradation

## 11. 監視・運用観点
- `logger.recordMetric` が Analytics 未設定時に安全にスキップ
- エラー時のログ内容 (path, method, error) が妥当
- `/api/debug/d1` の診断結果が期待通り

## 12. テスト実施手順 (概要)
1. ローカルで `wrangler dev` を起動
2. `.dev.vars` に必要なシークレットを設定
3. D1 を作成しマイグレーション適用
4. ユニット/結合/手動テストを段階的に実施
5. 本番相当 (remote D1) でスモークテスト

## 13. 合格基準
- クリティカルな認証フロー (OAuth/JWT) が全て成功
- API 保護が期待通りに動作
- 外部連携失敗時に適切なエラー応答を返す
- セキュリティヘッダーが欠落しない
- 重大な未解決バグが 0

## 14. リスクと優先順位
- OAuth フローの `state`/`pkce` ミスは最優先で検証
- D1 未設定時のパスは運用事故につながるため重点テスト
- Webhook 署名検証はセキュリティ観点で優先度高

## 15. 今後の自動化候補
- `vitest` + `miniflare` でのユニット/結合テスト基盤
- GitHub Actions での CI (lint/test)
- API スモークテストの自動化
