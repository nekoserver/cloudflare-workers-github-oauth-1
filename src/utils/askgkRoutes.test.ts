import { describe, expect, it, vi } from 'vitest';
import { askgkEngine, resolveAskgkRoute } from './askgkRoutes';
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

  it('sends an engine to its own route ahead of ASKGK_ROUTE_ID, and others to the selected route', () => {
    const settings = { ASKGK_ROUTES: JSON.stringify({ ...registry(), engineRoutes: { claude: 'main' } }), ASKGK_ROUTE_ID: 'standalone' };
    expect(resolveAskgkRoute(settings, 'claude')).toBe('https://main.example/api');
    expect(resolveAskgkRoute(settings, 'codex')).toBe('https://standalone.example/api');
    expect(resolveAskgkRoute(settings)).toBe('https://standalone.example/api');
  });
  it('does not fall back to another route when the engine route is disabled', () => {
    const config = { ...registry(), engineRoutes: { claude: 'main' } };
    config.routes[1].enabled = false;
    expect(() => resolveAskgkRoute({ ASKGK_ROUTES: JSON.stringify(config) }, 'claude')).toThrow('claudeの送り先');
  });
  it.each([{ claude: 'missing' }, { claude: 1 }, ['main']])('rejects engineRoutes that do not name a registered route: %j', engineRoutes => {
    expect(() => resolveAskgkRoute({ ASKGK_ROUTES: JSON.stringify({ ...registry(), engineRoutes }) }, 'codex')).toThrow('engineRoutes');
  });
  it('keeps the legacy single endpoint for every engine', () => {
    expect(resolveAskgkRoute({ ASKGK_TUNNELS_URL: 'https://legacy.example/api' }, 'claude')).toBe('https://legacy.example/api');
  });
  it.each([
    ['claude_prompt="hello"', 'claude'],
    ['  Codex_prompt = "x"', 'codex'],
    ['claude_prompt', undefined],
    ['what is claude_prompt="x"', undefined],
    ['models-list', undefined],
  ])('reads the engine from the prompt prefix: %s', (message, engine) => {
    expect(askgkEngine(message)).toBe(engine);
  });
  it('routes the bundled claude requests to the main container and others to the Redmine container', async () => {
    const urls: string[] = [];
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(JSON.parse(String(init?.body)).url);
      return new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: 'ok' }) }));
    });
    await askTunnelSigner({ fetch }, 'claude_prompt="hello"', { ASKGK_ROUTE_ID: 'independent' });
    await askTunnelSigner({ fetch }, 'codex_prompt="hello"', { ASKGK_ROUTE_ID: 'independent' });
    expect(urls).toEqual(['https://mygw.nekomaneki.work/lib/api/tunnels', 'https://r9.nekomaneki.work/lib/api/tunnels']);
    const sent = JSON.parse(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).body);
    expect(sent.message).toBe('claude_prompt="hello"');
  });
});
