export type TailnetPeer = Record<string, unknown>;
const label = (value: unknown) => typeof value === 'string' ? value.toLowerCase().split('.')[0] : '';
/** Match only a service name or its numeric collision suffix, never other services. */
export function matchesTailnetPeer(peer: TailnetPeer, base: string): boolean {
  const match = (name: string) => name === base || name.startsWith(base + '-') && /^[1-9][0-9]*$/.test(name.slice(base.length + 1));
  return [peer.hostName, peer.name, peer.dnsName].some(value => match(label(value)));
}
export function onlineTailnetPeer(peers: unknown, base: string): TailnetPeer | null {
  const candidates = Array.isArray(peers) ? peers.filter(p => p && typeof p === 'object' && p.online === true && matchesTailnetPeer(p, base)) : [];
  return candidates.length === 1 ? candidates[0] : null;
}
export function tailnetPeerAddress(peer: TailnetPeer, base: string): string {
  const dns = typeof peer.dnsName === 'string' ? peer.dnsName.toLowerCase().replace(/\.$/, '') : '';
  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.ts\.net$/.test(dns) && matchesTailnetPeer({name:label(dns)},base)) return dns;
  for (const value of [peer.dnsName, peer.name, peer.hostName]) {
    const name = label(value);
    if (/^[a-z0-9-]+$/.test(name) && matchesTailnetPeer({name},base)) return name;
  }
  throw new Error('Invalid tailnet peer');
}
