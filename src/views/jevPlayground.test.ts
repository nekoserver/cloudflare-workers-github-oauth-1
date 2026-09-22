import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
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

    expect(html).toContain('"criteria": "質問の条件が state の内容から成立すると判断できる');
    expect(html).toContain('"criteria": [');
    expect(html).toContain('"authentication"');
    expect(html).not.toContain('"choices"');
  });

  it('各質問タイプに複数のstateを用意し、選択時にJSONを更新する', () => {
    const html = getJevPlaygroundPage();

    expect(html.match(/class="state-select"/g)).toHaveLength(3);
    expect(html.match(/<option value=/g)).toHaveLength(24);
    expect(html).toContain("select.addEventListener('change'");
    expect(html).toContain('body.state=sample.state');
    expect(html).toContain('question=sample.question');
  });

  it('stateを選ぶと対応するstateとquestionをJSONへ反映する', () => {
    const dom = new JSDOM(getJevPlaygroundPage(), { runScripts: 'dangerously' });
    const card = dom.window.document.querySelector('[data-type="noul"]')!;
    const select = card.querySelector<HTMLSelectElement>('.state-select')!;
    const textarea = card.querySelector<HTMLTextAreaElement>('textarea')!;

    select.value = '3';
    select.dispatchEvent(new dom.window.Event('change'));

    const body = JSON.parse(textarea.value);
    expect(body.state).toBe('申請の受信日時は 9 月 18 日 14:20、締切は 9 月 20 日 17:00 です。');
    expect(body.questions.condition.question).toBe('この申請は期限内に受信されたか？');
  });

  it('実行時間をミリ秒単位で表示し、不要な説明文を表示しない', () => {
    const html = getJevPlaygroundPage();

    expect(html).toContain('performance.now()');
    expect(html).toContain("+' ms'");
    expect(html).not.toContain('Worker に設定済みの');
    expect(html).not.toContain('3つの質問タイプは同時に独立して試せます。');
  });
});
