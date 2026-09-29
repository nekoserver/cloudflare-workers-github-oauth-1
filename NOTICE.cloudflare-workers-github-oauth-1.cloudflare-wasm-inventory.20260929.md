# NOTICE: Cloudflare Workersに表示されるWASMモジュールの棚卸し

**調査日**: 2026-09-29  
**対象**: `cloudflare-workers-github-oauth-1` / Wrangler 3.114.17 / `npm ci`後の依存関係

## 結論

Cloudflare側でWASMモジュールが増えたように見えるのは異常ではない。`wrangler deploy --dry-run`で実際のWorkerバンドルを作ると、**8個**の`.wasm`がESモジュールとして同梱される。そのうち1個はCloudflare/Wrangler由来の`blake3-wasm`だが、Wranglerが勝手にデプロイしたものではない。このリポジトリが`src/utils/wranglerBlake3Server.ts`から明示的にimportし、`/cf-dashboard`の改変検知IDに使っているためである。

`node_modules` には合計11個のWASMファイルがあるが、全部がWorkerへアップロードされるわけではない。「ローカルに存在する」「`public/`の静的アセットとして配信される」「WorkerバンドルのWASMモジュールになる」は別の概念として数える必要がある。

## 1. CloudflareへアップロードされるWASM: 8個

次のコマンドでネットワークへデプロイせず、Wranglerのバンドル結果を確認した。

```bash
rm -rf /tmp/cf-wasm-audit
npx wrangler deploy --dry-run --outdir /tmp/cf-wasm-audit
find /tmp/cf-wasm-audit -maxdepth 1 -type f -name '*.wasm' -printf '%f\t%s bytes\n' | sort
```

| バンドル内の元ファイル | bytes | 由来 | 実際の用途 |
|---|---:|---|---|
| `blake3_js_bg.wasm` | 34,384 | Wranglerの直接依存`blake3-wasm@2.1.5` | `/cf-dashboard`の取得結果からBLAKE3 digestを生成 |
| `sha256_bg.wasm` | 25,600 | 自前Rust | `/neko 256`等のSHA-256 |
| `factor_bg.wasm` | 21,248 | 自前Rust | `/neko factor`の素因数分解 |
| `dig_bg.wasm` | 55,686 | 自前Rust | `/neko dig`のDNSパケット処理 |
| `ls_bg.wasm` | 35,040 | 自前Rust | `/neko ls`のWASMレジストリ整形 |
| `gh_bg.wasm` | 79,179 | 自前Rust | `gh pr list`相当の整形 |
| `msb_bg.wasm` | 62,596 | 自前Rust | `/neko msb --help` |
| `go-diff.wasm` | 3,152,752 | 自前Go | `POST /api/diff`のサーバー実行 |

> Wranglerの出力ファイル名には内容ハッシュが付く。表では比較しやすいようハッシュ接頭辞を省いた。サイズはバンドルの実ファイルから取得した。

### 数え方の注意

- `public/wasm/`にあってもブラウザからだけ読む`gh-attach.wasm`、`sqlc.wasm`、`sqlx_bg.wasm`、`jev_bg.wasm`、`gron.wasm`は、今回のWorkerバンドル用WASM 8個には入っていない。これらはAssetsから静的ファイルとして配信される。
- `ruby+stdlib.wasm`はjsDelivrからブラウザが実行時に取得するため、リポジトリにもWorkerバンドルにも入らない。
- `tree-wasm`はレジストリ上は「未ビルド」で、現在のバンドルには入らない。
- Cloudflare dashboardの「Modules」数を説明するときは`public/wasm`のファイル数ではなく、必ず`wrangler deploy --dry-run`の出力と照合する。

## 2. `node_modules`に存在するWASM: 11ファイル

`find node_modules -type f -name '*.wasm'` の結果。こちらは開発・テスト用依存も含むため、Cloudflareのデプロイモジュール一覧とは一致しない。

