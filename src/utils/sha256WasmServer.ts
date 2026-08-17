import { initSync, sha256_hex } from '../../public/wasm/sha256.js';
import sha256WasmModule from '../../public/wasm/sha256_bg.wasm';

let initialized = false;

/**
 * /sha256-wasm(ブラウザ側)と同じRust実装のWASMバイナリを、initSync()で
 * Cloudflare Workers上でも直接実行する。Workers/wranglerの.wasmインポートは
 * WebAssembly.Moduleを返すため、fetchを介さずinitSyncへそのまま渡せる
 * (target=webのwasm-bindgen出力をブラウザ・サーバー両方で共用している)。
 *
 * このファイルはindex.ts側からdynamic import()でのみ読み込むこと。
 * 静的importにすると `.wasm` インポートがVite/vitestの環境では
 * WebAssembly.Moduleではなくアセットパス文字列を返すため、このファイルを
 * importするだけで既存のindex.tsを読み込む全テスト(`import app from
 * './index'`)がテスト収集時に壊れる。
 */
export function sha256HexViaWasm(input: string): string {
  if (!initialized) {
    initSync(sha256WasmModule);
    initialized = true;
  }
  return sha256_hex(input);
}
