# アクセス制限の構成と Proxy Test ページのセキュリティ境界

## 背景

本 Worker（`cloudflare-workers-github-oauth-1`）は国内 ISP のみにアクセスを限定している。
この制限がどこで掛かっているか、またプロキシテストページ追加時にどの層が何を守るかを整理した。

## アクセス制限の実装箇所

### Worker ソースコード側

Worker のソースコード（`src/` 配下）には **IP アドレス・ASN・国による制限ロジックは一切存在しない**。

`CF-Connecting-IP` ヘッダーを参照している箇所は `src/middleware/auth.ts` のみで、
これは不正 JWT 検知時の Slack 通知にリモート IP を含めるためのもの。アクセス制御には使われていない。

### Cloudflare ダッシュボード側（WAF）

ISP 制限は **Cloudflare ダッシュボードの WAF（Web Application Firewall）** で設定されている。
以下のいずれかの機能が使われている可能性がある:

| 機能 | ダッシュボードの場所 | 設定単位 |
|---|---|---|
| Custom Rules（推奨） | Security > WAF > Custom rules | ASN / IP / 国 |
| IP Access Rules（レガシー） | Security > WAF > Tools | IP / ASN / 国 |
| Security Rules（新 UI） | Security > Security rules | 上記を統合 |

**Claude Code 環境の Cloudflare MCP は Workers / KV / D1 / R2 の参照のみ対応しており、WAF ルールの一覧・詳細は取得できない。** ルールの確認・変更はダッシュボードから手動で行う必要がある。

## プロキシテストページ（`/proxy-test`）のセキュリティ境界

### インバウンド（ブラウザ → Worker）

```
[ブラウザ] → [Cloudflare Edge: WAF ISP制限] → [Worker: JWT認証] → レスポンス
```

- **第1層: WAF の ISP 制限** — Cloudflare エッジでリクエスト元の IP/ASN を判定。許可された ISP 以外からのアクセスはここでブロックされる
- **第2層: `authMiddleware`（JWT 認証）** — GitHub OAuth でログイン済みのユーザーのみアクセス可能

### アウトバウンド（Worker → オリジン）

```
[Worker] → [Cloudflare Edge IP (IPv4)] → [対象オリジン]
```

- Worker の `fetch()` は **Cloudflare のエッジ IP** から発信される
- ISP 制限はインバウンドのみに適用され、**Worker からのアウトバウンド通信には影響しない**
- Worker はどのオリジンにも（プライベート IP を除き）アクセスできる

### まとめ

| 方向 | ISP 制限 | JWT 認証 | 備考 |
|---|---|---|---|
| ブラウザ → `/proxy-test` | 適用 | 適用 | 二重保護 |
| ブラウザ → `/api/proxy-test` | 適用 | 適用 | 二重保護 |
| Worker → 外部オリジン | **不適用** | - | Cloudflare Edge IP から発信 |

## 注意事項

- WAF ルールを変更する際は、プロキシテスト機能が外部に対するオープンリレーとして悪用されないか考慮すること。現状は ISP 制限 + JWT 認証の二重保護があるため安全
- ISP 制限を解除・緩和する場合は、プロキシテストページへのアクセスも緩和される点に留意する
- Worker からのアウトバウンド fetch はプライベート IP（`127.0.0.1`, `10.x`, `192.168.x`, `172.16-31.x`）をコード側でブロック済み（`/api/proxy-test` エンドポイント内のバリデーション）
