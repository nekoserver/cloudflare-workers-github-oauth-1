import { describe, it, expect } from 'vitest';
import { getApisPage } from './views/apis';

// 対象: APIリファレンスページ(/apis)。新設した🔑キー管理機能の
// エンドポイント(GET /api/api-keys・POST /api/api-keys・
// POST /api/api-keys/:id/revoke)が、実装(src/index.ts)に合わせて
// カタログへ登録されていることを確認する。
//
// 故障シナリオ:
//   (1) バックエンドにエンドポイントを追加したのにAPIリファレンスへの
//       登録を忘れ、ドキュメントと実装が食い違う
//   (2) レスポンス例のフィールド名が実装(index.tsのc.json(...))と
//       一致しない(キー名の誤記等)

describe('APIリファレンスページ: APIキー管理エンドポイントのドキュメント化', () => {
  const html = getApisPage();

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it("'APIキー管理' グループが存在する", () => {
    expect(html).toContain("group: 'APIキー管理'");
  });

  it('GET /api/api-keys(一覧)が登録されている', () => {
    expect(html).toContain("method:'GET',  path:'/api/api-keys'");
  });

  it('POST /api/api-keys(発行)が登録され、ラベル・有効期限日数をbodyに持つ', () => {
    const idx = html.indexOf("method:'POST', path:'/api/api-keys',");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 900);
    expect(block).toContain("n:'label'");
    expect(block).toContain("n:'expiresInDays'");
    expect(block).toContain('rawKey');
    expect(block).toContain('countdownNotice');
    expect(block).toContain('Key期限');
  });

  it('POST /api/api-keys/:id/revoke(失効)が登録され、idをpath_paramsに持つ', () => {
    const idx = html.indexOf("path:'/api/api-keys/:id/revoke'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain("path_params:['id']");
  });
});
