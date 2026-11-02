# AIチャットの会話ストリーム: 接続先の台帳化

作成日: 2026-11-02
状態: 実装済み・未コミット・未デプロイ。

## 1. 会話ストリームの接続先を台帳と解決関数にまとめる

**対象**: `src/utils/conversationStreamRoutes.ts`（新規）、`src/data/conversation-stream-routes.json`（新規）、`src/utils/conversationStreamHosts.ts`、`src/utils/conversationStreamHealth.ts`、`src/views/conversationStreamPanel.ts`、`src/views/aichat.ts`、`src/index.ts`（`GET /aichat`のCSP、`GET /api/aichat/conversation-stream/health`） — AIチャットの「ストリーム」パネルが埋め込む会話ストリームの接続先を1つの台帳にまとめ、起動しているコンテナのCloudflare Tunnel公開ホストに合わせて、台帳の書き換えだけで切り替えられるようにする。

### 背景

会話ストリームは、コンテナ上のlib（`/lib/conversation-embed.html`と`/lib/api/chat/{ws,sse,ndjson,jsonseq}`）を、トンネルの公開ホスト経由でiframeに埋め込んで表示する。どの公開ホストがどのコンテナに届くかは、起動したトンネル（コンテナの`entrypoint.sh`が`NEKOROOT_HOSTNAME`から作るingress）で変わる。

これまで接続先は、次の4か所に固定値で書かれていた。コンテナやトンネルを切り替えるたびに、コードの変更とデプロイが必要だった。

| 箇所 | 内容 |
|---|---|
| `conversationStreamHosts.ts` | `CONVERSATION_STREAM_URLS`（redmine・mygw・mynw・testcfc）と`CONVERSATION_STREAM_FRAME_ORIGINS` |
| `conversationStreamPanel.ts` | 接続先の`<option>`（HTMLに直書き）と、スクリプト内の`embedUrls` |
| `conversationStreamHealth.ts` | 死活確認の対象 |
| `index.ts` | `/aichat`のCSP `frame-src` |

### 仕様

**台帳**（`src/data/conversation-stream-routes.json`が既定）

```json
{
  "autoPriority": ["redmine", "mygw", "mynw", "testcfc"],
  "routes": [
    { "id": "mygw", "origin": "https://mygw.nekomaneki.work", "enabled": true },
    { "id": "mynw", "origin": "https://mynw.nekomaneki.work", "enabled": true },
    { "id": "testcfc", "origin": "https://stream.test.cfc.nekomaneki.work", "enabled": true },
    { "id": "redmine", "origin": "https://r9.nekomaneki.work", "enabled": true }
  ]
}
```

| 項目 | 意味 | 制約 |
|---|---|---|
| `routes[].id` | 接続先のID（パネルの選択肢の値、死活確認の結果） | 英小文字・数字・ハイフン、32文字まで、重複不可、`auto`は予約 |
| `routes[].origin` | コンテナのトンネル公開ホスト | パス・認証情報・クエリなしのHTTPS |
| `routes[].label` | 選択肢の表示名 | 省略時はホスト名。1〜80文字。HTMLではエスケープする |
| `routes[].enabled` | 無効にすると選択肢・自動選択・CSPから外れる | 真偽値。省略時は有効 |
| `routes`の並び | 選択肢の表示順 | 有効な経路が1つ以上必要 |
| `autoPriority` | 「自動」で試す順。死活確認の結果とCSPの並びもこの順 | 省略時は`routes`の順。未登録・重複のIDは不可。無効な経路は除く |

既定の台帳は、変更前の表示順（mygw・mynw・testcfc・redmine）と自動選択の順（redmine・mygw・mynw・testcfc）をそのまま再現する。表示名も変更前に画面に出ていたホスト名と同じ。

**差し替え**: 試験運用のあいだは、台帳のファイル`src/data/conversation-stream-routes.json`を書き換えてデプロイする。環境変数での差し替えは設けない（利用者の判断、2026-11-02）。運用してみて必要になったら、変数での差し替えを改めて検討する。

**不正な設定**: 台帳が不正なら、誤った接続先を黙って使わず止める。台帳の形式は`src/utils/conversationStreamRoutes.test.ts`が同梱の台帳を読んで確かめるので、通常はデプロイ前のテストで気づく。

