/** Only trusted embeds may receive stream credentials and parent controls. */
export const CONVERSATION_STREAM_URLS = {
  testcfc: 'https://test.cfc.nekomaneki.work/http/lib/conversation-embed.html',
  mygw: 'https://mygw.nekomaneki.work/lib/conversation-embed.html',
  mynw: 'https://mynw.nekomaneki.work/lib/conversation-embed.html',
} as const;

export type ConversationStreamHost = keyof typeof CONVERSATION_STREAM_URLS;
export const CONVERSATION_STREAM_FRAME_ORIGINS = [...new Set(
  Object.values(CONVERSATION_STREAM_URLS).map(url => new URL(url).origin),
)].join(' ');
