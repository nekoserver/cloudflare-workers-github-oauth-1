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
  approxSize: string;
};

export const WASM_MODULE_REGISTRY: WasmModuleInfo[] = [
  {
    id: 'sha256',
    name: 'SHA-256 (Rust)',
    description:
      '文字列のSHA-256ハッシュを計算する。/sha256-wasmページのブラウザ実行と、AIチャットの/neko 256サブコマンドのサーバー実行の両方で同じバイナリを使用する',
    wasmPath: 'public/wasm/sha256_bg.wasm',
    sourceDir: 'wasm/sha256-wasm',
    approxSize: '約25KB',
  },
];

export function findWasmModule(id: string): WasmModuleInfo | undefined {
  return WASM_MODULE_REGISTRY.find((m) => m.id === id);
}
