import { describe, it, expect } from 'vitest';
import { getApisPage } from './views/apis';

// 対象: /apis(APIテスター)ページ。/jev-score-board(Jevスコアボード)の
// JSON API(rows・top-by-label・answer・label-names)が丸ごとカタログから
// 抜け落ちていたため、専用グループ「Jevスコアボード」として追加した。
// dynamicneko向けの-external版(Bearer認証、Service Binding経由専用)は
// このテスター(Cookie認証)からは叩けないため、意図的に含めない。
describe('/apis ページ: Jevスコアボードのエンドポイントをカタログに追加', () => {
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

  it("group: 'Jevスコアボード' が存在する", () => {
    expect(html).toContain("group: 'Jevスコアボード'");
  });

  it('rows・top-by-label・answer・label-namesの4エンドポイントがすべてGETで登録されている', () => {
    for (const path of [
      '/api/jev-score-board/rows',
      '/api/jev-score-board/top-by-label',
      '/api/jev-score-board/answer',
      '/api/jev-score-board/label-names',
    ]) {
      expect(html).toContain(`method:'GET',  path:'${path}'`);
    }
  });

  it('-external版(dynamicneko向け、Bearer認証専用)はテスターの対象に含めない', () => {
    expect(html).not.toContain('jev-score-board-rows-external');
    expect(html).not.toContain('jev-score-board-top-by-label-external');
    expect(html).not.toContain('jev-score-board-answer-external');
    expect(html).not.toContain('jev-score-board-label-names-external');
  });

  it('top-by-labelはlabelIdを必須クエリとして持つ', () => {
    const idx = html.indexOf("path:'/api/jev-score-board/top-by-label'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 200);
    expect(block).toContain("query:[{n:'labelId',req:true");
  });
});
