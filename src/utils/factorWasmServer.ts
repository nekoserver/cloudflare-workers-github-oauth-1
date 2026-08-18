import { initSync, factor } from '../../public/wasm/factor.js';
import factorWasmModule from '../../public/wasm/factor_bg.wasm';

let initialized = false;

/**
 * /factor-wasm(ブラウザ側)と同じRust実装のWASMバイナリを、initSync()で
 * Cloudflare Workers上でも直接実行する(sha256WasmServer.tsと同じ方式)。
 *
 * このファイルはindex.ts側からdynamic import()でのみ読み込むこと。
 * 静的importにすると `.wasm` インポートがVite/vitestの環境では
 * WebAssembly.Moduleではなくアセットパス文字列を返すため、このファイルを
 * importするだけで既存のindex.tsを読み込む全テスト(`import app from
 * './index'`)がテスト収集時に壊れる。
 */
export function factorViaWasm(n: number): string {
  if (!initialized) {
    initSync(factorWasmModule);
    initialized = true;
  }
  return factor(n);
}
