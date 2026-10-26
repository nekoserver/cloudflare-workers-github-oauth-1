import * as logger from './logger';

import { CONVERSATION_STREAM_URLS, type ConversationStreamHostRecord } from './conversationStreamHosts';

/** Returns reachable trusted embeds, preferring the container host. */
export async function conversationStreamHealthy(records?: ConversationStreamHostRecord[]): Promise<string[]> {
  const hosts = (records ?? Object.entries(CONVERSATION_STREAM_URLS).map(([id, url], priority) => ({
    id, label: id, origin: new URL(url).origin, priority, enabled: true,
  }))).filter(host => host.enabled).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const results = await Promise.all(hosts.map(async host => {
    try {
      const response = await fetch(new URL('/lib/conversation-embed.html', host.origin).href, {
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
        && /<form\b[^>]*\bid=["']login["']/i.test(html)) return host.id;
      if (!/<html\b[^>]*\bdata-embed=["']conversation["']/i.test(html)) return null;
      if (!/<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+\.mjs(?:[?#][^"']*)?["'])[^>]*>/i.test(html)) return null;
      return host.id;
    } catch (error) {
      logger.warn('Conversation stream embed host probe failed', {
        host: host.id, error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }));
  return results.filter((host): host is string => host !== null);
}
