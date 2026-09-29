/**
 * ブラウザ(/sha256-wasm等)とサーバー(/neko 256等)の両方で実行できる
 * WASMモジュールのカタログ。Workersにはファイルシステムの一覧取得API
 * (`ls`相当)が無いため、新しいWASMモジュールを wasm/ 配下に追加した
 * ときは、このレジストリに手動で登録すること。
 */
export type WasmModuleInfo = {
  id: string;
  name: string;
  description: string;
  wasmPath: string;
  sourceDir: string;
  sourceFile: string;
  approxSize: string;
  // ls-wasm(/neko ls)がこのレジストリ自体を仮想ディレクトリとして一覧表示するために
  // 追加した実データ由来のフィールド。sizeBytesはpublic/wasm/配下の対応する
  // *_bg.wasmファイルの実バイト数(approxSizeの元になった数値そのもの)、
  // builtAtはそのファイルの最終コミット日(git log -1 --format=%ad --date=short)。
  // どちらも推測値ではなく実際のファイル/git履歴から確認した値を入れること。
  sizeBytes: number;
  builtAt: string;
};

export const WASM_MODULE_REGISTRY: WasmModuleInfo[] = [
  {
    id: 'wrangler',
    name: 'wrangler (BLAKE3, Rust)',
    description:
      'Cloudflare Wrangler CLIが依存するblake3-wasm。このWorkerでは/cf-dashboardの取得結果の改変検知ID生成にwebビルドを再利用しており、Wranglerのdeploy --dry-runでWorkerバンドルに実際に同梱されることを確認済み',
    wasmPath: 'node_modules/blake3-wasm/dist/wasm/web/blake3_js_bg.wasm',
    sourceDir: 'node_modules/blake3-wasm',
    // 外部依存のソースはリポジトリに含めないため、バージョンと完全性ハッシュを
    // 確認できるlockfileをソース表示の対象にする。
    sourceFile: 'package-lock.json',
    approxSize: '約34KB',
    sizeBytes: 34384,
    builtAt: '2026-09-15',
  },
  {
    id: 'sha256',
    name: 'SHA-256 (Rust)',
    description:
      '文字列のSHA-256ハッシュを計算する。/sha256-wasmページのブラウザ実行と、AIチャットの/neko 256サブコマンドのサーバー実行の両方で同じバイナリを使用する',
    wasmPath: 'public/wasm/sha256_bg.wasm',
    sourceDir: 'wasm/sha256-wasm',
    sourceFile: 'wasm/sha256-wasm/src/lib.rs',
    approxSize: '約25KB',
    sizeBytes: 25600,
    builtAt: '2026-08-20',
  },
  {
    id: 'factor',
    name: 'factor (素因数分解, Rust)',
    description:
      'GNU coreutilsのfactorコマンドを模した素因数分解(0以上2^53以下の整数、試し割り法)。/factor-wasmページのブラウザ実行と、AIチャットの/neko factorサブコマンドのサーバー実行の両方で同じバイナリを使用する',
    wasmPath: 'public/wasm/factor_bg.wasm',
    sourceDir: 'wasm/factor-wasm',
    sourceFile: 'wasm/factor-wasm/src/lib.rs',
    approxSize: '約21KB',
    sizeBytes: 21248,
    builtAt: '2026-08-20',
  },
  {
    id: 'dig',
    name: 'dig (DNS lookup, Rust)',
    description:
      'dig(1)風のDNS問い合わせ。DNSワイヤーフォーマットの問い合わせパケット組み立て・応答パケット解析をRust/WASMで行い、実際のDNS問い合わせ自体はCloudflare DNS over HTTPS(cloudflare-dns.com)へのfetchで行う。AIチャットの/neko digサブコマンドのサーバー実行で使用する',
    wasmPath: 'public/wasm/dig_bg.wasm',
    sourceDir: 'wasm/dig-wasm',
    sourceFile: 'wasm/dig-wasm/src/lib.rs',
    approxSize: '約55KB',
    sizeBytes: 55686,
    builtAt: '2026-08-20',
  },
  {
    id: 'ls',
    name: 'ls (WASM module一覧, Rust)',
    description:
      'GNU coreutilsのlsコマンドの出力書式(短形式/-l長形式/-a全件表示)だけをRustで再実装し、実データはJS側から渡す。Workersには実ファイルシステムが無いため、一覧の対象はこのWASM_MODULE_REGISTRY自体(仮想ディレクトリ)にしている。AIチャットの/neko lsサブコマンドのサーバー実行で使用する',
    wasmPath: 'public/wasm/ls_bg.wasm',
    sourceDir: 'wasm/ls-wasm',
    sourceFile: 'wasm/ls-wasm/src/lib.rs',
    approxSize: '約35KB',
    sizeBytes: 35040,
    builtAt: '2026-08-26',
  },
  {
    id: 'tree',
    name: 'tree (repository tree, Rust)',
    description:
      'GitHub Trees APIのpath・type・任意timestamp一覧をMarkdown入れ子リストへ整形する。globフィルタ、ファイル/ディレクトリ限定、名前/時刻順、逆順、表示深さ、隠しパス切替に対応する。ネットワークアクセスとOAuthはWorker側が担当する',
    wasmPath: 'wasm/tree-wasm/target/wasm32-unknown-unknown/release/tree_wasm.wasm',
    sourceDir: 'wasm/tree-wasm',
    sourceFile: 'wasm/tree-wasm/src/lib.rs',
    approxSize: '未ビルド',
    sizeBytes: 0,
    builtAt: '未ビルド',
  },
  {
    id: 'gh-attach',
    name: 'gh issue create --attach (Go)',
    description:
      'GitHub CLI(cli/cli)の`gh issue create --attach`が実装するMarkdown組み立てロジック(本文中の画像参照の書き換え・未参照分の追記)をGo/js-wasmへ移植したもの。他のモジュールと異なりRust/wasm-bindgenではなくGo標準のwasm_exec.jsグルーコードで動く。実ファイルI/O・HTTP通信(GitHubへのアップロード・Issue作成)はブラウザWASMでは行えないため対象外とし、/gh-attachページのTypeScript(Cloudflare Workers)側が実際の通信を担う。ブラウザ実行のみでサーバー(/neko等)からは呼ばれない',
    wasmPath: 'public/wasm/gh-attach.wasm',
    sourceDir: 'wasm/gh-attach-wasm',
    sourceFile: 'wasm/gh-attach-wasm/markdown.go',
    approxSize: '約3.5MB',
    sizeBytes: 3649850,
    builtAt: '2026-09-02',
  },
  {
    id: 'gh',
    name: 'gh pr list (Rust)',
    description:
      'GitHub CLI(cli/cli)の`gh pr list`相当。GitHub REST API(GET /repos/{owner}/{repo}/pulls)のJSONレスポンスをowner/repoの検証込みでMarkdownテーブルへ整形する。実際のfetch(OAuthトークン付与)はWorker(サーバー)側のTypeScriptが行う。AIチャットの/neko gh pr listサブコマンド・GET /api/gh/pr-listのサーバー実行で使用する(ブラウザページは無い)',
    wasmPath: 'public/wasm/gh_bg.wasm',
    sourceDir: 'wasm/gh-wasm',
    sourceFile: 'wasm/gh-wasm/src/lib.rs',
    approxSize: '約77KB',
    sizeBytes: 78278,
    builtAt: '2026-09-02',
  },
  {
    id: 'sqlc',
    name: 'sqlc query annotations (Go)',
    description:
      'sqlc(https://sqlc.dev/)の`-- name: GetAuthor :one`形式のクエリアノテーションをパースし、名前・コマンド種別・行番号・SQL本文をMarkdownテーブルへ整形する。SQL方言の構文解析やコード生成は対象外。gh-attach-wasmと同じくGo標準のwasm_exec.jsグルーコードで動く。/sqlc-wasmページのブラウザ実行のみでサーバー(/neko等)からは呼ばれない',
    wasmPath: 'public/wasm/sqlc.wasm',
    sourceDir: 'wasm/sqlc-wasm',
    sourceFile: 'wasm/sqlc-wasm/annotations.go',
    approxSize: '約2.4MB',
    sizeBytes: 2402703,
    builtAt: '2026-09-06',
  },
  {
    id: 'sqlx',
    name: 'SQLx QueryBuilder (Rust)',
    description:
      'SQLxのQueryBuilder<Postgres>をRust/WASMで実行し、複数行INSERTのプレースホルダーSQLと引数を生成する。識別子検証と値のバインドをWASM内で行い、DB接続・クエリ実行はブラウザではなくWorker側に分離する。/sqlx-wasmページで利用する',
    wasmPath: 'public/wasm/sqlx_bg.wasm',
    sourceDir: 'wasm/sqlx-wasm',
    sourceFile: 'wasm/sqlx-wasm/src/lib.rs',
    approxSize: '約177KB',
    sizeBytes: 180739,
    builtAt: '2026-09-25',
  },
  {
    id: 'jev',
    name: 'jev (Jev評価ロジック, Rust)',
    description:
      'Jev(TypeSafe AI System One Model)評価の純粋ロジック(criteriaの入力検証・未評価ラベルの抽出・APIリクエストボディ組み立て・レスポンス解析)をRustで実装。HTTP通信・APIキー・D1・認可はWorker側のTypeScriptが担当する。ブラウザページ・/neko サブコマンドからはまだ呼ばれておらず、src/utils/jevWasmServer.ts経由でのサーバー再利用のみ用意している',
    wasmPath: 'public/wasm/jev_bg.wasm',
    sourceDir: 'wasm/jev-wasm',
    sourceFile: 'wasm/jev-wasm/src/lib.rs',
    approxSize: '約106KB',
    sizeBytes: 108613,
    builtAt: '2026-09-17',
  },
  {
    id: 'msb',
    name: 'msb --help / --tree (microsandbox CLI, Rust)',
    description:
      'microsandbox(https://github.com/microsandbox/microsandbox)のCLI `msb` のヘルプ・コマンドツリー表示だけを再実装したもの。msb本体はKVM(Linux)/libkrun/Apple Silicon仮想化/WHP(Windows)に依存するmicroVMランタイムでWASM(ブラウザ/Workers)からは実行できないため、公式README(Apache-2.0)に列挙されたコマンド一覧を元にした静的なヘルプ・ツリー出力(msb_help/msb_tree/msb_command_help)のみを提供する。実際のサンドボックス起動・イメージ取得・スナップショット等は対象外。`/neko msb --help`のサーバー実行で使用する(msb_helpのみ配線済み。msb_tree/msb_command_helpとブラウザページは未配線)',
    wasmPath: 'public/wasm/msb_bg.wasm',
    sourceDir: 'wasm/msb-wasm',
    sourceFile: 'wasm/msb-wasm/src/lib.rs',
    approxSize: '約61KB',
    sizeBytes: 62596,
    builtAt: '2026-09-23',
  },
  {
    id: 'gron',
    name: 'gron / ungron (Go)',
    description:
      'gron(https://github.com/tomnomnom/gron)の中核であるJSON⇔代入文(`json.a.b[0] = 1;`)の相互変換だけを移植したもの。HTTPリクエスト実行・ファイル監視・ANSIカラー出力・CLI引数解析は対象外。gh-attach-wasm・sqlc-wasmと同じくGo標準のwasm_exec.jsグルーコードで動く。/gron-wasmページのブラウザ実行のみでサーバー(/neko等)からは呼ばれない',
    wasmPath: 'public/wasm/gron.wasm',
    sourceDir: 'wasm/gron-wasm',
    sourceFile: 'wasm/gron-wasm/gron.go',
    approxSize: '約3.1MB',
    sizeBytes: 3226678,
    builtAt: '2026-09-23',
  },
  {
    id: 'go-diff',
    name: 'go-diff (Go)',
    description:
      'go-diff(https://github.com/sergi/go-diff、Googleのdiff-match-patchアルゴリズムのGo移植)を使い、2つのテキストの行単位の差分を```diff フェンス付きMarkdownへ整形する。パッチ生成・適用(patch_make/patch_apply)・あいまい一致(match_main)は対象外。gh-attach-wasm・sqlc-wasmと同じくGo標準のwasm_exec.jsグルーコードで動く。/go-diff-wasmページのブラウザ実行に加え、POST /api/diff(セッションまたはAPIキー認証)からサーバー実行でも呼び出せる。コード生成の正しさ判定には使わない(CLAUDE.mdルール35参照)、人間が見るための差分表示専用',
    wasmPath: 'public/wasm/go-diff.wasm',
    sourceDir: 'wasm/go-diff-wasm',
    sourceFile: 'wasm/go-diff-wasm/diff.go',
    approxSize: '約3.0MB',
    sizeBytes: 3152752,
    builtAt: '2026-09-24',
  },
];

export function findWasmModule(id: string): WasmModuleInfo | undefined {
  return WASM_MODULE_REGISTRY.find((m) => m.id === id);
}