| 経路 | 不正なときの動作 |
|---|---|
| `GET /api/aichat/conversation-stream/health` | 上流を呼ばず、500と`{ healthy: false, availableHosts: [], error }`を返す。`logger.error`に記録 |
| `GET /aichat` | ページは表示する。CSPを`frame-src 'none'`にし、パネルに理由（`#conversationStreamConfigError`）を表示して「ストリーム」ボタンを無効にする。`logger.error`に記録 |

**URLの組み立て**: `conversationStreamEndpoints(origin)`が、1つのoriginから次のURLを返す。lib側のクライアント（`chat/app.mjs`、`chat/http-stream.mjs`）が使うパスと同じ。

| 種類 | URL |
|---|---|
| `embed` | `https://<host>/lib/conversation-embed.html` |
| `websocket` | `wss://<host>/lib/api/chat/ws` |
| `sse`・`ndjson`・`jsonseq` | `https://<host>/lib/api/chat/{sse,ndjson,jsonseq}` |

パネルが使うのは`embed`だけで、通信は埋め込んだページが自分のホストへ行う。他の4つは、コンテナ側の設定（後述）と同じパスであることを示し、テストで固定するためのもの。

### 修正内容

| ファイル | 変更 |
|---|---|
| `src/utils/conversationStreamRoutes.ts` | 新規。`resolveConversationStreamRoutes(settings)`、`conversationStreamEndpoints(origin)`、`conversationStreamFrameOrigins(routes)` |
| `src/data/conversation-stream-routes.json` | 新規。既定の台帳 |
| `src/utils/conversationStreamHosts.ts` | 既定の台帳から`CONVERSATION_STREAM_URLS`・`CONVERSATION_STREAM_FRAME_ORIGINS`を作る（従来の参照のため残す）。`ConversationStreamHost`は`string` |
| `src/utils/conversationStreamHealth.ts` | `conversationStreamHealthy(routes)`。`autoPriority`の順に、各経路の`embed`を確認する |
| `src/views/conversationStreamPanel.ts` | `getConversationStreamPanel(routes, configError)`。選択肢・埋め込みURL・表示名を台帳から作る。スクリプトへのJSONは`<`をエスケープして埋め込む。設定エラーの表示 |
| `src/views/aichat.ts` | `getAiChatPage`に`conversationStreamRoutes`・`conversationStreamRoutesError`を追加し、パネルへ渡す |
| `src/index.ts` | `/aichat`と死活確認で`resolveConversationStreamRoutes()`を使う。CSPの`frame-src`を台帳から作る |
| テスト | 新規`src/utils/conversationStreamRoutes.test.ts`。`conversationStreamHealth.test.ts`、`conversation-stream-health-endpoint.test.ts`、`aichat-stream-frame-csp.test.ts`、`views/aichat-stream-embed.test.ts`に、別の台帳・不正な台帳のケースを追加（別の台帳は関数に直接渡す） |

### 検証

| 確認 | 結果 |
|---|---|
| 先に失敗するテストを書く | 実装前に、新規・追加のテストが失敗することを確認 |
| 関連テスト（上記5ファイルと`containerEndpoints.test.ts`） | 6ファイル33件が通過 |
| ページのscript（ルール41） | `getAiChatPage`の出力から`<script>`を取り出し、既定の台帳・別の台帳（表示名に`</script>`を含む）・設定エラーの3通りで`node --check`。すべて通過し、scriptの数も変わらない（埋め込みから抜け出していない） |
| 型 | 変更したファイルに型エラーなし（`tsc --noEmit`。リポジトリには変更と無関係の既存エラーが多数ある） |
| 全体テスト | 変更後は9068件中106件が失敗（38ファイル）。同じ38ファイルを変更前のmain（`a50782e2`）で流すと105件が失敗し、差は`heritageJourney-end-city-picker-20260820.test.ts`の1件だけ。このファイルは今回変えておらず、単独では2回とも16件が通過（全体を流したときの負荷による不安定なテスト）。今回の変更で増えた失敗はない |
| デプロイ・本番での切替 | 未実施（この環境に`CLOUDFLARE_API_TOKEN`がない） |

### 注意事項

