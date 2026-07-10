import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');

function routeBlock(marker: string, len: number): string {
  const idx = src.indexOf(marker);
  expect(idx).toBeGreaterThan(-1);
  return src.slice(idx, idx + len);
}

// DBにテーブル・ユニークインデックスが未作成の場合など、D1へのクエリが例外を投げるケースで
// エラーがユーザーに見える形で返らないと「何も表示されない」という原因不明のバグに見えてしまう。
// catchで握りつぶさずエラー内容をレスポンスに含めることを保証する。
describe('空港近隣データAPI群 — D1クエリ失敗時にエラー内容をレスポンスへ含める', () => {
  it('POST /api/airport-nearby-heritage は try/catch で包み、失敗時にerror/detailを返す', () => {
    const block = routeBlock("app.post('/api/airport-nearby-heritage'", 1800);
    expect(block).toContain('try {');
    expect(block).toContain("catch (err)");
    expect(block).toMatch(/error:\s*['"].*['"],\s*detail:/);
  });

  it('POST /api/airport-nearby-airports は try/catch で包み、失敗時にerror/detailを返す', () => {
    const block = routeBlock("app.post('/api/airport-nearby-airports'", 1800);
    expect(block).toContain('try {');
    expect(block).toContain("catch (err)");
    expect(block).toMatch(/error:\s*['"].*['"],\s*detail:/);
  });

  it('GET /api/airport-nearby-heritage-airports は try/catch で包み、失敗時にerror/detailを返す', () => {
    const block = routeBlock("app.get('/api/airport-nearby-heritage-airports'", 900);
    expect(block).toContain('try {');
    expect(block).toContain("catch (err)");
    expect(block).toMatch(/error:\s*['"].*['"],\s*detail:/);
  });

  it('GET /api/airport-nearby-heritage-ranking は try/catch で包み、失敗時にerror/detailを返す', () => {
    const block = routeBlock("app.get('/api/airport-nearby-heritage-ranking'", 900);
    expect(block).toContain('try {');
    expect(block).toContain("catch (err)");
    expect(block).toMatch(/error:\s*['"].*['"],\s*detail:/);
  });
});
