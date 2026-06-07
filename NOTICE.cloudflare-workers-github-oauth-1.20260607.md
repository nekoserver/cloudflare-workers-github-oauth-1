# NOTICE — cloudflare-workers-github-oauth-1 — 2026-06-07

## Cloudflare D1（SQLite）がサポートしない関数・機能

### REVERSE() は存在しない

D1 は SQLite をベースにしており、MySQL や PostgreSQL にある `REVERSE(str)` 関数を**サポートしていない**。
`REVERSE()` を含む SQL をバインドして実行すると、D1 は例外を投げる。
フロントエンドが `.catch()` でエラーを受け取り「データなし」扱いになるため、
**UI からは「表示されない」だけに見えてデバッグが難しい**。

#### やってはいけない例

```sql
-- ❌ D1 では動かない
SELECT SUBSTR(url, LENGTH(url) - INSTR(REVERSE(url), '/') + 2) AS last_seg
FROM some_table;
```

#### 代替: INSTR + SUBSTR で末尾セグメントを抽出する

URL が `/s/{hash}/{id}` のように固定プレフィックスを持つ場合は、
`INSTR` と `SUBSTR` だけで末尾の id を取り出せる。

```sql
-- ✅ D1 で動く（/s/{hash}/{id} 形式の URL から id を取得）
CAST(
  SUBSTR(url,
    INSTR(url, '/s/') + 3
    + INSTR(SUBSTR(url, INSTR(url, '/s/') + 3), '/')
  ) AS INTEGER
)
```

計算の内訳（例: `url = '/s/abc123/456'`）:

| 式 | 値 | 説明 |
|---|---|---|
| `INSTR(url, '/s/')` | 1 | `/s/` の開始位置 |
| `+3` | 4 | `/s/` の次の文字（hash 先頭）の位置 |
| `SUBSTR(url, 4)` | `abc123/456` | `/s/` 以降の文字列 |
| `INSTR('abc123/456', '/')` | 7 | hash 内の `/` の位置 |
| `4 + 7 = 11` | — | id 先頭の絶対位置 |
| `SUBSTR(url, 11)` | `456` | share_id 文字列 |

固定プレフィックスがない汎用的な「最後の `/` 以降を取得」が必要な場合は、
アプリ層（TypeScript 側）で URL を split して渡すほうが安全。

### D1（SQLite）で使えない主な関数（確認済み・要注意）

| 関数 | 由来 | D1 での扱い |
|---|---|---|
| `REVERSE(str)` | MySQL / PostgreSQL | **エラー（未定義）** |
| `GROUP_CONCAT` | SQLite 標準 | **使える**（ただし区切り文字のデフォルトは `,`） |
| `JSON_ARRAYAGG` | MySQL 8+ / PostgreSQL | **エラー**（SQLite は `JSON_GROUP_ARRAY` を使う） |
| `ILIKE` | PostgreSQL | **エラー**（SQLite は `LIKE` のみ。大文字小文字無視は `COLLATE NOCASE` を使う） |
| `REGEXP_REPLACE` | PostgreSQL / MySQL | **エラー**（SQLite はデフォルトで REGEXP 演算子未サポート） |

### SQL エラーが「表示されない」として現れるパターン

D1 クエリが例外を投げたとき、ハンドラに try/catch がなければ Worker は 500 を返す。
フロントエンドが `fetch(...).catch(() => { ... 非表示処理 ... })` の形だと、
**エラーではなく「データが空」として UI に現れる**。デバッグ時は：

1. ブラウザの DevTools → Network タブでレスポンスの status を確認する
2. 500 なら Worker 側の SQL に問題がある
3. 200 だが items が空なら WHERE 条件や JOIN が一致していない
