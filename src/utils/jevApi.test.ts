import { describe, expect, it } from 'vitest';
import { parseJevCreditsResponse } from './jevApi';

describe('parseJevCreditsResponse', () => {
  it('正しい形式のレスポンスをパースする', () => {
    const result = parseJevCreditsResponse({ creditsRemaining: 4.999974, paidInputTokensRemaining: 119998172 });
    expect(result).toEqual({ creditsRemainingUsd: 4.999974, paidInputTokensRemaining: 119998172 });
  });

  it('オブジェクトでない場合は例外を投げる', () => {
    expect(() => parseJevCreditsResponse('not an object')).toThrow();
    expect(() => parseJevCreditsResponse(null)).toThrow();
  });

  it('creditsRemainingが欠落している場合は例外を投げる', () => {
    expect(() => parseJevCreditsResponse({ paidInputTokensRemaining: 100 })).toThrow();
  });

  it('paidInputTokensRemainingが欠落している場合は例外を投げる', () => {
    expect(() => parseJevCreditsResponse({ creditsRemaining: 1.5 })).toThrow();
  });

  it('数値でないフィールドがある場合は例外を投げる', () => {
    expect(() => parseJevCreditsResponse({ creditsRemaining: '1.5', paidInputTokensRemaining: 100 })).toThrow();
  });
});
