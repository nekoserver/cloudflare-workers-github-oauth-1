import { describe, it, expect, vi } from 'vitest';
import { generateSlackAiReply } from './slackAiReply';

describe('generateSlackAiReply', () => {
  it('AIの応答テキストをresponseフィールドから取り出す', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    const result = await generateSlackAiReply('hello', undefined, aiRun);
    expect(result).toEqual({ ok: true, text: 'こんにちは', usedModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' });
  });

  it('configuredModelが指定されていればそれを使う', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'ok' });
    await generateSlackAiReply('hello', '@cf/meta/llama-3.1-70b-instruct', aiRun);
    expect(aiRun).toHaveBeenCalledWith('@cf/meta/llama-3.1-70b-instruct', expect.any(Object));
  });

  it('モデル別の追加パラメータ(getModelRunParams)がマージされる', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'ok' });
    await generateSlackAiReply('hello', '@cf/google/gemma-4-26b-a4b-it', aiRun);
    const [, params] = aiRun.mock.calls[0];
    expect(params.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(params.max_tokens).toBe(65536);
  });

  it('choices[0].message.content からも応答テキストを取り出せる', async () => {
    const aiRun = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'chat形式の応答' } }] });
    const result = await generateSlackAiReply('hello', undefined, aiRun);
    expect(result).toEqual({ ok: true, text: 'chat形式の応答', usedModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' });
  });

  it('primaryModelが例外を投げた場合はFALLBACK_MODELに一度だけ再試行する', async () => {
    const aiRun = vi.fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({ response: 'fallback応答' });
    const result = await generateSlackAiReply('hello', '@cf/meta/llama-3.1-70b-instruct', aiRun);
    expect(result).toEqual({ ok: true, text: 'fallback応答', usedModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' });
    expect(aiRun).toHaveBeenCalledTimes(2);
  });

  it('primaryModelが空応答を返した場合もFALLBACK_MODELに再試行する', async () => {
    const aiRun = vi.fn()
      .mockResolvedValueOnce({ response: '' })
      .mockResolvedValueOnce({ response: 'fallback応答' });
    const result = await generateSlackAiReply('hello', '@cf/meta/llama-3.1-70b-instruct', aiRun);
    expect(result).toEqual({ ok: true, text: 'fallback応答', usedModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' });
  });

  it('primaryとFALLBACKの両方が失敗した場合はok:falseとエラー内容を返す（握りつぶさない）', async () => {
    const aiRun = vi.fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockRejectedValueOnce(new Error('fallback also down'));
    const result = await generateSlackAiReply('hello', '@cf/meta/llama-3.1-70b-instruct', aiRun);
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe('fallback also down');
  });

  it('configuredModelが未指定でFALLBACK_MODEL自体が失敗した場合は1回だけ試行してエラーを返す', async () => {
    const aiRun = vi.fn().mockRejectedValue(new Error('down'));
    const result = await generateSlackAiReply('hello', undefined, aiRun);
    expect(result.ok).toBe(false);
    expect(aiRun).toHaveBeenCalledTimes(1);
  });
});
