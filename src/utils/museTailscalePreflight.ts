import { askgkEngine } from './askgkRoutes';

type Container = { getState(): Promise<{ status: string }>; fetch(request: Request): Promise<Response> };
const NOT_SENT = 'Museへは送信していません。';

/**
 * tailnet上のmuse-vmの確認結果。Workerはtailnetに参加できないため、本体デモコンテナの
 * `tailscale status`で読む。online以外はすべて「muse-vmを確認できない」で、理由をreasonに入れる。
 *
 * 2026-11-07 ユーザー指定: Muse投稿を停止してよいのは、tailnet上にmuse-vmを確認できない場合だけ。
 * 停止の文言は必ず「tailnet上にmuse-vmを確認できません（理由）」の形にする(museVmNotConfirmedMessage)。
 */
export type MuseVmPresence = { state: 'online' } | { state: 'not_confirmed'; reason: string };

const REASON_UNKNOWN = 'Tailscaleの接続状態を確認できません';
const REASON_CONTAINER = '本体コンテナが停止中のため、Tailscaleの接続状態を確認できません';
const REASON_BACKEND = 'Tailscaleが停止中または未接続です';
const REASON_PEER = '宛先muse-vmがオフラインまたは未登録で、接続を確認できません';

/** 停止の文言。「Muse投稿を停止しました。」で始め、確認できなかった理由を添える。 */
export function museVmNotConfirmedMessage(reason: string): string {
  return 'Muse投稿を停止しました。tailnet上にmuse-vmを確認できません（' + reason + '）。' + NOT_SENT;
}

/** tailnet上にmuse-vmが居るかを1回確かめる。停止中のコンテナは起動しない。例外は投げない。 */
export async function checkMuseVmOnTailnet(getContainer: () => Promise<Container | null>, timeoutMs = 4_000): Promise<MuseVmPresence> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<string>((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve(REASON_UNKNOWN); }, timeoutMs);
  });
  const check = async (): Promise<string | null> => {
    const container = await getContainer();
    if (!container) return REASON_UNKNOWN;
    const state = await container.getState();
    // stub.fetchは停止中のコンテナを起動して課金を始めるため、先に状態を確かめる。
    if (state.status !== 'running' && state.status !== 'healthy') return REASON_CONTAINER;
    const response = await container.fetch(new Request('http://container/debug/tailscale-peers', { signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } }));
    if (!response.ok) return REASON_UNKNOWN;
    const data = await response.json() as { backendState?: unknown; peers?: { hostName?: unknown; dnsName?: unknown; online?: unknown }[] } | null;
    if (!data || typeof data.backendState !== 'string' || !Array.isArray(data.peers)) return REASON_UNKNOWN;
    if (data.backendState !== 'Running') return REASON_BACKEND;
    const peer = data.peers.find(p => p && (p.hostName === 'muse-vm' || typeof p.dnsName === 'string' && p.dnsName.split('.')[0] === 'muse-vm'));
    if (peer?.online !== true) return REASON_PEER;
    return null;
  };
  try {
    const reason = await Promise.race([check().catch(() => REASON_UNKNOWN), expired]);
    return reason === null ? { state: 'online' } : { state: 'not_confirmed', reason };
  } finally {
    clearTimeout(timer!);
  }
}

/** checkMuseVmOnTailnetで確認できなければ、停止の文言で例外を投げる。 */
export async function requireMuseTailscale(getContainer: () => Promise<Container | null>, timeoutMs = 4_000, onStatus?: (healthy: boolean) => void): Promise<void> {
  const presence = await checkMuseVmOnTailnet(getContainer, timeoutMs);
  onStatus?.(presence.state === 'online');
  if (presence.state !== 'online') throw new Error(museVmNotConfirmedMessage(presence.reason));
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
