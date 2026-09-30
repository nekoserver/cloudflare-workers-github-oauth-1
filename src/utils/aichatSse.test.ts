import { describe, expect, it } from 'vitest';
import { encodeSseEvent, parseAichatStreamData } from './aichatSse';

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
