import { describe, it, expect } from 'vitest';
import { getApisPage } from './views/apis';

// 対象: /apis(APIテスター)ページ。HTTP QUERYメソッドで呼べるように
// なった/api/heritage-area/searchをカタログに追加し、QUERYメソッド用の
// バッジ色とリクエスト送信ロジック(ボディ添付)にも対応させる。
describe('/apis ページ: HTTP QUERYメソッドへの対応', () => {
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

  it('QUERYメソッド用のバッジ色(--query/--query-bg, .badge-QUERY)がライト/ダーク両方に定義されている', () => {
    expect(html).toContain('--query:');
    expect(html).toContain('--query-bg:');
    expect(html).toContain('.badge-QUERY{background:var(--query-bg);color:var(--query);}');
    // ダークモード(@media(prefers-color-scheme:dark))側にも--queryの定義があること
    const darkBlockMatch = html.match(/@media\(prefers-color-scheme:dark\)\{[\s\S]*?\}\n\}/);
    expect(darkBlockMatch).not.toBeNull();
    expect(darkBlockMatch![0]).toContain('--query:');
  });

  it('/api/heritage-area/searchがPOST/QUERYの両方でカタログに登録されている', () => {
    expect(html).toContain("path:'/api/heritage-area/search'");
    const postIdx = html.indexOf("method:'POST', path:'/api/heritage-area/search'");
    const queryIdx = html.indexOf("method:'QUERY', path:'/api/heritage-area/search'");
    expect(postIdx).toBeGreaterThan(-1);
    expect(queryIdx).toBeGreaterThan(-1);
  });

  it('QUERYエントリはkeywords配列をbodyとして送信できる設定になっている', () => {
    const idx = html.indexOf("method:'QUERY', path:'/api/heritage-area/search'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 250);
    expect(block).toContain("body:[{n:'keywords'");
  });

  it('sendRequest()はQUERYメソッドでもボディを添付する(POST/PUT/PATCH/DELETEのみの既存判定漏れを修正)', () => {
    const idx = html.indexOf("async function sendRequest()");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 1100);
    expect(block).toContain("['POST','PUT','PATCH','DELETE','QUERY'].includes(currentEp.method)");
  });
});
