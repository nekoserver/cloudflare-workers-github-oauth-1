import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationStreamHealthy } from './conversationStreamHealth';
import { CONTAINER_ENDPOINTS } from './containerEndpoints';
import { resolveConversationStreamRoutes } from './conversationStreamRoutes';
import * as logger from './logger';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const embedHtml = '<!doctype html><html data-embed="conversation"><script type="module" src="/chat/app.mjs"></script></html>';
function response(body = embedHtml, contentType = 'text/html', status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': contentType } });
}
describe('conversation stream upstream health', () => {
  it('probes the trusted selectable hosts and requests its HTML entry', async () => {
    const probe = vi.fn().mockImplementation(async () => response());
    vi.stubGlobal('fetch', probe);
    expect(await conversationStreamHealthy()).toEqual(['mygw']);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith(CONTAINER_ENDPOINTS.conversation, expect.objectContaining({
      method: 'GET', redirect: 'manual', signal: expect.any(AbortSignal),
      headers: expect.objectContaining({ Accept: 'text/html' }),
    }));
  });
  it('does not probe unselected containers when the main host is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('mynw.') ? response() : response('down', 'text/html', 530)));
    expect(await conversationStreamHealthy()).toEqual([]);
  });
  it('does not treat unrelated login pages, JSON or failure statuses as healthy', async () => {
    for (const upstream of [response('{}', 'application/json'), response('<html><title>login</title></html>'), response('down', 'text/html', 503)]) {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => upstream.clone()));
      expect(await conversationStreamHealthy()).toEqual([]);
    }
  });
  it('recognizes the protected conversation key-entry shell without credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response('<html data-auth-gate="conversation"><form id="login"></form></html>')));
    expect(await conversationStreamHealthy()).toEqual(['mygw']);
  });
  it('does not recognize an incomplete authentication marker', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response('<html data-auth-gate="conversation"></html>')));
    expect(await conversationStreamHealthy()).toEqual([]);
  });
  it('probes the configured container tunnel routes in auto-selection order', async () => {
    const probe = vi.fn(async (url: string) => url.includes('a.example') ? response('down', 'text/html', 530) : response());
    vi.stubGlobal('fetch', probe);
    const routes = resolveConversationStreamRoutes({
      autoPriority: ['b', 'a'], routes: [{ id: 'a', origin: 'https://a.example' }, { id: 'b', origin: 'https://b.example' }],
    });
    expect(await conversationStreamHealthy(routes)).toEqual(['b']);
    expect(probe.mock.calls.map(call => call[0])).toEqual(['https://b.example/lib/conversation-embed.html', 'https://a.example/lib/conversation-embed.html']);
  });
  it('logs connection failures for each trusted host', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const warning = vi.spyOn(logger, 'warn');
    expect(await conversationStreamHealthy()).toEqual([]);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith('Conversation stream embed host probe failed', expect.objectContaining({ host: 'mygw', error: 'fetch failed' }));
  });
});
