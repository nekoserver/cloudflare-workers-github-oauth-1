# メインWorker / コンテナの会話ストリーム初期設定

`tunnels.rb`、WebSocket、SSE、NDJSON/JSON Sequence、App Server、observerの新規設定・再設定・再配置後は、メインWorker側とコンテナ内の確認を両方完了させる。Worker設定だけ、またはコンテナ内プロセスの起動だけをもって完了としない。

## コンテナ内

対象の `lib` コンテナでは [CHAT_WEBSOCKET.md](../../lib/ops/CHAT_WEBSOCKET.md) の検収を実施する。起動ENV優先、Apache CGI/SSI、固定thread、App Server/observer/workerのUnix socket・権限、認証済み各streamの実イベント、console投稿後のassistant応答を確認する。secrets・Cookie・会話全文をREPORTへ書かない。別writerがいる場合は所有lockを保ち、別threadへのforkは明示承認後だけ行う。

投稿の確認は明示的に一度だけ実行する。HTTP acceptedで止めず、observerが同じ投稿先threadから固有応答を受信するまでを見る。health check、画面を閉じた状態のpoll、observer readはAI turnを起動しない。停止中・未選択containerへのhealth checkを使って接続候補を探さない。

## メインWorker側

- `ASKGK_ROUTE_ID`と会話ストリームの`autoPriority`を照合する。独立コンテナと本体コンテナの行先を取り違えない。
- `/api/aichat/conversation-stream/health` が認証なしに候補へ問い合わせないこと、停止中候補を自動選択のために呼び出さないことを確認する。
- ログイン済み画面でパネルを開いたときの選択先・Origin・イベントと、閉じた後のiframe/poll停止を確認する。画面を閉じている場合は実ブラウザ確認済みと報告しない。
- Workerのservice binding・D1・vars/secretsの設定名を配備前後で比較する。接続先を変えたときは実際の署名付きAPI要求と内容を確認する。

## 記録

変更ごとにREPORTを作り、実行した検証、具体的な応答、未確認範囲、利用した会話の区別を記載する。起動・HTTP 200・acceptedのみでは完了としない。コンテナ再作成後のthread/config復元は別途確認する。

2026-11-04の実測は [CONSOLE-STREAM REPORT](REPORT.cloudflare-workers-github-oauth-1.CONSOLE-STREAM.20261104.md)、アドホックなfork投稿の設計・制約は [`lib` SPEC](../../lib/SPEC.lib.20261104.console-stream-adhoc.md) を参照。
