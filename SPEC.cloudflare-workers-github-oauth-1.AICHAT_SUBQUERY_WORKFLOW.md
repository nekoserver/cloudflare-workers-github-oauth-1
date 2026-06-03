# SPEC.cloudflare-workers-github-oauth-1.AICHAT_SUBQUERY_WORKFLOW

## AIチャットの過去ログと外部サイトへの補足説明リンクを埋め込むワークフロー

**対象**: AIチャット画面（`/aichat`）、D1テーブル群（`aichat_search_impressions` / `aichat_subqueries` / `aichat_share_subquery_links`）、`src/views/aichat.ts`（フロントエンド）、`src/index.ts`（APIエンドポイント）— ユーザーが検索キーワードを入力したときに露出した質問を自動記録し、過去ログの各質問に対して「サブクエリ（追加質問テキスト）+ 外部URLリンク」を手動で紐付けてモーダル内に表示できるようにする。PR #441〜#450（進行中）に対応する一連の実装をまとめる。

---

## 1. 実装の背景と目的

AIチャットでは、左サイドバーの検索窓にキーワードを入力すると過去ログ一覧が絞り込まれる。しかしこれまでは「どの質問が何回検索結果に露出したか」「その質問を深掘りするための外部URLがあるか」を記録・表示する手段がなかった。

本ワークフローは以下の2段階で構成される。

1. **自動記録フェーズ** — 検索実行のたびに「検索結果に現れた全質問ID・検索結果総数」を `aichat_search_impressions` テーブルに書き込む
2. **手動紐付けフェーズ** — 過去ログ詳細モーダルから「追加質問（サブクエリ）」と「外部URL」を1質問:多リンクで登録し、同モーダル内にリンクを表示する

---

## 2. テーブル設計

### 2-1. `aichat_search_impressions`（migration 0044）

**対象**: キーワード検索のたびに自動 INSERT される露出ログ。1検索 × 1検索結果行が1レコードに対応する。

| カラム | 型 | 説明 |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | 行ID |
| `user_id` | TEXT NOT NULL (FK→user_sessions) | 操作ユーザー |
| `share_id` | TEXT NOT NULL (FK→ai_chat_shares) | 露出した質問ID |
| `result_count` | INTEGER | その検索の総ヒット件数 |
| `searched_at` | TEXT NOT NULL | 検索日時（ISO8601） |
| `deleted_at` | TEXT | 論理削除フラグ |

```sql
CREATE TABLE IF NOT EXISTS aichat_search_impressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  share_id TEXT NOT NULL,
  result_count INTEGER,
  searched_at TEXT NOT NULL,
  deleted_at TEXT
);
```

### 2-2. `aichat_subqueries`（migration 0045）

**対象**: ユーザーが手動登録するサブクエリ（追加質問テキスト）のマスタテーブル。`query` に UNIQUE 制約を持ち、重複登録を防ぐ。

| カラム | 型 | 説明 |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | 自動採番ID（参照キー） |
| `query` | TEXT NOT NULL UNIQUE | サブクエリ本文 |

```sql
CREATE TABLE IF NOT EXISTS aichat_subqueries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL UNIQUE
);
```

### 2-3. `aichat_share_subquery_links`（migration 0046）

**対象**: 「過去ログの質問」と「サブクエリ」と「外部URL」を結ぶリンクテーブル。1質問に対して複数のサブクエリ+URLを登録できる（1対多）。

| カラム | 型 | 説明 |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | 行ID |
| `user_id` | TEXT NOT NULL | 登録ユーザー |
| `question` | TEXT NOT NULL | 質問本文（`ai_chat_shares.question` と一致） |
| `subquery_id` | INTEGER NOT NULL (FK→aichat_subqueries) | サブクエリID |
| `url` | TEXT NOT NULL | 外部URL |
| `created_at` | TEXT NOT NULL | 登録日時 |
| UNIQUE | `(user_id, question, subquery_id)` | 同一質問×サブクエリの重複登録を防ぐ |

```sql
CREATE TABLE IF NOT EXISTS aichat_share_subquery_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  subquery_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, question, subquery_id)
);
```

