import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

describe('POST /api/aichat/check-heritage-mitokoro-llama-batch', () => {
  it('llama-3.3-70b-instruct-fp8-fast 固定でlookupHeritageTopicModelCacheを呼ぶ', () => {
    expect(src).toContain("const HERITAGE_TOOLTIP_LLAMA_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';");
    const idx = src.indexOf("app.post('/api/aichat/check-heritage-mitokoro-llama-batch'");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('lookupHeritageTopicModelCache(');
    expect(block).toContain('HERITAGE_TOOLTIP_LLAMA_MODEL');
    expect(block).toContain('HERITAGE_TOOLTIP_GEMMA_TOPIC');
  });

  it('gemma用エンドポイントと同じレスポンス形状(cached)を返す', () => {
    const idx = src.indexOf("app.post('/api/aichat/check-heritage-mitokoro-llama-batch'");
    const block = src.slice(idx, idx + 900);
    expect(block).toMatch(/return jsonUtf8\(result\.error \? \{ cached: result\.cached, error: result\.error \} : \{ cached: result\.cached \}\);/);
  });
});
