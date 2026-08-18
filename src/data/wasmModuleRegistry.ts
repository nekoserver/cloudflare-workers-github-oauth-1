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
};

export const WASM_MODULE_REGISTRY: WasmModuleInfo[] = [
  {
    id: 'sha256',
    name: 'SHA-256 (Rust)',
    description:
      '文字列のSHA-256ハッシュを計算する。/sha256-wasmページのブラウザ実行と、AIチャットの/neko 256サブコマンドのサーバー実行の両方で同じバイナリを使用する',
    wasmPath: 'public/wasm/sha256_bg.wasm',
    sourceDir: 'wasm/sha256-wasm',
    sourceFile: 'wasm/sha256-wasm/src/lib.rs',
    approxSize: '約25KB',
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
  },
];

export function findWasmModule(id: string): WasmModuleInfo | undefined {
  return WASM_MODULE_REGISTRY.find((m) => m.id === id);
}
