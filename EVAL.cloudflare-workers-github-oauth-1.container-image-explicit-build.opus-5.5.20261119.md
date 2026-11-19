# EVAL: デモコンテナイメージの明示ビルドとdigest固定（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.container-image-explicit-build.md`](SPEC.cloudflare-workers-github-oauth-1.container-image-explicit-build.md)（版3、SHA256 `7c6305a3f801a72fc7907ebafe0cf00d6c9f069881487b631711a1fa2779ff57`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）の`scripts/`・`wrangler.toml`・`containers/demo/image.lock.json`
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.container-image-explicit-build.md`](EVAL.cloudflare-workers-github-oauth-1.container-image-explicit-build.md)は文書の形の評価で、モデル名が無い）

---

## 総合

**対象**: 要求と受け入れ条件の充足。

スクリプトはあるが、受け入れ条件AC-EI-001（`--check`が0）を満たしていない。2026-11-18の後にコンテナの入力（httpd 2.4.71、git 2.56.1、`lib-restore-wait.sh`など）が変わり、ロックが再記録されていないため。Workers Buildsのビルドコマンドが新しいスクリプトに切り替わったかは、リポジトリからは確かめられない。

| 区分 | 要求・条件 |
|---|---|
| 充足 | REQ-EI-004（手順はスクリプトに固定）、REQ-EI-005（PR #2649） |
| 未充足 | REQ-EI-003・AC-EI-001 |
| 未確認 | REQ-EI-001・002（本番のビルドコマンドしだい）、AC-EI-002・003 |

---

## 要件ごとの評価

**対象**: 判定と根拠。

| 項目 | 判定 | 根拠 |
|---|---|---|
| REQ-EI-001 | 未確認 | スクリプトは明示ビルドを行う。本番のビルドコマンドが`bash scripts/deploy-with-container-build.sh`か`npx wrangler deploy`かは、ダッシュボードの設定 |
| REQ-EI-002 | 未確認 | リポジトリの`wrangler.toml`はDockerfileのパス。スクリプトは本番のビルドの中でdigestに書き換える。ビルドコマンドが切り替わっていなければ、変更の判定に任せたまま |
| REQ-EI-003 | 未充足 | `--check`が1（`REBUILD`） |
| REQ-EI-004 | 充足 | `scripts/deploy-with-container-build.sh`（[`eed0e99c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eed0e99c)） |
| REQ-EI-005 | 充足 | PR #2649はマージ済み |
| AC-EI-001 | 未充足 | 同上 |
| AC-EI-002・003 | 未確認 | 本番を見ていない |

---

## 提案（未実施）

**対象**: 次の作業。

1. 本番のビルドコマンドが切り替わっているかを、ダッシュボードかビルドのログ（`/cf-containers`の「最新ビルドのログを取得」）で確かめる。
2. 切り替わっていれば、次の本番ビルドでロックが再記録されるはず。その後に`--check`が0になることを確かめ、再記録した`image.lock.json`をリポジトリに戻す手順（ビルドの環境の変更はコミットされない）をSPECに足す。

---

## 確かめていないこと

**対象**: 範囲外。

- 本番のビルドのログ、本番のD1の`cf_container_snapshots`、本番のコンテナの版。
