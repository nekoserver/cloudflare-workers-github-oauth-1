import * as logger from './logger';

import { CONVERSATION_STREAM_URLS, type ConversationStreamHost } from './conversationStreamHosts';
export type { ConversationStreamHost } from './conversationStreamHosts';

/** Returns reachable trusted embeds, preferring the container host. */
export async function conversationStreamHealthy(): Promise<ConversationStreamHost[]> {
  const hosts = Object.keys(CONVERSATION_STREAM_URLS) as ConversationStreamHost[];
  const results = await Promise.all(hosts.map(async host => {
    try {
      const response = await fetch(CONVERSATION_STREAM_URLS[host], {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000),
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (response.status !== 200) return null;
      const contentType = response.headers.get('Content-Type');
      if (!contentType || !/^text\/html(?:;|$)/i.test(contentType)) return null;
      const html = await response.text();
      if (!/<html\b[^>]*\bdata-embed=["']conversation["']/i.test(html)) return null;
      if (!/<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+\.mjs(?:[?#][^"']*)?["'])[^>]*>/i.test(html)) return null;
      return host;
    } catch (error) {
      logger.warn('Conversation stream embed host probe failed', {
        host, error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }));
  return results.filter((host): host is ConversationStreamHost => host !== null);
}
