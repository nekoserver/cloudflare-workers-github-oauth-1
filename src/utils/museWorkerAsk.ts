import { DEFAULT_ASKGK_TIMEOUT_SECONDS, readAskgkTimeoutSetting } from './askgkTimeoutSettings';
import { parseCompletion, type MuseDirectResult } from './museDirectAsk';
import { formatMuseBridgeDiagnosis, type MuseBridgeDiagnosis, type MuseKeyStat } from './wasmMuseBridge';
/** 送った鍵の指紋と、鍵ごとの返事の記録を1文にする。返事をもらえている鍵と指紋が違えば、送った鍵は Muse に特定されていない。 */
export function formatMuseKeyReport(fingerprint?: string, keys?: MuseKeyStat[]): string {
  if (!fingerprint) return '';
  const mine = keys?.find(k => k.fingerprint === fingerprint);
  const others = (keys ?? []).filter(k => k.fingerprint !== fingerprint && k.replied > 0);
  return `送った鍵 ${fingerprint}: 返事 ${mine?.replied ?? 0}回・返事なし ${mine?.unanswered ?? 0}回`
    + (others.length ? ` / 返事をもらえている鍵 ${others.map(k => `${k.fingerprint}: ${k.replied}回`).join('、')}` : ' / 返事をもらえた鍵はまだ無い');
}
import { MUSE_NODE_READY_MS } from './museNodeReady';
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
      env.TAILSCALE_WASM.get(env.TAILSCALE_WASM.idFromName('muse')).fetch(new Request('http://tailnet' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Muse-Bridge-Timeout-Ms': String(Math.max(1000, timeoutMs - 3000)), ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal })),
      new Promise<Response>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(Response.json({ error: 'llm_timeout' }, { status: 504 })); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
/** 直送(Worker内WASM → muse-vm)の死活確認。AIチャットの枠色・tree-view・/tailscale-wasm が使う。 */
/**
 * 死活確認の待ち時間。ノードは起動し直した直後、tailnetにつながるまで MUSE_NODE_READY_MS まで待つので、それより長くする
 * (以前は8秒で、起動直後は Muse が動いていても必ず失敗し、ページ読み込み時のトーストが出ていた。2026-11-12)。
 */
export const MUSE_WORKER_HEALTH_TIMEOUT_MS = MUSE_NODE_READY_MS + 8_000;
export async function checkMuseWorkerHealth(env: Env, callerKey?: string): Promise<boolean> {
  if (!env.MUSE_API_KEY) return false;
  try { const res = await boundedFetch(env, '/muse/health', undefined, MUSE_WORKER_HEALTH_TIMEOUT_MS, callerKey); return res.status === 200 && (await res.json() as { status?: string })?.status === 'ok'; }
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
        const data = await res.json().catch(() => null) as { diagnosis?: MuseBridgeDiagnosis; keyFingerprint?: string; keys?: MuseKeyStat[] } | null;
        const lines = [data?.diagnosis?.cause ? formatMuseBridgeDiagnosis(data.diagnosis) : '', formatMuseKeyReport(data?.keyFingerprint, data?.keys)].filter(Boolean);
        return lines.length ? { ok: false, error, diagnosis: lines.join('\n') } : { ok: false, error };
      }
      const result = parseCompletion(await res.text()); onStatus?.(result.ok); return result;
    } catch { onStatus?.(false); return { ok: false, error: 'muse_connection_failed' }; }
 }
/** Worker内WASMで muse-vm へ送る経路のID(SPEC.cloudflare-workers-github-oauth-1.20261112.muse-request-routes.md 7章の名前の候補)。 */
export type MuseWorkerRouteId = 'aichat-direct' | 'treeview-musetab-wasm';
/** 待ち時間の上限。動いている tree-view の Museタブと同じ90秒にそろえる(2026-11-12)。 */
export const MUSE_WORKER_MAX_TIMEOUT_SECONDS = 90;
/**
 * Worker内WASMの直送の共通の送り方。tree-view の Museタブで応答が返る送り方を、AIチャットにも使う(違うのは経路IDだけ。ユーザー指定 2026-11-12)。
 * 鍵は毎回 Authorization で中継へ明示する(中継が起動時に読んだ鍵に任せない)。失敗したら経路IDを Worker のログに出す(鍵は出さない)。
 */
export async function sendMuseViaWorker(env: Env, messages: {role: 'user' | 'assistant'; content: string}[], options: { routeId: MuseWorkerRouteId; apiKey?: string; onStatus?: (healthy: boolean) => void }): Promise<MuseDirectResult> {
  const result = await askMuseWorkerMessages({ ...env, MUSE_API_KEY: options.apiKey }, messages, options.onStatus, MUSE_WORKER_MAX_TIMEOUT_SECONDS, options.apiKey);
  if (!result.ok) console.log('[muse-worker] ' + JSON.stringify({ routeId: options.routeId, error: result.error, ...(result.diagnosis ? { diagnosis: result.diagnosis } : {}) }));
  return result;
}
/** 直送(Worker内WASM → muse-vm)。AIチャットの接頭語なしのMuse・/askmuse(⚙の既定)と /tailscale-wasm の bridge-chat が使う。送り方は tree-view の Museタブと同じ。 */
export function museWorkerDep(env: Env, onStatus?: (healthy: boolean) => void) {
  return (prompt: string): Promise<MuseDirectResult> => sendMuseViaWorker(env, [{ role: 'user', content: prompt }], { routeId: 'aichat-direct', apiKey: env.MUSE_API_KEY, onStatus });
}
