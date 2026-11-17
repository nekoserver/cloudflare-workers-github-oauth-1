/**
 * netmap から自ノードの Tailscale IPv4 を取り出す
 * (SPEC.cloudflare-workers-github-oauth-1.tailscale-wasm.recovery REQ-TW-016)。
 *
 * netmap の直列化は tsconnect の jsNetMapNode(Name / addresses)を正とし、
 * Go の LocalAPI 形(Name / TailscaleIPs)も拾う。探索の考え方は
 * muse-monitor の ts-discover.parsePeers と同じ(名前と addresses を持つ
 * レコードを再帰的に探す)。自ノードが居ない・IPv4 が無いときは推測せず
 * null を返す。
 */

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function firstIpv4(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const ip = item.split('/')[0];
    if (IPV4.test(ip)) return ip;
  }
  return null;
}

export function parseSelfIp(netMapJson: string, hostname: string): string | null {
  let root: unknown;
  try {
    root = JSON.parse(netMapJson);
  } catch {
    return null;
  }
  const target = hostname.split('.')[0].toLowerCase();
  let found: string | null = null;
  const visit = (value: unknown, depth: number): void => {
    if (found !== null || depth > 6 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const rec = value as Record<string, unknown>;
    const name = rec['Name'] ?? rec['name'];
    if (typeof name === 'string' && name.split('.')[0].replace(/\.$/, '').toLowerCase() === target) {
      found = firstIpv4(rec['addresses'] ?? rec['Addresses'] ?? rec['TailscaleIPs'] ?? rec['tailscaleIPs']);
      if (found !== null) return;
    }
    for (const child of Object.values(rec)) visit(child, depth + 1);
  };
  visit(root, 0);
  return found;
}
