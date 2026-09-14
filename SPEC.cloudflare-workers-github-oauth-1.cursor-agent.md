# SPEC.cloudflare-workers-github-oauth-1.cursor-agent.md

**対象**: `/cursor-agent` ページ、Cursor Background Agent API（Cloud Agent / VM）、
D1 `cursor_agent_*` テーブル、および今日以降の AIチャット入力窓・ダイナミックワーカー
（`nekoserver/dynamicneko`）からの問い合わせ — いま実装済みの起動・チャンク結合・
キャッシュ・応答検索・過去ログ検索を1箇所にまとめ、次に足す2経路の到達点を決める。

日付付き SPEC の詳細は末尾の関連に残す。診断用の本番エラー文言は
[`SPEC.cursor-agent.md`](SPEC.cursor-agent.md) にも残す（表未作成・データ破損のテストに使う。削除禁止）。

---

## 0. 到達点

**対象**: cursor-agent 機能の「いまできること」と「今日以降にやること」の境界。

| 状態 | 内容 |
|---|---|
| 実装済み | Cursor API への問い合わせ、会話応答のチャンク抽出・結合、回答キャッシュ保存、応答本文＋画面列の検索、過去ログ検索（キーワード×ヒット起動の保存）、AIチャット入力窓からの表示検索（スラッシュコマンド `/neko csearch`） |
| 未実装（本 SPEC の次工程） | AIチャット入力窓からの起動と過去ログ保存 |
| 未実装（本 SPEC の次工程） | ダイナミックワーカーから同じ起動・検索・過去検索を行う |

入口が違っても、D1 の所有者は GitHub ユーザー（`user_id`）で一意にする。
履歴・キャッシュ・過去ログを入口ごとに分裂させない。

---

## 1. 実装済み: `/cursor-agent` から Cursor VM へ

**対象**: `GET /cursor-agent`（`src/views/cursorAgent.ts`）、
`POST /api/cursor-agent/launch`、Cursor Background Agent API
`POST https://api.cursor.com/v1/agents` —
プロンプトと許可リポジトリから VM 上の Agent を起動し、問答を D1 に残す。

### 背景

本体 Worker から Cursor Cloud Agent を起動し、外部 Cursor アプリへ逃げずに
起動結果・状態・回答文を読めるようにする。秘密情報は `CURSOR_API_KEY`
（`wrangler secret put`）。`[vars]` への平文記載は禁止。

### 起動フロー

```text
入力(prompt, repoFullName)
  → validateCursorAgentLaunchRequest
       (CURSOR_API_KEY / プロンプト2文字以上 / 許可リポジトリ)
  → POST https://api.cursor.com/v1/agents
       Authorization: Basic base64(CURSOR_API_KEY:)
       body: buildCursorAgentRequestBody
  → extractCursorAgentFields
  → INSERT cursor_agent_launch_log
  → INSERT cursor_agent_status_log（初回）
  → JSON { cursorResponse, historySaved, reportText }
```

許可リポジトリは当面 `nekoserver/cloudflare-workers-github-oauth-1` のみ
（`CURSOR_AGENT_ALLOWED_REPOS`）。model は `grok-4.6`、effort `high`、fast `true`、
`startingRef: main`。`agent_id` は **`agent.id` ネストのみ**（トップレベル `id` は見ない）。

D1 保存失敗でも Cursor 起動自体は成功扱いで HTTP 200、`historySaved: false`
（ルール8: 記録は logger、通知はレスポンス）。Cursor API 失敗は 502。

### HTTP（セッション必須）

すべて `authMiddleware`。履歴は `user.sub` と一致する行だけ。他人の `id` は 404。

| メソッド | パス | 役割 |
|---|---|---|
| `GET` | `/cursor-agent` | HTML |
| `POST` | `/api/cursor-agent/launch` | 起動 |
| `GET` | `/api/cursor-agent/history` | 一覧。`?q=` で検索（D1 へ書かない） |
| `POST` | `/api/cursor-agent/history/past-log-search` | 検索してキーワード×ヒットを保存 |
| `GET` | `/api/cursor-agent/history/:id/timeline` | status_log 連鎖 |
| `POST` | `/api/cursor-agent/history/:id/refresh` | `GET /v1/agents/{id}` → status_log 追記 |
| `GET` | `/api/cursor-agent/history/:id/conversation` | 会話回答（キャッシュ優先） |
| `DELETE` | `/api/cursor-agent/history/:id` | 暫定削除（子テーブルも削除） |

