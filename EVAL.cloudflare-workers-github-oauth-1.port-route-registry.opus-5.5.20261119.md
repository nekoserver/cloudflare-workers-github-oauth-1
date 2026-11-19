# EVAL: ポートと経路の正本（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.port-route-registry.md`](SPEC.cloudflare-workers-github-oauth-1.port-route-registry.md)（版4、SHA256 `3e8924bb5955145fcca5f09fc26ff0ebcd548063bedb9341693f620b2d553f2a`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）の`containers/demo/`と`src/`
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.port-route-registry.md`](EVAL.cloudflare-workers-github-oauth-1.port-route-registry.md)は文書の形の評価で、モデル名が無い）

---

## 総合

**対象**: REQ-PR-001〜007の実装。

SPECはdraftで、未決事項（正本の名前と形式など）が利用者の判断待ちのまま。実装は始まっておらず、7つの要求はどれも未充足。文書としての形は既存のEVALのとおり。

---

## 要件ごとの評価

**対象**: 要求ごとの判定と根拠。

| 要求 | 判定 | 根拠 |
|---|---|---|
| REQ-PR-001 | 未充足 | 正本のファイルが無い |
| REQ-PR-002・003 | 未充足 | 照合のテストが無い。ポートは`server.js`・`apache-*.conf`・`cloudflared-ingress.yml.template`に直書き |
| REQ-PR-004 | 未充足（前提の未実装） | 経路確認（REQ-LP-010）が無い |
| REQ-PR-005 | 未充足 | 表は8443と8445の欄に分かれた（[`5f27297f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5f27297f)）が、hopごとの期待と実際、層の区別は無い |
| REQ-PR-006・007 | 未充足 | 正本が無いため、冒頭の明記も無い |

---

## 提案（未実施）

**対象**: 次の作業。

1. 未決事項の3件を利用者が決める（SPECの提案は、JSONの`containers/demo/routes.json`、照合のみ、T3のポートを含める）。
2. 決まったら、AC-PR-002の変異の確認（ポートを1つずらすと照合テストが落ちる）を先に書いてから正本を足す。

---

## 確かめていないこと

**対象**: この評価の範囲外。

- 稼働中のコンテナの待ち受け（SPECのP4のとおり、照合は別の仕組みが担う）。
