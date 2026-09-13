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
| 4 | /apisの/api/aichat説明から /neko hms/cal/clog が消える | 説明文を復元 |
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
| `src/views/apis.ts` / `src/data/apiEndpointList.ts` | /neko hms/cal/clogを説明に明記 |
| 複数の `*.test.ts` | ソース照合・並び順・城タップ座標の契約を現行実装に合わせる |

### 関連コミット

- 本PRのコミット（push後にハッシュを追記）