**1対多の関係**: 同一 `question` に対して `subquery_id` が異なれば複数レコードを登録可能。同一 `question` × 同一 `subquery_id` は1件のみ（URLが変わっても上書きではなく別レコードは登録不可）。

---

## 3. APIエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/aichat/search-impressions` | 露出ログを質問単位に集計して最新30件を返す。`LEFT JOIN aichat_search_log` でキーワードも付加 |
| POST | `/api/aichat/search-impressions` | `shareIds[]` + `resultCount` を受け取り、検索結果全件をバルク INSERT |
| GET | `/api/aichat/subqueries` | サブクエリマスタ一覧を返す（最大100件、id 降順） |
| POST | `/api/aichat/subqueries` | `query` を受け取り `INSERT OR IGNORE` で登録（重複は無視） |
| GET | `/api/aichat/share-subquery-links` | `?question=` で絞り込み、当該質問に紐づく全リンクを `JOIN aichat_subqueries` して返す |
| POST | `/api/aichat/share-subquery-links` | `{ question, subquery_id, url }` を受け取り `INSERT OR IGNORE` で登録 |

---

## 4. フロントエンド構成

### 4-1. タブバーボタン

ナビバー右側のユーザーメニュー内に以下の順でボタンを配置する（左から右）:

```
🔗 サブクエリ | 📋 露出ログ | 📊 質問分析 | 🗂 検索明細 | 📋 検索履歴 | テーマ切替 | ユーザー名
```

### 4-2. `subqueriesOverlay`（サブクエリ一覧モーダル）

- z-index: 700（他のオーバーレイと同層）
- 「＋ 新規追加」ボタンを押すとフォームが出現
- フォームに入力するたびに既存リストと照合し、重複があれば「追加」ボタンを非表示にして警告メッセージを表示
- 重複なしのときのみ「追加」ボタンが現れ、押すと `POST /api/aichat/subqueries` を送信してリストを再描画

### 4-3. `addSubqueryModal`（追加質問登録モーダル）

- z-index: 900（過去ログモーダル z-index:750 より上の最上位レイヤー）
- 過去ログモーダルのフッターにある「＋ 追加質問を登録する」ボタンで開く
- `GET /api/aichat/subqueries` で取得したリスト（最大20件、スクロール可）から1件をタップ選択
- 選択するとテキストボックスにサブクエリ本文が埋め込まれ（読み取り専用）、URL 入力欄が有効化される
- 「登録する」を押すと `POST /api/aichat/share-subquery-links` を送信し、成功後モーダルを閉じて `historyModalSubqueryLinks` を再描画

### 4-4. `historyModalSubqueryLinks`（過去ログモーダル内リンクエリア）

- 過去ログモーダルフッター下に配置
- `showHistoryModal()` 呼び出し時に `loadSubqueryLinks(question)` を実行
- `GET /api/aichat/share-subquery-links?question=` で取得したリンク一覧を表示
- リンクがなければ非表示（`display:none`）
- リンクがあれば「追加質問リンク」ヘッダ + 各行「サブクエリ本文 / 🔗 開く（外部リンク）」を表示
- 登録直後も `loadSubqueryLinks` を再実行してリアルタイムに更新

---

## 5. 露出ログUI（📋 露出ログ）の仕様

### 集計ロジック

`aichat_search_impressions` を `share_id` 単位で集計し、`aichat_search_log` を LEFT JOIN してキーワードを付加する。上位30件（露出回数降順）を対象に、キーワードごとに複数行が返るため、クライアント側で Map に集約する。

### テーブル表示

| 列 | 内容 |
|---|---|
| キーワード数 | その質問が内包するキーワードの種類数（多い順に降順ソート） |
| 質問 | 質問本文（タップで過去ログモーダルを開く） |
| キーワード | バッジ形式で列挙 |
| 最終検索 | Cookie でトグルON/OFF。日付セルは `YYYY-MM` カレンダーへのリンク |

### 自動記録タイミング

`doSearch()` 関数でキーワード検索を実行し、1件以上の結果が返ったとき、全件の `shareId[]` と `resultCount` を `POST /api/aichat/search-impressions` に送信する（エラーは握りつぶし）。

