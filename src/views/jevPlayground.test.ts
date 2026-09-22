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

  it('noulに判定基準、choiceに選択肢、scoreに両端の基準を設定する', () => {
    const dom = new JSDOM(getJevPlaygroundPage());
    const getBody = (type: string) => JSON.parse(dom.window.document.querySelector<HTMLTextAreaElement>(`[data-type="${type}"] textarea`)!.value);

    expect(getBody('noul').questions.condition.criteria).toEqual({
      yes: 'state の内容から質問の条件が成立すると判断できる',
      no: 'state の内容から質問の条件が成立しないと判断できる',
    });
    expect(getBody('choice').questions.category.criteria).toEqual({
      authentication: '利用者が誰であるかを確認する処理',
      authorization: '利用者に操作の権限があるかを確認する処理',
      'data-processing': 'データの変換、集計、または加工を行う処理',
      observability: 'システムの状態を計測、記録、または通知する機能',
      'user-interface': '利用者が直接操作する画面や入力体験の変更',
    });
    expect(getBody('score').questions.quality.criteria).toEqual(['まったく満たしていない', '十分に満たしている']);
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
    const card = dom.window.document.querySelector('[data-type="noul"]')!;
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

  it('各セクションのINとOUTを左右に並べ、RunボタンをOUTの右上に表示する', () => {
    const dom = new JSDOM(getJevPlaygroundPage());

    for (const card of dom.window.document.querySelectorAll('.card')) {
      const panels = card.querySelectorAll('.io-grid > .io-panel');
      expect(panels).toHaveLength(2);
      expect(panels[0].querySelector('.io-heading')?.textContent).toBe('IN');
      expect(panels[1].querySelector('.io-heading > span')?.textContent).toBe('OUT');
      expect(panels[1].querySelector('.io-heading .run')).not.toBeNull();
    }
    const html = getJevPlaygroundPage();
    expect(html).toContain('.io-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)');
    expect(html).toContain('.actions{display:flex;align-items:center;justify-content:flex-end');
  });

  it('stateドロップダウンをIN表記より上に表示する', () => {
    const dom = new JSDOM(getJevPlaygroundPage());

    for (const card of dom.window.document.querySelectorAll('.card')) {
      const picker = card.querySelector('.state-picker')!;
      const ioGrid = card.querySelector('.io-grid')!;
      expect(picker.compareDocumentPosition(ioGrid) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(card.querySelector('.input-panel .state-select')).toBeNull();
    }
  });

  it('実行時間をミリ秒単位で表示し、不要な説明文を表示しない', () => {
    const html = getJevPlaygroundPage();

    expect(html).toContain('performance.now()');
    expect(html).toContain("+' ms'");
    expect(html).not.toContain('Worker に設定済みの');
    expect(html).not.toContain('3つの質問タイプは同時に独立して試せます。');
  });
});
