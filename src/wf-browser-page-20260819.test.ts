// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
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

  it('バッジは「ワークフロー名 (API数)」の表記で、各ワークフローが使うAPI数の多い順に左から並ぶ', () => {
    // 0001は2件のAPIを参照、0002は1件のみ参照 → 0001が先に並ぶ
    const refs = new Map([
      [sample.method + ' ' + sample.path, [{ workflow_no: '0001', title: 'WASMモジュール管理' }]],
      [sample2.method + ' ' + sample2.path, [{ workflow_no: '0001', title: 'WASMモジュール管理' }]],
      ['POST /api/uuid/save', [{ workflow_no: '0002', title: 'AIチャット送信' }]],
    ]);
    const html = getWfBrowserPage('testuser', refs, allWorkflows);
    const barStart = html.indexOf('id="wfbBadgebar"');
    const barEnd = html.indexOf('</div>', barStart);
    const barHtml = html.slice(barStart, barEnd);
    expect(barHtml).toContain('WASMモジュール管理 (2)');
    expect(barHtml).toContain('AIチャット送信 (1)');
    const idx1 = barHtml.indexOf('data-wf-no="0001"');
    const idx2 = barHtml.indexOf('data-wf-no="0002"');
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(-1);
    expect(idx1).toBeLessThan(idx2);
  });

  it('参照エンドポイントが0件のワークフローは(0)と表記される', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows);
    expect(html).toContain('WASMモジュール管理 (0)');
    expect(html).toContain('AIチャット送信 (0)');
  });

  it('バッジ間の余白(gap)は1pxに詰められている', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows);
    expect(html).toContain('gap: 1px;');
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

describe('getWfBrowserPage — 「ワークフローで絞り込み:」パネルのON/OFFトグル', () => {
  // 対象: 上部の「ワークフローで絞り込み:」バッジバー(#wfbBadgebar)に、
  // バッジ一覧(#wfbBadgebarBadges)自体の表示/非表示を切り替えられる
  // トグルボタン(#wfbBadgebarToggle)を追加する。localStorageに状態を
  // 保存し、次回訪問時も状態を維持する。
  //
  // 故障シナリオ:
  //   (1) トグルを押してもバッジ一覧が非表示にならない
  //   (2) 再度押しても表示に戻らない
  //   (3) localStorageへ状態が保存されず、リロードのたびに表示状態に戻る
  const allWorkflows = [{ workflow_no: '0001', title: 'WASMモジュール管理' }];

  function setup() {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
  }

  it('トグルボタン・バッジ一覧用の要素が存在する', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows);
    expect(html).toContain('id="wfbBadgebarToggle"');
    expect(html).toContain('id="wfbBadgebarBadges"');
  });

  it('初期状態は表示中(aria-pressed="true"、wfb-badgebar-hiddenクラスなし)', () => {
    localStorage.clear();
    setup();
    const toggle = document.getElementById('wfbBadgebarToggle')!;
    const badges = document.getElementById('wfbBadgebarBadges')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(badges.classList.contains('wfb-badgebar-hidden')).toBe(false);
  });

  it('トグルを押すとバッジ一覧が非表示になり、もう一度押すと表示に戻る', () => {
    localStorage.clear();
    setup();
    const toggle = document.getElementById('wfbBadgebarToggle') as HTMLButtonElement;
    const badges = document.getElementById('wfbBadgebarBadges')!;

    toggle.click();
    expect(badges.classList.contains('wfb-badgebar-hidden')).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    expect(badges.classList.contains('wfb-badgebar-hidden')).toBe(false);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('トグル状態はlocalStorageに保存され、再読み込み後も維持される', () => {
    localStorage.clear();
    setup();
    (document.getElementById('wfbBadgebarToggle') as HTMLButtonElement).click();
    expect(localStorage.getItem('wfbBadgebarCollapsed')).toBe('1');

    setup();
    const badges = document.getElementById('wfbBadgebarBadges')!;
    expect(badges.classList.contains('wfb-badgebar-hidden')).toBe(true);
  });
});

describe('getWfBrowserPage — 反映漏れ(workflow_stepsが未登録)の警告トースト', () => {
  const allWorkflows = [
    { workflow_no: '0001', title: 'WASMモジュール管理' },
    { workflow_no: '0005', title: 'heritage-area Travelキーワード検索' },
  ];

  // 対象: workflow_registryには登録されているがworkflow_stepsが1行も無い
  // (処理段階のINSERT文が未実行の)ワークフローがある場合、/wf-browser
  // ページ上部に薄ピンク色のトーストでやんわり警告し、反映までの導線
  // (該当ワークフローページへのリンク)を示す。
  //
  // 故障シナリオ:
  //   (1) 反映漏れがあるのにトーストが出ない(気づけない)
  //   (2) 反映漏れが無いのにトーストが出てしまう(過剰警告)
  //   (3) トースト内に該当ワークフローへの導線(リンク)が無い
  //   (4) 閉じるボタンを押しても消えない

  it('反映漏れワークフローがある場合、薄ピンク色のトースト(#wfbToast)を表示し、該当ワークフローへのリンクを含める', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows, [
      { workflow_no: '0005', title: 'heritage-area Travelキーワード検索' },
    ]);
    expect(html).toContain('id="wfbToast"');
    expect(html).toContain('background: #fde2e9');
    expect(html).toContain('href="/workflow/0005"');
    expect(html).toContain('heritage-area Travelキーワード検索');
  });

  it('反映漏れが無い場合はトーストを表示しない', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows, []);
    expect(html).not.toContain('id="wfbToast"');
  });

  it('missingStepsWorkflows省略時もエラーにならず、トーストを表示しない', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows);
    expect(html).not.toContain('id="wfbToast"');
  });

  it('(DOM実動作) 閉じるボタンを押すとトーストがDOMから消える', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows, [
      { workflow_no: '0005', title: 'heritage-area Travelキーワード検索' },
    ]);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    expect(document.getElementById('wfbToast')).not.toBeNull();
    (document.getElementById('wfbToastClose') as HTMLButtonElement).click();
    expect(document.getElementById('wfbToast')).toBeNull();
  });
});

