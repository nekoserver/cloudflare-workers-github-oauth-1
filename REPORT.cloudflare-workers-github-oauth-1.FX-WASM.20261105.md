# fx WASM サンプル（2026-11-05）

Vercel Labsのコーディングエージェントfxを対象に、公式libfx 0.0.16の配布済みWASMエンジンをブラウザで実行する `/fx-wasm` を本体Workerへ追加した。JSONビューアの同名fxとは別。ログインを要求し、`/wasm-modules` に入口を追加した。ネイティブCLIのインストール、Zigコンパイル、Dockerビルド、Workerデプロイは実施していない。本番URLの利用開始には本体Workerの反映が必要。

## 実装

- `src/views/fxWasm.ts`：サンプル画面。実行方式、依頼、仮想hello.js、応答、ツール履歴、停止、初期化を表示。
- `public/fx-wasm.mjs`：公式createFxEngineを使用。JSPI対応を先に判定し、非対応では実行を禁止。仮想ファイルはページ内だけに保持し、再読み込みで破棄する。各実行は新規会話。read_file/write_fileはhello.jsだけを受理し、入力型・容量を検証する。画面にあるコード自体をevalしない。
- 模擬モデルはキー不要で定型のread_file→write_file→応答を返す。エンジンとツールは本物のWASMを実行するが、AI推論は模擬であり外部通信なし。任意の依頼に対応するAIとして扱わない。
- 実モデルは利用者本人のAI GatewayキーとモデルIDを入力する。モデルのcatalogとgenerationだけを正規のAI Gateway originへ許可し、redirectを禁止。キーを入力欄から消し、Cookie/localStorage/sessionStorage/サーバーへ保存しない。プロンプト・仮想ファイルがモデルへ送られ、料金が発生することを表示。
- Worker側に汎用proxyや秘密鍵の返却APIは作っていない。ブラウザから既存コンテナのシェル、ファイル、Codex認証を操作する経路はない。
- CSPは同一originのスクリプトとWASMを許可し、モデル通信はai-gateway.vercel.shだけに制限。モデル応答はtextContentで描画する。

## 配布物

`public/vendor/libfx/` にブラウザエンジンが必要とする14ファイルを同梱。公式npmアーカイブをSHA256で照合し、各配布ファイルのSHA256、取得URL、版、Apache-2.0ライセンスをmanifestとLICENSEに残した。fx-core.wasmは2,260,477 bytes。ソースからのビルドや新しいnpm本体依存の追加はない。

復元は `python3 scripts/vendor-libfx.py`。版更新時はアーカイブSHA256と契約テストを更新し、実ブラウザの再検証が必要。

公式仕様：[WebAssembly](https://fx.sh/docs/lib/webassembly)、[libfx API](https://fx.sh/docs/lib/api)、[upstream](https://github.com/vercel-labs/fx)。WASM版にはJSPIが必要。公式配布物のAPIと型定義も照合した。

## 検証

- 追加前に仕様テストを実行し、未実装で失敗することを確認。
- `npx vitest run src/fx-wasm.test.ts src/container-monitor-api.test.ts`：7 tests成功。未認証拒否、認証後200、no-store、CSP、ページ内容、配布版とmanifest、変更したページの生成script構文を確認。
- `node --test scripts/fx-wasm.test.mjs`：4 tests成功。別ファイル/パストラバーサル/過大書き込みを拒否し元ファイルを維持、許可外モデル通信を拒否、模擬通信の順序、全配布物のチェックサムを確認。
- `node scripts/check-fx-wasm-browser.mjs`：実Chromiumで公式WASM起動、read_file/write_file実行、hello.js変更、FX_WASM_DEMO_OK表示、初期化、キー必須・モード切替時キー消去、永続ブラウザストレージ未使用、非対応時の実行禁止を確認。模擬実行の外部通信0、pageerror0。最初はプロジェクト指定版のブラウザが未導入で起動できず、`PLAYWRIGHT_CHROMIUM_EXECUTABLE` で既存の配布済みChromiumを指定して検証した。
- `node --check public/fx-wasm.mjs` とdiff whitespace確認成功。新しいHTMLにinline scriptはなく、外部モジュールを使う。

実モデルへの課金通信、実利用者のログイン済み本番画面、実行途中キャンセルの全タイミング、他ブラウザでの検証は未実施。ローカルのHTTPサーバーは本番と同じページとCSP・配布物を使用するが、公開Workerへの配備確認とは異なる。Worker内でのWASM推論実行やネイティブCLI端末全体の再現を行うページではなく、公式エージェントコアのブラウザ実行サンプル。
