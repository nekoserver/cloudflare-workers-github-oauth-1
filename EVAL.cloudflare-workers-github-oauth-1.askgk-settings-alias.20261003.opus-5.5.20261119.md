# EVAL: `/neko askgk settings`のエイリアスとSlack対応（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.askgk-settings-alias.20261003.md`](SPEC.cloudflare-workers-github-oauth-1.askgk-settings-alias.20261003.md)（2026-11-19の改訂版、SHA256 `2e2faaac0dc3a63c4aea01e682eeeb6f5c220064814fc562668249c7c7f9c730`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md`](EVAL.cloudflare-workers-github-oauth-1.askgk-slack-support.20261003.md)はSlack対応の事前評価で、モデル名が無い）

---

## 総合

**対象**: 本書の修正内容と3つの追記。

エイリアス・変換しない語・ヘルプ・Slackの`@メンション`は、どれも本書のとおり動く（テスト52件が通過）。古かったのは「背景」の送り先（`mynw`）で、今は台帳`askgk-routes.json`が決める。

| 項目 | 判定 | 根拠 |
|---|---|---|
| `settings`→「設定状況」 | 充足 | `src/utils/tunnelSignerAsk.ts`の37行、テスト |
| `sysstats`・`routines`を変換しない | 充足 | 同上（エイリアスに無い。回帰のテスト） |
| 引数なし・`help`をそのまま送る | 充足 | `/neko help`の197行、テスト |
| Slackの`@メンション`の`/neko askgk` | 充足 | `src/utils/slackMentionReply.ts`、`slackMentionReply.test.ts` |
| 送り先（背景の記述） | 古い（改訂で更新） | `src/data/askgk-routes.json` |

---

## 確かめていないこと

**対象**: 範囲外。

- Slackからの実際の呼び出しと、tunnels側の応答（設定状況の中身）。
