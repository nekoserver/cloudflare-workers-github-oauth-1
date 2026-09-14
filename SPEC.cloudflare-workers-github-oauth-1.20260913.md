# SPEC.cloudflare-workers-github-oauth-1.20260913

## 1. cursor-agentのAgent IDタップでアプリ先の回答文を最上位モーダルへ埋め込む

**対象**: `GET /cursor-agent`(`src/views/cursorAgent.ts`)、
`GET /api/cursor-agent/history/:id/conversation`、
`buildCursorAgentConversationUrl` / `extractCursorAgentConversationAnswers`
(`src/utils/cursorAgentLaunch.ts`) — 問答履歴の Agent ID をタップしたとき、
Cursorアプリ(`https://cursor.com/agents/{id}`)に表示される会話の回答文を
外部遷移せず、最上位レイヤーのモーダル内へ埋め込む。

### 背景

Agent ID は既にアプリ内モーダルを開いていたが、本文は状態タイムラインと
「Cursorで直接開く」リンクが中心で、アプリ先の回答文そのものはモーダルに
載っていなかった。回答を読むたびに外部アプリへ行く必要があった。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 他ユーザーの launch_id で会話を読める | user_id 不一致は 404。Cursor API は呼ばない |
| 2 | agent_id 未記録なのに空 id で問い合わせる | 400。Cursor API は呼ばない |
| 3 | CURSOR_API_KEY 未設定でも会話 API を呼ぶ | 400 |
| 4 | Cursor API 失敗を空 answers の成功として返す | 502 + error。モーダル回答欄にエラーを表示 |
| 5 | user_message を回答として出す | assistant_message / assistant のみ採用 |
| 6 | 回答を innerHTML で流し XSS になる | textContent で描画 |
| 7 | モーダルが他パネルの裏に入る | 開く直前に `getNextZ()` で z-index を設定 |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/cursorAgentLaunch.ts` | 会話URL組み立てと assistant 回答文の抽出を追加 |
| `src/index.ts` | `GET /api/cursor-agent/history/:id/conversation` を追加 |
| `src/views/cursorAgent.ts` | 最上位モーダル先頭に「回答文」欄を追加し、Agent ID タップで会話APIの answers を埋め込む |
| `src/utils/cursorAgentLaunch.test.ts` | URL組み立て・抽出のユニットテスト |
| `src/cursor-agent-launch.test.ts` | 会話APIとページHTMLのテスト |
| `src/cursor-agent-answer-modal-e2e.test.ts` | Agent ID タップ → モーダルに回答文が出る jsdom E2E |

### 関連コミット

- [`8eb1aeb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8eb1aeba46e2a40654d20f8aa54c1909494d96f7) cursor-agentのAgent IDタップでアプリ先の回答文を最上位モーダルへ埋め込む

## 2. 毎回落ちているユニットテストの修復

**対象**: jsdom環境のJWT検証(`src/utils/jwt.ts`)、空港/国境マスタ
(`src/data/airports.ts` / `src/data/countryBorders.ts`)、
`/apis` の `/api/aichat` 説明、および実装と乖離したソース文字列テスト —
毎回失敗していた15ファイル20件を、実装の契約に合わせて修復する。

### 背景