---

## 6. 関連コミット

| # | コミットハッシュ | 件名 | PR |
|---|---|---|---|
| 1 | [`dce68b7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/dce68b7) | 質問×キーワード分析ボタンを追加 | #441 |
| 2 | [`34cf30f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/34cf30f) | 質問分析モーダルのキーワード表示ロジックを修正 | #442 |
| 3 | [`b3ce6f1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b3ce6f1) | 質問分析モーダルに連番列・降順ソート・上位30件制限を追加 | #443 |
| 4 | [`9c5402c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9c5402c) | 検索選択時の検索結果数を result_count として記録 | #444 |
| 5 | [`7e5e589`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7e5e589) | 質問分析モーダルの質問セルタップで過去ログを中央モーダル表示 | #444 |
| 6 | [`64222ab`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/64222ab) | 質問分析モーダルを過去ログ表示中も保持・全キーワードハイライト | #445 |
| 7 | [`b182936`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b182936) | 日付リンクで左サイドメニューを開く際に質問分析モーダルを閉じる | #446 |
| 8 | [`9d8dd09`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9d8dd09) | aichat_search_impressions テーブルと露出ログ機能を追加 | #447 |
| 9 | [`b02d02b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b02d02b) | 露出ログモーダルを質問分析モーダルと同等のパターンに変更 | #448 |
| 10 | [`0f8b580`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0f8b580) | 過去ログモーダルにヘッダ検索窓を追加・露出ログからの動線を整備 | #449 |
| 11 | [`34e6c03`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/34e6c03) | 過去ログモーダルのヘッダ検索ボタンで左サイドバーがすぐ閉じる問題を修正 | #450（open） |
| 12 | [`05e18ef`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/05e18ef) | 露出ログモーダルの左端カラムをキーワード数に変更・最終検索カラムをトグル化 | #450（open） |
| 13 | [`346ef16`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/346ef16) | aichat_subqueries / aichat_share_subquery_links テーブルとUIを追加 | 未PR |

---

## 7. index.ts 登録必須項目

新テーブルを追加した場合、以下5箇所すべてに登録しなければ `/status` に表示されない（CLAUDE.md ルール23参照）。

| 登録先 | aichat_search_impressions | aichat_subqueries | aichat_share_subquery_links |
|---|---|---|---|
| STATUS_TABLE_DEFINITIONS | ✅ 0044 | ✅ 0045 | ✅ 0046 |
| TABLE_COLUMN_KEYS | ✅ | ✅ | ✅ |
| TABLE_GROUP_MAP | ✅ ai | ✅ ai | ✅ ai |
| COLUMN_FK_TARGETS | ✅ | — | ✅ subquery_id→aichat_subqueries |
| STATUS_MIGRATION_SQL | ✅ | ✅ | ✅ |

---

## 8. D1実行用SQL

### migration 0044

```sql
CREATE TABLE IF NOT EXISTS aichat_search_impressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  share_id TEXT NOT NULL,
  result_count INTEGER,
  searched_at TEXT NOT NULL,
  deleted_at TEXT
);
```

### migration 0045

```sql
CREATE TABLE IF NOT EXISTS aichat_subqueries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL UNIQUE
);
```

### migration 0046

```sql
CREATE TABLE IF NOT EXISTS aichat_share_subquery_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  subquery_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, question, subquery_id)
);
```

---

## 9. 注意事項

- `aichat_share_subquery_links.question` は `ai_chat_shares.question` のテキスト値をそのまま格納する（FK ではなくテキスト一致）。`ai_chat_shares` の `question` が変化した場合はリンクが孤立する可能性があるが、質問テキストは不変のため実運用上は問題ない
- 同一質問 × 同一サブクエリへの URL 更新は現在の実装では非対応（同じ組み合わせは1件のみ。URLを差し替えるにはレコードを削除してから再登録する）
- 露出ログの自動 POST はエラーを握りつぶす（`.catch(function() {})`）。DB障害時に検索操作がブロックされないようにするための意図的な設計
