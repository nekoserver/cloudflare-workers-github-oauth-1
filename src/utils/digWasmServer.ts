import { initSync, dig_build_query, dig_format_response } from '../../public/wasm/dig.js';
import digWasmModule from '../../public/wasm/dig_bg.wasm';

let initialized = false;

function ensureInit(): void {
  if (!initialized) {
    initSync(digWasmModule);
    initialized = true;
  }
}

/**
 * `/neko dig` のDNSワイヤーフォーマット問い合わせパケットをWASM(Rust実装)で
 * 組み立てる。このファイルはindex.ts側からdynamic import()でのみ読み込むこと
 * (理由はsha256WasmServer.tsのコメントを参照。.wasm静的importを含むファイルを
 * index.tsが静的importすると、`import app from './index'` を使う既存の全テストが
 * テスト収集時に壊れる)。
 */
export function digBuildQueryViaWasm(name: string, qtype: string): Uint8Array {
  ensureInit();
  return dig_build_query(name, qtype);
}

/**
 * DNS over HTTPSで受け取った生の応答バイト列を、dig(1)風のテキストに
 * WASM(Rust実装)で整形する。
 */
export function digFormatResponseViaWasm(
  name: string,
  qtype: string,
  server: string,
  queryMs: number,
  responseBytes: Uint8Array
): string {
  ensureInit();
  return dig_format_response(name, qtype, server, queryMs, responseBytes);
}

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const DOH_SERVER_LABEL = 'cloudflare-dns.com (DNS over HTTPS)';

/**
 * `/neko dig <ドメイン> [タイプ]` の実処理。WASM(Rust実装)でDNSワイヤー
 * フォーマットの問い合わせパケットを組み立て、Cloudflare DNS over HTTPS
 * (`cloudflare-dns.com/dns-query`)へPOSTし、返ってきた生バイト列をWASMで
 * dig(1)風テキストに整形する。Workersからは生のUDP:53ソケットが使えない
 * ため、実際のDNS問い合わせ自体はDoH経由のfetchで行う。
 */
export async function digLookupViaWasm(name: string, qtype: string): Promise<string> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('ドメイン名を指定してください');
  }
  const queryBytes = digBuildQueryViaWasm(trimmedName, qtype);
  // Cloudflare WorkersのfetchのBodyInit型はArrayBuffer(ArrayBufferLikeではなく)を
  // 要求するため、wasm-bindgenが返すUint8Arrayをコピーして正規化する。
  const queryBuffer = queryBytes.slice().buffer as ArrayBuffer;
  const startedAt = Date.now();
  const res = await fetch(DOH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/dns-message',
      Accept: 'application/dns-message',
    },
    body: queryBuffer,
  });
  if (!res.ok) {
    throw new Error(`DNS over HTTPSへの問い合わせに失敗しました(HTTP ${res.status})`);
  }
  const responseBuf = new Uint8Array(await res.arrayBuffer());
  const queryMs = Date.now() - startedAt;
  return digFormatResponseViaWasm(trimmedName, qtype, DOH_SERVER_LABEL, queryMs, responseBuf);
}
