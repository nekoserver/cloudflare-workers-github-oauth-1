import { describe, it, expect } from 'vitest';
import { app } from './server';

describe('QUERY /books', () => {
  it('ジャンル指定で絞り込む', async () => {
    const res = await app.request('/books', {
      method: 'QUERY',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre: 'sci-fi' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(2);
    expect(data.books.map((b: { title: string }) => b.title).sort()).toEqual(['1984', 'ソラリス'].sort());
  });

  it('年代範囲とsortを指定すると絞り込みと並び替えが両方効く', async () => {
    const res = await app.request('/books', {
      method: 'QUERY',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minYear: 1930, maxYear: 1960, sort: 'year' }),
    });
    const data = await res.json();
    expect(data.books.map((b: { year: number }) => b.year)).toEqual([1934, 1940, 1949]);
  });

  it('ボディなしのQUERYは全件を返す(GETと同じ安全なセマンティクス)', async () => {
    const res = await app.request('/books', { method: 'QUERY' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(5);
  });

  it('不正なJSONボディは400を返す', async () => {
    const res = await app.request('/books', {
      method: 'QUERY',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    });
    expect(res.status).toBe(400);
  });

  it('title順ソートは日本語ロケールで並び替える', async () => {
    const res = await app.request('/books', {
      method: 'QUERY',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sort: 'title' }),
    });
    const data = await res.json();
    const titles = data.books.map((b: { title: string }) => b.title);
    expect(titles).toEqual(titles.slice().sort((a: string, b: string) => a.localeCompare(b, 'ja')));
  });
});
