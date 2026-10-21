import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationStreamHealthy } from './conversationStreamHealth';
import { CONTAINER_ENDPOINTS } from './containerEndpoints';
import * as logger from './logger';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const embedHtml = '<!doctype html><html data-embed="conversation"><script type="module" src="/chat/app.mjs"></script></html>';
function response(body = embedHtml, contentType = 'text/html', status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': contentType } });
}
describe('conversation stream upstream health', () => {
  it('probes only the active CFC host and requests its HTML entry', async () => {
    const probe = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', probe);
    expect(await conversationStreamHealthy()).toEqual(['testcfc']);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith(CONTAINER_ENDPOINTS.conversation, expect.objectContaining({
      method: 'GET', redirect: 'manual', signal: expect.any(AbortSignal),
      headers: expect.objectContaining({ Accept: 'text/html' }),
    }));
  });
  it('does not treat unrelated login pages, JSON or failure statuses as healthy', async () => {
    for (const upstream of [response('{}', 'application/json'), response('<html><title>login</title></html>'), response('down', 'text/html', 503)]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream));
      expect(await conversationStreamHealthy()).toEqual([]);
    }
  });
  it('recognizes the protected conversation key-entry shell without credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('<html data-auth-gate="conversation"><form id="login"></form></html>')));
    expect(await conversationStreamHealthy()).toEqual(['testcfc']);
  });
  it('does not recognize an incomplete authentication marker', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('<html data-auth-gate="conversation"></html>')));
    expect(await conversationStreamHealthy()).toEqual([]);
  });
  it('logs connection failures without retrying retired hosts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const warning = vi.spyOn(logger, 'warn');
    expect(await conversationStreamHealthy()).toEqual([]);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith('Conversation stream embed host probe failed', expect.objectContaining({ host: 'testcfc', error: 'fetch failed' }));
  });
});
