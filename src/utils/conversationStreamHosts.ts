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

export type ConversationStreamHost = keyof typeof CONVERSATION_STREAM_URLS;
export const CONVERSATION_STREAM_FRAME_ORIGINS = [...new Set(
  Object.values(CONVERSATION_STREAM_URLS).map(url => new URL(url).origin),
)].join(' ');