| package / file | bytes | 依存経路 | Workerバンドル |
|---|---:|---|---|
| `@ast-grep/wasm/wasm_bg.wasm` | 1,733,807 | 直接devDependency | 含まない |
| `blake3-wasm/.../browser/blake3_js_bg.wasm` | 34,398 | `wrangler` | 含まない |
| `blake3-wasm/.../nodejs/blake3_js_bg.wasm` | 34,405 | `wrangler` | 含まない |
| `blake3-wasm/.../web/blake3_js_bg.wasm` | 34,384 | `wrangler`、かつアプリが明示import | **含む** |
| `tree-sitter-javascript/tree-sitter-javascript.wasm` | 358,909 | `tree-sitter-typescript` | 含まない |
| `tree-sitter-typescript/tree-sitter-tsx.wasm` | 1,445,638 | 直接devDependency | 含まない |
| `tree-sitter-typescript/tree-sitter-typescript.wasm` | 1,413,849 | 直接devDependency | 含まない |
| `undici/lib/llhttp/llhttp.wasm` | 55,466 | `jsdom`および`wrangler > miniflare` | 含まない |
| `undici/lib/llhttp/llhttp_simd.wasm` | 55,450 | 同上 | 含まない |
| `web-tree-sitter/debug/web-tree-sitter.wasm` | 823,927 | `@ast-grep/wasm` | 含まない |
| `web-tree-sitter/web-tree-sitter.wasm` | 201,104 | `@ast-grep/wasm` | 含まない |

`npm ls blake3-wasm @ast-grep/wasm tree-sitter-javascript tree-sitter-typescript undici web-tree-sitter --all`で依存経路を確認した。`package.json`のWrangler指定は`^3.96.0`だが、lockfileが固定する実インストール版は3.114.17である。今後バージョンを更新したら数とサイズを再取得すること。

## 3. このリポジトリで役に立つ候補

### A. 優先度高: `@ast-grep/wasm` + TypeScript/TSX grammar

すでに`scripts/index-file-deps.mjs`で使っている。追加で、次の静的監査に流用できる。

- WASMサーバーラッパーを`index.ts`から静的importしていないかの構文監査
- ルート、API、レジストリ、テストの「追加し忘れ」検出
- `fetch`呼び出しに認証ヘッダやエラー処理があるかのルール化

ただしビルド時/開発時ツールのまま使い、Workerランタイムには入れない。本体とgrammarを含めると数MB増えるうえ、一般リクエスト中にAST解析する必然性がない。

### B. 優先度中: `blake3-wasm`

すでに`/cf-dashboard`で利用中。大きなレスポンス、スナップショット、生成レポートの内容IDや重複排除キーに流用できる。ただし、次の使い分けを守る。

- 内容アドレス、キャッシュキー、高速な改変検知: BLAKE3の候補
- OAuth PKCE、JWT/HMAC、Webhook署名等のプロトコル指定: 指定済みのWeb Cryptoアルゴリズをそのまま使う

特に「Wranglerに既に入っているからデプロイサイズが無料」ではない。アプリがimportすればそのWASMはWorkerのアップロードに含まれる。

### C. 優先度低: `llhttp.wasm`

Undici/jsdom/Miniflare内部のHTTPパーサーであり、アプリから直接使う公開APIとして導入されたものではない。Workersでは`Request` / `Response` / `fetch` / HonoにHTTP解析を任せるべきで、直接利用のメリットはない。

### D. 現状保留: `web-tree-sitter`

ASTの逐次解析やエディタ機能をブラウザに追加するなら有用。一方、現在のファイル依存関係抽出は`@ast-grep/wasm`で足りており、`web-tree-sitter`を直接利用すると初期化、grammar登録、CSP、バイナリ配信を新たに管理することになる。具体的なエディタ要件が出るまで追加しない。`debug/web-tree-sitter.wasm`は本番候補にしない。

## 4. 運用チェックリスト

1. 依存更新後は`npm ls ... --all`と`find node_modules -name '*.wasm'`を再実行する。
2. `npx wrangler deploy --dry-run --outdir /tmp/cf-wasm-audit`を実行し、ローカル依存ではなく実際のデプロイ対象を数える。
3. 新しいWASMが増えたら、生成された`worker-entry.js`のimport元に戻って「アプリが明示的に使うものか」を判定する。
4. Worker実行用の場合だけ`WASM_MODULE_REGISTRY`へ登録し、実際にimportするvariant (`web` / `nodejs` / `browser`)とパス・サイズを一致させる。
5. 追加前後の`Total Upload` と`.wasm`一覧をPRに記録し、サイズ増加の根拠を残す。

## 参考

- [Cloudflare Workers: WebAssembly](https://developers.cloudflare.com/workers/runtime-apis/webassembly/)
- [Cloudflare Workers: Modules](https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/)
- [`blake3-wasm` package](https://www.npmjs.com/package/blake3-wasm)
- [`@ast-grep/wasm` documentation](https://ast-grep.github.io/guide/tools/wasm.html)
- このリポジトリ固有のビルド・CSP・vitestの制約は [`NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md`](NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md) を参照。
