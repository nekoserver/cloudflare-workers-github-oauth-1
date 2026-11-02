import { conversationStreamFrameOrigins, resolveConversationStreamRoutes } from './conversationStreamRoutes';

/**
 * 同梱の台帳(src/data/conversation-stream-routes.json)から作る既定の接続先。
 * リクエストを扱う処理は resolveConversationStreamRoutes() を使う。ここは参照用。
 */
const defaults = resolveConversationStreamRoutes();

/** Trusted stream destinations in auto-selection order; each host keeps its own authentication. */
export const CONVERSATION_STREAM_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  defaults.autoPriority.map(id => [id, defaults.routes.find(route => route.id === id)!.endpoints.embed]),
);

export type ConversationStreamHost = string;
export const CONVERSATION_STREAM_FRAME_ORIGINS = conversationStreamFrameOrigins(defaults);
