# EVAL: テーブルカタログ（Jev評価系）（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.table-catalog-jev.md`](SPEC.cloudflare-workers-github-oauth-1.table-catalog-jev.md)（2026-11-19の改訂版、SHA256 `32f4a4a2a67e9cdfb6e976f254deef43c17969d4b53661ca38e7417668a8da7d`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）の`migrations/`・`src/index.ts`
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.table-catalog-jev.md`](EVAL.cloudflare-workers-github-oauth-1.table-catalog-jev.md)にはモデル名が無い）

---

## 総合

**対象**: 目録の正しさ（6テーブル、マイグレーション、グループ、エンドポイント）。

目録の内容は今のコードと一致する。古くなったのは範囲だけで、本書の後にJevのテーブルが6つ（脆弱性診断・テスト充足度）増え、目録に無い。

| 項目 | 判定 | 根拠 |
|---|---|---|
| 6テーブルのマイグレーション | 一致 | 0144・0145・0148に`CREATE TABLE` |
| グループ（すべて`ai`） | 一致 | `TABLE_GROUP_MAP` |
| エンドポイント9本 | 一致 | `src/index.ts`に存在 |
| 関連の処理 | 一致（テスト） | `jevAnswerValues`・`jevRevViewer`・`jevScoreBoard`・`jevScoreFlow`のテスト40件が通過 |
| 範囲 | 古い | 0150・0151のテーブルが目録に無い |

---

## 提案（未実施）

**対象**: 次の作業。

1. 0150・0151の6テーブルを目録に足す（同じ形の表で）。

---

## 確かめていないこと

**対象**: 範囲外。

- 本番のD1の各テーブルの行数と、カラムの実際の定義（本書のカラムの表とマイグレーションの照合は、6テーブルの存在までしか見ていない）。
