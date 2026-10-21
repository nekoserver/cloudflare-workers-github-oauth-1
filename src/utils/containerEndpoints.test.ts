import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CFC_CONTAINER_HOSTNAME, CFC_CONTAINER_ORIGIN, CONTAINER_ENDPOINTS } from './containerEndpoints';
import { CONVERSATION_STREAM_URLS, CONVERSATION_STREAM_FRAME_ORIGINS } from './conversationStreamHosts';

describe('CFC container endpoints', () => {
  it('keeps API, Docker and stream targets on the same active container origin', () => {
    for (const url of Object.values(CONTAINER_ENDPOINTS)) expect(new URL(url).origin).toBe(CFC_CONTAINER_ORIGIN);
    expect(CONVERSATION_STREAM_URLS).toEqual({ testcfc: CONTAINER_ENDPOINTS.conversation });
    expect(CONVERSATION_STREAM_FRAME_ORIGINS).toBe(CFC_CONTAINER_ORIGIN);
  });
  it('keeps the deployment tunnel hostname and askgk override aligned', () => {
    const config = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf8');
    expect(config.match(/^NEKOROOT_HOSTNAME\s*=\s*"([^"]+)"/m)?.[1]).toBe(CFC_CONTAINER_HOSTNAME);
    expect(config.match(/^ASKGK_TUNNELS_URL\s*=\s*"([^"]+)"/m)?.[1]).toBe(CONTAINER_ENDPOINTS.tunnels);
    expect(CFC_CONTAINER_HOSTNAME).not.toBe('test.cfc.nekomaneki.work');
  });
});
