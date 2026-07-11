import { Hono } from 'hono';

export interface Book {
  id: number;
  title: string;
  genre: string;
  year: number;
}

export const BOOKS: Book[] = [
  { id: 1, title: '吾輩は猫である', genre: 'novel', year: 1905 },
  { id: 2, title: '銀河鉄道の夜', genre: 'novel', year: 1934 },
  { id: 3, title: 'ソラリス', genre: 'sci-fi', year: 1961 },
  { id: 4, title: '1984', genre: 'sci-fi', year: 1949 },
  { id: 5, title: '走れメロス', genre: 'novel', year: 1940 },
];

export interface BookQuery {
  genre?: string;
  minYear?: number;
  maxYear?: number;
  sort?: 'year' | 'title';
}

export function searchBooks(query: BookQuery): Book[] {
  const results = BOOKS.filter((b) => {
    if (query.genre && b.genre !== query.genre) return false;
    if (query.minYear != null && b.year < query.minYear) return false;
    if (query.maxYear != null && b.year > query.maxYear) return false;
    return true;
  });
  if (query.sort === 'year') return results.slice().sort((a, b) => a.year - b.year);
  if (query.sort === 'title') return results.slice().sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  return results;
}

export const app = new Hono();

/**
 * HTTP QUERY (draft-ietf-httpbis-safe-method-w-body) は GET と同じ
 * safe/idempotent なセマンティクスを持ちながらリクエストボディを送れる。
 * URLに載せづらい複雑な検索条件を、POSTの「安全でない」意味論を借りずに送れる。
 */
app.on('QUERY', '/books', async (c) => {
  const text = await c.req.text();
  let query: BookQuery = {};
  if (text) {
    try {
      query = JSON.parse(text);
    } catch {
      return c.json({ error: 'リクエストボディのJSON解析に失敗しました' }, 400);
    }
  }
  const books = searchBooks(query);
  return c.json({ count: books.length, books });
});

export default app;
