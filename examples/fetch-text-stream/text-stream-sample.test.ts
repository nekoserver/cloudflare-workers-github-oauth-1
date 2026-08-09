import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAsTextStream } from './text-stream-sample';

function makeStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(body);
}

describe('fetchAsTextStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('複数チャンクを順番に受け取り、全文を連結して返す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeStreamResponse(['Hello, ', 'World', '!'])),
    );

    const received: string[] = [];
    const fullText = await fetchAsTextStream('https://example.com/', (chunk) => {
      received.push(chunk);
    });

    expect(fullText).toBe('Hello, World!');
    expect(received.length).toBeGreaterThan(0);
    expect(received.join('')).toBe('Hello, World!');
  });

  it('レスポンスボディがない場合はエラーを投げる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null)),
    );

    await expect(fetchAsTextStream('https://example.com/', () => {})).rejects.toThrow(
      'レスポンスボディが空です',
    );
  });
});