主要ロジックは `src/utils/cursorAgentLaunch.ts` に切り出し済み（ルール15）。

### 関連コミット

- [`75a299d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/75a299d) Cursor Background Agent 起動ページ(`/cursor-agent`)を追加
- [`c1c7931`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c1c7931) cursor-agentのagent_id抽出バグを修正(常にnullで保存されていた)
- [`c6d0e28`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c6d0e28) cursor-agentのテーブル設計を親子(launch_log/status_log)に分離し個別カラム化

---

## 2. 実装済み: 応答のチャンク処理

**対象**: `GET /api/cursor-agent/history/:id/conversation`、
`extractCursorAgentConversationAnswers` / `mergeCursorAgentConversationAnswers` —
Cursor 会話 API が返す assistant 断片を、人間が読める1本の回答文にする。

### 背景

会話 API（`GET https://api.cursor.com/v0/agents/{id}/conversation`）の
`messages` は複数チャンクになる。user の発言を回答として出すと質問と答えが混ざる。

### 処理

1. `payload.messages` を出現順に走査する
2. `type === 'assistant_message'` または `'assistant'` かつ非空 `text` だけ採用する
3. `user_message` は捨てる
4. 空文字を除き `\n\n` で結合する（`mergeCursorAgentConversationAnswers`）
5. 断片が無ければ `""`（空キャッシュとしては INSERT しない）
6. ハンドラは結合後の1本を `answers: [merged]` で返す。空なら `[]`

レポート欄（`report_text`）は別経路。`GET /v1/agents/{id}` の `run.text` 優先
（`extractCursorAgentSummaryText`）。会話回答と混同しない。

### 関連コミット

- [`8eb1aeb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8eb1aeb) cursor-agentのAgent IDタップでアプリ先の回答文を最上位モーダルへ埋め込む
- [`af7b23a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/af7b23a) cursor-agentの回答文をMarkdown表示しD1キャッシュを優先する

---

## 3. 実装済み: キャッシュ保存

**対象**: D1 `cursor_agent_answer_cache`（migration 0139）、
`GET /api/cursor-agent/history/:id/conversation`、
`isCursorAgentSuccessfulTerminal` —
完了した回答文だけを `launch_id` UNIQUE で保存し、再表示時は Cursor API を呼ばない。

### 書き込み条件

成功終端（`agent_status` が `FINISHED` / `COMPLETED`、または `run_status` が `COMPLETED`）
かつ結合後の回答が非空のときだけ INSERT。RUNNING 中の途中文は UNIQUE で永久保存しない
（以後キャッシュ優先になり、完成文に更新できなくなる）。

未完了の行は毎回会話 API を呼ぶ。キャッシュ読み出しも成功終端のときだけ行う。

表は assistant の回答本文だけ持つ。生の会話 JSON と `user_message` は持たない。

0139 未適用でも会話 API は呼べる。キャッシュ読み出し失敗は `cacheError` と logger
（空成功にしない）。回答本文検索にはこの表が必要。SQL:

```sql
CREATE TABLE IF NOT EXISTS cursor_agent_answer_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  launch_id INTEGER NOT NULL UNIQUE REFERENCES cursor_agent_launch_log(id),
  answer_text TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cursor_agent_answer_cache_launch ON cursor_agent_answer_cache(launch_id);
```

### 関連コミット

- [`af7b23a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/af7b23a) cursor-agentの回答文をMarkdown表示しD1キャッシュを優先する

---

## 4. 実装済み: 応答検索と過去応答検索

**対象**: `GET /api/cursor-agent/history?q=`、
`POST /api/cursor-agent/history/past-log-search`、
`queryCursorAgentHistoryWithSearch`、D1 `cursor_agent_search_log` /
`cursor_agent_search_history`（migration 0140）、`/cursor-agent` 検索窓。

### 検索対象

サーバ側 INSTR（大小文字無視）。LIKE の `%`/`_` は使わない。

| 列 | 由来 |
|---|---|
| 回答本文 | `cursor_agent_answer_cache.answer_text`（LEFT JOIN） |
| プロンプト | `cursor_agent_launch_log.prompt` |
| レポート | 最新 `cursor_agent_status_log.report_text` |
| Agent ID | `cursor_agent_launch_log.agent_id` |
| リポジトリ | `cursor_agent_launch_log.repo_full_name` |

キャッシュ未作成の行も画面の列でヒットする（LEFT JOIN）。上限 100 件、新しい順。
検索語は trim + 200 文字切り。

### インクリメンタル（表示のみ）

入力は 300ms デバウンスで `GET ?q=`。検索ボタンと Enter も同じ GET。
D1 の過去ログへは書かない。世代番号 `historyFetchSeq` と AbortController で、
初期読み込みの遅延応答が検索結果を上書きしない。

検索欄を空にすると全件へ戻る。「解除」ボタンと「再読み込み」ボタンは置かない。

### 過去ログ検索（保存する）

「過去ログ検索」だけが `POST /api/cursor-agent/history/past-log-search`。
サーバが自分の履歴を再検索し、ヒットした `launch_id` をキーワードへ結ぶ。
クライアントが送った ID は使わない。AIチャットの `aichat_search_log` と同じく
`(user_id, keyword, launch_id)` が一意。再検索では `select_count` を増やす。
明細は `seq_num` を増やして追記する。

0140 未適用でもヒット一覧は返し、`persistError` を載せる。

### 0139 欠落時のフォールバック

0140 を適用しても、欠落しているのが `cursor_agent_answer_cache` なら
次の `searchError` は残る（空成功にしない。データ破損・テーブル未設定のテストに使う）。

```text
回答キャッシュの検索に失敗しました: D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR
```

JOIN 失敗時は画面の列だけで再検索する。プロンプト等に一致すれば `rows` に載る。
インクリメンタルが空一覧のまま死なないようにする。

| 状態 | 見え方 |
|---|---|
| 0139 が無い／壊れている | `searchError` に表名。画面の列に一致すれば `rows` あり |
| 表はあるがキャッシュ0件 | `searchError` なし。`cacheTotal === 0` |
| 表もあり語が不一致 | `searchError` なし。`cacheTotal > 0` でヒット0件 |

### 関連コミット

- [`245906c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/245906c) cursor-agentの履歴検索を回答キャッシュ本文のサーバ検索へ切り替える
- [`a9a5f83`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a9a5f83) 履歴検索を画面の語でもヒットさせ、失敗メッセージが見えるようにする
- [`2082ec9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2082ec9) cursor-agentに過去ログ検索を追加しインクリメンタル検索を戻す
- [`afc8f75`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/afc8f75) 回答キャッシュ表欠落時も画面の列で検索し解除ボタンを撤去する

---

## 5. 実装済み: D1 スキーマ

**対象**: migration 0137–0140 の `cursor_agent_*` テーブル。
`/status` の `STATUS_TABLE_DEFINITIONS` / `TABLE_COLUMN_KEYS` / `TABLE_GROUP_MAP`
（グループ `'ai'`）/ `COLUMN_FK_TARGETS` / `STATUS_MIGRATION_SQL` に登録済み。

| テーブル | migration | 役割 |
|---|---|---|
| `cursor_agent_launch_log` | 0137 + 0138 | 1起動=1行。prompt / agent_id / user_id |
| `cursor_agent_status_log` | 0138 | 状態取得の連鎖。refresh のたび追記 |
| `cursor_agent_answer_cache` | 0139 | 完了回答本文。launch_id UNIQUE |
| `cursor_agent_search_log` | 0140 | 過去ログ集計 `(user_id, keyword, launch_id)` UNIQUE |
| `cursor_agent_search_history` | 0140 | 過去ログ明細。seq_num 追記 |

論理 FK: `user_id` → `user_sessions`。SQL FK: `launch_id` → `cursor_agent_launch_log`。

削除順: search_history → search_log → answer_cache → status_log → launch_log。

---

## 6. 実装済み: `/cursor-agent` UI の約束

**対象**: `src/views/cursorAgent.ts`。

- Agent ID タップは外部 Cursor へ飛ばず、最上位モーダルに回答文（Markdown）と
  状態タイムラインを出す。z-index は `getNextZ()`（ルール26）
- 日時は UTC 保存を JST 換算し「JST」と明記する
- レポート欄に生 JSON を出さない
- ページ表示・起動直後・検索欄クリア時、未終了行だけ自動 `refresh`
- PWA 右上に外部リンクを置かない。ナビ帯は高さ 44px
- `/welcome` ドロップダウンへは、依頼が無い限り `/cursor-agent` を足さない（ルール30）

---

## 7. 今日以降: AIチャット入力窓からの Cursor VM 問い合わせと過去検索

**対象**: `/aichat` の入力窓（`src/views/aichat.ts`）、
`src/utils/aichatSlashCommand.ts` の `/neko` スラッシュコマンド —
ログイン済みセッションから、`/cursor-agent` と同じ起動・応答検索・過去ログ検索を
入力窓で完結させる。検索（`/neko csearch`）は実装済み。起動と過去ログ保存は未実装。

### 背景

`/cursor-agent` で起動〜キャッシュ〜検索までは動く。日常の入口は AIチャット入力窓
（Slack / 入力窓 / 回答伝播 / ダイナミックワーカーの4ソースのうち `textbox`）である。
いまの `/neko search` / `/neko s` は `ai_chat_shares` の過去ログであり、
Cursor VM の起動履歴（`cursor_agent_launch_log`）とは別コーパスである。混ぜない。

ナビに `/cursor-agent` を足すことは、この SPEC の作業範囲に含めない（ルール30）。

### 到達点

1. 入力窓から Cursor VM を起動できる
2. 入力窓から応答本文＋画面列を検索できる（表示のみ。キー入力のたびに過去ログへ書かない）
3. 入力窓から過去ログ検索できる（キーワード×ヒット起動を 0140 へ保存する）
4. 所有者は JWT の `user.sub`。既存 `/api/cursor-agent/*` と同じ行が見える
5. コア処理は `cursorAgentLaunch.ts` の既存関数を呼ぶ。ハンドラへコピペしない

### スラッシュコマンド案（実装時に確定してよい。コーパスは分離する）

| 入力 | 動き | 既存 API 相当 | 状態 |
|---|---|---|---|
| `/neko cursor <プロンプト>` | VM 起動。許可リポジトリは現状1件なので省略可 | `POST /api/cursor-agent/launch` | 未実装 |
| `/neko csearch <語>` | ヒットした質問文を表で返す（最大30件）。先頭列は作成時刻(JST)。「表示」リンクから最上位モーダルでキャッシュを読む。0140へは書かない | `queryCursorAgentHistoryWithSearch` + `GET .../history/:id/conversation` | 実装済み |
| `/neko cursor-past <語>` | 同じ検索をしたうえで 0140 へ保存 | `POST .../past-log-search` | 未実装 |

`/neko search` の意味を Cursor VM 側に付け替えてはいけない。
AIチャット過去ログ検索は残す。

### 実装済み: `/neko csearch`

**対象**: `/aichat` 入力窓のスラッシュコマンド `/neko csearch <キーワード>`、
`POST /api/aichat` の `searchCursorAgentHistory`、
応答バブル内の質問文表、「表示」リンク、`#cursorAgentAnswerModal` —
件数表示の代わりにヒットした起動の作成時刻(JST)と質問文（`prompt`）を表にし、
`[表示](#csearch-{id})` から `GET /api/cursor-agent/history/:id/conversation` のキャッシュ優先本文を
最上位モーダルで読む。

#### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | `/neko search` と混ざり `ai_chat_shares` を見る | 別スラッシュコマンド。`searchShares` は呼ばない |
| 2 | ヒット有無だけ出して質問文が無い | `formatAichatNekoCsearchResults` が質問文表を返す |
| 3 | 「表示」がプレーンテキストで実リンクにならない | Markdown が `[表示](#csearch-{id})` を出し、`parseMd` が `<a>` を作る。クリックは `preventDefault` して専用モーダル |
| 4 | 回答全文が AIチャット `historyModal` を開く | `nekoCursorResults` と専用モーダル。`getNextZ()` 登録 |
| 5 | キャッシュ欠落を空で握りつぶす | モーダルにエラーまたは「キャッシュに回答文がありません」 |
| 6 | 入力のたびに 0140 へ書く | 表示検索のみ。`persistCursorAgentPastLogHits` は呼ばない |
| 7 | `created_at` 欠落・不正を空にする | `formatCursorAgentCreatedAtJst` が `(時刻不明)` または原文を残す |
| 8 | parseMd の `target="_blank"` で別タブへ飛ぶ | 配線時に `target` を外し `preventDefault` する |

応答のチャンク結合とキャッシュ書き込みは、起動直後ではなく
成功終端を確認したあと（既存 conversation 経路）で行う。入力窓から起動した行も
同じ `launch_id` を使う。Agent ID 相当の識別子は応答 Markdown に出し、
詳細は既存モーダルまたは `/cursor-agent` で読めるようにする。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | `/neko search` が Cursor 履歴まで拾い、AIチャット過去ログと混ざる | コマンドを分ける。SQL も `ai_chat_shares` と `cursor_agent_*` を混ぜない |
| 2 | 入力のたびに 0140 へ INSERT する | 表示検索と過去ログ保存を分ける（現行と同じ） |
| 3 | ハンドラに起動ロジックを直書きする | `validateCursorAgentLaunchRequest` 等を再利用 |
| 4 | CURSOR_API_KEY 未設定で Cursor API に空認証を送る | 既存 validation。Cursor API の前に 400 |
| 5 | 他人の launch を返す | `user_id = user.sub` を既存関数に任せる |
| 6 | 起動は成功したが D1 失敗を黙る | `historySaved: false` 相当をチャット応答に出す |
| 7 | welcome ナビへ勝手にリンクを足す | やらない |

### 実装方針

- slash 判定は `aichatSlashCommand.ts` に追加し、ユニットテストを先に書く
- 起動・検索・保存はサーバ側（ブラウザから Cursor API を直接叩かない）
- `/neko help` の表に行を足す（ルール16: Markdown テーブル）
- `/neko aireqst` のソース内訳には、起動そのものはまだ `ai_chat_shares.source`
  ではない。Cursor VM 起動回数を載せるかは別判断（この SPEC では必須にしない）

---

## 8. 今日以降: ダイナミックワーカーからの問い合わせ

**対象**: `nekoserver/dynamicneko` の AI 問い合わせウィジェット、
本体 Worker の `POST /api/aichat/query-external` /
`POST /api/kimi-code/generate-external` と同じ外部呼び出しパターン —
dynamicneko は本体の Cookie セッションを持たない。**未実装。**

### 背景

dynamicneko は Service Binding（`DYNAMICNEKO` / 呼び出し元からは本体 Worker）で
本体 API を呼ぶ。`*.workers.dev` 同士の通常 fetch は Cloudflare 1042 で落ちるため
公開 URL にしない（`src/types.ts` の `DYNAMICNEKO` コメント、`/neko hellodw`）。

既存の外部 API:

| API | 認証 | 本体処理 | 所有者 |
|---|---|---|---|
| `POST /api/aichat/query-external` | `AICHAT_EXTERNAL_SECRET` | Workers AI | `login` → `user_sessions.user_id` で `ai_chat_shares` 保存 |
| `POST /api/aichat/permission-external` | 同上 | 許可メール確認 | `dynamicneko_aichat_allowed_users` |
| `POST /api/kimi-code/generate-external` | `KIMI_CODE_EXTERNAL_SECRET` | `runKimiCodeGeneration` | ログの userId は `'dynamicneko-service'` |

cursor-agent の履歴はユーザー単位である。kimi-code のように
`userId='dynamicneko-service'` で launch_log を書くと、本体 `/cursor-agent` と
履歴が分裂する。aichat external の `login` 解決を踏襲する。

いま `query-external` がローカル処理する `/neko` は `aireqst` だけ。
他サブコマンドは Cookie 前提の D1 参照が多く対象外、とコメントされている。
Cursor VM コマンドはここに個別追加する。

### 到達点

1. dynamicneko から Cursor VM を起動できる
2. dynamicneko から応答検索（表示）と過去ログ検索（保存）ができる
3. 起動・検索結果は、同じ GitHub login が `/cursor-agent` と AIチャット入力窓で見た行と一致する
4. 未許可メールでは Cursor API を呼ばない（課金・VM 起動を止める）
5. コア処理はセッション経路と共通関数。external は認証と `user_id` 解決だけが違う

### 認証と所有者

kimi-code / aichat に倣い、変数名は呼び出し元と同じにする
（名前食い違いで 401 になった事故の再発防止）。

| 項目 | 方針 |
|---|---|
| 通信 | Service Binding。公開 URL の fetch にしない |
| 認証 | Bearer secret（例: `CURSOR_AGENT_EXTERNAL_SECRET`。実装時に dynamicneko 側と同名） |
| 許可 | `dynamicneko_aichat_allowed_users` を当面再利用。専用表が必要になったら分ける |
| 起動の user_id | body の `login`（GitHub login）。`user_sessions` に無ければ保存せず 403/400。`'dynamicneko-service'` で launch しない |
| 権限 UI | permission-external 相当でグレーアウトしてよいが、本体 API でも再検証する |

### API 案（実装時にパス名を確定してよい）

セッション用と処理を共有し、認証だけ分ける。

| 役割 | セッション（既存） | external（追加） |
|---|---|---|
| 起動 | `POST /api/cursor-agent/launch` | `POST /api/cursor-agent/launch-external` |
| 検索（表示） | `GET /api/cursor-agent/history?q=` | `POST /api/cursor-agent/history-external`（Binding では GET クエリより JSON body の方が扱いやすい） |
| 過去ログ | `POST /api/cursor-agent/history/past-log-search` | `POST /api/cursor-agent/past-log-search-external` |

body 例: `{ email, login, prompt, keyword, repoFullName? }`。
`email` で許可、`login` で `user_id`。prompt / keyword は経路ごとに必須。

`query-external` の question に `/neko cursor ...` を載せる案もある。
その場合も Cursor 用コア関数を呼び、Workers AI には落とさない。
既存の「`aireqst` 以外の /neko は対象外」を、Cursor コマンドだけ例外として明示する。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | Cookie セッション前提のまま呼んで常時 401 | Bearer secret 経路を新設 |
| 2 | 公開 URL fetch で 1042 | Service Binding のみ |
| 3 | secret 名が本体と dynamicneko で違う | 同名にする |
| 4 | 許可メールを UI だけ見て本体で再検証しない | launch/search でも allowlist を見る |
| 5 | `dynamicneko-service` で launch_log を書く | `login` → `user_sessions` |
| 6 | login が本体未ログインで行が孤児になる | 保存スキップまたは 403。黙って他人名義にしない |
| 7 | クライアント指定の launchIds を信じて過去ログへ結ぶ | サーバ再検索のみ（現行と同じ） |
| 8 | 0139 欠落を空成功にする | 既存 `searchError` を JSON で返す |
| 9 | RUNNING 回答をキャッシュする | 既存 `isCursorAgentSuccessfulTerminal` |

### 実装方針

- テストを先に書く（secret 不一致 401、未許可 403、login 無しで launch しない、
  他人の履歴が返らない、表示検索が 0140 を書かない）
- `runKimiCodeGeneration` と同様、ハンドラから共通関数を呼ぶ
- ルール8: catch したら logger + レスポンスの error。空の成功にしない
- ルール32: 失敗は discriminated union。文字列 prefix 判定にしない
- dynamicneko 側ウィジェットの UI はこのリポジトリの後続作業。本体は API 契約を先に固定する

---

## 9. 3経路で共有する原則

**対象**: `/cursor-agent`、AIチャット入力窓、ダイナミックワーカーの3入口。

1. 起動前チェックは `validateCursorAgentLaunchRequest` のみ
2. チャンク抽出・結合・成功終端キャッシュは既存関数のみ
3. 検索 SQL は `queryCursorAgentHistoryWithSearch` のみ（0139 フォールバック含む）
4. 過去ログ保存は `persistCursorAgentPastLogHits` のみ。GET/キー入力では呼ばない
5. 所有者は GitHub ユーザー。入口用のダミー user_id で履歴を分裂させない
6. `CURSOR_API_KEY` は secret。external secret も `[vars]` に書かない
7. 診断用 `searchError` 文言は残す（次節）

---

## 10. 診断用 searchError（必載・削除禁止）

**対象**: `GET /api/cursor-agent/history?q=` および同じ検索関数を使う全入口。
表未作成とデータ破損の両方のテストに使う。統合してもこの節は削除しない。

本番 D1:

```text
回答キャッシュの検索に失敗しました: D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR
```

組み立ては `回答キャッシュの検索に失敗しました: ` + D1 の `err.message`。
`D1_ERROR:` と `: SQLITE_ERROR` は Cloudflare D1 が付ける。
vitest の node:sqlite では `no such table: cursor_agent_answer_cache` になるが、
表名と日本語プレフィックスは共通である。

詳細な再現手順は [`SPEC.cursor-agent.md`](SPEC.cursor-agent.md)。

---

## 11. テスト資産（実装済み）

**対象**: 現行の vitest。次工程でも同じファイル群に足す。

| ファイル | 対象 |
|---|---|
| `src/utils/cursorAgentLaunch.test.ts` | 純関数、SQL、欠落判定、過去ログ persist |
| `src/cursor-agent-launch.test.ts` | HTTP ルート、キャッシュ条件、searchError |
| `src/cursor-agent-past-log-search.test.ts` | POST 過去ログ、0140 未作成 |
| `src/cursor-agent-history-answer-search-e2e.test.ts` | インクリメンタル、searchError と行の同時表示 |
| `src/cursor-agent-answer-modal-e2e.test.ts` | Agent ID → モーダル回答 |
| `src/aichat-slash-csearch.test.ts` | スラッシュコマンド `/neko csearch` の解釈・表整形・タイムアウト |
| `src/aichat-neko-csearch-modal.test.ts` | 入力窓の質問文表とキャッシュ全文モーダル |

次工程で追加するテストの置き場:

- AIチャット: 起動と過去ログ保存の slash / E2E
- dynamicneko: `src/dynamicneko-aichat-external-endpoints.test.ts` と同型の
  Bearer secret / allowlist / login 解決テスト

---

## 12. 関連

**対象**: 日付付き SPEC・NOTICE・既存の aichat/dynamicneko 資料。

### 関連コミット

- [`6dd3308`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6dd3308) cursor-agentの実装済み範囲と入力窓・ダイナミックワーカー対応をSPECにまとめる
- [`762eaaf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/762eaaf) cursor-agentの実装評価と達成度をEVALに時系列でまとめる
- [`bd0d7cf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bd0d7cf) AIチャットに /neko csearch を追加しCursor VM過去ログを表で返す
- [`d944bf8`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d944bf8) /neko csearch の操作列を「表示」リンクにし作成時刻(JST)を先頭列へ出す
- [`be77572`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/be77572) /neko csearch の表示下線を外しモーダル回答をMarkdown描画する

### 関連資料

- [`SPEC.cursor-agent.md`](SPEC.cursor-agent.md) — 診断文言の必載コピー
- [`SPEC.cloudflare-workers-github-oauth-1.20260913.md`](SPEC.cloudflare-workers-github-oauth-1.20260913.md) — モーダル回答、キャッシュ検索、過去ログ
- [`SPEC.cloudflare-workers-github-oauth-1.20260914.md`](SPEC.cloudflare-workers-github-oauth-1.20260914.md) — 0139 欠落フォールバック
- [`NOTICE.cloudflare-workers-github-oauth-1.20260914.md`](NOTICE.cloudflare-workers-github-oauth-1.20260914.md)
- [`SPEC.cloudflare-workers-github-oauth-1.dynamicneko-aichat-flow.md`](SPEC.cloudflare-workers-github-oauth-1.dynamicneko-aichat-flow.md)
- [`NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md`](NOTICE.cloudflare-workers-github-oauth-1.github-webhook-slack.md) — Binding / secret 名
- [`EVAL.cloudflare-workers-github-oauth-1.20260914.md`](EVAL.cloudflare-workers-github-oauth-1.20260914.md) — 作成時点の警告。成功終端キャッシュとインクリメンタルは現行で対処済み
- [`EVAL.cloudflare-workers-github-oauth-1.cursor-agent.md`](EVAL.cloudflare-workers-github-oauth-1.cursor-agent.md) — 2026-09-13〜14 の実装評価と達成度（時系列コミット表）
