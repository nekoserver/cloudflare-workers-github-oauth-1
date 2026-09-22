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

  it('noulにinstructions、choiceに選択肢、scoreに両端の基準を設定する', () => {
    const dom = new JSDOM(getJevPlaygroundPage());
    const getBody = (type: string) => JSON.parse(dom.window.document.querySelector<HTMLTextAreaElement>(`[data-type="${type}"] textarea`)!.value);

    expect(getBody('noul').questions.condition.instructions).toBe(
      'state の内容を根拠に、質問の条件が成立するなら yes、成立しないなら no と判定する',
    );
    expect(getBody('noul').questions.condition).not.toHaveProperty('criteria');
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
      expect(panels[0].querySelector('.io-heading')?.textContent).toBe('IN リクエスト JSON');
      expect(panels[1].querySelector('.io-heading > span')?.textContent).toBe('OUT');
      expect(panels[1].querySelector('.io-heading .run')).not.toBeNull();
    }
    const html = getJevPlaygroundPage();
    expect(html).toContain('.io-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)');
    expect(html).toContain('.actions{display:flex;align-items:center;justify-content:flex-end');
    expect(html).toContain('.io-panel{min-width:0;display:flex;flex-direction:column}');
    expect(html).not.toContain('pre{height:100%');
  });

  it('state選択後に更新した文字列を黄色で3回点滅する', () => {
    const dom = new JSDOM(getJevPlaygroundPage(), { runScripts: 'dangerously' });
    const card = dom.window.document.querySelector('[data-type=\"noul\"]')!;

    card.querySelectorAll<HTMLButtonElement>('.state-option')[3].click();

    const flash = card.querySelector('.state-value-flash')!;
    expect(flash.textContent).toBe('\"申請の受信日時は 9 月 18 日 14:20、締切は 9 月 20 日 17:00 です。\"');
    expect(flash.classList.contains('is-flashing')).toBe(true);
    expect(getJevPlaygroundPage()).toContain('animation:state-value-flash .35s ease-in-out 3');
  });

  it('固定ヘッダーに各質問タイプへのジャンプリンクを表示しHomeリンクを表示しない', () => {
    const dom = new JSDOM(getJevPlaygroundPage());
    const header = dom.window.document.querySelector('.page-header')!;

    expect(header.querySelector('h1')?.textContent).toBe('Jev API Playground');
    expect(Array.from(header.querySelectorAll<HTMLAnchorElement>('.jump-links a')).map((link) => [link.textContent, link.hash])).toEqual([
      ['noul — Yes / No 判定', '#state-label-noul'],
      ['choice — 選択肢から分類', '#state-label-choice'],
      ['score — 程度を評価', '#state-label-score'],
    ]);
    for (const link of header.querySelectorAll<HTMLAnchorElement>('.jump-links a')) {
      expect(dom.window.document.querySelector(link.hash)?.textContent).toBe('state');
    }
    expect(dom.window.document.querySelector('a[href=\"/\"]')).toBeNull();
    expect(getJevPlaygroundPage()).toContain('.page-header{position:sticky;top:0');
    expect(getJevPlaygroundPage()).toContain('.jump-links a:hover,.jump-links a:focus-visible');
    expect(getJevPlaygroundPage()).toContain('text-decoration:none');
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

  it('レスポンスの200を緑、それ以外のステータスを赤のバッジで表示する', () => {
    const html = getJevPlaygroundPage();

    expect(html.match(/class="response-status-badge" hidden/g)).toHaveLength(3);
    expect(html).toContain("response.status===200?'is-success':'is-error'");
    expect(html).toContain("statusBadge.textContent=String(response.status)");
    expect(html).toContain('.response-status-badge.is-success{background:#1a7f37}');
    expect(html).toContain('.response-status-badge.is-error{background:#cf222e}');
  });
});
