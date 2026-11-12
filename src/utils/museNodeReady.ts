/** /muse/* を送る前に、tailnetへの接続とmuse-vmの在席を待つ上限。 */
export const MUSE_NODE_READY_MS = 20_000;

export type MuseNodeSnapshot = { state: string; museOnline: boolean };

/** IPN.status() の生の値から、状態とmuse-vmがオンラインかを読む。読めなければ未接続。 */
export function readMuseNodeSnapshot(raw: string | Error): MuseNodeSnapshot {
  if (raw instanceof Error) return { state: '', museOnline: false };
  try {
    const data = JSON.parse(raw) as { state?: string; peers?: { name?: string; dnsName?: string; online?: boolean }[] };
    return { state: data.state ?? '', museOnline: !!data.peers?.some(p => (p.name || p.dnsName || '').split('.')[0] === 'muse-vm' && p.online === true) };
  } catch { return { state: '', museOnline: false }; }
}

/**
 * Worker内のTailscale WASMノードが Running になり、netmapにmuse-vmがオンラインで載るまで待つ。
 * デプロイのたびにノードは起動し直し、Runningの後もmuse-vmが見えるまで少しかかる
 * (以前は6秒・Runningだけで打ち切り、最初の送信が接続失敗になっていた)。
 * ログインが要るときは鍵で1回だけログインする。鍵が無い・自動ログイン停止中なら、Runningでないまま待たない。
 */
export async function waitForMuseNode(opts: {
  snapshot: () => MuseNodeSnapshot;
  login?: () => void;
  canLogin: boolean;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<MuseNodeSnapshot> {
  const sleep = opts.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.timeoutMs ?? MUSE_NODE_READY_MS);
  let loginRequested = false;
  for (let current = opts.snapshot(); ; current = opts.snapshot()) {
    if (current.state === 'Running' && current.museOnline) return current;
    if (current.state !== 'Running' && !opts.canLogin) return current;
    if (now() >= deadline) return current;
    if (current.state === 'NeedsLogin' && !loginRequested && opts.login) { loginRequested = true; opts.login(); }
    await sleep(100);
  }
}
