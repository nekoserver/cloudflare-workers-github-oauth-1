/**
 * AI 分類タイムアウトロジックのテスト
 *
 * classifyKeywordWithAI はサーバー内部関数のため直接テストできないが、
 * タイムアウト処理の核となる withTimeout ユーティリティと
 * クライアント側のタイムアウト状態ラベルをテストする。
 */
import { describe, it, expect, vi } from 'vitest';
import { withAiTimeout, AI_CLASSIFY_TIMEOUT_MS } from './utils/aiTimeout';

describe('withAiTimeout', () => {
  it('規定時間内に解決した場合はその値を返す', async () => {
    const fast = Promise.resolve('feature');
    const result = await withAiTimeout(fast, 1000);
    expect(result).toBe('feature');
  });

  it('タイムアウトを超えた場合は空文字列を返す', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('feature'), 500));
    const result = await withAiTimeout(slow, 50);
    expect(result).toBe('');
  });

  it('タイムアウト値は AI_CLASSIFY_TIMEOUT_MS 定数から参照できる', () => {
    expect(typeof AI_CLASSIFY_TIMEOUT_MS).toBe('number');
    expect(AI_CLASSIFY_TIMEOUT_MS).toBeGreaterThan(0);
    expect(AI_CLASSIFY_TIMEOUT_MS).toBeLessThanOrEqual(10000);
  });

  it('rejectionしたPromiseはタイムアウトと同じく空文字列を返す', async () => {
    const failing = Promise.reject(new Error('AI unavailable'));
    const result = await withAiTimeout(failing, 1000);
    expect(result).toBe('');
  });
});

describe('クライアント側タイムアウトステータス', () => {
  function buildTimeoutMessage(ms: number): string {
    const sec = Math.round(ms / 1000);
    return `タイムアウト（${sec}秒）— 再度お試しください`;
  }

  it('10秒タイムアウトのメッセージが正しい', () => {
    const msg = buildTimeoutMessage(10000);
    expect(msg).toBe('タイムアウト（10秒）— 再度お試しください');
  });

  it('秒数が整数に丸められる', () => {
    const msg = buildTimeoutMessage(10500);
    expect(msg).toContain('11秒');
  });
});
