import { describe, it, expect } from 'vitest';
import { computeQuestionHash } from './conversationHash';

describe('computeQuestionHash', () => {
  it('同じ user_id と question なら同じハッシュを返す', async () => {
    const h1 = await computeQuestionHash('user1', '日本の首都は？');
    const h2 = await computeQuestionHash('user1', '日本の首都は？');
    expect(h1).toBe(h2);
  });

  it('question が異なれば別ハッシュを返す', async () => {
    const h1 = await computeQuestionHash('user1', '日本の首都は？');
    const h2 = await computeQuestionHash('user1', 'フランスの首都は？');
    expect(h1).not.toBe(h2);
  });

  it('user_id が異なれば別ハッシュを返す', async () => {
    const h1 = await computeQuestionHash('user1', '日本の首都は？');
    const h2 = await computeQuestionHash('user2', '日本の首都は？');
    expect(h1).not.toBe(h2);
  });

  it('model や answer が違っても同じ question なら同じハッシュを返す', async () => {
    const h1 = await computeQuestionHash('user1', '富士山の高さは？');
    const h2 = await computeQuestionHash('user1', '富士山の高さは？');
    expect(h1).toBe(h2);
  });

  it('64文字の16進数文字列を返す', async () => {
    const h = await computeQuestionHash('user1', 'テスト');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
