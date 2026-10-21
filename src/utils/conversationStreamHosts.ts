import { CONTAINER_ENDPOINTS } from './containerEndpoints';

/** Only the active CFC container may receive stream credentials and controls. */
export const CONVERSATION_STREAM_URLS = {
  testcfc: CONTAINER_ENDPOINTS.conversation,
} as const;

export type ConversationStreamHost = keyof typeof CONVERSATION_STREAM_URLS;
export const CONVERSATION_STREAM_FRAME_ORIGINS = [...new Set(
  Object.values(CONVERSATION_STREAM_URLS).map(url => new URL(url).origin),
)].join(' ');
