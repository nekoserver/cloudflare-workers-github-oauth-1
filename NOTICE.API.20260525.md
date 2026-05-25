# NOTICE.API — コミット検索履歴 API リファレンス

作成日: 2026-05-25

このドキュメントは PR [#285](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/285) で追加・拡張したコミット検索履歴関連の API エンドポイントをまとめたものです。

---

## 概要

コミット検索履歴 API は 4 本のエンドポイントで構成されています。

| エンドポイント | 用途 |
|---|---|
| `GET /api/repositories/search/commits` | コミット全文検索 + 履歴保存 |
| `GET /api/repositories/search/history` | 検索履歴一覧（総ヒット数降順） |
| `GET /api/repositories/search/history/:id` | 単一検索イベントの詳細 |
| `GET /api/repositories/search/keyword-stats` | キーワード集計（共起・時系列・リポジトリ別） |

すべてのエンドポイントはセッション Cookie による認証が必要です（`credentials: 'same-origin'`）。

---

## 1. `GET /api/repositories/search/commits`

コミットキャッシュ（`commit_list_cache`）を全文検索し、ヒット件数をDBに記録して結果を返します。

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `q` | string | 必須 | 検索クエリ（2文字以上） |

### 検索対象フィールド

- コミットメッセージ（`message`）
- 著者名（`authorName`）
- GitHub ログイン名（`authorLogin`）
- コミット SHA（`sha`）

### レスポンス（200 OK）

```json
{
  "query": "fix",
  "total": 42,
  "results": [
    {
      "owner": "nekoserver",
      "repo": "cloudflare-workers-github-oauth-1",
      "date": "2026-05",
      "commits": [
        {
          "sha": "abc1234def5678",
          "message": "fix: ログイン時のリダイレクト処理を修正",
          "authorName": "Taro Yamada",
          "authorLogin": "taro",
          "authorAvatarUrl": "https://avatars.githubusercontent.com/...",
          "date": "2026-05-20",
          "url": "https://github.com/..."
        }
      ]
    }
  ]
}
```

### DBへの保存

ヒット件数が 1 件以上の場合、以下の 3 テーブルに自動的に記録されます。

| テーブル | 保存内容 |
|---|---|
| `commit_search_history` | 検索クエリ・総ヒット数・ヒットしたリポジトリ名一覧（JSON）・検索日時 |
| `commit_search_repo_stats` | リポジトリごとのヒット数（`search_history_id` FK） |
| `commit_search_hit_details` | コミット単位のヒット記録（SHA・メッセージ先頭200文字）。1回の検索で最大200件 |

---

## 2. `GET /api/repositories/search/history`

ログインユーザーの検索履歴一覧を総ヒット数の降順で返します。同一クエリの複数回検索が含まれます（重複排除はクライアント側で処理）。

### レスポンス（200 OK）

```json
{
  "history": [
    {
      "id": 123,
      "search_query": "fix",
      "total_hits": 42,
      "repo_names": "[\"nekoserver/repo-1\",\"nekoserver/repo-2\"]",
      "searched_at": "2026-05-25T10:00:00.000Z"
    }
  ]
}
```

### 注意事項

- 最大 200 件を返します。
- `repo_names` は JSON 文字列です。`JSON.parse()` でパースしてください。
- 同一クエリが複数行として返ることがあります。キーワードごとに集計したい場合は `/api/repositories/search/keyword-stats` を使ってください。

---

## 3. `GET /api/repositories/search/history/:id`

単一の検索イベント（`commit_search_history.id` で指定）の詳細と、そのときのリポジトリ別ヒット数を返します。

### パスパラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | number | `commit_search_history.id` |

### レスポンス（200 OK）

```json
{
  "history": {
    "id": 123,
    "search_query": "fix",
    "total_hits": 42,
    "repo_names": "[\"nekoserver/repo-1\"]",
    "searched_at": "2026-05-25T10:00:00.000Z"
  },
  "repoStats": [
    {
      "repo_name": "nekoserver/repo-1",
      "hit_count": 30,
      "search_query": "fix",
      "user_name": "Taro Yamada"
    }
  ]
}
```

### エラー

- `404 Not Found` — 指定 ID が存在しない、またはログインユーザーの所有でない場合

---

## 4. `GET /api/repositories/search/keyword-stats` （新規追加）

キーワード単位で検索履歴を集計します。集計サマリー・リポジトリ別ヒット数・共起キーワード・日別時系列の 4 種類のデータを 1 リクエストで返します。

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `q` | string | 必須 | 集計対象のキーワード（2文字以上） |

### レスポンス（200 OK）

```json
{
  "query": "fix",
  "summary": {
    "search_count": 15,
    "total_hits": 380,
    "search_days": 8,
    "first_searched_at": "2026-04-01T09:00:00.000Z",
    "last_searched_at": "2026-05-25T10:00:00.000Z"
  },
  "repoStats": [
    { "repo_name": "nekoserver/repo-1", "total_hit_count": 200, "search_count": 10 },
    { "repo_name": "nekoserver/repo-2", "total_hit_count": 180, "search_count":  8 }
  ],
  "coKeywords": [
    { "search_query": "bug", "shared_repo_count": 3, "total_hits": 45 },
    { "search_query": "refactor", "shared_repo_count": 2, "total_hits": 20 }
  ],
  "timeseries": [
    { "date": "2026-04-01", "search_count": 2, "total_hits": 50 },
    { "date": "2026-04-15", "search_count": 3, "total_hits": 80 },
    { "date": "2026-05-25", "search_count": 1, "total_hits": 42 }
  ]
}
```

### フィールド詳細

**`summary`**

| フィールド | 型 | 内容 |
|---|---|---|
| `search_count` | number | このキーワードの検索実行回数（延べ） |
| `total_hits` | number | 全検索回のヒット数の合計 |
| `search_days` | number | 検索が行われた日付の種類数 |
| `first_searched_at` | string (ISO8601) | 最初に検索された日時 |
| `last_searched_at` | string (ISO8601) | 最後に検索された日時 |

**`repoStats`**（最大50件、`total_hit_count` 降順）

| フィールド | 型 | 内容 |
|---|---|---|
| `repo_name` | string | `owner/repo` 形式 |
| `total_hit_count` | number | 全検索回を通じた累計ヒット数 |
| `search_count` | number | このリポジトリにヒットした検索回数 |

**`coKeywords`**（最大30件、`shared_repo_count` 降順）

「共起キーワード」とは、クエリ `q` がヒットしたリポジトリと**同じリポジトリ**に過去にヒットしたことがある他のキーワードです。

| フィールド | 型 | 内容 |
|---|---|---|
| `search_query` | string | 共起キーワードの文字列 |
| `shared_repo_count` | number | `q` と共通してヒットしたリポジトリ数 |
| `total_hits` | number | 共起キーワードの過去の累計ヒット数 |

**`timeseries`**（全期間、`date` 昇順）

| フィールド | 型 | 内容 |
|---|---|---|
| `date` | string (YYYY-MM-DD) | 集計日付（UTC→SQLite の `DATE()` による） |
| `search_count` | number | その日に実行した検索回数 |
| `total_hits` | number | その日のヒット数の合計 |

---

## 利用例

### 使用例 A — キーワードの検索傾向を調べる

```js
const res = await fetch('/api/repositories/search/keyword-stats?q=Merge+pull+request', {
  credentials: 'same-origin'
});
const data = await res.json();

console.log('検索回数:', data.summary.search_count);
console.log('検索日数:', data.summary.search_days);
console.log('総ヒット数:', data.summary.total_hits);

// 日別推移をコンソールに出力
data.timeseries.forEach(row => {
  console.log(row.date, ':', row.total_hits, 'hits /', row.search_count, '回検索');
});
```

### 使用例 B — あるキーワードと共起するキーワードを取得する

```js
const res = await fetch('/api/repositories/search/keyword-stats?q=fix', {
  credentials: 'same-origin'
});
const data = await res.json();

// 同じリポジトリにヒットしたことがある他のキーワード
data.coKeywords.forEach(k => {
  console.log(`「${k.search_query}」: 共有リポジトリ数 ${k.shared_repo_count}`);
});
```

### 使用例 C — D1 上で直接集計クエリを実行する（ローカル診断用）

```sql
SELECT search_query, COUNT(*) as search_count, SUM(total_hits) as total_hits
FROM commit_search_history
WHERE user_id = '<user_sub>'
GROUP BY search_query
ORDER BY total_hits DESC
LIMIT 20;
```

```sql
SELECT d.commit_sha, d.commit_message, d.repo_name
FROM commit_search_hit_details d
JOIN commit_search_history h ON d.search_history_id = h.id
WHERE h.search_query = 'fix'
ORDER BY h.searched_at DESC
LIMIT 50;
```

---

## 関連テーブル

| テーブル | migration | 役割 |
|---|---|---|
| `commit_search_history` | 0011 | 検索イベント（クエリ・総ヒット数・日時） |
| `commit_search_repo_stats` | 0011 | 検索イベントごとのリポジトリ別ヒット数 |
| `commit_search_hit_details` | 0032 | 検索イベントごとのコミット単位ヒット記録 |

---

## 注意事項

- `commit_search_hit_details` はデプロイ後に migration 0032 の実行が必要です（`/status` → 「マイグレーション実行」ボタン、または `wrangler d1 execute` で手動実行）。
- `timeseries` の日付は SQLite の `DATE(searched_at)` によるため UTC 基準です。表示時に JST 変換が必要な場合はクライアント側で処理してください。
- `coKeywords` の集計は `commit_search_repo_stats` の自己結合で行われます。データ量が増えると計算コストが上がるため、結果は最大 30 件に制限しています。
- 検索結果が 0 件の場合、3 テーブルへの保存は行われません（`total_hits === 0` の検索はDBに記録されない）。
