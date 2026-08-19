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
