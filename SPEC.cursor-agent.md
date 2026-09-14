# SPEC.cursor-agent.md

日付付き SPEC と実装の横断まとめは
[`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md)
へ移した。起動・チャンク結合・キャッシュ・応答検索・過去ログ検索の現状と、
今日以降の AIチャット入力窓・ダイナミックワーカー対応の到達点はそちらを正とする。

統合しても、次の診断メッセージ節は削除しない。表未作成とデータ破損の確認に使う。

## 1. 回答キャッシュ表が無い／壊れているときの検索エラー

**対象**: `GET /api/cursor-agent/history?q=`、D1 `cursor_agent_answer_cache`（migration 0139）、
`/cursor-agent` 問答履歴の検索結果欄（`.history-search-error`） —
表が未作成のとき、または表が落ちて SQLite が同じエラーを返すとき、空の成功（0件）にせず
次の文言を `searchError` として返す。データ破損時とテーブル未設定時の両方のテストに使う。

### 本番 D1 で出る文言（必載）

```text
回答キャッシュの検索に失敗しました: D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR
```

組み立ては `回答キャッシュの検索に失敗しました: ` + D1 の `err.message`。
`D1_ERROR:` と末尾の `: SQLITE_ERROR` は Cloudflare D1 が付ける。
vitest の node:sqlite では `no such table: cursor_agent_answer_cache` だけになるが、
表名を含むことと、先頭の日本語プレフィックスは共通である。

### 再現

1. migration 0139 を実行していない D1、または `DROP TABLE cursor_agent_answer_cache` したあと
2. `/cursor-agent` で検索語を入れて検索する（インクリメンタル / 「検索」 / 「過去ログ検索」のいずれでも、`q` 付き履歴取得が走る）
3. 履歴欄に上記 `searchError` が出る。HTTP は 200 のまま。
   プロンプト等の画面の列に一致する行があれば `rows` に載る。一致が無ければ `rows` は空配列。
   migration 0140 を適用しても 0139 が無い限り `searchError` は消えない。

### 区別

| 状態 | 見え方 |
|---|---|
| 表が無い／壊れている | `searchError` に `no such table: cursor_agent_answer_cache`。画面の列に一致すれば `rows` あり |
| 表はあるがキャッシュ0件 | `searchError` なし。`cacheTotal === 0`。「回答キャッシュは0件です」 |
| 表もあり行もあるが語が不一致 | `searchError` なし。`cacheTotal > 0` でヒット0件 |

空成功にすると、未マイグレーションと「まだ Agent ID を開いていない」が区別できない。
JOIN 失敗で `rows` を常に空にすると、インクリメンタル検索が死んで見える。

### テスト

- `src/cursor-agent-launch.test.ts`: 表を作らず `?q=` したとき `searchError` が
  `回答キャッシュの検索に失敗しました` と `no such table: cursor_agent_answer_cache` を含む。
  画面の列に一致する語なら `rows` も返す
- `src/cursor-agent-history-answer-search-e2e.test.ts`: `searchError` を履歴欄へ出す。行があるときは表も残す

## 2. キャッシュ表欠落時の画面列フォールバックと解除ボタン撤去

**対象**: `queryCursorAgentHistoryWithSearch`、`GET /cursor-agent` の検索窓 —
0139 未適用でもプロンプト等で絞り込み、検索欄を空にすれば一覧へ戻す。「解除」は置かない。

詳細は [`SPEC.cloudflare-workers-github-oauth-1.20260914.md`](SPEC.cloudflare-workers-github-oauth-1.20260914.md)
および横断まとめ [`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md) 節4。

### 関連

- [`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md)
- [`SPEC.cloudflare-workers-github-oauth-1.20260913.md`](SPEC.cloudflare-workers-github-oauth-1.20260913.md) 節4・節5
- [`NOTICE.cloudflare-workers-github-oauth-1.20260914.md`](NOTICE.cloudflare-workers-github-oauth-1.20260914.md)
- [`8d0cc6e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8d0cc6e) 回答キャッシュ表未作成時のD1検索エラーをSPEC.cursor-agent.mdに残す
- [`afc8f75`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/afc8f75) 回答キャッシュ表欠落時も画面の列で検索し解除ボタンを撤去する
