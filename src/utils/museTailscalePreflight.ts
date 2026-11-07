import { askgkEngine } from './askgkRoutes';

type Container = { getState(): Promise<{ status: string }>; fetch(request: Request): Promise<Response> };
const NOT_SENT = 'Museへは送信していません。';
const UNKNOWN = 'Muse投稿を停止しました。Tailscaleの接続状態を確認できません。' + NOT_SENT;

export async function requireMuseTailscale(getContainer: () => Promise<Container | null>, timeoutMs = 4_000, onStatus?: (healthy: boolean) => void): Promise<void> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error(UNKNOWN)); }, timeoutMs);
  });
  const check = async (): Promise<string | null> => {
    const container = await getContainer();
    if (!container) return UNKNOWN;
    const state = await container.getState();
    if (state.status !== 'running' && state.status !== 'healthy') return 'Muse投稿を停止しました。本体コンテナが停止中のためTailscaleへ接続できません。' + NOT_SENT;
    const response = await container.fetch(new Request('http://container/debug/tailscale-peers', { signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } }));
    if (!response.ok) return UNKNOWN;
    const data = await response.json() as { backendState?: unknown; peers?: { hostName?: unknown; dnsName?: unknown; online?: unknown }[] } | null;
    if (!data || typeof data.backendState !== 'string' || !Array.isArray(data.peers)) return UNKNOWN;
    if (data.backendState !== 'Running') return 'Muse投稿を停止しました。Tailscaleが停止中または未接続です。' + NOT_SENT;
    const peer = data.peers.find(p => p && (p.hostName === 'muse-vm' || typeof p.dnsName === 'string' && p.dnsName.split('.')[0] === 'muse-vm'));
    if (peer?.online !== true) return 'Muse投稿を停止しました。Tailscaleの宛先muse-vmへの接続を確認できません（オフラインまたは未登録）。' + NOT_SENT;
    return null;
  };
  let error: string | null;
  try { error = await Promise.race([check().catch(() => UNKNOWN), expired]); }
  catch (failure) { onStatus?.(false); throw failure; }
  finally { clearTimeout(timer!); }
  onStatus?.(error === null);
  if (error) throw new Error(error);
}

/** Require a fresh main-container tailnet check before each Muse submission.
 * No inference, container startup, retries or alternative submission routes.
 * Online is a prerequisite, not proof of successful inference/HTTP delivery.
 */
export function withMuseTailscalePreflight<T>(send: (message: string) => Promise<T>, getContainer: () => Promise<Container | null>, timeoutMs = 4_000, onStatus?: (healthy: boolean) => void) {
  return async (message: string): Promise<T> => {
    if (askgkEngine(message) !== 'muse') return send(message);
    await requireMuseTailscale(getContainer, timeoutMs, onStatus);
    return send(message);
  };
}

/** Same prerequisite for the input border and submission. Never submits a job. */
export async function checkMuseTailscale(getContainer: () => Promise<Container | null>): Promise<boolean> {
  try { return await withMuseTailscalePreflight(async () => true, getContainer)('muse_prompt="health"'); }
  catch { return false; }
}
