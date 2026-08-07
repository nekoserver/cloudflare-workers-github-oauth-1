import { describe, it, expect, vi } from 'vitest';
import { generateSlackAiReply, buildSlackAiMessages, SLACK_AI_MODEL } from './slackAiReply';

describe('buildSlackAiMessages', () => {
  it('system roleを使わず、Markdown指示を埋め込んだuserメッセージ1件のみを返す', () => {
    const messages = buildSlackAiMessages('こんにちは');
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages.some((m) => m.role === 'system')).toBe(false);
    expect(messages[0].content).toContain('Markdown記法');
    expect(messages[0].content).toContain('こんにちは');
  });
});

describe('generateSlackAiReply', () => {
  it('configuredModel未指定時はSLACK_AI_MODEL(gemma-4-26b-a4b-it)を既定モデルとして使う', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'こんにちは' });
    const result = await generateSlackAiReply('hello', undefined, aiRun);
    expect(result).toEqual({ ok: true, text: 'こんにちは', usedModel: SLACK_AI_MODEL, usage: { input_tokens: null, output_tokens: null, total_tokens: null } });
    expect(aiRun).toHaveBeenCalledWith(SLACK_AI_MODEL, expect.any(Object));
  });

  it('system roleを含めずuserメッセージのみをAIに渡す(gemma-4-26b-a4b-itのthinking mode強制バグを回避するため)', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'ok' });
    await generateSlackAiReply('hello', undefined, aiRun);
    const [, params] = aiRun.mock.calls[0];
    const messages = params.messages as Array<{ role: string }>;
    expect(messages.some((m) => m.role === 'system')).toBe(false);
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
  });

  it('gemma-4-26b-a4b-itのAICHAT_MODEL_MAX_TOKENS(65536)をそのまま使わず、Slack向けの小さい上限に丸める(巨大な応答がAIチャット履歴表示をフリーズさせるのを防ぐため)', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'ok' });
    await generateSlackAiReply('hello', '@cf/google/gemma-4-26b-a4b-it', aiRun);
    const [, params] = aiRun.mock.calls[0];
    expect(params.max_tokens).toBeLessThan(65536);
    expect(params.max_tokens).toBe(4096);
  });

  it('AICHAT_MODEL_MAX_TOKENSに定義の無いモデルはデフォルト(4096)とSLACK_MAX_TOKENSの小さい方を使う', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'ok' });
    await generateSlackAiReply('hello', '@cf/meta/llama-3.1-70b-instruct', aiRun);
    const [, params] = aiRun.mock.calls[0];
    expect(params.max_tokens).toBe(4096);
  });

  it('choices[0].message.content からも応答テキストを取り出せる', async () => {
    const aiRun = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'chat形式の応答' } }] });
    const result = await generateSlackAiReply('hello', undefined, aiRun);
    expect(result).toEqual({ ok: true, text: 'chat形式の応答', usedModel: SLACK_AI_MODEL, usage: { input_tokens: null, output_tokens: null, total_tokens: null } });
  });

  it('primaryModelが例外を投げた場合はFALLBACK_MODELに一度だけ再試行する', async () => {
    const aiRun = vi.fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({ response: 'fallback応答' });
    const result = await generateSlackAiReply('hello', '@cf/meta/llama-3.1-70b-instruct', aiRun);
    expect(result).toEqual({ ok: true, text: 'fallback応答', usedModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', usage: { input_tokens: null, output_tokens: null, total_tokens: null } });
    expect(aiRun).toHaveBeenCalledTimes(2);
  });

  it('primaryModelが空応答を返した場合もFALLBACK_MODELに再試行する', async () => {
    const aiRun = vi.fn()
      .mockResolvedValueOnce({ response: '' })
      .mockResolvedValueOnce({ response: 'fallback応答' });
    const result = await generateSlackAiReply('hello', '@cf/meta/llama-3.1-70b-instruct', aiRun);
    expect(result).toEqual({ ok: true, text: 'fallback応答', usedModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', usage: { input_tokens: null, output_tokens: null, total_tokens: null } });
  });

  it('primaryとFALLBACKの両方が失敗した場合はok:falseとエラー内容を返す（握りつぶさない）', async () => {
    const aiRun = vi.fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockRejectedValueOnce(new Error('fallback also down'));
    const result = await generateSlackAiReply('hello', '@cf/meta/llama-3.1-70b-instruct', aiRun);
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe('fallback also down');
  });

  it('configuredModelが未指定でSLACK_AI_MODEL・FALLBACK_MODELの両方が失敗した場合はエラーを返す', async () => {
    const aiRun = vi.fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockRejectedValueOnce(new Error('down'));
    const result = await generateSlackAiReply('hello', undefined, aiRun);
    expect(result.ok).toBe(false);
    expect(aiRun).toHaveBeenCalledTimes(2);
  });

  it('AI応答のusageフィールドからトークン数を取り出す(ai_chat_sharesへの保存に使う)', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'ok', usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 } });
    const result = await generateSlackAiReply('hello', undefined, aiRun);
    expect(result.ok).toBe(true);
    expect((result as { usage: unknown }).usage).toEqual({ input_tokens: 12, output_tokens: 34, total_tokens: 46 });
  });

  it('usageフィールドが無い場合は全てnullを返す', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'ok' });
    const result = await generateSlackAiReply('hello', undefined, aiRun);
    expect((result as { usage: unknown }).usage).toEqual({ input_tokens: null, output_tokens: null, total_tokens: null });
  });
});
