import { describe, it, expect } from 'vitest';
import { getApisPage } from './views/apis';

// 対象: /apis(APIテスター)ページ。GET/POST /api/preferences/:key が
// カタログに未登録だったため追加する。
describe('/apis ページ: /api/preferences/:key の登録', () => {
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

  it('GET/POST /api/preferences/:key の両方がカタログに登録されている', () => {
    const getIdx = html.indexOf("method:'GET',  path:'/api/preferences/:key'");
    const postIdx = html.indexOf("method:'POST', path:'/api/preferences/:key'");
    expect(getIdx).toBeGreaterThan(-1);
    expect(postIdx).toBeGreaterThan(-1);
  });

  it('POSTエントリはvalueを必須bodyパラメータとして持つ', () => {
    const idx = html.indexOf("method:'POST', path:'/api/preferences/:key'");
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain("body:[{n:'value',req:true");
  });

  it('両エントリにpath_paramsとサンプル値(pp)が設定されている', () => {
    const getIdx = html.indexOf("method:'GET',  path:'/api/preferences/:key'");
    const getSnippet = html.slice(getIdx, getIdx + 300);
    expect(getSnippet).toContain("path_params:['key']");
    expect(getSnippet).toContain("pp:{key:");
  });
});
