import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAIN_CONTAINER_HOSTNAME, MAIN_CONTAINER_ORIGIN, CONTAINER_ENDPOINTS } from './containerEndpoints';
import { resolveAskgkRoute } from './askgkRoutes';
import { CONVERSATION_STREAM_URLS, CONVERSATION_STREAM_FRAME_ORIGINS } from './conversationStreamHosts';

describe('main container endpoints', () => {
  it('keeps API, Docker and stream targets on the same active container origin', () => {
    for (const url of Object.values(CONTAINER_ENDPOINTS)) expect(new URL(url).origin).toBe(MAIN_CONTAINER_ORIGIN);
    expect(CONVERSATION_STREAM_URLS.mygw).toBe(CONTAINER_ENDPOINTS.conversation);
    expect(CONVERSATION_STREAM_URLS.mynw).toBe('https://mynw.nekomaneki.work/lib/conversation-embed.html');
    expect(CONVERSATION_STREAM_URLS.redmine).toBe('https://r9.nekomaneki.work/lib/conversation-embed.html');
    expect(CONVERSATION_STREAM_FRAME_ORIGINS.split(' ')).toEqual(['https://r9.nekomaneki.work', MAIN_CONTAINER_ORIGIN, 'https://mynw.nekomaneki.work', 'https://stream.test.cfc.nekomaneki.work']);
  });
  it('uses the independent Worker API for askgk while retaining the main tunnel', () => {
    const config = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf8');
    expect(config.match(/^NEKOROOT_HOSTNAME\s*=\s*"([^"]+)"/m)?.[1]).toBe(MAIN_CONTAINER_HOSTNAME);
    expect(config.match(/^ASKGK_ROUTE_ID\s*=\s*"([^"]+)"/m)?.[1]).toBe('independent');
    expect(new URL(resolveAskgkRoute()).origin).not.toBe(MAIN_CONTAINER_ORIGIN);
    expect(MAIN_CONTAINER_HOSTNAME).not.toBe('test.cfc.nekomaneki.work');
  });
});
