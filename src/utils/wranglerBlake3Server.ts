import init, { hash } from 'blake3-wasm/dist/wasm/web/blake3_js.js';
import wranglerBlake3Wasm from 'blake3-wasm/dist/wasm/web/blake3_js_bg.wasm';

let initialized = false;

/** Wranglerが依存するblake3-wasmを実行し、取得結果の改変検知用IDを作る。 */
export async function wranglerBlake3Hex(value: string): Promise<string> {
  if (!initialized) {
    await init(wranglerBlake3Wasm);
    initialized = true;
  }
  const output = new Uint8Array(32);
  hash(new TextEncoder().encode(value), output);
  return Array.from(output, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
