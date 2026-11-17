/**
 * netmap から自ノードの Tailscale IPv4 を取り出す
 * (SPEC.cloudflare-workers-github-oauth-1.tailscale-wasm.recovery REQ-TW-016)。
 *
 * netmap の形は tsconnect の jsNetMapNode 直列化(Name / addresses)を正とし、
 * Go の LocalAPI 形(Name / TailscaleIPs)も拾う。自ノードが居ない・住所が
 * 無いときは推測せず null を返す。
 */
import { describe, expect, it } from 'vitest';
import { parseSelfIp } from './tailnetSelfIp';

describe('parseSelfIp', () => {
  it('addresses から自ノードの IPv4 を返す(プレフィックスを落とす)', () => {
    const netMap = JSON.stringify({
      node: { Name: 'main-worker-muse.taile4e096.ts.net.', addresses: ['100.127.175.6/32', 'fd7a:115c:a1e0::6/128'] },
      peers: [{ Name: 'muse-vm.taile4e096.ts.net.', addresses: ['100.86.29.77/32'] }],
    });
    expect(parseSelfIp(netMap, 'main-worker-muse')).toBe('100.127.175.6');
  });

  it('peers の中にある自ノードも見つける', () => {
    const netMap = JSON.stringify({
      peers: [
        { name: 'muse-vm', addresses: ['100.86.29.77/32'] },
        { name: 'main-worker-muse', addresses: ['100.103.197.48/32'] },
      ],
    });
    expect(parseSelfIp(netMap, 'main-worker-muse')).toBe('100.103.197.48');
  });

  it('TailscaleIPs 表記も拾う', () => {
    const netMap = JSON.stringify({ self: { Name: 'main-worker-muse', TailscaleIPs: ['100.64.0.1', 'fd7a::1'] } });
    expect(parseSelfIp(netMap, 'main-worker-muse')).toBe('100.64.0.1');
  });

  it('自ノードが居なければ null', () => {
    const netMap = JSON.stringify({ peers: [{ Name: 'muse-vm', addresses: ['100.86.29.77/32'] }] });
    expect(parseSelfIp(netMap, 'main-worker-muse')).toBeNull();
  });

  it('壊れた JSON や IPv6 のみなら null', () => {
    expect(parseSelfIp('{oops', 'main-worker-muse')).toBeNull();
    const v6only = JSON.stringify({ node: { Name: 'main-worker-muse', addresses: ['fd7a:115c:a1e0::6/128'] } });
    expect(parseSelfIp(v6only, 'main-worker-muse')).toBeNull();
  });
});
