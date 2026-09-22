import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { getJevPlaygroundPage } from './jevPlayground';

describe('getJevPlaygroundPage', () => {
  it('422にならないscore形式の3テンプレートと個別のRunボタンを表示する', () => {
    const html = getJevPlaygroundPage();
    for (const type of ['gate', 'classification', 'quality']) {
      expect(html).toContain(`data-type="${type}"`);
    }
    expect(html.match(/\"type\": \"score\"/g)).toHaveLength(3);
    expect(html).not.toContain('"type": "noul"');
    expect(html).not.toContain('"type": "choice"');
    expect(html.match(/class="run"/g)).toHaveLength(3);
    expect(html).toContain("fetch('/api/jev-playground'");
    expect(html).not.toContain('Bearer');
  });

  it('各score質問に2要素のcriteriaを設定する', () => {
    const html = getJevPlaygroundPage();

    expect(html).toContain('"条件を満たしていない"');
    expect(html).toContain('"カテゴリに該当しない"');
    expect(html).toContain('"まったく満たしていない"');
  });

  it('各質問タイプに複数のstateを用意し、選択時にJSONを更新する', () => {
    const html = getJevPlaygroundPage();

    expect(html.match(/class="state-select"/g)).toHaveLength(3);
    expect(html.match(/class="state-option"/g)).toHaveLength(24);
    expect(html.match(/class="state-dialog"/g)).toHaveLength(3);
    expect(html).toContain("dialog.showModal()");
    expect(html).toContain('body.state=sample.state');
    expect(html).toContain('question=sample.question');
  });

  it('stateを選ぶと対応するstateとquestionをJSONへ反映する', () => {
    const dom = new JSDOM(getJevPlaygroundPage(), { runScripts: 'dangerously' });
    const card = dom.window.document.querySelector('[data-type="gate"]')!;
    const option = card.querySelectorAll<HTMLButtonElement>('.state-option')[3];
    const textarea = card.querySelector<HTMLTextAreaElement>('textarea')!;

    option.click();

    const body = JSON.parse(textarea.value);
    expect(body.state).toBe('申請の受信日時は 9 月 18 日 14:20、締切は 9 月 20 日 17:00 です。');
    expect(body.questions.condition.question).toBe('この申請は期限内に受信されたか？');
  });

  it('各サンプルを横幅いっぱいの1カラムで表示する', () => {
    const html = getJevPlaygroundPage();

    expect(html).toContain('.grid{display:grid;grid-template-columns:minmax(0,1fr)');
    expect(html).toContain('.card{width:100%');
  });

  it('実行時間をミリ秒単位で表示し、不要な説明文を表示しない', () => {
    const html = getJevPlaygroundPage();

    expect(html).toContain('performance.now()');
    expect(html).toContain("+' ms'");
    expect(html).not.toContain('Worker に設定済みの');
    expect(html).not.toContain('3つの質問タイプは同時に独立して試せます。');
  });
});
