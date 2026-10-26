import { describe, expect, it } from 'vitest';
import { collectContainerMonitor, getContainerMonitorProviders } from './containerMonitor';
describe('container monitoring providers', () => {
  it('defaults to WASM when no API token is configured', () => {
    expect(getContainerMonitorProviders({})).toEqual({ defaultProvider: 'tailscale-wasm', providers: [{ id: 'tailscale-wasm', label: 'Tailscale WASM', execution: 'browser', scope: 'ログインしたTailscaleユーザーから見える端末' }] });
  });
  it('includes configured APIs and always retains WASM without exposing credentials', () => {
    const result = getContainerMonitorProviders({ CLOUDFLARE_ACCOUNT_ID: 'account', CF_CONTAINER_API_TOKEN: 'private-cf', TAILSCALE_API_TOKEN: 'private-ts' });
    expect(result.providers.map(p => p.id)).toEqual(['cloudflare-api', 'tailscale-api', 'tailscale-wasm']);
    expect(JSON.stringify(result)).not.toContain('private-');
  });
  it('does not advertise an API for blank or incomplete credentials', () => {
    expect(getContainerMonitorProviders({ CF_CONTAINER_API_TOKEN: ' ', TAILSCALE_API_TOKEN: '' }).providers).toHaveLength(1);
    expect(getContainerMonitorProviders({ CF_CONTAINER_API_TOKEN: 'token' }).providers).toHaveLength(1);
  });
  it('rejects unavailable methods and browser-only dispatch without sending requests', async () => {
    const fetcher = async () => { throw new Error('unexpected network'); };
    await expect(collectContainerMonitor({}, 'cloudflare-api', fetcher)).rejects.toThrow('利用できません');
    await expect(collectContainerMonitor({}, 'tailscale-wasm', fetcher)).rejects.toThrow('ブラウザ');
  });
  it('normalizes Tailscale API results without inventing online status from lastSeen', async () => {
    const data = await collectContainerMonitor({ TAILSCALE_API_TOKEN: 'private' }, 'tailscale-api', async (input, init) => {
      expect(String(input)).toBe('https://api.tailscale.com/api/v2/tailnet/-/devices');
      expect(init?.method).toBeUndefined();
      return new Response(JSON.stringify({ devices: [{ id: 'one', name: 'node', addresses: ['100.64.0.1'], lastSeen: '2026-10-26T00:00:00Z', machineKey: 'private-key' }] }));
    });
    expect(data.targets[0].status).toBe('unknown'); expect(data.targets[0].observedAt).toBe('2026-10-26T00:00:00Z');
    expect(JSON.stringify(data)).not.toContain('private');
  });
});
