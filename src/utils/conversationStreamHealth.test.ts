import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationStreamHealthy } from './conversationStreamHealth';

afterEach(() => vi.unstubAllGlobals());
describe('conversation stream upstream health', () => {
  it.each([200, 401, 403, 500, 503, 530, 302])('HTTP %i', async (status) => {
    const probe = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal('fetch', probe);
    expect(await conversationStreamHealthy()).toBe(status === 200);
    expect(probe).toHaveBeenCalledWith('https://mynw.nekomaneki.work/lib/conversation-embed.html', expect.objectContaining({
      method: 'HEAD', redirect: 'manual', signal: expect.any(AbortSignal),
    }));
  });
  it('DNS/connection failures are unhealthy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    expect(await conversationStreamHealthy()).toBe(false);
  });
});
