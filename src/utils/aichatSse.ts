export type AichatStreamChunk = {
  text: string;
  usage?: Record<string, unknown>;
};

/** Extract the text delta used by both Workers AI and OpenAI-compatible streams. */
export function parseAichatStreamData(data: string): AichatStreamChunk | null {
  if (!data || data === '[DONE]') return null;
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
  const choices = Array.isArray(value.choices) ? value.choices as Array<Record<string, unknown>> : [];
  const delta = choices[0]?.delta as Record<string, unknown> | undefined;
  const text = typeof value.response === 'string'
    ? value.response
    : typeof delta?.content === 'string'
      ? delta.content
      : '';
  const usage = typeof value.usage === 'object' && value.usage !== null
    ? value.usage as Record<string, unknown>
    : undefined;
  return { text, usage };
}

export function encodeSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

