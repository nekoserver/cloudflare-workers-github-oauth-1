# 本体Workerへのwasm-tailscale導入（2026-11-08）

## 実装と切替

@ai-ecoverse/wasm-tailscale 1.104.1-13の公開済みWASMを固定依存として導入。npm integrityと公開build-infoのSHA256を照合。Go/Dockerのビルドは行わない。scripts/verify-wasm-tailscale.mjsでWASM・Go shim・第三者ライセンスのSHA256を再検査できる。upstreamのroot exportsに型エントリがないため、tsconfig.pathsで配布済みindex.d.tsを型参照に指定した。実行時は公開サブパスwasm_exec.jsとmain.wasmのみをimportする。

専用SQLite Durable Object TailscaleWasm（binding TAILSCALE_WASM、migration v3-tailscale-wasm）を追加。ノードの秘密状態は非公開DO SQLiteへ同期保存し、ブラウザ・localStorage・レスポンスへ出さない。ephemeral=false、logUpload=false、shieldsUp。ノードは固定名museだけを使用する。常時接続中のDOは稼働・ストレージ・通信の課金対象になり得る。

管理画面は/tailscale-wasm、管理APIは/api/tailscale-wasm/statusと/login・/logout。ログイン・管理者認可を必須とし、変更APIは別originを拒否。ログインキーを使う場合も保存・応答せず、既存コンテナのTAILSCALE_AUTHKEYは自動流用しない。画面の「接続」から発行されたログインURLを利用者が承認する。ログインURLはHTTPSのtailscale.com配下だけを許可する。初期表示で自動ログインはしない。

MUSE_TRANSPORTが未指定/containerなら既存のコンテナ直通経路、wasmならWorker内WASM直通経路を選ぶ。ログイン完了とmuse-vmの到達を確かめてからWorker変数MUSE_TRANSPORT=wasmを設定する。現wrangler.tomlはこの変数をwasmへ切り替えていない。WASM binding不在・未接続・通信失敗を理由にコンテナやtunnelsへ自動切替しない。Muse選択の通常入力と/askmuse、AIチャットのMuseヘルス確認に同じ接続方式を適用する。/neko askgk muse_promptの独立したtunnels経路は変更しない。

**排他の範囲**: 1リクエストは選択された経路にだけ送る。2経路への同時送信・失敗時の自動再送はない。同時に発生した別々の投稿を直列化するロックは追加していない。別デプロイ間で切り替える前から実行中の要求は旧経路で継続し、新要求と重なる可能性がある。切替は処理中の質問がなくなってから行う。コンテナの既存Tailscale接続自体は停止しない。

転送先はmuse-vm:8080の/healthと/v1/chat/completionsに固定。認証・メッセージ形状・サイズを確認し、redirectを追わず、応答上限とタイムアウトを設ける。汎用HTTP/TCPプロキシは公開しない。秘密MUSE_API_KEYはWorkerからDO内部へ渡し、ブラウザへ渡さない。

## 検証

artifacts/wasm-tailscale-20261108/に保存。先行transportテストは実装前に失敗を確認（transport-before.log）。ローカルの実workerdで配布WASMを起動しNeedsLoginとshieldsUpを確認。実DOのSQLiteを使う検査でも、状態の反復取得と未定義プロキシの404を確認（worker-do-final.log）。これはモックだけの起動検査ではない。認証キー・tailnet参加・推論要求はこの検査に使わない。別の初期互換性検査ではworkerdからログインURLを取得できたが、利用者の承認は行っていない。

APIテストでコンテナbindingなしのWASM直通・元本文・1回だけ送信、失敗時にコンテナ/tunnelsへ切替しないこと、管理者限定・別origin拒否を確認。サービス単体で固定宛先、未接続/peerオフライン/認証不一致の停止、応答上限、タイムアウト後に返ったupstreamのcancelを確認。画面の生成scriptをnode --checkで検査。既存コンテナ直通・プレフィックスの回帰も実行。

全体typecheckは90件の既存診断で失敗。元実装との比較は行番号を正規化すると診断内容が同一。今回の追加ファイルに診断なし。git diff --check成功。

esbuildで本体Workerをバンドルできることを確認。新WASMのgzip約7.21MBと本体JS約2.12MB、既存主要WASM約1.08MBで、非minifyの概算合計約10.41MB（blake3等・デプロイメタデータを除く）。本番Workerのサイズ上限に近いため、デプロイ時に実際のWrangler計測値を確認する必要がある。これはデプロイ成功の証拠ではない。

## 未反映・未検証

Workerデプロイ・DOマイグレーションの本番適用・tailnetログイン・WASMからmuse-vmへの認証済み実応答・DO再生成後の認証復元は未実施。既存コンテナからMuseへの先行成功をWASMの成功へ流用しない。コンテナイメージ・ブラウザ側の既存@tailscale/connect機能は変更していない。ソースビルド・Dockerビルド・Git pushなし。

参照: https://github.com/ai-ecoverse/wasm-tailscale 、https://developers.cloudflare.com/workers/runtime-apis/webassembly/ 。
