# コンテナ監視と取得方式の共通化

## ページと取得経路

本体Workerの `/container-monitor` に管理者専用ページを追加。既存 `/cf-containers` から移動できる。コンテナ一覧を取得するために本体や独立コンテナを起動しない。

`src/utils/containerMonitor.ts` のプロバイダー台帳が、選択肢と実際の取得処理の共通の正となる。`GET /api/container-monitor/providers` が利用可能な取得方式だけを返す。トークンがなければTailscale WASMが既定となり、トークンがあれば対応するAPIも選べる。APIトークン・端末参加用認証キーの値はブラウザへ返さない。

| ID | 実行場所 | 有効条件 | 取得範囲 |
| --- | --- | --- | --- |
| cloudflare-api | Worker | CLOUDFLARE_ACCOUNT_IDとCF_CONTAINER_API_TOKEN、またはCLOUDFLARE_API_TOKEN | APIから参照できるアプリケーションとインスタンス |
| tailscale-api | Worker | TAILSCALE_API_TOKEN | APIから参照できるTailnetの端末。TAILSCALE_TAILNET未指定なら `-` |
| tailscale-wasm | ブラウザ | APIトークン不要。画面でTailscaleへログイン | そのユーザーのアクセス権で見える端末 |

WASM方式もTailscaleへのログインが必要で、Tailnetに未登録のコンテナや権限で不可視の端末を検出できるという意味ではない。Cloudflareの実行状態とTailscaleの接続状態は取得元・範囲を明記して表示する。Tailscale APIにonline情報がない場合はlastSeenから稼働中と推測せず「不明」とする。

`GET /api/container-monitor/snapshot?provider=...` は同じ台帳で取得方式と資格情報の存在を毎回確認。存在しない方式、トークン削除後のAPI選択、ブラウザ専用方式のWorker実行は拒否する。既存のログイン・管理者認可をページと両APIへ適用し、no-storeとする。画面は更新時と30秒ごとに選択肢も読み直し、削除された方式の古い応答を表示しない。Tailscaleの切断・ログアウト時も古いオンライン表示を破棄する。

Cloudflare一覧は `/containers/applications` と各 `/instances-v2` のページトークンを追跡する。並列取得は4件、全体25秒・単一要求最大10秒。部分的な取得失敗はcomplete=falseと各アプリケーションのエラーを返す。取得失敗や記録なしを停止と扱わない。コンテナの追加・削除は一覧から自動的に追従し、固定ホスト表を持たない。

## WASM成果物

公式 `@tailscale/connect@1.102.3-3-tb31d8a75a-g5e651e16f` を利用。npm配布物のSHA512 integrityを照合し、圧縮WASMとJSを `public/tailscale-connect/1.102.3-3/` に配置した。独自のTailscaleソースビルドやDockerビルドは行っていない。build-info.jsonに出典とチェックサムを記録し、ライセンスを同梱。

`node scripts/sync-tailscale-connect.mjs` で同じ公式配布物を取得・照合・復元できる。`public/_headers` で圧縮ファイルをapplication/gzipとして配信する。読み込み側はHTTPの転送圧縮とファイル自体のgzipを区別し、必要時にDecompressionStreamで展開してWASMヘッダを確認した後、application/wasmのBlobからSDKを初期化する。HTTPの自動展開済みデータにも対応する。バイナリはWorkerの実行モジュールではなく静的アセットであり、ページから必要時に読み込む。ページのCSPでWASMとTailscaleのHTTPS/WebSocket接続を許可する。

参加状態は専用prefixのsessionStorageに保存し、ログアウト時に消す。既存コンテナ用TAILSCALE_AUTHKEYはブラウザへ渡さない。任意の認証URLを開かず、HTTPSのTailscaleログインURLだけを表示する。

## tree-viewとの境界

今回のプロバイダー台帳・正規化されたsnapshot APIは他の画面でも利用できる共通経路として実装した。確認したdynamicneko mainと配備ソースのtree-viewコンテナAPIは利用者別Sandboxを扱っており、ユーザーの言及した別の全コンテナ検出経路は特定できていない。tree-viewが新APIを利用する変更は今回行っておらず、既存検出との接続完了とは報告しない。

## 検証と復元

APIなし・トークン設定済みの選択肢、部分取得失敗、ページ送り、認可、トークン非公開、HTML注入、切替中の古い応答、切断後の古い端末表示を検証。Chromiumで公式WASMを初期化しrun/login/fetchの公開関数を確認。外部接続は遮断したテストで、実Tailnetへのログイン・到達性の成功証明ではない。既存Cloudflare資格情報で実際の全アプリケーション・インスタンス取得も確認した。Tailscale APIの実資格情報は現在なく、同方式の本番API照会は未実施。

配備前Worker本体・settings・deploymentsはroot専用 `/root/.local/state/tailscale-wasm/` に保存。ロールバックは保存した配備ID/バージョンを指定する。ローカル復旧資料の丸ごとのGit登録は行わない。再取得可能なSDKキャッシュと、非公開で保持すべき復旧資料を区別する。


2026-10-26の本番最終Workerバージョンは `ed80b713-ea19-4eb0-8df2-86db630a926f`。本番URLからChromiumで公式WASMのrun/login/fetch初期化を確認済み。初回配信で検出したファイルgzipとHTTP転送圧縮の扱いの差は明示的な展開処理で修正した。実Tailnetへのログイン後の疎通確認とは区別する。
