import { describe, expect, it, vi } from 'vitest';
import { encodeSseEvent, parseAichatStreamData, withSseHeartbeat } from './aichatSse';

describe('SSE idle heartbeat', () => {
  it('110秒を超える無出力期間も15秒ごとに通信し、終了後はタイマーを停止する', async () => {
    vi.useFakeTimers();
    try {
      let upstream!: ReadableStreamDefaultController<Uint8Array>;
      const source = new ReadableStream<Uint8Array>({ start(controller) { upstream = controller; } });
      const reader = withSseHeartbeat(source).getReader();
      for (let elapsed = 15; elapsed <= 120; elapsed += 15) {
        const pending = reader.read();
        await vi.advanceTimersByTimeAsync(15_000);
        expect(new TextDecoder().decode((await pending).value)).toBe(': keepalive\n\n');
      }
      const payload = new TextEncoder().encode(encodeSseEvent('done', { response: '回答' }));
      upstream.enqueue(payload);
      upstream.close();
      expect((await reader.read()).value).toEqual(payload);
      expect((await reader.read()).done).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('切断を上流へ伝播しタイマーを停止する', async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const reader = withSseHeartbeat(new ReadableStream<Uint8Array>({ cancel })).getReader();
      await reader.cancel('disconnected');
      expect(cancel).toHaveBeenCalledWith('disconnected');
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('上流エラーを伝播しタイマーを停止する', async () => {
    vi.useFakeTimers();
    try {
      const reader = withSseHeartbeat(new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('upstream failed')); } })).getReader();
      await expect(reader.read()).rejects.toThrow('upstream failed');
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});

describe('AI chat SSE helpers', () => {
  it('Workers AI response deltaを読む', () => {
    expect(parseAichatStreamData('{"response":"こんにちは"}')).toEqual({ text: 'こんにちは', usage: undefined });
  });

  it('OpenAI互換choices deltaとusageを読む', () => {
    expect(parseAichatStreamData('{"choices":[{"delta":{"content":"A"}}],"usage":{"output_tokens":1}}'))
      .toEqual({ text: 'A', usage: { output_tokens: 1 } });
  });

  it('DONE・壊れたJSONを無視する', () => {
    expect(parseAichatStreamData('[DONE]')).toBeNull();
    expect(parseAichatStreamData('{')).toBeNull();
  });

  it('ブラウザ向けnamed eventをJSONで符号化する', () => {
    expect(encodeSseEvent('delta', { text: 'a\nb' })).toBe('event: delta\ndata: {"text":"a\\nb"}\n\n');
  });
});
