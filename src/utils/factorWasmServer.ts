import { initSync, factor, is_prime } from '../../public/wasm/factor.js';
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

/**
 * `/neko fymd`・`/neko factor -a`用の素数判定。JS側で別の試し割り実装
 * (旧isPrimeInteger)を持つと2つの実装が食い違うリスクがあるため、
 * factor()と同じRust実装(is_prime、対応範囲は0以上2^53以下)へ一本化する。
 */
export function isPrimeViaWasm(n: number): boolean {
  if (!initialized) {
    initSync(factorWasmModule);
    initialized = true;
  }
  return is_prime(n);
}
