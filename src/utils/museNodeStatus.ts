import { isContainerRunning, type ContainerStateLike } from './cfContainerStatus';
import type { MuseContainer } from './museDirectAsk';

/**
 * /muse-statusの実処理。Workerはtailnetに参加できないため、本体デモコンテナを経由して
 * tailnet上のmuse・muse-vmの状態を読む。経路は/askmuseと同じで、キーはWorkerのsecretに置く。
 *
 * どの関数も、定期的に呼ばれても課金が始まらないよう、停止中のコンテナは起動しない
 * (stub.fetchは停止中のコンテナを起動するので、先にgetStateで確かめる)。
 */
export const MUSE_NODE_NAMES = ['muse', 'muse-vm'] as const;
export type MuseNodeName = (typeof MUSE_NODE_NAMES)[number];

const PEERS_PATH = '/debug/tailscale-peers';
const PEERS_TIMEOUT_MS = 8_000;
const SIGNAL_TIMEOUT_MS = 8_000;
// server.jsの中継(15秒)より長く待ち、中継の504を受け取る。
const NIX_TIMEOUT_MS = 18_000;
const MAX_NIX_PACKAGES = 5_000;
const MAX_NIX_TEXT = 200;

export function isMuseNodeName(value: unknown): value is MuseNodeName {
  return typeof value === 'string' && (MUSE_NODE_NAMES as readonly string[]).includes(value);
}

export type MuseNodeSummary = {
  name: MuseNodeName;
  found: boolean;
  online: boolean;
  active: boolean;
  os: string;
  ip: string;
  connection: string;
  relay: string;
  lastSeen: string;
  lastHandshake: string;
};

export type MuseNodesResult = {
  containerRunning: boolean;
  backendState: string | null;
  nodes: MuseNodeSummary[];
  error: null | 'container_not_running' | 'tailscale_unavailable' | 'timeout';
};

export type MuseSignalCode = 'ok' | 'unhealthy' | 'container_not_running' | 'not_authenticated' | 'connection_failed' | 'timeout';
// detailは接続できなかった理由(本体コンテナのtailscale ncのエラー出力)。502のときだけ入る。ページではtextContentで表示する。
export type MuseSignalResult = { node: MuseNodeName; code: MuseSignalCode; latencyMs: number | null; checkedAt: string; detail: string | null };
const MAX_SIGNAL_DETAIL = 300;

/** 中継の502の本文{errorCode, detail}からdetailを取り出す。読めなければnull。 */
function readRelayDetail(body: string): string | null {
  try {
    const detail = (JSON.parse(body) as { detail?: unknown } | null)?.detail;
    return typeof detail === 'string' && detail.trim() ? detail.trim().slice(0, MAX_SIGNAL_DETAIL) : null;
  } catch {
    return null;
  }
}

export type MuseNixState =
  | 'ok'
  | 'not_provided'
  | 'container_not_running'
  | 'not_authenticated'
  | 'auth_failed'
  | 'connection_failed'
  | 'timeout'
  | 'invalid_response';
export type MuseNixPackage = { name: string; version: string | null };
export type MuseNixResult = {
  node: MuseNodeName;
  state: MuseNixState;
  packages: MuseNixPackage[];
  total: number;
  truncated: boolean;
  generatedAt: string | null;
};

type ContainerResponse = { kind: 'response'; status: number; text: string } | { kind: 'stopped' } | { kind: 'timeout' } | { kind: 'failed' };

/** getStateも含めて期限内に1回だけ問い合わせる。例外は投げず、結果の種類で返す。 */
async function readContainer(container: MuseContainer, path: string, apiKey: string | undefined, timeoutMs: number): Promise<ContainerResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<ContainerResponse>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ kind: 'timeout' });
    }, timeoutMs);
  });
  const execute = async (): Promise<ContainerResponse> => {
    if (!isContainerRunning((await container.getState()) as ContainerStateLike)) return { kind: 'stopped' };
    const response = await container.fetch(new Request(`http://container${path}`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
    }));
    return { kind: 'response', status: response.status, text: await response.text() };
  };
  try {
    return await Promise.race([execute().catch((): ContainerResponse => ({ kind: 'failed' })), expired]);
  } finally {
    clearTimeout(timer!);
  }
}

