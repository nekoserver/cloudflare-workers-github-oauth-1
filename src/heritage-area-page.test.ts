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
    expect(html).toContain('エリア番号');
    expect(html).toContain('世界遺産名（ほか駅名/空港名/活火山名）');
  });

  it('registers heritage-area route and API handlers', () => {
    const src = readFileSync('src/index.ts', 'utf8');
    expect(src).toContain("app.get('/heritage-area'");
    expect(src).toContain("app.get('/api/heritage-area/travel-categories'");
    expect(src).toContain("app.get('/api/heritage-area/travel-categories/:id/keywords'");
    expect(src).toContain("app.post('/api/heritage-area/search'");
  });
});
