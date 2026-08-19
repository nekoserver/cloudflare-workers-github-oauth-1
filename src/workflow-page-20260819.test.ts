// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { normalizeWorkflowNo } from './index';
import { getWorkflowPage } from './views/workflow';

// 対象: /workflow・/workflow/:no ページとその番号正規化(normalizeWorkflowNo)。
// ワークフロー(内部でAPI問い合わせを行うアプリ)に0001〜9999の通し番号を
// 割り当て、/workflow/番号 で直接呼び出せるようにする機能。
//
// 故障シナリオ:
//   (1) 0埋めなし・文字列以外の入力で例外や意図しない番号になる
//   (2) 範囲外(0, 10000以上)や非数値が有効な番号として通ってしまう
//   (3) サイドバーに登録済みワークフローが表示されない
//   (4) 選択中のワークフローの処理段階(API問い合わせ)が上から下の順序で
//       表示されない
describe('normalizeWorkflowNo — /workflow/:no の番号正規化', () => {
  it('数値文字列を4桁ゼロ埋めに正規化する', () => {
    expect(normalizeWorkflowNo('1')).toBe('0001');
    expect(normalizeWorkflowNo('42')).toBe('0042');
    expect(normalizeWorkflowNo('9999')).toBe('9999');
  });

  it('先頭ゼロ埋め済みの入力もそのまま正規化する', () => {
    expect(normalizeWorkflowNo('0007')).toBe('0007');
  });

  it('範囲外(0・10000以上)はnullを返す', () => {
    expect(normalizeWorkflowNo('0')).toBeNull();
    expect(normalizeWorkflowNo('10000')).toBeNull();
    expect(normalizeWorkflowNo('-1')).toBeNull();
  });

  it('数値以外の文字列はnullを返す', () => {
    expect(normalizeWorkflowNo('abcd')).toBeNull();
    expect(normalizeWorkflowNo('')).toBeNull();
  });
});

describe('getWorkflowPage — サイドバー・処理段階の表示', () => {
  const workflows = [
    { workflow_no: '0001', title: 'WASMモジュール管理', page_path: '/wasm-modules', summary: null },
    { workflow_no: '0002', title: 'AIチャット送信', page_path: '/aichat', summary: null },
  ];

  it('サイドバーに登録済み全ワークフローへのリンクを表示する', () => {
    const html = getWorkflowPage('testuser', workflows, null);
    expect(html).toContain('/workflow/0001');
    expect(html).toContain('WASMモジュール管理');
    expect(html).toContain('/workflow/0002');
    expect(html).toContain('AIチャット送信');
  });

  it('選択中のワークフローの処理段階を上から下の順序(step_order昇順)で表示する', () => {
    const html = getWorkflowPage('testuser', workflows, {
      workflow: workflows[0],
      steps: [
        { step_order: 1, stage_title: 'モジュール一覧をロード', api_method: 'GET', api_path: '/api/wasm-modules', note: null },
        { step_order: 2, stage_title: 'ソースを表示', api_method: 'GET', api_path: '/api/wasm-modules/source', note: 'モーダルで表示' },
      ],
    });
    const idx1 = html.indexOf('モジュール一覧をロード');
    const idx2 = html.indexOf('ソースを表示');
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(idx1);
    expect(html).toContain('/api/wasm-modules/source');
    expect(html).toContain('モーダルで表示');
  });

  it('API問い合わせが無い段階は「API問い合わせなし」と表示する', () => {
    const html = getWorkflowPage('testuser', workflows, {
      workflow: workflows[0],
      steps: [
        { step_order: 1, stage_title: 'ページを開く', api_method: null, api_path: null, note: null },
      ],
    });
    expect(html).toContain('API問い合わせなし');
  });

  it('未選択時はプレースホルダーを表示する', () => {
    const html = getWorkflowPage('testuser', workflows, null);
    expect(html).toContain('左のサイドバーからワークフローを選択してください');
  });

  it('登録済みワークフローが0件でもエラーなく表示できる', () => {
    const html = getWorkflowPage('testuser', [], null);
    expect(html).toContain('登録済みワークフローはありません');
  });

  it('サイドパネル左上に開閉ボタン(#wfSidebarToggle)を配置する', () => {
    const html = getWorkflowPage('testuser', workflows, null);
    expect(html).toContain('id="wfSidebarToggle"');
    expect(html).toContain('class="wf-sidebar-header"');
  });
});

describe('getWorkflowPage — サイドパネル開閉ボタン(DOM実動作)', () => {
  const workflows = [
    { workflow_no: '0001', title: 'WASMモジュール管理', page_path: '/wasm-modules', summary: null },
  ];

  it('開閉ボタンを押すたびに #wfLayout の wf-sidebar-collapsed クラスが切り替わる', async () => {
    const html = getWorkflowPage('testuser', workflows, null);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    const layout = document.getElementById('wfLayout') as HTMLElement;
    const btn = document.getElementById('wfSidebarToggle') as HTMLButtonElement;
    expect(layout.classList.contains('wf-sidebar-collapsed')).toBe(false);

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(layout.classList.contains('wf-sidebar-collapsed')).toBe(true);

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(layout.classList.contains('wf-sidebar-collapsed')).toBe(false);
  });

  it('開閉状態はlocalStorageに保存され、再読み込み後も維持される', async () => {
    const html = getWorkflowPage('testuser', workflows, null);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    const btn = document.getElementById('wfSidebarToggle') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(localStorage.getItem('wfSidebarCollapsed')).toBe('1');

    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    const layout2 = document.getElementById('wfLayout') as HTMLElement;
    expect(layout2.classList.contains('wf-sidebar-collapsed')).toBe(true);
  });
});
