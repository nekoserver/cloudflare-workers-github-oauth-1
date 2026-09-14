# SPEC.cloudflare-workers-github-oauth-1.20260914

## 1. 回答キャッシュ表欠落時は画面の列で検索を継続する

**対象**: `GET /api/cursor-agent/history?q=`、`POST /api/cursor-agent/history/past-log-search`、
`queryCursorAgentHistoryWithSearch`、`/cursor-agent` 問答履歴のインクリメンタル検索 —
migration 0140（過去ログ表）を適用しても `cursor_agent_answer_cache`（0139）が無いと
`LEFT JOIN` が落ち、検索語付きの問い合わせが空行だけになってインクリメンタル検索が死ぬ。
診断用 `searchError` は残したまま、プロンプト・レポート・Agent ID・リポジトリだけで再検索する。

### 背景

本番で 0140 を適用してページをリロードしても、次の文言が残る。

```text
回答キャッシュの検索に失敗しました: D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR
```

0140 は `cursor_agent_search_log` / `cursor_agent_search_history` を作るだけで、
このエラーの表は 0139 である。加えて、`q=` 付き SQL がキャッシュ表を JOIN するため、
表が無いとヒット0件になり、入力しても一覧が空のままになる。
「解除」は検索語なし一覧へ戻すためのボタンだったが、`type=search` を空にすれば
`input` で同じ復帰ができるため、謎の操作に見えていた。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 0140 だけ適用し 0139 が無い | JOIN 失敗を `searchError` に残し、画面の列で再検索する |
| 2 | 再検索まで空行にする | プロンプト等に一致する行は `rows` に載せる |
| 3 | `searchError` を消して空成功にする | 本番文言を残し、未作成とキャッシュ0件を区別する |
| 4 | 解除ボタンだけが一覧復帰手段 | ボタンを撤去し、検索欄を空にすると全件に戻す |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/cursorAgentLaunch.ts` | 欠落判定・JOINなしSQL・`queryCursorAgentHistoryWithSearch` |
| `src/index.ts` | GET 履歴と過去ログ検索が同じフォールバックを使う |
| `src/views/cursorAgent.ts` | 「解除」撤去。`searchError` とヒット行を同時表示 |

回答キャッシュ本文まで探すには、次の SQL を D1 で実行する（migration 0139）。

```sql
CREATE TABLE IF NOT EXISTS cursor_agent_answer_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  launch_id INTEGER NOT NULL UNIQUE REFERENCES cursor_agent_launch_log(id),
  answer_text TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_answer_cache_launch ON cursor_agent_answer_cache(launch_id);
```

### テスト

- `src/cursor-agent-launch.test.ts`: `q=anything` は空行+`searchError`。`q=表なし` は行+`searchError`
- `src/cursor-agent-past-log-search.test.ts`: キャッシュ表なしでもプロンプト一致を保存
- `src/cursor-agent-history-answer-search-e2e.test.ts`: エラーと行の同時表示、検索欄クリアで全件復帰

### 関連コミット

- [`afc8f75`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/afc8f75) 回答キャッシュ表欠落時も画面の列で検索し解除ボタンを撤去する

### 関連

- [`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md)
- [`SPEC.cursor-agent.md`](SPEC.cursor-agent.md)
- [`NOTICE.cloudflare-workers-github-oauth-1.20260914.md`](NOTICE.cloudflare-workers-github-oauth-1.20260914.md)

## 2. cursor-agent 横断 SPEC に現状と次工程をまとめる

