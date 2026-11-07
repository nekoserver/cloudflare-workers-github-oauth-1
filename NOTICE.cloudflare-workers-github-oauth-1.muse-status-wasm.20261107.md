# NOTICE: `/muse-status`をTailscale WASMで取得したときの知見

日付: 2026-11-07

**対象**: `/muse-status`のTailscale WASM経由の取得（PR [#2541](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2541)）、公式`@tailscale/connect`、このコンテナでの検証、PRのコンテナ欄 — 知らないと詰まること、間違えやすいことの記録。仕様は[muse-statusのSPEC](SPEC.cloudflare-workers-github-oauth-1.muse-status.20261106.md)。

## ブラウザとWASM

- **ルートでCSPを設定しないと、全体の既定が付く。** 既定は`connect-src 'self'`で`wasm-unsafe-eval`も無く、WASMもTailscaleへの接続も止まる。`src/index.ts`の共通処理は、ルートが`Content-Security-Policy`を設定していないときだけ既定を付ける。WASMを使うページは、`/container-monitor`や`/muse-status`のようにルートでCSPを設定する。ブラウザのコンソールに出るだけで、jsdomの単体テストでは気づけない。CSPはルートのテストで確かめる
- **`@tailscale/connect`の`fetch`は`fetch(url)`だけ。** GETだけで、ヘッダーは付けられない。戻り値は`status`・`statusText`・`text()`。Bearerが要るAPI（`/nix/packages`など）はWASMから呼べない。キーをブラウザへ渡す回避はしない
- **netmapのpeerは`name`・`addresses`・`online`だけ。** `online`は省略されることがある（`omitempty`）。省略を「オフライン」と読まない。OS・経路・最終接続は無い。`name`はFQDNなので、先頭のラベルで比べる
- **SDKの仕様は配布物の中の文字列で確かめられる。** `main.wasm.gz`を展開し、`Usage: fetch(url)`や`json:"online,omitempty"`を探す。このコンテナには`strings`が無いので、Pythonで読む
- **WASMの`fetch`はブラウザのfetchではない。** WASMの中のGoのHTTPクライアントがtailnetで送り、ブラウザから見えるのはTailscaleへのHTTPSとWebSocketだけ。そのため、宛先の`http://100.x.y.z`はCSPの`connect-src`にも混合コンテンツにも当たらない、と判断した。実tailnetでは確かめていない
- **WASMの`fetch`は取り消せない。** 時間切れは`Promise.race`で結果だけ先に返す。裏で通信は続く
- **ログインのたびに、ブラウザが端末として増える可能性がある。** エフェメラルかどうかは確かめていない。`/container-monitor`も同じ

## muse-vmの`/health`

Museへの問い合わせ（D1`agent-inquiries`のケース`muse-status-wasm-20261107`）で分かったこと。ソースからの回答で、Museは稼働中のプロセスと同じ内容であることを確かめたと答えている。

- `/health`は認証のチェックより前に返り、`JOB_LOCK`も取らない。推論中でも遅れない。本文は`{"status":"ok"}`で固定
- パスは完全一致。`/health/`や`/health?…`は401になり、「異常応答」と誤判定される
- `0.0.0.0:8080`で待ち受け、送信元のIPやHostで拒否しない。tailnetで届けば、新しい端末からも応答する
- 200は、HTTPのリスナーが生きていることだけを示す。ジョブが処理されていることは示さない。WASMで送った結果には「到達性の確認のみ」と表示する

## このコンテナでの検証

- **全体テストを走らせない。** AGENT.mdに「このコンテナでは`npx vitest run`の全体を実行しない（standard-1で50分を超える）」とある。CLAUDE.mdのルール9（push前に全体テスト）より、AGENT.mdを優先する。今回は読み落として走らせ、途中で止めた。作業の最初にAGENT.mdを読む
- **mainで既に落ちているテストと型エラーがある。** 2026-11-07の時点で、`src/aichat-zt-embedding-model-ui.test.ts`は26件中19件が失敗し、`tsc --noEmit`は87件のエラーを出す。どちらもmainで同じだった。自分の変更のせいかは、`git worktree add`でmainを取り出し、`node_modules`をシンボリックリンクして同じテストを流して比べる。型エラーは行番号を除いて比べる
- **`node_modules`が空のことがある。** `npm ci --ignore-scripts`で14秒で入った
- **Playwrightのブラウザは入っていない。** `chromium.launch({ executablePath: '/usr/bin/google-chrome' })`で動く。`scripts/check-muse-status-browser.mjs`は`CHROME_PATH`で場所を変えられる
- **WASMの初期化は、外部への通信を遮断しても確かめられる。** 公式WASMは`NeedsLogin`まで進む。実tailnetへの参加とは区別して報告する

## コンテナの再ビルドの判断

- **「イメージに未反映」という報告を引き継がない。** 前回のREPORTに「`server.js`の修正はイメージに未反映」とあり、そのまま答えたが、実際は反映済みだった。本番D1の`cf_container_snapshots`の最新行の`image_commit`を取り、`git merge-base --is-ancestor <コミット> <image_commit>`で確かめる
- **`public/`はイメージに入らない。** `wrangler.toml`の`assets = { directory = "./public" }`で、Workerのデプロイで配信される。イメージの中身は`containers/demo/`のファイルだけ
- **このコンテナではビルドできない。** AGENTS.mdで禁止され、`docker`も入っていない。本番のイメージは、利用者がWorkers Buildsか`wrangler deploy`で作る
- PRには再ビルドと再起動の要否を毎回書く（CLAUDE.mdのルール47、PRテンプレートの「## コンテナ」）

## Museへの問い合わせとD1

- **D1 MCPは、`params`を使うと複数の文を送れない。** `params with multiple statements is not supported`になる。回答の全文のように引用符を含む値は、`params`付きの1文で入れ、残りは`params`無しで続けて送る
- **このコンテナからMuseへ聞ける。** `~/lib`で`ruby claude/test/manual/askgk_request.rb claude/api/tunnels.claude.rb 'muse_prompt="…"'`。今回は74秒と98秒で返った。プロンプトの中で二重引用符を使わない
- **前の回答を予備知識として添えると、2回目が深くなる。** 2回目は前回の回答を添えて判定規則だけを聞き、`JOB_LOCK`との関係とパスの完全一致が得られた
- **Museの提案は手元の仕組みと照らしてから採否を決める。** 混合コンテンツの指摘は、WASMの中のHTTPには当たらないので不採用にした。採否と理由は`inquiry_proposals`に残した

## 残っていること

- 実tailnetでのログインと、ブラウザの端末からmuse-vmの8080番へ届くか（ACL）。ケース`muse-status-wasm-20261107`は`open`のまま
- `/health`に最後のジョブの応答時刻を足す提案（`msw-p2`）。muse-vm側の変更で、本番反映はMuseのメインのチャットで人が依頼する
- 本番への反映（未デプロイ）
