# PLAN: cloudflare-workers-github-oauth-1.20260313

> PLAN.cloudflare-workers-github-oauth-1.md と最新SPECの内容を統合し、現在の実装状況に基づくセキュリティ評価と機能拡張提案をまとめた計画書。

---

## 参照した仕様・計画

- `PLAN.cloudflare-workers-github-oauth-1.md`
- `SPEC.cloudflare-workers-github-oauth.latest.md`
- `SPEC.cloudflare-workers-github-oauth-1.latest.md`

---

## 現在の実装概要 (仕様準拠)

- GitHub OAuth 2.0 + JWT 認証
- CSRF対策 (state Cookie)
- JWT発行、Cookie保存、認証ミドルウェア
- D1によるユーザーセッション管理 (オプション)
- Resend webhook 受信と署名検証
- オリジン通知 (event パラメータでGET)
- Slack通知 (送信結果確定時のみ、from/to/subject付き)
- 構造化ログとAnalytics Engine連携 (オプション)

---

## セキュリティ評価

### 強み

- OAuth state による CSRF 対策が実装済み
- JWTは Web Crypto API で署名検証を実施
- Cookieは HttpOnly + Secure + SameSite=Lax を付与
- Resend webhook は Svix署名で検証し、未検証は拒否
- エラーレスポンスは HTML/JSON を用途別に返す

### 主要ギャップ

- PKCE の未導入
- OAuth callback のパラメータ検証が仕様レベルで詳細化されていない
- セッション固定対策、アイドル/絶対タイムアウトの明記が不足
- CSP / HSTS / X-Frame-Options などのセキュリティヘッダが未実装
- Webhook再送やリプレイ対策 (timestamp検証、idの重複排除) の記載がない
- Slack通知に不要なシークレットを必須扱いしており、実装との要件整合が弱い

### セキュリティ上の注意点

- Resend webhook のオリジン通知先が固定であるため、環境分離が必要な場合は設定化が必要
- 監査ログと不正検知の粒度は今後の拡張が必要
- レートリミットはWAF前提でアプリ側に制限ロジックがない

---

## 拡張提案

### 短期 (1-2スプリント)

- PKCE の導入
- OAuth callback 入力の厳密バリデーション
- セキュリティヘッダ (CSP/HSTS/XFO/CTO) の追加
- Resend webhook のリプレイ対策の設計
- Slack通知の必須シークレット要件の整理

### 中期 (3-6スプリント)

- セッション管理の強化 (アイドル/絶対タイムアウト)
- ログの機微情報マスキング
- 監査ログとアラート設計
- 環境分離 (staging/production) の設定整理

### 長期 (6スプリント以降)

- GitHub App 対応
- マルチプロバイダ OAuth (Google/GitLab等)
- CIでの依存関係スキャンとセキュリティゲート
- コンプライアンス文書 (SECURITY.md, プライバシーポリシー) の整備

---

## 実装優先度 (提案)

| 項目 | 理由 | 優先度 |
|---|---|---|
| PKCE導入 | OAuthの安全性向上 | 最優先 |
| セキュリティヘッダ追加 | 一般的なWeb防御 | 高 |
| Webhookリプレイ対策 | 外部入力の安全性向上 | 高 |
| セッションタイムアウト強化 | セッション悪用対策 | 中 |
| 監査ログ/アラート | 事故対応と検知 | 中 |
| マルチプロバイダ | 機能拡張 | 低 |

---

## 進め方 (次のアクション候補)

1. 仕様と実装の差分を整理し、PKCE・ヘッダ追加を最初の作業として確定
2. Webhookリプレイ対策とオリジン通知の設定化を設計
3. セッション管理強化を D1 スキーマと合わせて計画
4. 監査ログの粒度と通知先を決定