function emptyNode(name: MuseNodeName): MuseNodeSummary {
  return { name, found: false, online: false, active: false, os: '', ip: '', connection: '', relay: '', lastSeen: '', lastHandshake: '' };
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** server.jsのsummarizeTailscalePeersの応答から、Museの2ノードだけを取り出す。一覧に無いノードもfound: falseで返す。 */
export function pickMuseNodes(peers: unknown): MuseNodeSummary[] {
  const list = Array.isArray(peers) ? (peers as Record<string, unknown>[]) : [];
  return MUSE_NODE_NAMES.map((name) => {
    const peer = list.find((item) => item?.hostName === name);
    if (!peer) return emptyNode(name);
    return {
      name,
      found: true,
      online: peer.online === true,
      active: peer.active === true,
      os: text(peer.os),
      ip: text(peer.ip),
      connection: text(peer.connection),
      relay: text(peer.relay),
      lastSeen: text(peer.lastSeen),
      lastHandshake: text(peer.lastHandshake),
    };
  });
}

export async function fetchMuseNodes(container: MuseContainer | null): Promise<MuseNodesResult> {
  const blank = MUSE_NODE_NAMES.map(emptyNode);
  if (!container) return { containerRunning: false, backendState: null, nodes: blank, error: 'container_not_running' };
  const result = await readContainer(container, PEERS_PATH, undefined, PEERS_TIMEOUT_MS);
  if (result.kind === 'stopped') return { containerRunning: false, backendState: null, nodes: blank, error: 'container_not_running' };
  if (result.kind === 'timeout') return { containerRunning: true, backendState: null, nodes: blank, error: 'timeout' };
  if (result.kind === 'failed' || result.status !== 200) return { containerRunning: true, backendState: null, nodes: blank, error: 'tailscale_unavailable' };
  try {
    const body = JSON.parse(result.text) as { backendState?: unknown; peers?: unknown; error?: unknown };
    if (body.error || !Array.isArray(body.peers)) return { containerRunning: true, backendState: null, nodes: blank, error: 'tailscale_unavailable' };
    return { containerRunning: true, backendState: text(body.backendState) || null, nodes: pickMuseNodes(body.peers), error: null };
  } catch {
    return { containerRunning: true, backendState: null, nodes: blank, error: 'tailscale_unavailable' };
  }
}

/** ノードの/healthへ死活確認のシグナルを1回送る。推論は走らない。 */
export async function sendMuseSignal(container: MuseContainer | null, apiKey: string | undefined, node: MuseNodeName): Promise<MuseSignalResult> {
  const finish = (code: MuseSignalCode, latencyMs: number | null = null, detail: string | null = null): MuseSignalResult => ({ node, code, latencyMs, checkedAt: new Date().toISOString(), detail });
  if (!container) return finish('container_not_running');
  if (!apiKey) return finish('not_authenticated');
  const startedAt = Date.now();
  const result = await readContainer(container, `/admin/muse/${node}/health`, apiKey, SIGNAL_TIMEOUT_MS);
  const latencyMs = Date.now() - startedAt;
  if (result.kind === 'stopped') return finish('container_not_running');
  if (result.kind === 'timeout') return finish('timeout');
  if (result.kind === 'failed') return finish('connection_failed');
  if (result.status === 502) return finish('connection_failed', null, readRelayDetail(result.text));
  if (result.status === 504) return finish('timeout');
  if (result.status !== 200) return finish('unhealthy', latencyMs);
  try {
    return finish((JSON.parse(result.text) as { status?: unknown } | null)?.status === 'ok' ? 'ok' : 'unhealthy', latencyMs);
  } catch {
    return finish('unhealthy', latencyMs);
  }
}

/**
 * ノードの`GET /nix/packages`の応答を読む。形は`{"packages":[{"name":"hello","version":"2.12.1"}],"generatedAt":"…"}`。
 * 不正な要素は捨て、1件も読める形でなければinvalid_responseにする。値はページでtextContentとして表示する。
 */
export function parseMuseNixPackages(payload: string): Omit<MuseNixResult, 'node' | 'state'> | null {
  let data: { packages?: unknown; generatedAt?: unknown };
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!Array.isArray(data?.packages)) return null;
  const packages: MuseNixPackage[] = [];
  for (const item of data.packages as { name?: unknown; version?: unknown }[]) {
    if (typeof item?.name !== 'string' || !item.name || item.name.length > MAX_NIX_TEXT) continue;
    const version = typeof item.version === 'string' && item.version.length <= MAX_NIX_TEXT ? item.version : null;
    packages.push({ name: item.name, version });
  }
  if (data.packages.length > 0 && packages.length === 0) return null;
  packages.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    packages: packages.slice(0, MAX_NIX_PACKAGES),
    total: packages.length,
    truncated: packages.length > MAX_NIX_PACKAGES,
    generatedAt: typeof data.generatedAt === 'string' && data.generatedAt.length <= MAX_NIX_TEXT ? data.generatedAt : null,
  };
}

export async function fetchMuseNixPackages(container: MuseContainer | null, apiKey: string | undefined, node: MuseNodeName): Promise<MuseNixResult> {
  const fail = (state: MuseNixState): MuseNixResult => ({ node, state, packages: [], total: 0, truncated: false, generatedAt: null });
  if (!container) return fail('container_not_running');
  if (!apiKey) return fail('not_authenticated');
  const result = await readContainer(container, `/admin/muse/${node}/nix`, apiKey, NIX_TIMEOUT_MS);
  if (result.kind === 'stopped') return fail('container_not_running');
  if (result.kind === 'timeout') return fail('timeout');
  if (result.kind === 'failed') return fail('connection_failed');
  if (result.status === 404) return fail('not_provided');
  if (result.status === 401 || result.status === 403) return fail('auth_failed');
  if (result.status === 502) return fail('connection_failed');
  if (result.status === 504) return fail('timeout');
  if (result.status !== 200) return fail('invalid_response');
  const parsed = parseMuseNixPackages(result.text);
  return parsed ? { node, state: 'ok', ...parsed } : fail('invalid_response');
}
