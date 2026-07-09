import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getHeritageAreaPage } from './views/heritageArea';

describe('heritage-area page', () => {
  it('renders Travel category buttons, multi-select keywords, and result table placeholders', () => {
    const html = getHeritageAreaPage();
    expect(html).toContain('Heritage Area');
    expect(html).toContain('/api/heritage-area/travel-categories');
    expect(html).toContain('/api/heritage-area/search');
    expect(html).toContain('複数選択可');
    expect(html).toContain('keyword-drawer');
    expect(html).toContain('id="keyword-search"');
    expect(html).toContain('renderResultRows');
    expect(html).toContain('検索露出ログ検索結果');
    expect(html).toContain('AIチャット検索露出ログ');
    expect(html).toContain('露出回数');
    expect(html).toContain('AIチャット質問');
  });

  it('registers heritage-area route and API handlers', () => {
    const src = readFileSync('src/index.ts', 'utf8');
    expect(src).toContain("app.get('/heritage-area'");
    expect(src).toContain("app.get('/api/heritage-area/travel-categories'");
    expect(src).toContain("app.get('/api/heritage-area/travel-categories/:id/keywords'");
    expect(src).toContain("app.post('/api/heritage-area/search'");
    expect(src).toContain('FROM aichat_search_impressions i');
    expect(src).toContain("'aichat_search_impressions' AS category");
  });
});
