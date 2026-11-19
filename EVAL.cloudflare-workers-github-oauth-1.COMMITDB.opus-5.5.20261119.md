# EVAL: repo_commit_indexの追記（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md`](SPEC.cloudflare-workers-github-oauth-1.COMMITDB.md)（2026-11-19の改訂版、SHA256 `261327485fb09f96380f93d742cdf0e7db7aa77a30a11ed91496a822f0fc491d`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）の`src/index.ts`のpush webhook・`migrations/`
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.20260828.md`](EVAL.cloudflare-workers-github-oauth-1.20260828.md)がこのSPECを参照していた。モデル名が無い）

---

## 総合

**対象**: 追記の運用（手動・自動）と、スキーマ。

SPECが書かれた後（2026-10-04）に、手動の運用を自動の追記（pushのwebhook）が置き換えた。自動の追記は、SPECの決まり（`owner/repo`形式、`INSERT OR IGNORE`、リポジトリごとの連番、マージコミットのPR番号）に沿っている。食い違いは2つ: `CLAUDE.md`ルール24が手動の運用を必須にしたままであること、自動の追記の失敗がログにしか残らないこと（ルール8の「通知」）。

| 項目 | 判定 | 根拠 |
|---|---|---|
| `owner/repo`形式 | 充足 | `repositoryFullName`（GitHubの`owner/repo`）をそのまま使う |
| 連番（`MAX(seq_num)`の続き） | 充足（テスト・コード） | `src/index.ts`、`githubPushNotify.test.ts` |
| マージコミットのPR番号 | 充足（テスト） | 同上のテスト（`buildPushRepoCommitIndexEntries`の20件の中） |
| 失敗の記録・通知（ルール8） | 一部 | 記録はログだけ。通知とテストは無い |
| `CLAUDE.md`ルール24との整合 | 未充足 | ルールが手動の運用のまま |
| D1の件数と`git rev-list --count`の一致 | 未確認 | 本番のD1を読んでいない |

---

## 提案（未実施）

**対象**: 次の作業。

1. `CLAUDE.md`のルール24を「自動の追記が主、手動は補い」に直すかを利用者が決める。
2. 自動の追記の失敗を`webhook_log`などに残し、`/status`か通知で見えるようにする（ルール8）。テストを先に書く。
3. webhookの取りこぼしで連番に穴が空いたとき（一部のpushが届かない）の扱い（後から手動で埋めると番号が詰まらない）をSPECに足す。

---

## 確かめていないこと

**対象**: 範囲外。

- 本番のD1の`repo_commit_index`の件数と、各リポジトリの`git rev-list --count`の一致。
