import { CFC_CONTAINER_ORIGIN, CONTAINER_ENDPOINTS } from './containerEndpoints';

/** Trusted stream destinations; each host keeps its own authentication. */
export const CONVERSATION_STREAM_URLS = {
  // Prefer the Redmine Container observer when auto-selecting; the other
  // trusted destinations remain available as fallback/manual choices.
  redmine: 'https://r9.nekomaneki.work/lib/conversation-embed.html',
  mygw: CONTAINER_ENDPOINTS.conversation,
  mynw: 'https://mynw.nekomaneki.work/lib/conversation-embed.html',
  testcfc: new URL('/lib/conversation-embed.html', CFC_CONTAINER_ORIGIN).href,
} as const;

export const CONVERSATION_STREAM_PROTOCOLS = ['websocket', 'sse', 'ndjson', 'jsonseq'] as const;

/** Public, non-secret directory data for the authenticated main Worker API. */
export function getConversationStreamDirectory(records?: ConversationStreamHostRecord[]) {
  const hosts = records ?? Object.entries(CONVERSATION_STREAM_URLS).map(([id, url], priority) => ({
    id, label: id, origin: new URL(url).origin, priority, enabled: true,
  }));
  return hosts.filter(host => host.enabled).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).map(host => ({
    ...host,
    embedUrl: new URL('/lib/conversation-embed.html', host.origin).href,
    embedPath: '/lib/conversation-embed.html',
    streamPath: '/lib/api/chat',
    protocols: [...CONVERSATION_STREAM_PROTOCOLS],
    authentication: 'conversation-session',
  }));
}

export type ConversationStreamHost = keyof typeof CONVERSATION_STREAM_URLS;
export const CONVERSATION_STREAM_FRAME_ORIGINS = [...new Set(
  Object.values(CONVERSATION_STREAM_URLS).map(url => new URL(url).origin),
)].join(' ');

export type ConversationStreamHostRecord = {
  id: string;
  label: string;
  origin: string;
  priority: number;
  enabled: boolean;
};

const ALLOWED_HOST_SUFFIXES = ['nekomaneki.work', 'nekoflare.workers.dev'];

export function normalizeConversationStreamHost(input: unknown): Omit<ConversationStreamHostRecord, 'enabled'> {
  if (!input || typeof input !== 'object') throw new Error('接続先データが不正です');
  const value = input as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(id)) throw new Error('IDは英数字・ハイフン・アンダースコアで指定してください');
  if (!label || label.length > 64) throw new Error('表示名は1〜64文字で指定してください');
  if (typeof value.origin !== 'string' || value.origin.length > 512) throw new Error('HTTPSの接続先URLを指定してください');
  let url: URL;
  try { url = new URL(value.origin); } catch { throw new Error('接続先URLを解釈できません'); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || !ALLOWED_HOST_SUFFIXES.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
    throw new Error('接続先は許可済みドメイン配下のHTTPSオリジンで指定してください');
  }
  const priority = Number(value.priority);
  if (!Number.isInteger(priority) || priority < 0 || priority > 10_000) throw new Error('優先順位は0〜10000の整数で指定してください');
  return { id, label, origin: url.origin, priority };
}
