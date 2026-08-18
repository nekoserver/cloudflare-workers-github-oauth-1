/**
 * GET /cheese-search ページの構造テスト
 *
 * 対象: フランスチーズ検索ページ(フリーワード検索+facetフィルタ)。
 *
 * 故障シナリオ:
 *   (1) 認証なしでアクセスできてしまう
 *   (2) facetボタン(乳種/固さ/カビ/産地限定)や食材ペアリング検索欄が生成されない
 *   (3) client-side scriptにテンプレートリテラルのエスケープ起因の構文エラーが混入する
 */
import { describe, it, expect } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getCheeseSearchPage } from './views/cheeseSearch';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

describe('GET /cheese-search', () => {
  it('未認証の場合はページを返さない', async () => {
    const res = await app.request('/cheese-search', {}, { JWT_SECRET });
    expect(res.status).not.toBe(200);
  });

  it('認証済みの場合はHTMLページを返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/cheese-search',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('フランスチーズ検索');
  });
});

describe('getCheeseSearchPage', () => {
  const html = getCheeseSearchPage('tester');

  it('facetフィルタ(乳種・固さ・カビ・産地限定)を含む', () => {
    expect(html).toContain('data-facet="milk"');
    expect(html).toContain('data-facet="hardness"');
    expect(html).toContain('data-facet="mold"');
    expect(html).toContain('data-facet="region"');
  });

  it('フリーワード検索欄と食材ペアリング検索欄を含む', () => {
    expect(html).toContain('id="freeword"');
    expect(html).toContain('id="pairingInput"');
  });

  it('/api/cheese-frを呼び出す', () => {
    expect(html).toContain("fetch('/api/cheese-fr'");
  });

  it('テンプレートリテラル起因のエスケープ崩れがない(単引用符エスケープ・生regexリテラルなし)', () => {
    expect(html).not.toContain("\\'");
    expect(html).not.toContain('&#39;&#39;');
  });
});
