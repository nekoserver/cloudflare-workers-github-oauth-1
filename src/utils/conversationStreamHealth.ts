import * as logger from './logger';

export type ConversationStreamHost = 'mygw' | 'mynw';

const EMBED_URLS: Record<ConversationStreamHost, string> = {
  mygw: 'https://mygw.nekomaneki.work/lib/conversation-embed.html',
  mynw: 'https://mynw.nekomaneki.work/lib/conversation-embed.html',
};

/** Returns reachable embed hosts in preference order (mygw, then mynw). */
export async function conversationStreamHealthy(): Promise<ConversationStreamHost[]> {
  const hosts = Object.keys(EMBED_URLS) as ConversationStreamHost[];
  const results = await Promise.all(hosts.map(async host => {
    try {
      const response = await fetch(EMBED_URLS[host], {
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