describe('getWfBrowserPage — バッジ押下時の該当行へのジャンプ(DOM実動作)', () => {
  // 対象: ワークフローバッジを押した際、そのワークフローが使用する
  // エンドポイントのうち最上位(DOM順で最初)の行にカーソル(フォーカス)を
  // 飛ばし、スクロールして見える位置まで移動させる。
  //
  // 故障シナリオ:
  //   (1) 最上位行ではなく無関係な行、または複数行すべてにフォーカスが飛ぶ
  //   (2) scrollIntoViewが呼ばれない(画面内に見えるようにならない)
  //   (3) バッジを解除(2回目クリック)した際にもジャンプが発生してしまう
  const sample = API_ENDPOINT_LIST[0];
  const sample2 = API_ENDPOINT_LIST[1];
  const allWorkflows = [{ workflow_no: '0001', title: 'WASMモジュール管理' }];

  function setup() {
    const refs = new Map([
      [sample.method + ' ' + sample.path, [{ workflow_no: '0001', title: 'WASMモジュール管理' }]],
      [sample2.method + ' ' + sample2.path, [{ workflow_no: '0001', title: 'WASMモジュール管理' }]],
    ]);
    const html = getWfBrowserPage('testuser', refs, allWorkflows);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
  }

  it('バッジを押すと、そのワークフローが使う最上位(DOM順で最初)の行にフォーカスが移り、画面内へスクロールされる', () => {
    setup();
    const rows = document.querySelectorAll('.wfb-row');
    const scrollSpies = [...rows].map((r) => {
      (r as HTMLElement).scrollIntoView = vi.fn();
      return (r as HTMLElement).scrollIntoView as ReturnType<typeof vi.fn>;
    });

    const badge = document.querySelector('[data-wf-no="0001"]') as HTMLButtonElement;
    badge.click();

    const firstMatchIdx = [...rows].findIndex((r) => (r.getAttribute('data-wf-nos') || '').split(' ').includes('0001'));
    expect(firstMatchIdx).toBeGreaterThan(-1);
    expect(scrollSpies[firstMatchIdx]).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(rows[firstMatchIdx]);
    // 他の行にはジャンプしていない
    scrollSpies.forEach((spy, i) => {
      if (i !== firstMatchIdx) expect(spy).not.toHaveBeenCalled();
    });
  });

  it('バッジを解除(2回目クリック)した際はジャンプが発生しない', () => {
    setup();
    const rows = document.querySelectorAll('.wfb-row');
    const scrollSpies = [...rows].map((r) => {
      (r as HTMLElement).scrollIntoView = vi.fn();
      return (r as HTMLElement).scrollIntoView as ReturnType<typeof vi.fn>;
    });

    const badge = document.querySelector('[data-wf-no="0001"]') as HTMLButtonElement;
    badge.click();
    scrollSpies.forEach((spy) => spy.mockClear());
    badge.click();

    scrollSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});

describe('getWfBrowserPage — 全ワークフロー反映確認の成功トースト', () => {
  const allWorkflows = [
    { workflow_no: '0001', title: 'WASMモジュール管理' },
    { workflow_no: '0005', title: 'heritage-area Travelキーワード検索' },
  ];

  // 対象: ページ読み込み時、登録済みのすべてのワークフローに
  // workflow_stepsが反映されている(反映漏れが無い)ことが確認できた場合、
  // 画面上部から薄緑色のトースト(#wfbSuccessToast)が降りてきて
  // 「◯件すべてのワークフローが反映されました」と表示し、
  // アニメーション終了後にDOMから消える。
  //
  // 故障シナリオ:
  //   (1) 反映漏れが無いのにトーストが出ない(安心材料が無い)
  //   (2) 反映漏れがあるのにトーストが出てしまう(誤った安心感を与える)
  //   (3) ワークフローが1件も登録されていないのにトーストが出てしまう
  //   (4) アニメーション終了後もDOMに残り続ける

  it('反映漏れが無く、ワークフローが1件以上ある場合は成功トースト(#wfbSuccessToast)を表示し件数を含める', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows, []);
    expect(html).toContain('id="wfbSuccessToast"');
    expect(html).toContain('2件すべてのワークフローが反映されました');
  });

  it('反映漏れがある場合は成功トーストを表示しない', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows, [
      { workflow_no: '0005', title: 'heritage-area Travelキーワード検索' },
    ]);
    expect(html).not.toContain('id="wfbSuccessToast"');
  });

  it('ワークフローが1件も登録されていない場合は成功トーストを表示しない', () => {
    const html = getWfBrowserPage('testuser', new Map(), [], []);
    expect(html).not.toContain('id="wfbSuccessToast"');
  });

  it('(DOM実動作) animationend後に成功トーストがDOMから消える', () => {
    const html = getWfBrowserPage('testuser', new Map(), allWorkflows, []);
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    const toast = document.getElementById('wfbSuccessToast');
    expect(toast).not.toBeNull();
    toast!.dispatchEvent(new Event('animationend'));
    expect(document.getElementById('wfbSuccessToast')).toBeNull();
  });
});
