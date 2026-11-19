# EVAL: lib ダッシュボードへの経路の身元と復旧（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.lib-proxy-identity.md`](SPEC.cloudflare-workers-github-oauth-1.lib-proxy-identity.md)（版9、SHA256 `29eee66e7940c2d9c9303bdcd740f6b70744a0ca58b90f62823fb91f13272e1d`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）のコード
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.lib-proxy-identity.md`](EVAL.cloudflare-workers-github-oauth-1.lib-proxy-identity.md)は文書の形の評価で、モデル名が無く、実装を見ていない）

---

## 総合

**対象**: REQ-LP-001〜011の実装 — 既存のEVALが見ていなかった、コードでの充足。

文書としての形は既存のEVALのとおり合格。実装は、身元の付け直し（REQ-LP-001）だけが入っていて、管理者でない要求への404、エラーの本文の最小化、段階ごとの経路確認、停止中のセクション（REQ-LP-008〜011）は入っていない。

| 区分 | 要件 |
|---|---|
| 充足 | LP-001・002・006・007 |
| 一部 | LP-005 |
| 未充足 | LP-008・009・010・011 |
| 対象外（lib） | LP-003・004 |

---

## 要件ごとの評価

**対象**: SPECの要件 — 判定と根拠。

| 要件 | 判定 | 根拠 |
|---|---|---|
| REQ-LP-001 | 充足 | `buildProxyForwardRequest`（[`7dcabc92`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7dcabc92)）。`npx vitest run src/utils/proxyIdentity.test.ts`が4件通過（ブラウザ由来のヘッダが置き換わる、ログインが無ければ付かない、ほかのヘッダは残る） |
| REQ-LP-002 | 充足 | `server.js`に変更なし |
| REQ-LP-005 | 一部 | 起動・再起動の操作と、8445の欄があるヘルスチェックの表（[`5f27297f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5f27297f)）はある。プロキシのエラーで「制限」と「下流の停止」を分ける表示は無い |
| REQ-LP-006・007 | 充足 | 運用の定め |
| REQ-LP-008 | 未充足 | 管理者でない要求に403（`src/middleware/auth.ts`の`cfDashboardAdminMiddleware`） |
| REQ-LP-009 | 未充足 | 502の本文に例外のメッセージをそのまま入れる（`src/index.ts`の`/cf-containers/proxy/*`） |
| REQ-LP-010 | 未充足 | 段階の名前（「スクリプト実行」「ページ応答正常」など）も、経路確認の記録も、コードに無い（`git grep`） |
| REQ-LP-011 | 未充足 | 停止中のセクションは無い |

---

## 提案（未実施）

**対象**: 未充足の要件を満たすための次の作業。

1. `/cf-containers/proxy/*`の前に、管理者でなければ404を返す小さなミドルウェアを置く（同じミドルウェアを使うほかの経路は変えない、REQ-LP-008）。テストを先に書く。
2. プロキシの失敗時の本文を固定の文言にし、例外のメッセージは`recordContainerOperation`の記録にだけ残す（REQ-LP-009）。
3. REQ-LP-010・011は画面と記録の設計が要るので、別のPRに分ける。

---

## 確かめていないこと

**対象**: この評価の範囲外。

- 管理者の認証済みセッションでの実経路（AC-LP-004・006・007）。SPECのP6のとおり、未認証の位置からは確かめない。
- libの側（REQ-LP-003・004）。