- **環境変数は追加しない**: 最初の案では`CONVERSATION_STREAM_ROUTES`で台帳を差し替えられるようにしたが、CLAUDE.mdのルール37に沿って利用者に確認し、まずファイルでの試験運用とした。
- **既存テスト2件の修正**: `aichat-stream-frame-csp.test.ts`と`conversation-stream-health-endpoint.test.ts`は、変更前のHEADでも失敗していた。Redmineの接続先を追加した[`f4273a8c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f4273a8c)以降の順序（redmineが先頭）に追従していなかったため。実際の順序に合わせて書き直した。
- **コンテナ側の設定**: 埋め込みページは自分のホストへ接続するため、コンテナのストリームのサーバー（libの`chat_websocket.py`・`chat_http_stream.py`）は、そのホストを`LIB_CHAT_ORIGINS`で許可する必要がある。Workerの台帳とコンテナの設定は、同じingressから導く（次節）。
- **埋め込み元の許可**: lib側の埋め込みページは、親ページのOriginを`chat/app.mjs`の`parentOrigins`と`LIB_CHAT_FRAME_ORIGINS`で許可している。これは本WorkerのOriginで、コンテナを切り替えても変わらない。本Workerのドメインを変える場合は、lib側も変える必要がある。

### 関連コミット

なし（2026-11-02時点で未コミット）。基にした実装:

- [`f4273a8c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f4273a8c) feat: add Redmine observer as auto stream host（2026-10-26）
- [`ae340fdf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ae340fdf) fix: restore mygw nekoroot endpoints and mynw stream selection（2026-10-21）
- [`264d4c72`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/264d4c72) fix: コンテナAPIと会話配信の接続先をCFCへ集約（2026-10-21）
- [`7b5cee28`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7b5cee28) feat: decouple askgk and add API/WASM container monitoring（askgkの経路台帳、2026-10-26）

## 2. コンテナ側から接続先を導く（libとの連携）

**対象**: lib（`nekoserver/lib`）の`claude/ops/stream_routes.py`（未コミット） — コンテナのingressから、コンテナ側の`LIB_CHAT_ORIGINS`と、本Workerの台帳に入れる経路を、同じ情報源から作る。

### 背景

コンテナを切り替えると、トンネルの公開ホストが変わる。本Workerの台帳とコンテナの`LIB_CHAT_ORIGINS`を手で別々に直すと、食い違いやすい。

### 仕様

`stream_routes.py`は`/etc/cloudflared/ingress.yml`のうち、パス指定なしでApache（`https://127.0.0.1:8443`または`localhost:8443`）へ向かうホスト名を接続先とする。テンプレートの置換前の値（`__NEKOROOT_HOSTNAME__`）は拒否する。

| コマンド | 出力 |
|---|---|
| `stream_routes.py env` | `LIB_CHAT_ORIGINS=…`（既存の値を残し、トンネルのホストを加える） |
| `stream_routes.py worker --id <ID>` | 本Workerの台帳の`routes`に入れる経路のJSON（ホストが複数なら`<ID>-2`…） |
| `stream_routes.py endpoints` | 各ホストの埋め込み・WebSocket・SSE・NDJSON・JSON Text SequenceのURL（`conversationStreamEndpoints`と同じパス） |

このコンテナ（2026-11-02）では`mygw.nekomaneki.work`が導かれ、`worker --id mygw`は`[{"id": "mygw", "origin": "https://mygw.nekomaneki.work"}]`を出力した（既定の台帳のmygwと一致）。

### コンテナを切り替えるときの手順

1. コンテナ側で`python3 lib/claude/ops/stream_routes.py env`の値を、ストリームのサーバーの`LIB_CHAT_ORIGINS`に設定して再起動する。
2. `stream_routes.py worker --id <ID>`の出力を、本Workerの台帳`src/data/conversation-stream-routes.json`の`routes`に加える。自動選択で優先するなら`autoPriority`の先頭に置く。
3. テストを通してから本Workerをデプロイする（デプロイは利用者の環境から）。
4. AIチャットの「ストリーム」パネルで、接続先の選択肢と「自動」の結果を確認する。

### 注意事項

- 手順1〜3の自動化（コンテナの`entrypoint.sh`での実行、台帳の更新とデプロイ）は未実装。`entrypoint.sh`はcf-containerの管理で、デプロイにはCloudflareのAPIトークンが必要。
- lib側の仕様・テストは`lib/claude/SPEC.claude.20261102.md`と`lib/claude/FEATURES.claude.20261102.md`（機能8・9）。

## 今後

一覧の `mygw` は、2026-11-02の時点では `server.js` の仮の応答を返す（本体コンテナのApacheが lib を出していない。今回の変更より前からの状態）。接続先の一覧を手で書く今の形をやめ、コンテナが自分のできることを返す形へ寄せる最終案は、本体リポジトリの `SPEC.cloudflare-workers-github-oauth-1.cross-container.20261102.md`（askgkのPRで追加）にまとめた。
