// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
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

  it('PWA(display-mode:standalone)では画面右上のユーザー名を非表示にする', () => {
    const html = getWorkflowPage('testuser', workflows, null);
    expect(html).toContain('@media (display-mode: standalone) { .pwa-hide { display: none !important; } }');
    expect(html).toMatch(/class="user-name pwa-hide"/);
  });

  it('viewport meta に viewport-fit=cover を指定し、ヘッダーがセーフエリア(ノッチ)分の余白を確保する', () => {
    const html = getWorkflowPage('testuser', workflows, null);
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('env(safe-area-inset-top)');
  });

  it('ヘッダー(.navbar)の縦方向paddingは他のアプリ系ページと同程度(10px)に抑える', () => {
    const html = getWorkflowPage('testuser', workflows, null);
    expect(html).toContain('padding: 10px 20px;');
  });

  it('PWA用のmeta(apple-mobile-web-app-capable等)を他のPWA対応ページと同様に配置する', () => {
    // 故障シナリオ(1): これらのタグが無いページはiOS Safariが「アプリのスコープ外」と
    // 判定し、アドレスバーが表示された状態(通常のSafariタブ)で開いてしまう。
    // PWAとしてホーム画面から起動した状態からサイドパネルのリンクで遷移した際、
    // 遷移先ページにもこのタグ一式が無いとアドレスバーが出現する不具合になる。
    const html = getWorkflowPage('testuser', workflows, null);
    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes">');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="ワークフロー">');
  });

  it('/manifest.json(start_url=/webgl-sphereの別アプリ用)へはlinkしない', () => {
    // 故障シナリオ(2): このmanifest.jsonはWebGL地球儀アプリ専用
    // (name/start_urlが地球儀向け)で、ワークフローページからも
    // <link rel="manifest">してしまうと、ワークフローページをホーム画面に
    // 追加した際にアイコン・起動URLが地球儀アプリのものになってしまう。
    // 同一オリジン・相対パスのページ遷移である限りstandalone表示自体は
    // apple-mobile-web-app-capableだけで維持されるため、manifestは不要。
    const html = getWorkflowPage('testuser', workflows, null);
    expect(html).not.toContain('rel="manifest"');
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

describe('getWorkflowPage — サイドパネルのリンクをfetch+history.pushStateで切り替える(DOM実動作)', () => {
  // 対象: PWA(display-mode:standalone)でサイドパネルのリンクをクリックした際、
  // 通常のフルページ遷移(<a href>のデフォルト動作)だとiOSでアドレスバーが
  // 一瞬表示されてしまう不具合への対応。fetch(/api/workflow/:no) + 画面差し替え
  // + history.pushStateで、フルリロードを起こさずにページを切り替える。
  //
  // 故障シナリオ:
  //   (1) クリックしてもデフォルトのページ遷移(e.preventDefaultなし)が起きてしまう
  //   (2) 画面(#wfMain)の内容が新しいワークフローの内容に差し替わらない
  //   (3) URL(history)が更新されない、またはブラウザの戻るボタンで元に戻らない
  //   (4) サイドバーの選択中(active)表示が切り替わらない
  const workflows = [
    { workflow_no: '0001', title: 'WASMモジュール管理', page_path: '/wasm-modules', summary: null },
    { workflow_no: '0002', title: 'AIチャット送信', page_path: '/aichat', summary: 'テスト概要' },
  ];

  function setupNavTest() {
    const html = getWorkflowPage('testuser', workflows, { workflow: workflows[0], steps: [] });
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        workflow: workflows[1],
        steps: [{ step_order: 1, stage_title: 'ステップ1', api_method: 'GET', api_path: '/api/aichat', note: null }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    return { fetchMock };
  }

  afterEach(() => { vi.unstubAllGlobals(); });

  it('サイドバーのリンククリックはデフォルトのページ遷移をpreventDefaultする', async () => {
    setupNavTest();
    const link = document.querySelector('[data-wf-no="0002"]') as HTMLAnchorElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('クリックするとfetch(/api/workflow/:no)を呼び、#wfMainの内容を差し替える', async () => {
    const { fetchMock } = setupNavTest();
    const link = document.querySelector('[data-wf-no="0002"]') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock).toHaveBeenCalledWith('/api/workflow/0002', expect.objectContaining({ credentials: 'same-origin' }));
    const main = document.getElementById('wfMain')!;
    expect(main.innerHTML).toContain('AIチャット送信');
    expect(main.innerHTML).toContain('/api/aichat');
    expect(document.title).toContain('AIチャット送信');
  });

  it('クリックするとhistory.pushStateでURLを更新し、サイドバーのactive表示も切り替わる', async () => {
    setupNavTest();
    const pushStateSpy = vi.spyOn(history, 'pushState');
    const link = document.querySelector('[data-wf-no="0002"]') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(pushStateSpy).toHaveBeenCalledWith(expect.anything(), '', '/workflow/0002');
    expect(link.classList.contains('active')).toBe(true);
    const otherLink = document.querySelector('[data-wf-no="0001"]') as HTMLAnchorElement;
    expect(otherLink.classList.contains('active')).toBe(false);
    pushStateSpy.mockRestore();
  });
});
