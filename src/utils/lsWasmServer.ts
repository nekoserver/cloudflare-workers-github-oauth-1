import { initSync, ls_format } from '../../public/wasm/ls.js';
import lsWasmModule from '../../public/wasm/ls_bg.wasm';
import { WASM_MODULE_REGISTRY } from '../data/wasmModuleRegistry';

let initialized = false;

function ensureInit(): void {
  if (!initialized) {
    initSync(lsWasmModule);
    initialized = true;
  }
}

/**
 * wasmPath("public/wasm/sha256_bg.wasm"等)から末尾のファイル名だけを取り出す。
 */
function basename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

/**
 * WASM_MODULE_REGISTRY(このリポジトリのWASMモジュールカタログ)を、
 * ls-wasm(Rust実装)へ渡す"name\ttype\tsize\tmtime"形式のTSVへ変換する。
 * Workersには実ファイルシステムが無いため、`/neko ls` の一覧対象は
 * このレジストリ自体を仮想ディレクトリとして扱う(wasmModuleRegistry.tsの
 * コメント参照)。size/mtimeはレジストリに登録済みの実データ(sizeBytes/builtAt、
 * どちらもpublic/wasm/配下の実ファイル・git履歴から確認済みの値)を使う。
 */
function buildRegistryEntriesTsv(): string {
  return WASM_MODULE_REGISTRY
    .map((m) => `${basename(m.wasmPath)}\t-\t${m.sizeBytes}\t${m.builtAt}`)
    .join('\n');
}

/**
 * `/neko ls [-l] [-a]` の実処理。GNU coreutilsのlsコマンドの出力書式
 * (短形式/-l長形式/-a全件表示)をWASM(Rust実装)で整形する。このファイルは
 * index.ts側からdynamic import()でのみ読み込むこと(理由はsha256WasmServer.ts
 * のコメントを参照。.wasm静的importを含むファイルをindex.tsが静的importすると、
 * `import app from './index'` を使う既存の全テストがテスト収集時に壊れる)。
 */
export function lsFormatViaWasm(long: boolean, showAll: boolean): string {
  ensureInit();
  return ls_format(buildRegistryEntriesTsv(), long, showAll);
}
