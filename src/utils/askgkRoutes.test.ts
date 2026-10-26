import { describe, expect, it, vi } from 'vitest';
import { resolveAskgkRoute } from './askgkRoutes';
import { askTunnelSigner } from './tunnelSignerAsk';

const registry = () => ({ defaultRouteId: 'standalone', routes: [
  { id: 'standalone', url: 'https://standalone.example/api', enabled: true },
  { id: 'main', url: 'https://main.example/api', enabled: true },
] });

describe('askgk route registry', () => {
  it('adds and selects a new endpoint without application changes', () => {
    const config = registry();
    config.routes.push({ id: 'new', url: 'https://new.example/api', enabled: true });
    expect(resolveAskgkRoute({ ASKGK_ROUTES: JSON.stringify(config), ASKGK_ROUTE_ID: 'new' })).toBe('https://new.example/api');
  });
  it('re-reads selection, disablement and removal for each operation', () => {
    const config = registry();
    const settings = { ASKGK_ROUTES: JSON.stringify(config) };
    expect(resolveAskgkRoute(settings)).toBe('https://standalone.example/api');
    config.defaultRouteId = 'main';
    settings.ASKGK_ROUTES = JSON.stringify(config);
    expect(resolveAskgkRoute(settings)).toBe('https://main.example/api');
    config.routes[1].enabled = false;
    settings.ASKGK_ROUTES = JSON.stringify(config);
    expect(() => resolveAskgkRoute(settings)).toThrow('未登録または無効');
    config.routes.pop();
    settings.ASKGK_ROUTES = JSON.stringify(config);
    expect(() => resolveAskgkRoute(settings)).toThrow('未登録または無効');
  });
  it.each(['', '{', 'null', '{}', JSON.stringify({ ...registry(), routes: [...registry().routes, registry().routes[0]] })])('rejects invalid configuration without using a legacy fallback: %s', value => {
    expect(() => resolveAskgkRoute({ ASKGK_ROUTES: value, ASKGK_TUNNELS_URL: 'https://legacy.example/api' })).toThrow();
  });
  it.each(['http://unsafe.example/api', 'https://user:password@example.com/api', 'https://example.com/api#fragment'])('rejects unsafe endpoint %s', url => {
    expect(() => resolveAskgkRoute({ ASKGK_TUNNELS_URL: url })).toThrow();
  });
  it('honors a legacy explicit endpoint when registry selection is absent', () => {
    expect(resolveAskgkRoute({ ASKGK_TUNNELS_URL: 'https://legacy.example/api' })).toBe('https://legacy.example/api');
  });
  it('does not send when the selected route was removed', async () => {
    const fetch = vi.fn();
    await expect(askTunnelSigner({ fetch }, 'codex_prompt="test"', { ASKGK_ROUTES: JSON.stringify(registry()), ASKGK_ROUTE_ID: 'removed' })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not replay a POST on another endpoint after an upstream failure', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: false, status: 530, body: 'error code: 1033' })));
    await expect(askTunnelSigner({ fetch }, 'codex_prompt="test"', { ASKGK_ROUTES: JSON.stringify(registry()) })).rejects.toThrow('530');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).url).toBe('https://standalone.example/api');
  });
});
