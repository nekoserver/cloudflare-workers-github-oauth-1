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


/** Keep downstream proxies active even while inference emits no visible text. */
export function withSseHeartbeat(source: ReadableStream<Uint8Array>, intervalMs = 15_000): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const heartbeat = new TextEncoder().encode(': keepalive\n\n');
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  const stop = () => {
    stopped = true;
    clearInterval(timer);
  };
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      timer = setInterval(() => {
        // Do not build an unbounded queue when the client stops reading.
        if (!stopped && (controller.desiredSize ?? 0) > 0) controller.enqueue(heartbeat);
      }, intervalMs);
      try {
        while (!stopped) {
          const { value, done } = await reader.read();
          if (stopped) break;
          if (done) {
            stop();
            controller.close();
            break;
          }
          controller.enqueue(value);
        }
      } catch (error) {
        if (!stopped) {
          stop();
          controller.error(error);
        }
      } finally {
        stop();
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      stop();
      await reader.cancel(reason);
    },
  });
}
