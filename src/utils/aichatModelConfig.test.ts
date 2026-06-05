import { describe, it, expect } from 'vitest';
import { AICHAT_MODEL_MAX_TOKENS, AICHAT_MODEL_EXTRA_PARAMS, getModelRunParams } from './aichatModelConfig';

describe('AICHAT_MODEL_MAX_TOKENS', () => {
  it('Gemma-4 は 16384 トークンを返す', () => {
    expect(AICHAT_MODEL_MAX_TOKENS['@cf/google/gemma-4-26b-a4b-it']).toBe(16384);
  });

  it('未設定モデルは undefined を返す（呼び出し元でフォールバック）', () => {
    expect(AICHAT_MODEL_MAX_TOKENS['@cf/meta/llama-3.3-70b-instruct-fp8-fast']).toBeUndefined();
  });
});

describe('AICHAT_MODEL_EXTRA_PARAMS', () => {
  it('Gemma-4 に enable_thinking: false が設定されている', () => {
    const params = AICHAT_MODEL_EXTRA_PARAMS['@cf/google/gemma-4-26b-a4b-it'];
    expect(params).toBeDefined();
    expect((params.chat_template_kwargs as Record<string, unknown>)?.enable_thinking).toBe(false);
  });

  it('Gemma-4 に reasoning_effort は設定されていない（仕様外のため除去）', () => {
    const params = AICHAT_MODEL_EXTRA_PARAMS['@cf/google/gemma-4-26b-a4b-it'];
    expect(params?.reasoning_effort).toBeUndefined();
  });

  it('Gemma-3 には extra params が設定されていない', () => {
    expect(AICHAT_MODEL_EXTRA_PARAMS['@cf/google/gemma-3-12b-it']).toBeUndefined();
  });

  it('Llama 系モデルには extra params が設定されていない', () => {
    expect(AICHAT_MODEL_EXTRA_PARAMS['@cf/meta/llama-3.3-70b-instruct-fp8-fast']).toBeUndefined();
  });
});

describe('getModelRunParams', () => {
  it('Gemma-4 は base params に extra params をマージして返す', () => {
    const base = { messages: [], max_tokens: 16384 };
    const result = getModelRunParams('@cf/google/gemma-4-26b-a4b-it', base);
    expect(result.max_tokens).toBe(16384);
    expect(result.reasoning_effort).toBeUndefined();
    expect((result.chat_template_kwargs as Record<string, unknown>)?.enable_thinking).toBe(false);
  });

  it('extra params のないモデルは base params をそのまま返す', () => {
    const base = { messages: [], max_tokens: 4096 };
    const result = getModelRunParams('@cf/meta/llama-3.3-70b-instruct-fp8-fast', base);
    expect(result).toEqual(base);
    expect(result.reasoning_effort).toBeUndefined();
  });

  it('extra params が base params を上書きしない（base が優先されるべきキーは残る）', () => {
    const base = { messages: [{ role: 'user', content: 'test' }], max_tokens: 16384 };
    const result = getModelRunParams('@cf/google/gemma-4-26b-a4b-it', base);
    expect(result.messages).toEqual(base.messages);
  });
});
