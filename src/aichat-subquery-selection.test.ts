// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

function setup(items: unknown[], apiError?: string) {
  document.body.innerHTML = '<div id="modal"></div><div id="list"></div><input id="selected"><input id="url"><div id="msg"></div>';
  const html = getAiChatPage({ username: 'test', aiChatModel: 'model' });
  const reader = html.slice(html.indexOf('    function readSubqueriesResponse('), html.indexOf('    var subqueriesOverlay'));
  const source = reader + html.slice(html.indexOf('    function openAddSubqueryModal('), html.indexOf('    function closeAddSubqueryModal('));
  const list = document.getElementById('list')!;
  const selected = document.getElementById('selected') as HTMLInputElement;
  const bindings = {
    document, addSubqueryModal: document.getElementById('modal'), addSubqueryList: list,
    addSubquerySelected: selected, addSubqueryUrl: document.getElementById('url'), addSubqueryMsg: document.getElementById('msg'),
    getNextZ: () => 100, escHtml: (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    fetch: async () => ({ ok: !apiError, json: async () => apiError ? { error: apiError } : { items } }),
  };
  const readSelection = new Function(...Object.keys(bindings), 'var selectedSubqueryId = null;\n' + source + '\nopenAddSubqueryModal(); return function() { return selectedSubqueryId; };')(...Object.values(bindings));
  return { list, selected, readSelection };
}

describe('新規サブクエリの選択', () => {
  it('利用件数上位20件の後にある新しい質問文も読み出して指定できる', async () => {
    const items = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, query: '既存' + index, link_count: 1 }));
    items.push({ id: 26, query: '新規追加した質問文', link_count: 0 });
    const { list, selected, readSelection } = setup(items);
    await new Promise(resolve => setTimeout(resolve, 0));
    const entry = list.querySelector<HTMLElement>('[data-id="26"]');
    expect(entry).not.toBeNull();
    entry!.click();
    expect(selected.value).toBe('新規追加した質問文');
    expect(readSelection()).toBe(26);
  });
  it('一覧取得のAPIエラーを未登録扱いにせず理由を表示する', async () => {
    const { list } = setup([], '一覧を読み出せません');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(list.textContent).toContain('一覧を読み出せません');
    expect(list.textContent).not.toContain('まだ登録されていません');
  });
  it('追加直後は分類フィルターを解除し、再取得失敗でも保存した質問を保持する', async () => {
    const html = getAiChatPage({ username: 'test', aiChatModel: 'model' });
    const reader = html.slice(html.indexOf('    function readSubqueriesResponse('), html.indexOf('    var subqueriesOverlay'));
    const handlerSource = html.slice(html.indexOf("    subqueriesAddSubmit.addEventListener('click'"), html.indexOf('    // ===== サブクエリ選択→質問一覧モーダル ====='));
    const button = document.createElement('button');
    const input = document.createElement('input'); input.value = '新しい質問';
    const message = document.createElement('div');
    let rendered = 0;
    const bindings = {
      subqueriesAddSubmit: button, subqueriesAddInput: input, subqueriesAddMsg: message,
      renderSubqueriesList: () => { rendered++; },
      fetch: async (_url: string, init?: { method?: string }) => {
        if (init?.method === 'POST') return { ok: true, json: async () => ({ ok: true, item: { id: 101, query: '新しい質問' } }) };
        throw new Error('ネットワークエラー');
      },
    };
    const state = new Function(...Object.keys(bindings),
      'var subqueriesAllItems = []; var sqSelectedCats = { selected: true }; var sqSelectedGroupId = 3;\n' + reader + handlerSource +
      '\nreturn function() { return { items: subqueriesAllItems, categories: sqSelectedCats, group: sqSelectedGroupId }; };')(...Object.values(bindings));
    button.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(state()).toEqual({ items: [{ id: 101, query: '新しい質問', link_count: 0, keywords: [] }], categories: {}, group: null });
    expect(rendered).toBe(1);
    expect(message.textContent).toContain('追加しましたが、一覧の再取得に失敗しました: ネットワークエラー');
  });

  it('サブクエリ一覧を開く際のAPIエラーも未登録扱いにしない', async () => {
    const html = getAiChatPage({ username: 'test', aiChatModel: 'model' });
    const reader = html.slice(html.indexOf('    function readSubqueriesResponse('), html.indexOf('    var subqueriesOverlay'));
    const source = html.slice(html.indexOf('    function openSubqueries()'), html.indexOf('    function closeSubqueries()'));
    const body = document.createElement('div');
    const bindings = {
      subqueriesOverlay: document.createElement('div'), subqueriesAddForm: document.createElement('div'),
      subqueriesAddInput: document.createElement('input'), subqueriesAddSubmit: document.createElement('button'),
      subqueriesAddMsg: document.createElement('div'), subqueriesListBody: body,
      fetch: async (url: string) => ({ ok: !url.endsWith('/subqueries'), json: async () => url.endsWith('/subqueries') ? { error: '一覧取得エラー' } : {} }),
      renderSubqueriesList: () => { throw new Error('失敗を空一覧として描画してはいけない'); },
    };
    new Function(...Object.keys(bindings), 'var sqSelectedCats, sqSelectedGroupId;\n' + reader + source + '\nopenSubqueries();')(...Object.values(bindings));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(body.textContent).toBe('取得に失敗しました: 一覧取得エラー');
  });

});