`npx vitest run` を回すたびに同じ20件が落ち、新規変更の成否が見えなくなっていた。
原因は実装退行ではなく、(1) jsdomとNodeのSubtleCryptoでArrayBufferのrealmが違う、
(2) マスタデータの欠落、(3) 実装変更後に更新されていないソース照合テスト、の3系統だった。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | jsdomでJWT検証が例外になり /cheese-search /wasm-modules が401 | verifyにUint8Arrayを渡す |
| 2 | APT_REGIONSのLKCSがAIRPORT_LISTに無く国旗が欠ける | LKCSを追加 |
| 3 | AIRPORT_LISTの🇦🇱にCOUNTRY_BORDERS.ALが無く国境描画が例外 | ALポリゴンを追加 |
| 4 | 古いテストが /neko hms 列挙を要求し、新しい契約(/neko help案内)と衝突する | 列挙しない契約にテストを揃える |
| 5 | ソース照合テストが古い断片を探し続けて落ちる | 現行実装の契約に合わせて更新 |
| 6 | aichat履歴E2Eでscript実行時にfetch未定義 | beforeParseでfetchを注入 |
| 7 | 城タップ座標が古い2点ビュー計算のまま当たない | tourPoints全体で視点を再計算 |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/jwt.ts` | SubtleCrypto.verifyへTypedArrayを渡す |
| `src/utils/jwt-jsdom.test.ts` | jsdom環境でのJWT往復テストを追加 |
| `src/data/airports.ts` | LKCSを追加 |
| `src/data/countryBorders.ts` | アルバニア(AL)の国境データを追加 |
| `src/views/apis.ts` / `src/data/apiEndpointList.ts` | /nekoは列挙せず /neko help へ案内 |
| 複数の `*.test.ts` | ソース照合・並び順・城タップ座標の契約を現行実装に合わせる |

### 関連コミット

- [`16892c9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/16892c9) jsdom環境でもJWT検証が通るようSubtleCryptoへTypedArrayを渡す
- [`002ea48`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/002ea48) AIRPORT_LISTにLKCSを追加しCOUNTRY_BORDERSにアルバニアを補完する
- [`e5b5b75`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e5b5b75) 毎回落ちていたソース照合テストとマスタ契約を現行実装に合わせる
- [`49914a0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/49914a0) /neko説明は列挙せずhelp案内に揃え、城タップテストのscrollIntoViewを補う

## 3. cursor-agent回答文のMarkdown表示とD1キャッシュ優先

**対象**: `GET /api/cursor-agent/history/:id/conversation`、
`cursor_agent_answer_cache`、`GET /cursor-agent` の回答モーダル
(`src/views/cursorAgent.ts`) — Agent IDタップ時の回答文をMarkdown描画し、
D1キャッシュがあればCursor APIを呼ばず、無ければAPI後に断片を1本へまとめて保存する。

### 背景

回答文は `textContent` のまま出てMarkdownにならず、毎回Cursor APIへ問い合わせていた。
会話はassistant断片が複数に分かれることがある。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | キャッシュがあるのに毎回Cursor APIを呼ぶ | 非空の `answer_text` があれば `source=cache` で返す |
| 2 | 断片を複数行のままキャッシュする | `mergeCursorAgentConversationAnswers` で1本化 |
| 3 | user_messageや生JSONをキャッシュする | assistant回答文だけを `answer_text` に保存 |
| 4 | 空回答をキャッシュして再取得できなくなる | 空はINSERTしない |
| 5 | キャッシュ表未作成でAPI回答まで落ちる | 読み書き失敗は `cacheError` に残し回答は返す |
| 6 | Markdownがプレーンテキストのまま | `parseMd` + `.preview-area` |
| 7 | 生HTMLをinnerHTMLしてXSSになる | `parseMd` 内の `esc()` 後にだけ innerHTML |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/cursorAgentLaunch.ts` | 回答断片の結合関数を追加 |
| `src/index.ts` | キャッシュ優先の会話API、削除時のキャッシュ削除、0139登録 |
| `src/views/cursorAgent.ts` | 回答欄を parseMd でMarkdown描画 |
| `migrations/0139_create_cursor_agent_answer_cache.sql` | キャッシュテーブル |

### 関連コミット

- [`af7b23a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/af7b23a) cursor-agentの回答文をMarkdown表示しD1キャッシュを優先する

## 4. cursor-agent履歴検索を回答キャッシュ本文へ切り替える

**対象**: `GET /api/cursor-agent/history?q=`、`GET /cursor-agent` の検索窓
(`#agentHistorySearch`)、`cursor_agent_answer_cache.answer_text` —
問答履歴の検索を、画面に載っている最新100件のプロンプト/リポジトリ/レポート
ではなく、D1の回答キャッシュ本文に対するサーバ側検索へ切り替える。

### 背景

検索はクライアントの `filterHistoryRows` が、すでに読み込んだ一覧列だけを
絞り込んでいた。Agent IDタップ後にキャッシュされた回答文は一覧に出ていないため、
回答の中身では探せなかった。また最新100件以外の起動も対象外だった。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 画面上のプロンプト/レポートだけで絞り、answer_textを見ない | `q` があるときだけ `INNER JOIN cursor_agent_answer_cache` + `instr(lower(a.answer_text), lower(?))` |
| 2 | 他人のキャッシュ行がヒットする | `l.user_id = ?` を維持 |
| 3 | 空の q でキャッシュ未作成の履歴が消える | 空白のみは検索なし(LEFT JOINのみ) |
| 4 | キャッシュ未作成の行がプロンプト一致で残る | 検索時はキャッシュ行がある起動だけ |
| 5 | `%` `_` がLIKEワイルドカードになる | INSTRでリテラル一致 |
| 6 | キャッシュ表未作成で空配列だけ返す | `searchError` を返し履歴欄に表示。ログにも残す |
| 7 | プレースホルダが「リポジトリ・プロンプト」のまま | 「回答キャッシュを検索...」に更新 |
| 8 | 入力のたびに再取得し、初期読み込みの一覧応答が検索結果を上書きする | インクリメンタルサーチを撤去。検索ボタン/Enterのみ。世代番号で遅延応答を破棄 |
| 9 | キャッシュ0件を検索故障と区別できない | `cacheTotal` を返し「回答キャッシュは0件」と表示 |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/cursorAgentLaunch.ts` | 検索語正規化と履歴SQL組み立てを追加 |
| `src/index.ts` | `GET /api/cursor-agent/history` が `q` で回答本文を検索 |
| `src/views/cursorAgent.ts` | 検索ボタン/Enterで `?q=` を付けて回答キャッシュを問い合わせ。inputでは検索しない |
| `src/cursor-agent-launch.test.ts` ほか | 回答本文ヒット・プロンプト非ヒット・searchError・E2E |

### 注意事項

- 回答キャッシュは Agent ID タップ(会話API)のあとで埋まる。未タップの起動は検索対象に入らない
- 追加のD1マイグレーションは不要(0139の `cursor_agent_answer_cache` を使う)
- 表未作成・表破損時は空成功にせず、次の `searchError` を出す。データ破損時とテーブル未設定時のテストに使う。`SPEC.cursor-agent.md` へまとめるときもこの文言を残す

```text
回答キャッシュの検索に失敗しました: D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR
```

### 関連コミット

- [`245906c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/245906c) cursor-agentの履歴検索を回答キャッシュ本文のサーバ検索へ切り替える
- [`bc95820`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bc95820) cursor-agent履歴検索からインクリメンタルを外しキャッシュ表だけを明示検索する
- [`8d0cc6e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/8d0cc6e) 回答キャッシュ表未作成時のD1検索エラーをSPEC.cursor-agent.mdに残す

## 5. 履歴検索が画面の語で0件になる不具合とエラー非表示

**対象**: `GET /api/cursor-agent/history?q=`、`#agentHistorySearch` —
INNER JOIN でキャッシュ行だけを見ていたため、画面上のプロンプトで検索すると
常に0件になり、失敗時の `error-msg` は `display:none` で消えていた。

### 背景

回答テーブル専用検索は、キャッシュが空、またはユーザーが表に見えている
プロンプト語を入れると「検索がまったく効かない」ように見える。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | プロンプト一致が0件 | LEFT JOIN + プロンプト/レポート/Agent ID/リポジトリも INSTR |
| 2 | searchError が `.error-msg` の display:none で見えない | `history-search-error` で常時表示 |
| 3 | RUNNING の途中文を UNIQUE キャッシュして更新不能 | FINISHED/COMPLETED のときだけ保存・ヒット |

### 注意事項

- 検索はサーバ側のまま。インクリメンタルサーチは戻さない
- 回答キャッシュ本文でも、画面の列でもヒットする

### 関連コミット

- [`a9a5f83`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a9a5f83) 履歴検索を画面の語でもヒットさせ、失敗メッセージが見えるようにする

## 6. 問答履歴の再読み込みボタンを撤去する

**対象**: `GET /cursor-agent` 問答履歴パネル右上の「再読み込み」 —
検索と隣り合い、何を対象に何をするボタンか分からず誤操作の原因になっていた。

### 背景

ボタンは `GET /api/cursor-agent/history` で最新100件を取り直し、未終了行だけ
`POST .../refresh` する。これはページを開いたときと同じ `loadHistory()` であり、
検索「解除」と行の「最新状態を取得」と重複する。押すと検索条件を捨てて一覧に戻る。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/cursorAgent.ts` | `agentHistoryReloadBtn` を撤去。`loadHistory` はページ表示・起動直後・解除・行refresh後に残す |

### 注意事項

- 未終了行の自動 refresh はページを開いたときに従来どおり走る
- 個別の最新化は各行の「最新状態を取得」を使う

### 関連コミット

- [`4f125c1`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4f125c1) 問答履歴の再読み込みボタンを撤去する

## 7. VM応答履歴の過去ログ検索（キーワード×ヒット起動の保存）

**対象**: `GET /cursor-agent` 問答履歴の検索窓、`POST /api/cursor-agent/history/past-log-search`、
D1 `cursor_agent_search_log` / `cursor_agent_search_history`（migration 0140） —
入力途中のインクリメンタル検索は残しつつ、「過去ログ検索」ボタンで
AIチャット左サイドバーの検索完了（`aichat_search_log` へキーワード×ヒット共有を結ぶ）と
同等に、検索キーワードとヒットした VM 起動履歴を結びつける。

### 背景

問答履歴の検索は入力途中でもヒットが浮かぶ方が使いやすい。一方で、キー入力のたびに
D1へ検索ログを書くと途中語まで残る。AIチャットはインクリメンタル表示と、
完了時のキーワード×ヒット記録を分けている。同じ形を cursor-agent の応答履歴にも載せる。

### 故障シナリオ

| # | 故障 | 対処 |
|---|---|---|
| 1 | 入力のたびに過去ログへ INSERT する | GET `?q=` は表示のみ。保存は「過去ログ検索」の POST だけ |
| 2 | 初期読み込みの遅延応答が検索結果を上書きする | `historyFetchSeq` と AbortController で古い応答を破棄 |
| 3 | 他人の `launch_id` をクライアント指定で結ぶ | サーバ側で自分の履歴を再検索し、その id だけ保存 |
| 4 | 同じキーワード×起動で行が増殖する | UNIQUE(user_id, keyword, launch_id) + ON CONFLICT で select_count 加算 |
| 5 | 空キーワードで INSERT する | 正規化後空なら 400。persist も empty_keyword |
| 6 | 表未作成で空成功になる | persist_failed を返し、検索ヒットは残したまま persistError を出す |
| 7 | searchError が `.error-msg` で見えない | `history-search-error` を継続 |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `migrations/0140_create_cursor_agent_search_log.sql` | 集計・明細テーブル、UNIQUE と launch_id FK |
| `src/utils/cursorAgentLaunch.ts` | upsert/insert SQL と `persistCursorAgentPastLogHits` |
| `src/index.ts` | POST 過去ログ検索、/status レジストリ、履歴削除時の子行削除 |
| `src/views/cursorAgent.ts` | インクリメンタル（300ms）と「過去ログ検索」ボタン |

### 注意事項

- 正規化は AIチャットに合わせ、キーワード文字列を各行に持つ（キーワードマスタは作らない）
- `launch_id` は SQL FK、`user_id` は論理 FK（`user_sessions`）
- 0件ヒットでは結び付ける行が無いので集計・明細ともに INSERT しない
- デプロイ後に下記 SQL を D1 で実行する必要がある

### 関連コミット

- [`2082ec9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2082ec9) cursor-agentに過去ログ検索を追加しインクリメンタル検索を戻す

