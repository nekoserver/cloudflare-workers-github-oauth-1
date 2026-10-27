import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { summarizeTailscalePeers } = require('../containers/demo/server.js');

describe('summarizeTailscalePeers', () => {
  it('CurAddr があれば直接、無く Relay があれば DERP 中継と判定する', () => {
    const result = summarizeTailscalePeers({
      BackendState: 'Running',
      Self: { HostName: 'cf-demo-container', DNSName: 'cf-demo-container.example.ts.net.', TailscaleIPs: ['100.80.141.109'] },
      Peer: {
        a: { HostName: 'phone', TailscaleIPs: ['100.1.1.1'], Online: true, Active: true, CurAddr: '203.0.113.5:41641', Relay: 'syd' },
        b: { HostName: 'laptop', TailscaleIPs: ['100.1.1.2'], Online: true, Active: false, CurAddr: '', Relay: 'syd' },
        c: { HostName: 'old', TailscaleIPs: ['100.1.1.3'], Online: false, Active: false, CurAddr: '', Relay: '' },
      },
    });
    expect(result.backendState).toBe('Running');
    expect(result.self.ip).toBe('100.80.141.109');
    expect(result.peers.map((p: { hostName: string; connection: string }) => [p.hostName, p.connection])).toEqual([
      ['phone', 'direct'],
      ['laptop', 'relay'],
      ['old', 'none'],
    ]);
  });

  it('Peer が無くても空の一覧を返す', () => {
    expect(summarizeTailscalePeers({ BackendState: 'NeedsLogin' }).peers).toEqual([]);
  });
});

describe('配線', () => {
  it('server.js が /debug/tailscale-peers を返し、画面がそれを表示する', () => {
    expect(readFileSync('containers/demo/server.js', 'utf-8')).toMatch(/req\.url === '\/debug\/tailscale-peers'/);
    const v = readFileSync('src/views/cfContainers.ts', 'utf-8');
    expect(v).toMatch(/id="btn-tailscale-peers"/);
    expect(v).toMatch(/\/cf-containers\/proxy\/debug\/tailscale-peers/);
  });
});
