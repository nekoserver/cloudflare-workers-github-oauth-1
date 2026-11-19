# EVAL: テーブルカタログ・カラムキー定義・権限制御のDB化（2026-11-19、opus-5.5）

評価日: 2026-11-19（UTC）
評価: opus-5.5（Claude Opus 5.5、Claude Code）
評価の基準: [`SPEC.cloudflare-workers-github-oauth-1.table-catalog.md`](SPEC.cloudflare-workers-github-oauth-1.table-catalog.md)（2026-11-19の改訂版、SHA256 `db87aa422b9cf00764c247aa26205939a0ea13b79f3b336d7372b6eb1300d348`）
評価対象: `origin/main`（[`c271b7ba`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c271b7ba)）の`migrations/`・`src/index.ts`・`src/views/status.ts`
区分: [`SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md`](SPEC.cloudflare-workers-github-oauth-1.20261119.spec-eval-refresh.md)の手順1（既存の[`EVAL.cloudflare-workers-github-oauth-1.table-catalog-jev.md`](EVAL.cloudflare-workers-github-oauth-1.table-catalog-jev.md)がこのSPECも参照していた。モデル名が無い）

---

## 総合

**対象**: 本書の「コードへの影響」1〜6。

表の作成と初期データ（1）だけが入り、DBを正にする移行（2〜6）は止まっている。本文のマイグレーション番号（0024）は誤りで、実際は0026（[`77fecd3d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/77fecd3d)、2026-04-03）。

| 項目 | 判定 |
|---|---|
| 1. 表の作成 | 充足（0026） |
| 2・3. 定数からDB読み出しへ | 未充足（コードは表を読まない） |
| 4. グループ別のフィルタ | 未充足 |
| 5. ER図との同期のテスト | 未確認 |
| 6. ロール別のアクセス制御・`table_group_permissions` | 未充足（表も無い） |

---

## 根拠

**対象**: 確かめたこと。

- `migrations/0026_create_table_catalog.sql`に`table_catalog`・`table_column_keys`の`CREATE TABLE`。`table_group_permissions`のマイグレーションは無い。
- `src/index.ts`に`table_catalog`への`INSERT`（`STATUS_MIGRATION_SQL`）はあるが、`SELECT`は無い。
- `STATUS_TABLE_DEFINITIONS`は180件、`TABLE_GROUP_MAP`のグループは8つ。
- `/api/status/tables/:table/rows`は`authMiddleware`だけで、ロールの確認は無い。

---

## 提案（未実施）

**対象**: 次の作業。

1. 本書の方針（DBを正にする）を続けるか、`CLAUDE.md`ルール23の定数の運用を正とし、本書を「中止」にするかを利用者が決める。
2. 続けるなら、まず定数と`table_catalog`の内容が一致することを確かめるテストを足す（今は180件と初期データの差が分からない）。

---

## 確かめていないこと

**対象**: 範囲外。

- 本番のD1の`table_catalog`の行数と、定数との差。
