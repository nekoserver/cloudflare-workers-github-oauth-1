import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAichatModelsForRequest } from './utils/aichatImage';

const QWEN_MODEL = '@cf/qwen/qwen3.8-27b';
const FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

describe('AIチャット: qwen3.8-27b', () => {
  it('サーバー側の許可モデル一覧に含まれる', () => {
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const start = src.indexOf('const AICHAT_ALLOWED_MODELS = new Set([');
    const block = src.slice(start, src.indexOf(']);', start) + 3);
    expect(block).toContain(`'${QWEN_MODEL}'`);
  });

  it('選択されたqwen3.8-27bをAI問い合わせのプライマリモデルにする', () => {
    const result = resolveAichatModelsForRequest({
      requestedModel: QWEN_MODEL,
      hasImage: false,
      allowedModels: new Set([QWEN_MODEL, FALLBACK_MODEL]),
      configuredModel: '',
      textFallbackModel: FALLBACK_MODEL,
    });

    expect(result).toEqual({
      primaryModel: QWEN_MODEL,
      fallbackModel: FALLBACK_MODEL,
    });
  });
});
