import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getHeritageAreaPage } from './views/heritageArea';
import { HERITAGE_AREA_SEARCH_TOPICS } from './index';

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
    expect(html).toContain('引用キーの所属エリア');
    expect(html).toContain('class="spinner"');
    expect(html).toContain('renderAreaMatches');
  });

  it('registers heritage-area route and API handlers', () => {
    const src = readFileSync('src/index.ts', 'utf8');
    expect(src).toContain("app.get('/heritage-area'");
    expect(src).toContain("app.get('/api/heritage-area/travel-categories'");
    expect(src).toContain("app.get('/api/heritage-area/travel-categories/:id/keywords'");
    expect(src).toContain("app.post('/api/heritage-area/search'");
    expect(src).toContain('FROM aichat_search_impressions i');
    expect(src).toContain("'aichat_search_impressions' AS category");
    expect(src).toContain('const topics = HERITAGE_AREA_SEARCH_TOPICS');
    expect(src).toContain("(INSTR(REPLACE(s.question, '･', '・'), ?) > 0 OR INSTR(REPLACE(s.answer, '･', '・'), ?) > 0)");
    expect(src).toContain('const firstQuoteMatch = question.match(/「([^」]+)」/)');
    expect(src).toContain('itemByQuoteKey');
    expect(src).toContain('item_name: firstQuoteKey');
    expect(src).toContain('const areaLookup = db.prepare');
    expect(src).toContain('for (const key of item.quote_keys)');
    expect(src).toContain('FROM heritage_area_items i');
    expect(src).toContain("OR ? LIKE '%' || i.item_name || '%'");
    expect(src).toContain('area_matches');
  });
});
