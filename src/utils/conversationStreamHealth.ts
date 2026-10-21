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
        headers: { 'Cache-Control': 'no-cache', Accept: 'text/html' },
      });
      if (response.status !== 200) return null;
      const contentType = response.headers.get('Content-Type');
      if (!contentType || !/^text\/html(?:;|$)/i.test(contentType)) return null;
      const html = await response.text();
      // The protected page intentionally returns only its key-entry shell until
      // authentication. Reachable does not mean the caller is authenticated.
      if (/<html\b[^>]*\bdata-auth-gate=["']conversation["']/i.test(html)
        && /<form\b[^>]*\bid=["']login["']/i.test(html)) return host;
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
