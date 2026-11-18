# tree-view ワーカータブの白画面と会話中継（2026-11-13）

最終状態（2026-11-13 17:52 UTC）: 下記の後続反映により両Workerへ反映済み。本文の未デプロイ記録は反映前の検証時点の状態。
原因はdynamicnekoが公開mygwの `/lib/conversation-embed.html` をiframeに載せる一方、Apacheの管理者限定設定が公開 `/lib` を403にしていたこと。実HTTPでは公開403、内部8445は200。内部の会話受信・投稿成功だけではtree-view画面の成功を確認したことにならない。

公開制限を維持し、dynamicnekoの所有者ログイン→同一originの限定中継→本体の新しい `/api/tree-view/conversation-stream-external/lib/*` →起動中コンテナ→内部8445に変更した。本体はWorker署名と短寿命ユーザートークンを照合して管理者を確認し、限定したlib資産とchat APIだけを中継する。プラットフォームのCookieや中継用資格情報をlibへ渡さず、本文はバッファしない。停止中コンテナを起動しない。

成功した中継HTMLのnonce付きCSPを維持し、X-Frame-OptionsだけSAMEORIGINにする。全体のDENYを残すとHTTP200でもiframeは表示できない。dynamicnekoでは事前のHEAD確認と、失敗理由・閲覧再試行を追加した。

実ブラウザの試験では、ticket付き資産が相対importする `chat/vendor/markdown-it.mjs` の許可漏れも発見し、限定許可と回帰テストを追加した。iframeのsrcやHTTP200だけで成功判定せず、依存資産と会話本文の表示まで確認する。

詳細はdynamicnekoの `NOTICE.20261113.tree-view-worker-stream.md`。実lib・observerと両中継実装によるChrome試験でHMACログイン、JS/CSS、SSE、現在会話articleを確認。セッション保存先・本人照会は試験fixtureで、本番のログイン・service binding・WebSocket 101は未確認。本体Worker→dynamicnekoの順に反映が必要。push・デプロイ・Dockerビルドは今回未実施。

Museの経路一覧は `SPEC.cloudflare-workers-github-oauth-1.20261112.muse-request-routes.md` に `/tailscale-wasm` の通常フォームを追加した。ページ内の通常フォーム、MuseAgentJobs、旧コンテナ送信、Gadgetsへの `/chat` を区別して記録した。

最終検証: 本体の関連4ファイル41件、dynamicnekoブラウザ11件、所有者中継・台帳・CSPのNode検査と型チェックに成功。実SSE表示も成功。本体の現在のwrangler.tomlはDockerfileからのコンテナビルドを伴うため、AGENTS.mdの実行条件を満たさない本環境では通常の本体デプロイを実行していない。利用者からのApache Forbiddenの追報については表示中URLの照合待ちで、公開mygw/libが403という実測結果と区別して扱う。

## 後続の本番反映（2026-11-13 17:52 UTC）

インストール済みWranglerのhelp・実装で `--containers-rollout none` がコンテナのビルド・更新を省略することを確認した。この指定と `--keep-vars` を使い、本体→dynamicnekoの順にWorkerだけ反映した。通常デプロイを避けるという先の制約を満たす方法で、Dockerビルド・コンテナ再作成は行っていない。

本体Version ID: `fe1c9bd8-908e-4e86-a175-bc326789a6e0`。dynamicneko最終Version ID: `7ee55793-dc75-41d4-a719-9c6fa4f3425a`。

利用者が報告した操作はtree-viewのAIチャット→Muse→⬜︎→ワーカー。専用のブラウザ試験で、ウィンドウ移動後も同じiframeと同一origin中継を維持することを確認した。PWA専用ログインが/libを拒否する別の403も先にテストで再現し、限定した会話パスだけ許可。非公開opsの拒否は維持した。通常ログインの既存所有者アクセス検査も成功。HEAD確認はログインredirectを成功扱いにしない。

関連本体41件、ブラウザ11件＋指定操作・再試行2件、PWA中継・所有者アクセス・型チェックに成功。公開URLは未ログイン埋め込み302、未署名本体中継401、mygw公開/lib403。公開フロントエンドJSのSHA256が最終ビルドと一致。利用者のログイン済み画面での最終表示とWorkers実WebSocketの101は未確認。

Museの経路一覧SPECにも、/tailscale-wasmの入口、今回のウィンドウ操作、403の原因、修正後の会話中継、PWA/CSP/依存資産の注意点、反映Version IDと検証範囲を追記した。
