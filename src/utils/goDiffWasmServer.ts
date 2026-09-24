import '../../public/wasm/go-diff-wasm_exec.js';
import goDiffWasmModule from '../../public/wasm/go-diff.wasm';

// wasm_exec.js(`public/wasm/go-diff-wasm_exec.js`)はグローバルに`Go`クラスを
// 定義するだけの副作用importで、モジュールとしてのエクスポートは持たない。
declare class Go {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

let readyPromise: Promise<void> | null = null;

/**
 * go-diff-wasm(gh-attach-wasm・sqlc-wasmと同じくGo標準のwasm_exec.jsで動く)を
 * Cloudflare Workers上で初期化する。
 *
 * Rust/wasm-bindgen製モジュール(sha256WasmServer.ts等)の`initSync`と違い、
 * Goの`go.run(instance)`は`main()`がreturnするまで解決しないPromiseを返す。
 * `DiffText`のWASM側実装は`select{}`で意図的に無限ブロックするため、
 * `go.run()`を`await`すると永久に返ってこない。そこで`go.run()`は
 * (ブラウザページ側と同じく)あえて`await`せず、代わりにWASM側(main_js.go)が
 * `globalThis.__goDiffWasmReady`を呼び出したタイミングで
 * 「`goDiffText`等のグローバル関数の登録が完了した」と判断する。
 */
function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve) => {
      (globalThis as unknown as { __goDiffWasmReady?: () => void }).__goDiffWasmReady = resolve;
      const go = new Go();
      WebAssembly.instantiate(goDiffWasmModule, go.importObject).then((instance) => {
        void go.run(instance);
      });
    });
  }
  return readyPromise;
}

/**
 * 2つのテキストの行単位差分をgo-diff-wasm(`DiffText`)でMarkdownへ整形する。
 * `POST /api/diff`から呼ばれる。
 */
export async function diffTextViaWasm(a: string, b: string): Promise<string> {
  await ensureReady();
  const fn = (globalThis as unknown as { goDiffText?: (a: string, b: string) => string }).goDiffText;
  if (typeof fn !== 'function') {
    throw new Error('go-diff-wasmの初期化に失敗しました(goDiffTextが登録されていません)');
  }
  const result = fn(a, b);
  if (result.startsWith('ERROR: ')) {
    throw new Error(result.slice('ERROR: '.length));
  }
  return result;
}
