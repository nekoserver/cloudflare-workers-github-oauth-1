/**
 * /cf-containers の tailscale ノード ヘルスチェック欄の要約
 * (SPEC.cloudflare-workers-github-oauth-1.tailscale-wasm.recovery REQ-TW-015)。
 *
 * TailscaleWasm DO の /status 応答と、D1 の起動記録(tailscale_wasm_boot_log)を、
 * 欄の表示に必要な形へ寄せる純粋関数。DO への取得が失敗した場合は、その失敗
 * 自体を状態(unavailable)として返す。ログイン URL は要約に含めない
 * (待ちの有無だけを loginPending で表す)。
 */

export type TailnetBootEvent = {
  event: string;
  fingerprint: string | null;
  reason: string | null;
  created_at: string;
};

export type TailnetHealthKind =
  | 'running'
  | 'needs_login'
  | 'not_started'
  | 'unavailable'
  | 'not_configured'
  | 'unknown';

export type TailnetHealthSummary = {
  kind: TailnetHealthKind;
  nodeState: string | null;
  museOnline: boolean;
  peerCount: number;
  loginPending: boolean;
  lastBootEvent: TailnetBootEvent | null;
  bootEvents: TailnetBootEvent[];
  doError: string | null;
  checkedAt: string;
};

type StatusLike = {
  state?: unknown;
  peers?: unknown;
  loginURL?: unknown;
};

function peerName(peer: unknown): string | null {
  if (!peer || typeof peer !== 'object') return null;
  const record = peer as Record<string, unknown>;
  const raw = typeof record.name === 'string'
    ? record.name
    : typeof record.dnsName === 'string'
      ? record.dnsName
      : null;
  return raw ? raw.split('.')[0].toLowerCase() : null;
}

export function summarizeTailnetHealth(input: {
  configured: boolean;
  doError: string | null;
  status: StatusLike | null;
  bootEvents: TailnetBootEvent[];
  checkedAt: string;
}): TailnetHealthSummary {
  const bootEvents = input.bootEvents ?? [];
  const base: TailnetHealthSummary = {
    kind: 'unknown',
    nodeState: null,
    museOnline: false,
    peerCount: 0,
    loginPending: false,
    lastBootEvent: bootEvents[0] ?? null,
    bootEvents,
    doError: input.doError,
    checkedAt: input.checkedAt,
  };
  if (!input.configured) return { ...base, kind: 'not_configured' };
  if (input.doError) return { ...base, kind: 'unavailable' };
  const status = input.status;
  if (!status || typeof status.state !== 'string' || status.state === '') return base;
  const peers = Array.isArray(status.peers) ? status.peers : [];
  const museOnline = peers.some((peer) => {
    if (!peer || typeof peer !== 'object') return false;
    return peerName(peer) === 'muse-vm' && (peer as Record<string, unknown>).online === true;
  });
  const kind: TailnetHealthKind = status.state === 'Running'
    ? 'running'
    : status.state === 'NeedsLogin'
      ? 'needs_login'
      : status.state === 'not-started'
        ? 'not_started'
        : 'unknown';
  return {
    ...base,
    kind,
    nodeState: status.state,
    museOnline,
    peerCount: peers.length,
    loginPending: typeof status.loginURL === 'string' && status.loginURL.length > 0,
  };
}
