// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getWfBrowserPage } from './views/wfBrowser';
import { API_ENDPOINT_LIST } from './data/apiEndpointList';

// 対象: /wf-browser ページ。/apis ページにある全エンドポイント一覧のうち、
// /workflow/:no のいずれかのワークフローから参照されている(workflow_stepsに
// 登録されている)ものと、されていないものを見分けられるようにする。
// されていないエンドポイントはグレーアウト(wfb-row-gray)表示する。
//
// 故障シナリオ:
//   (1) 参照されているエンドポイントもグレーアウトしてしまう
//   (2) 参照されていないエンドポイントがグレーアウトされない
//   (3) 参照元ワークフローへのリンクが表示されない、または誤った番号にリンクする
//   (4) 同じエンドポイントを複数のワークフローが参照している場合に1件しか表示されない
describe('getWfBrowserPage — エンドポイントの参照有無によるグレーアウト', () => {
  it('参照されているエンドポイントはグレーアウトされず、参照元ワークフローへのリンクを表示する', () => {
    const sample = API_ENDPOINT_LIST[0];
    const refs = new Map([[sample.method + ' ' + sample.path, [{ workflow_no: '0001', title: 'テストワークフロー' }]]]);
    const html = getWfBrowserPage('testuser', refs);
    const rowStart = html.indexOf(sample.path);
    expect(rowStart).toBeGreaterThan(-1);
    const rowHtmlStart = html.lastIndexOf('<tr class="wfb-row', rowStart);
    const rowHtmlEnd = html.indexOf('</tr>', rowStart);
    const rowHtml = html.slice(rowHtmlStart, rowHtmlEnd);
    expect(rowHtml).not.toContain('wfb-row-gray');
    expect(rowHtml).toContain('href="/workflow/0001"');
    expect(rowHtml).toContain('テストワークフロー');
  });

  it('参照されていないエンドポイントはwfb-row-grayクラスでグレーアウトし「未参照」と表示する', () => {
    const html = getWfBrowserPage('testuser', new Map());
    const sample = API_ENDPOINT_LIST[0];
    const rowStart = html.indexOf(sample.path);
    const rowHtmlStart = html.lastIndexOf('<tr class="wfb-row', rowStart);
    const rowHtmlEnd = html.indexOf('</tr>', rowStart);
    const rowHtml = html.slice(rowHtmlStart, rowHtmlEnd);
    expect(rowHtml).toContain('wfb-row-gray');
    expect(rowHtml).toContain('未参照');
  });

  it('複数のワークフローが同じエンドポイントを参照している場合、両方のバッジを表示する', () => {
    const sample = API_ENDPOINT_LIST[0];
    const refs = new Map([[sample.method + ' ' + sample.path, [
      { workflow_no: '0001', title: 'A' },
      { workflow_no: '0002', title: 'B' },
    ]]]);
    const html = getWfBrowserPage('testuser', refs);
    expect(html).toContain('href="/workflow/0001"');
    expect(html).toContain('href="/workflow/0002"');
  });

  it('全エンドポイント数と参照済み件数のサマリを表示する', () => {
    const html = getWfBrowserPage('testuser', new Map());
    expect(html).toContain('全' + API_ENDPOINT_LIST.length + '件中');
    expect(html).toContain('0件</strong>');
  });
});

describe('getWfBrowserPage — 上部のワークフローバッジバー', () => {
  const sample = API_ENDPOINT_LIST[0];
  const sample2 = API_ENDPOINT_LIST[1];
  const allWorkflows = [
    { workflow_no: '0001', title: 'WASMモジュール管理' },
    { workflow_no: '0002', title: 'AIチャット送信' },
  ];

  it('登録済み全ワークフローのバッジを上部のバッジバー(#wfbBadgebar)に表示する', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows);
    const barStart = html.indexOf('id="wfbBadgebar"');
    const barEnd = html.indexOf('</div>', barStart);
    const barHtml = html.slice(barStart, barEnd);
    expect(barHtml).toContain('data-wf-no="0001"');
    expect(barHtml).toContain('WASMモジュール管理');
    expect(barHtml).toContain('data-wf-no="0002"');
  });

  it('バッジバー(position: sticky)がページ上部に固定される', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows);
    expect(html).toContain('.wfb-badgebar {');
    expect(html).toContain('position: sticky; top: 0;');
  });

  it('登録済みワークフローが0件でもエラーなく表示できる', () => {
    const html = getWfBrowserPage('testuser', new Map(), []);
    expect(html).toContain('登録済みワークフローはありません');
  });

  it('各行(tr)にどのワークフローが参照しているかをdata-wf-nosとして持たせる', () => {
    const refs = new Map([[sample.method + ' ' + sample.path, [{ workflow_no: '0001', title: 'A' }]]]);
    const html = getWfBrowserPage('testuser', refs, allWorkflows);
    const rowStart = html.indexOf(sample.path);
    const rowHtmlStart = html.lastIndexOf('<tr class="wfb-row', rowStart);
    const rowHtmlEnd = html.indexOf('>', rowHtmlStart);
    const rowTag = html.slice(rowHtmlStart, rowHtmlEnd);
    expect(rowTag).toContain('data-wf-nos="0001"');
  });

  it('(DOM実動作) バッジを押すと、そのワークフローが参照するエンドポイント行だけがwfb-highlightクラスを得る', () => {
    const refs = new Map([
      [sample.method + ' ' + sample.path, [{ workflow_no: '0001', title: 'A' }]],
      [sample2.method + ' ' + sample2.path, [{ workflow_no: '0002', title: 'B' }]],
    ]);
    const html = getWfBrowserPage('testuser', refs, allWorkflows);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    const badge1 = document.querySelector('[data-wf-no="0001"]') as HTMLButtonElement;
    badge1.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const rows = document.querySelectorAll('.wfb-row');
    const highlighted = [...rows].filter((r) => r.classList.contains('wfb-highlight'));
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].getAttribute('data-wf-nos')).toBe('0001');
    expect(badge1.classList.contains('active')).toBe(true);

    // もう一度押すと解除される
    badge1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelectorAll('.wfb-highlight')).toHaveLength(0);
    expect(badge1.classList.contains('active')).toBe(false);
  });

  it('(DOM実動作) 複数のバッジを押すと、それぞれが参照する行がすべてハイライトされる', () => {
    const refs = new Map([
      [sample.method + ' ' + sample.path, [{ workflow_no: '0001', title: 'A' }]],
      [sample2.method + ' ' + sample2.path, [{ workflow_no: '0002', title: 'B' }]],
    ]);
    const html = getWfBrowserPage('testuser', refs, allWorkflows);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    (document.querySelector('[data-wf-no="0001"]') as HTMLButtonElement).click();
    (document.querySelector('[data-wf-no="0002"]') as HTMLButtonElement).click();

    expect(document.querySelectorAll('.wfb-highlight')).toHaveLength(2);
  });
});
