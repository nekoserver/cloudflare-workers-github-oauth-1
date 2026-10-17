import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationStreamHealthy } from './conversationStreamHealth';
import * as logger from './logger';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const embedHtml = '<!doctype html><html data-embed="conversation"><script type="module" src="/chat/app.mjs"></script></html>';
function response(status: number, contentType = 'text/html') {
  return new Response(status === 200 ? embedHtml : null, { status, headers: { 'Content-Type': contentType } });
}
describe('conversation stream upstream health', () => {
  it('自動選択用に両ホストを調べ、接続可能な候補をmygw優先で返す', async () => {
    const probe = vi.fn().mockImplementation((url: string) => Promise.resolve(
      response(url.includes('mygw') ? 503 : 200),
    ));
    vi.stubGlobal('fetch', probe);
    expect(await conversationStreamHealthy()).toEqual(['mynw']);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(probe).toHaveBeenCalledWith('https://mygw.nekomaneki.work/lib/conversation-embed.html', expect.objectContaining({
      method: 'GET', redirect: 'manual', signal: expect.any(AbortSignal),
    }));
    expect(probe).toHaveBeenCalledWith('https://mynw.nekomaneki.work/lib/conversation-embed.html', expect.objectContaining({
      method: 'GET', redirect: 'manual', signal: expect.any(AbortSignal),
    }));
  });
  it('JSON 200や無関係なHTMLを接続可能としない', async () => {
    const probe = vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes('mygw')
      ? response(200, 'application/json')
      : new Response('<html><title>login</title></html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    vi.stubGlobal('fetch', probe);
    expect(await conversationStreamHealthy()).toEqual([]);
    expect(await conversationStreamHealthy()).toEqual([]);
  });
  it('有効なHTMLを返す両ホストを優先順で返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(200))));
    expect(await conversationStreamHealthy()).toEqual(['mygw', 'mynw']);
    expect(await conversationStreamHealthy()).toEqual(['mygw', 'mynw']);
  });
  it('DNS/connection failures are unhealthy and logged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const warning = vi.spyOn(logger, 'warn');
    expect(await conversationStreamHealthy()).toEqual([]);
    expect(warning).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledWith('Conversation stream embed host probe failed', expect.objectContaining({ host: 'mygw', error: 'fetch failed' }));
  });
});
