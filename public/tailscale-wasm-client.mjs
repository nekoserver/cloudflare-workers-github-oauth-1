// 公式@tailscale/connectのブラウザ用WASMを読み込む共通処理。/container-monitorと/muse-statusが使う。
// 配布物はpublic/tailscale-connect/<版>/に置き、出典とsha256はbuild-info.jsonにある。
export const TAILSCALE_WASM_ROOT = '/tailscale-connect/1.105.194';

/** ファイル自体のgzipとHTTPの転送圧縮を区別して展開し、WASMのヘッダを確かめる。 */
export async function decodeTailscaleWasm(input) {
  let bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if (bytes[0] !== 0 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) throw new Error('WASMの配信形式が不正です');
  return bytes;
}

/** Tailscaleが通知したログインURLのうち、HTTPSのtailscale.comのものだけを許す。 */
export function isTailscaleLoginURL(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === 'https:' && !url.username && !url.password
    && (url.hostname === 'login.tailscale.com' || url.hostname.endsWith('.tailscale.com'));
}

/** WASMを取得して公式SDKのcreateIPNを呼ぶ。configはcreateIPNへそのまま渡す(authKeyは空で、利用者がログインする)。 */
export async function loadTailscaleClient(config, fetcher = fetch) {
  const response = await fetcher(config.wasmURL ?? `${TAILSCALE_WASM_ROOT}/main.wasm.gz`);
  if (!response.ok) throw new Error(`WASM取得 HTTP ${response.status}`);
  const bytes = await decodeTailscaleWasm(await response.arrayBuffer());
  const wasmURL = URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
  try {
    const client = await (await import(`${TAILSCALE_WASM_ROOT}/pkg.js`)).createIPN({ ...config, wasmURL });
    if (client instanceof Error) throw client;
    if (!client || typeof client.run !== 'function') throw new Error('Tailscale WASM が起動可能なノードを返しませんでした');
    return client;
  } finally { URL.revokeObjectURL(wasmURL); }
}