**対象**: [`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md) —
`/cursor-agent` で実装済みの API 問い合わせ・チャンク処理・キャッシュ・応答検索・
過去ログ検索と、今日以降の AIチャット入力窓・ダイナミックワーカー対応の到達点。

### 背景

日付付き SPEC が機能単位に分かれており、次に足す2経路（入力窓 / dynamicneko）の
境界が見えにくかった。コーパス混同（`/neko search` = `ai_chat_shares`）と
`user_id='dynamicneko-service'` での履歴分裂を先に文書化する。

### 関連コミット

- [`6dd3308`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6dd3308) cursor-agentの実装済み範囲と入力窓・ダイナミックワーカー対応をSPECにまとめる

### 関連

- [`SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md`](SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md)
- [`SPEC.cursor-agent.md`](SPEC.cursor-agent.md)
- [`NOTICE.cloudflare-workers-github-oauth-1.20260914.md`](NOTICE.cloudflare-workers-github-oauth-1.20260914.md)

## 3. `/neko csearch` の「表示」を実リンクにし先頭列へ作成時刻(JST)を出す

**対象**: スラッシュコマンド `/neko csearch` の応答表、`formatAichatNekoCsearchResults`、
`mapCursorAgentHistoryToCsearchItems`、`#cursorAgentAnswerModal` —
操作列をプレーンテキスト「回答全文」から Markdown `[表示](#csearch-{id})` に変え、
各行の先頭に質問の作成時刻(JST)を置く。クリックは最上位モーダルでキャッシュ全文を読む。

### 背景

#1805 でスラッシュコマンド自体は認識されるようになったが、表の操作列が
プレーンテキストだったため `parseMd` が `<a>` を作らず、「回答全文」がリンクに見えなかった。
加えて作成時刻が無く、どの起動か時刻で辿れなかった。`created_at` は D1 の
`datetime('now')`（UTC・TZなし）なので、そのまま出すと JST と誤解される。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 「表示」がプレーンテキスト | Markdown リンクを出し `parseMd` が実アンカーを作る |
| 2 | `target="_blank"` で別タブへ飛ぶ | 配線時に `target` を外し `preventDefault` する |
| 3 | `nekoCursorResults` 欠落でリンク消失 | href `#csearch-{id}` から id を復元してモーダルを開く |
| 4 | `created_at` 欠落・不正を空にする | `(時刻不明)` または原文を残す |
| 5 | AIチャット `historyModal` を開く | 専用 `#cursorAgentAnswerModal` のみ |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/aichatSlashCommand.ts` | `formatCursorAgentCreatedAtJst`、表を3列、`[表示](#csearch-{id})` |
| `src/index.ts` | 履歴検索で `created_at` を渡す |
| `src/views/aichat.ts` | 実アンカー配線、下線リンク、時刻列 |

### テスト

- `src/aichat-slash-csearch.test.ts`: JST換算、表の3列、Markdownリンク
- `src/aichat-neko-csearch-modal.test.ts`: `<a href="#csearch-id">表示</a>`、クリックでモーダル、payload欠落時もリンク
- `src/utils/markdownRenderer.test.ts`: 表内ハッシュリンクが実アンカーになる

### 関連コミット

- [`d944bf8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d944bf8) /neko csearch の操作列を「表示」リンクにし作成時刻(JST)を先頭列へ出す

## 4. `/neko csearch` の表示リンク下線を外し、モーダル回答をMarkdown描画する

**対象**: `/aichat` の `.csearch-answer-link`、`#cursorAgentAnswerModalBody`、
`formatAichatSlashCommandHelp` の `/neko csearch` 行 —
「表示」の下線を消し、キャッシュ回答を `parseMd` で見出し・太字が出るようにし、
ヘルプ表記の `Cursor VM(courts)` を `Cursor VM` に揃える。

### 背景

#1806 で「表示」は実リンクになったが下線が残り、モーダル本文は `<pre>` + `textContent`
のため Markdown が生のまま出ていた。ヘルプだけ `Cursor VM(courts)` と書いており、
他の「Cursor VM」表記と食い違う。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 「表示」に下線が残る | `.csearch-answer-link` を `text-decoration: none` |
| 2 | 回答が `##` `**` の生テキスト | `innerHTML = parseMd(text)` と `.preview-area` |
| 3 | 生HTMLを innerHTML して XSS | `parseMd` 内の `esc()` 後だけ innerHTML。エラーは textContent |
| 4 | ヘルプが `Cursor VM(courts)` | `formatAichatSlashCommandHelp` を `Cursor VM` に直す |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/aichat.ts` | 下線削除、モーダル本体を preview-area の div、parseMd 描画 |
| `src/utils/aichatSlashCommand.ts` | `/neko help` の csearch 説明を Cursor VM に変更 |

### テスト

- `src/aichat-neko-csearch-modal.test.ts`: 下線なし、h2/strong、XSSエスケープ
- `src/utils/aichatSlashCommand.test.ts`: ヘルプに `(courts)` を含まない
