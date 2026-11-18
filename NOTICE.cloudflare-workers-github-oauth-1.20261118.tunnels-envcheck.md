# NOTICE: Tunnel一覧の実行ごとに環境変数を確認する

日付: 2026-11-18
対象: `GET /api/cf-containers/tunnels`（src/index.ts）と /cf-containers の Tunnel一覧セクション（src/views/cfContainers.ts）

## 変更

- 取得のたびに環境変数を確認し、結果を応答の `envCheck` で返すようにした。
  - `accountIdSet`: CLOUDFLARE_ACCOUNT_ID が設定されているか
  - `tokenSource`: 使うトークンの出所（CF_CONTAINER_API_TOKEN 等。未設定なら null）
  - `tokenVerify`: 設定済みの場合に verifyApiToken（user / account 両方の verify API）へかけた結果文字列。未設定なら null
- 未設定エラー・取得失敗・成功の全応答に envCheck を付ける。一覧の成否と環境変数の状態を切り分けて見られる。
- 画面は取得のたびにログ欄へ「環境変数: アカウントID=…、トークン=…、検証: …」を出す（成功時も）。

## 検証

- 新規 `src/cf-containers-tunnels-envcheck.test.ts` 4 件（実装前に失敗を確認）: 設定済み+検証 active、検証 NG、未設定、画面スクリプトの表示。
- push ガード（npx vitest run src/cf-containers）: 351/352。失敗 1 件は cf-containers-t3-pwa-diagnose-browser（実ブラウザが必要な環境依存で、変更前から同じ失敗）。

## 未検証

- 本番での実表示（デプロイ後に Tunnel一覧の「取得」を押して確認する）。verify の分だけ Cloudflare API 呼び出しが 2 回増える。
