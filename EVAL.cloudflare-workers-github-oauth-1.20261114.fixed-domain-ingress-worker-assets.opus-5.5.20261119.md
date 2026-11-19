# EVAL: 固定ドメインのTunnel入口・Workerルート・Static Assets（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md`](SPEC.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md)（2026-11-19の改訂版、SHA256 `3d482f29a1a86ee743051cf74411a3f0a6e2c145255c548bdfe8a16dafca82f7`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）と、本体のdemoコンテナのingress
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md`](EVAL.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md)にはモデル名が無い）

---

## 総合

**対象**: 管理要件と不変条件1〜6。

設計整理のSPECで、中心の成果物（Worker route台帳、Static Assetsの台帳）はまだ無い。リポジトリ側の前提（assetsの宣言、Routeがコメントアウト、ingressのテンプレート）は11-14と同じで、稼働中のコンテナのingressもテンプレートどおりだった。

| 項目 | 判定 |
|---|---|
| route台帳・Static Assetsの台帳（管理要件） | 未充足（未作成） |
| 不変条件2・4 | 充足（コード上。connectorを要件にしていない、Apache/lib資産をassetsへ移していない） |
| 不変条件1・3・5・6 | 未確認（台帳とCloudflare側の実設定が要る。5は要求ごとの外部取得の有無をコードで調べていない） |

---

## 要件ごとの評価

**対象**: 判定と根拠。

| 項目 | 根拠 |
|---|---|
| 台帳 | 全体の台帳のファイルは無い。機能別の台帳（askgk・会話ストリーム）だけ |
| 不変条件4 | `public/`にlibの資産は無い。libは`/root/lib`のbind mountでApacheが配る（lib SPEC） |
| ingress | `/etc/cloudflared/ingress.yml`は`mygw.nekomaneki.work`の`/ssh`→2222、それ以外→8443 |

---

## 提案（未実施）

**対象**: 次の作業。

1. 台帳の置き場所と形式を決め（port-route-registryの正本と合わせるか）、Cloudflareの読み取り（Workers・Routes・Custom Domains・Tunnel）で埋める。
2. `public/_headers`の規則を台帳に載せる。

---

## 確かめていないこと

**対象**: 範囲外。

- Cloudflare側のRoute・Custom Domain・DNS・リモートTunnelの設定（Cloudflareの読み取りの認証が無い）。
- dynamicnekoのStatic Assetsの本番の状態。
