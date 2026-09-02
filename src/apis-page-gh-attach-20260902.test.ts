import { describe, it, expect } from 'vitest';
import { getApisPage } from './views/apis';

// 対象: /apis(APIテスター)ページ。/gh-attachページが追加した
// POST /api/gh-attach/upload・POST /api/gh-attach/create-issue を
// カタログに登録する。
describe('/apis ページ: gh-attach APIの登録', () => {
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

  it('POST /api/gh-attach/upload がカタログに登録されている', () => {
    expect(html).toContain("method:'POST', path:'/api/gh-attach/upload'");
  });

  it('POST /api/gh-attach/create-issue がカタログに登録されている', () => {
    expect(html).toContain("method:'POST', path:'/api/gh-attach/create-issue'");
  });
});
