import { describe, it, expect } from 'vitest';
import { getApisPage } from './views/apis';

// 対象: /apis(APIテスター)ページ。GET /api/gh/pr-list(gh-wasmでのPR一覧取得)
// をカタログに登録する。
describe('/apis ページ: gh/pr-list APIの登録', () => {
  const html = getApisPage();

  it('script タグ内のJSに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('GET /api/gh/pr-list がカタログに登録されている', () => {
    expect(html).toContain("method:'GET', path:'/api/gh/pr-list'");
  });
});
