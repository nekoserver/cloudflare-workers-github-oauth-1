import { describe, expect, it } from 'vitest';
import { getJevPlaygroundPage } from './jevPlayground';

describe('getJevPlaygroundPage', () => {
  it('noul / choice / score のテンプレートと個別のRunボタンを表示する', () => {
    const html = getJevPlaygroundPage();
    for (const type of ['noul', 'choice', 'score']) {
      expect(html).toContain(`data-type="${type}"`);
      expect(html).toContain(`\"type\": \"${type}\"`);
    }
    expect(html.match(/class="run"/g)).toHaveLength(3);
    expect(html).toContain("fetch('/api/jev-playground'");
    expect(html).not.toContain('Bearer');
  });

  it('noulに判定基準、choiceに選択肢としてcriteriaを設定する', () => {
    const html = getJevPlaygroundPage();

    expect(html).toContain('"criteria": "認証エラーの場合に処理を停止');
    expect(html).toContain('"criteria": [');
    expect(html).toContain('"authentication"');
    expect(html).not.toContain('"choices"');
  });
});
