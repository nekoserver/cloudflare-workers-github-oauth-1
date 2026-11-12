import { DEFAULT_ASKGK_TIMEOUT_SECONDS, readAskgkTimeoutSetting } from './askgkTimeoutSettings';
import { parseCompletion, type MuseDirectResult } from './museDirectAsk';
import { formatMuseBridgeDiagnosis, type MuseBridgeDiagnosis } from './wasmMuseBridge';
export type MuseTransport = 'worker' | 'container';

/**
 * AIチャットの接頭語なしのMuseの経路。送信・死活確認・ジョブ受付で同じ設定(⚙、Cookie aichat_muse_signal)を読む。
 * 既定は直送(Worker内WASM、コンテナを通さない)。旧コンテナ直通は設定で明示的に選んだとき(transport:'container')だけ。
 * 失敗しても互いの代替にしない(SPEC.cloudflare-workers-github-oauth-1.aichat-muse.20261106.md の図、2026-11-08)。
 */
export function resolveMuseTransport(cookie: string): MuseTransport {
  const part = cookie.split(';').map(x => x.trim()).find(x => x.startsWith('aichat_muse_signal='));
  if (!part) return 'worker';
  try { return JSON.parse(decodeURIComponent(part.slice('aichat_muse_signal='.length)))?.transport === 'container' ? 'container' : 'worker'; }
  catch { return 'worker'; }
}
/** 直送に失敗したら tunnels.rb をフォールバック経路として使うか。既定は使わない(明示的に true のときだけ。ユーザー指定 2026-11-12)。 */
export function resolveMuseTunnelsFallback(cookie: string): boolean {
  const part = cookie.split(';').map(x => x.trim()).find(x => x.startsWith('aichat_muse_signal='));
  if (!part) return false;
  try { return JSON.parse(decodeURIComponent(part.slice('aichat_muse_signal='.length)))?.tunnelsFallback === true; }
  catch { return false; }
}
type Env = { TAILSCALE_WASM?: DurableObjectNamespace; MUSE_API_KEY?: string; DB?: D1Database };
async function boundedFetch(env: Env, path: string, body?: unknown, timeoutMs = 8000, apiKey?: string): Promise<Response> {
  if (!env.TAILSCALE_WASM) return Response.json({ error: 'tailscale_wasm_not_configured' }, { status: 503 });
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      env.TAILSCALE_WASM.get(env.TAILSCALE_WASM.idFromName('muse')).fetch(new Request('http://tailnet' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal })),
      new Promise<Response>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(Response.json({ error: 'llm_timeout' }, { status: 504 })); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
/** 直送(Worker内WASM → muse-vm)の死活確認。AIチャットの枠色・tree-view・/tailscale-wasm が使う。 */
export async function checkMuseWorkerHealth(env: Env, callerKey?: string): Promise<boolean> {
  if (!env.MUSE_API_KEY) return false;
  try { const res = await boundedFetch(env, '/muse/health', undefined, 8000, callerKey); return res.status === 200 && (await res.json() as { status?: string })?.status === 'ok'; }
  catch { return false; }
}
/** callerKeyを渡すと、Tailscale WASMの中継はその鍵をmuse-vmへ渡す(dynamicnekoのMUSE_API_KEY)。無ければ中継が持つ本体の鍵。 */
export async function askMuseWorkerMessages(env: Env, messages: {role: 'user' | 'assistant'; content: string}[], onStatus?: (healthy: boolean) => void, maxTimeoutSeconds?: number, callerKey?: string): Promise<MuseDirectResult> {
    if (!env.TAILSCALE_WASM) { onStatus?.(false); return { ok: false, error: 'tailscale_wasm_not_configured' }; }
    if (!env.MUSE_API_KEY) { onStatus?.(false); return { ok: false, error: 'muse_not_authenticated' }; }
    if (messages.reduce((size, message) => size + new TextEncoder().encode(message.content).length, 0) > 16384) return { ok: false, error: 'prompt_too_large' };
    try {
      const timeout = env.DB ? (await readAskgkTimeoutSetting(env.DB)).timeoutSeconds : DEFAULT_ASKGK_TIMEOUT_SECONDS;
      const res = await boundedFetch(env, '/muse/v1/chat/completions', { model: 'muse', messages }, Math.min(timeout, maxTimeoutSeconds ?? timeout) * 1000, callerKey);
      if (res.status !== 200) {
        onStatus?.(false);
        const error = res.status === 504 ? 'llm_timeout' : res.status === 401 || res.status === 403 ? 'muse_authentication_failed' : res.status === 429 ? 'muse_usage_limit' : 'muse_connection_failed';
        // 中継がタイムアウトの診断を返していれば、表示用の1文にして載せる。
        const data = await res.json().catch(() => null) as { diagnosis?: MuseBridgeDiagnosis } | null;
        return data?.diagnosis?.cause ? { ok: false, error, diagnosis: formatMuseBridgeDiagnosis(data.diagnosis) } : { ok: false, error };
      }
      const result = parseCompletion(await res.text()); onStatus?.(result.ok); return result;
    } catch { onStatus?.(false); return { ok: false, error: 'muse_connection_failed' }; }
 }
/** 直送(Worker内WASM → muse-vm)。AIチャットの接頭語なしのMuse・/askmuse(⚙の既定)と /tailscale-wasm の bridge-chat が使う。 */
export function museWorkerDep(env: Env, onStatus?: (healthy: boolean) => void) {
  return (prompt: string): Promise<MuseDirectResult> => askMuseWorkerMessages(env, [{ role: 'user', content: prompt }], onStatus);
}
