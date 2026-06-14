import { describe, it, expect } from 'vitest';
import { countKeywordOccurrences } from './index';

describe('countKeywordOccurrences', () => {
  it('応答にキーワードが含まれる場合は出現回数を返す', () => {
    const hits = countKeywordOccurrences('Cloudflare Workers は Workers です', ['Workers', 'Hono']);
    expect(hits).toEqual([{ keyword: 'Workers', matchCount: 2 }]);
  });

  it('大文字小文字を区別しない', () => {
    const hits = countKeywordOccurrences('cloudflare WORKERS は workers です', ['Workers']);
    expect(hits).toEqual([{ keyword: 'Workers', matchCount: 2 }]);
  });

  it('含まれないキーワードは結果に含まない', () => {
    const hits = countKeywordOccurrences('Cloudflare Workers', ['Hono', 'Deno']);
    expect(hits).toEqual([]);
  });

  it('複数のキーワードがすべてヒットする場合', () => {
    const hits = countKeywordOccurrences('D1 と R2 と D1 を使う', ['D1', 'R2', 'KV']);
    expect(hits).toHaveLength(2);
    const d1 = hits.find((h) => h.keyword === 'D1');
    const r2 = hits.find((h) => h.keyword === 'R2');
    expect(d1?.matchCount).toBe(2);
    expect(r2?.matchCount).toBe(1);
  });

  it('空のキーワードリストは空配列を返す', () => {
    expect(countKeywordOccurrences('something', [])).toEqual([]);
  });

  it('空の応答テキストはヒットなし', () => {
    expect(countKeywordOccurrences('', ['Workers'])).toEqual([]);
  });

  it('キーワードが空文字の場合はスキップ', () => {
    const hits = countKeywordOccurrences('Workers', ['', 'Workers']);
    expect(hits).toEqual([{ keyword: 'Workers', matchCount: 1 }]);
  });
});
