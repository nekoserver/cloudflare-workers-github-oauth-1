// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「出発地・到着地」行末にある
// 「登録済みルートを見る」ボタン(#view-registered-routes-btn)。押すと
// /api/heritage-journey/registered-routes から全登録ルートを取得し、
// 最上位モーダル(#registered-routes-modal-overlay)を開いて
//   1. 出発地・到着地それぞれの出現回数を「都市名 (件数)」の形式で降順表示
//   2. ID/出発地/到着地/直線距離のテーブル
// を表示する。ソートは件数降順、同数の場合の順序は未規定(安定ソートに依存)。
// テーブルは直線距離の遠い順で表示し、行タップで巡回ルートスコープを切り替える。
//
// 故障シナリオ:
//   (1) ボタンが正しい行(.city-row)に存在しない、モーダルが初期状態で開いている
//   (2) クリックしてもfetchが行われない、モーダルが開かない
//   (3) 出発地/到着地の重複がある場合に集計が正しく行われない、降順ソートされない
//   (4) 表示フォーマットが「都市名 (件数)」になっていない
//   (5) テーブルの行数・値がAPIレスポンスと一致しない
//   (6) 閉じるボタン/背景クリック/Escapeキーでモーダルが閉じない
//   (7) サーバーエラーや空リストのレスポンスで例外が発生する

function setupPage(fetchImpl: (input: unknown, init?: unknown) => Promise<{ json: () => Promise<unknown> }>) {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(fetchImpl);
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const SAMPLE_ROUTES = [
  { id: 1, start: 'パリ', end: 'ローマ', straightKm: 1100.4 },
  { id: 2, start: 'パリ', end: 'ロンドン', straightKm: 340.2 },
  { id: 3, start: '東京', end: 'ローマ', straightKm: 9600.1 },
];

describe('heritage-journeyページ: 「登録済みルートを見る」ボタンのマークアップ', () => {
  it('#view-registered-routes-btnが#end-cityと同じ行(.city-row)に存在し、モーダルは初期状態で閉じている', () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: [] }) }));
    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    const endCity = document.getElementById('end-city')!;
    expect(btn).not.toBeNull();
    expect(btn.closest('.city-row')).toBe(endCity.closest('.city-row'));
    const overlay = document.getElementById('registered-routes-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(false);
  });
});

describe('heritage-journeyページ: ボタン押下時のfetchとモーダル表示', () => {
  it('クリックすると一覧APIをfetchし、モーダルが開く', async () => {
    const { fetchMock } = setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: SAMPLE_ROUTES }) }));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const calls = fetchMock.mock.calls.filter((c) => String(c[0]) === '/api/heritage-journey/registered-routes');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const overlay = document.getElementById('registered-routes-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
  });
});

describe('heritage-journeyページ: 出発地・到着地の出現回数集計', () => {
  it('出発地・到着地それぞれ出現回数を降順で「都市名 (件数)」形式で表示する', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: SAMPLE_ROUTES }) }));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const startFreq = document.getElementById('registered-routes-start-freq')!;
    const endFreq = document.getElementById('registered-routes-end-freq')!;

    // 出発地: パリ(2), 東京(1) → パリが先
    expect(startFreq.textContent).toContain('パリ (2)');
    expect(startFreq.textContent).toContain('東京 (1)');
    expect(startFreq.textContent!.indexOf('パリ (2)')).toBeLessThan(startFreq.textContent!.indexOf('東京 (1)'));

    // 到着地: ローマ(2), ロンドン(1)
    expect(endFreq.textContent).toContain('ローマ (2)');
    expect(endFreq.textContent).toContain('ロンドン (1)');
    expect(endFreq.textContent!.indexOf('ローマ (2)')).toBeLessThan(endFreq.textContent!.indexOf('ロンドン (1)'));
  });
});

describe('heritage-journeyページ: ID/出発地/到着地/直線距離テーブル', () => {
  it('APIが返した各ルートのうち、現在の#start-city(初期値パリ)と出発地が一致する行だけを表示する', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: SAMPLE_ROUTES }) }));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const body = document.getElementById('registered-routes-table-body')!;
    const rows = body.querySelectorAll('tr');
    // SAMPLE_ROUTESのうちstart==='パリ'はid1,2の2件(id3は東京なので除外される)
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('1');
    expect(rows[0].textContent).toContain('パリ');
    expect(rows[0].textContent).toContain('ローマ');
    expect(rows[0].textContent).toContain('1100.4 km');
    expect(body.textContent).not.toContain('東京');
  });
});

describe('heritage-journeyページ: 到着地ドロップダウンと国旗フィルタ', () => {
  const ROUTES_WITH_COUNTRIES = [
    { id: 1, start: 'パリ', end: 'ローマ', straightKm: 1100.4 },
    { id: 2, start: 'パリ', end: 'ミラノ', straightKm: 640.1 },
    { id: 3, start: 'パリ', end: 'ロンドン', straightKm: 340.2 },
  ];

  async function openModal() {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: ROUTES_WITH_COUNTRIES }) }));
    document.getElementById('view-registered-routes-btn')!.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  }

  it('到着地の全都市リストは初期非表示で、到着地thをタップして初めて表示される', async () => {
    await openModal();
    const menu = document.getElementById('registered-routes-end-dropdown')!;
    expect(menu.hidden).toBe(true);
    expect(menu.textContent).toContain('ローマ (1)');

    document.getElementById('registered-routes-end-th-btn')!.click();
    expect(menu.hidden).toBe(false);
  });

  it('表の到着地名の直前に所属国の国旗を表示する', async () => {
    await openModal();
    const romeCell = document.querySelector('[data-route-end="ローマ"] td:nth-child(3)')!;
    const londonCell = document.querySelector('[data-route-end="ロンドン"] td:nth-child(3)')!;
    expect(romeCell.textContent).toBe('🇮🇹 ローマ');
    expect(londonCell.textContent).toBe('🇬🇧 ロンドン');
  });

  it('国旗選択肢は先頭が「なし」で、表内の国旗総数の降順に並ぶ', async () => {
    await openModal();
    document.getElementById('registered-routes-end-th-btn')!.click();
    const select = document.querySelector<HTMLSelectElement>('#registered-routes-country-filter')!;
    const options = Array.from(select.options).map((option) => option.textContent);
    expect(options[0]).toBe('なし');
    expect(options.slice(1)).toEqual(['🇮🇹 (2)', '🇬🇧 (1)']);
  });

  it('選択した国旗の到着地行だけを表示し、「なし」で全件に戻す', async () => {
    await openModal();
    const select = document.querySelector<HTMLSelectElement>('#registered-routes-country-filter')!;
    select.value = 'イタリア';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelectorAll('#registered-routes-table-body .registered-routes-row')).toHaveLength(2);
    expect(document.getElementById('registered-routes-table-body')!.textContent).not.toContain('ロンドン');

    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelectorAll('#registered-routes-table-body .registered-routes-row')).toHaveLength(3);
  });
});

describe('heritage-journeyページ: 登録済みルートから巡回スコープを選択', () => {
  it('モーダル領域をタップすると巡回ルートスコープと宿泊推奨地を下のレイヤーへ戻す', () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: SAMPLE_ROUTES }) }));
    document.getElementById('view-registered-routes-btn')!.click();
    const overlay = document.getElementById('registered-routes-modal-overlay') as HTMLElement;
    const miniPanel = document.getElementById('tour-mini-panel') as HTMLElement;
    const lodgingModal = document.getElementById('lodging-recommend-modal') as HTMLElement;

    miniPanel.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    lodgingModal.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(Number(lodgingModal.style.zIndex)).toBeGreaterThan(Number(overlay.style.zIndex));

    document.getElementById('registered-routes-modal-box')!
      .dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(Number(overlay.style.zIndex)).toBeGreaterThan(Number(miniPanel.style.zIndex));
    expect(Number(overlay.style.zIndex)).toBeGreaterThan(Number(lodgingModal.style.zIndex));
  });

  it('巡回ルートスコープ(#tour-mini-panel、left:12px幅280px)の右端に接し、ページ最上段に揃う座標へモーダルを配置する', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: SAMPLE_ROUTES }) }));
    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    const box = document.getElementById('registered-routes-modal-box') as HTMLElement;
    expect(box.style.left).toBe('292px');
    expect(box.style.top).toBe('12px');
  });

  it('ヘッダをドラッグするとモーダルを自由な位置へ移動できる', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: SAMPLE_ROUTES }) }));
    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    const box = document.getElementById('registered-routes-modal-box') as HTMLElement;
    const head = document.getElementById('registered-routes-modal-head') as HTMLElement;
    box.getBoundingClientRect = () => ({ left: 292, top: 12, right: 592, bottom: 300, width: 300, height: 288, x: 292, y: 12, toJSON() {} }) as DOMRect;

    head.dispatchEvent(new MouseEvent('mousedown', { clientX: 300, clientY: 20, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 220, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(box.style.left).toBe('492px');
    expect(box.style.top).toBe('212px');
  });

  it('現在の出発地に該当する行を経由データ総数の降順（同数なら直線距離順）に並べ、行末に総数を表示する', async () => {
    const routes = [
      { id: 20, start: 'パリ', end: 'ロンドン', straightKm: 340.2, waypointSetCount: 5 },
      { id: 10, start: 'パリ', end: 'ローマ', straightKm: 1100.4, waypointSetCount: 2 },
      { id: 30, start: 'パリ', end: 'ブリュッセル', straightKm: 263.8, waypointSetCount: 5 },
    ];
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes }) }));
    document.getElementById('view-registered-routes-btn')!.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const ids = Array.from(document.querySelectorAll('#registered-routes-table-body tr'))
      .map((row) => row.querySelector('td')!.textContent);
    expect(ids).toEqual(['20', '30', '10']);
    const counts = Array.from(document.querySelectorAll('#registered-routes-table-body tr'))
      .map((row) => row.lastElementChild!.textContent);
    expect(counts).toEqual(['5', '5', '2']);
  });

  it('各行をタップするたびに出発地・到着地と巡回ルートスコープ見出しが切り替わり、モーダルは開いたままになる', async () => {
    const { fetchMock } = setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: SAMPLE_ROUTES }) }));
    document.getElementById('view-registered-routes-btn')!.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const londonRow = document.querySelector('[data-route-end="ロンドン"]') as HTMLElement;
    londonRow.click();
    expect((document.getElementById('start-city') as HTMLSelectElement).value).toBe('Paris');
    expect((document.getElementById('end-city') as HTMLSelectElement).value).toBe('London');
    expect(document.getElementById('tour-mini-head')!.textContent).toContain('パリ');
    expect(document.getElementById('tour-mini-head')!.textContent).toContain('ロンドン');
    expect(document.getElementById('registered-routes-modal-overlay')!.classList.contains('open')).toBe(true);

    const romeRow = document.querySelector('[data-route-end="ローマ"]') as HTMLElement;
    romeRow.click();
    expect((document.getElementById('end-city') as HTMLSelectElement).value).toBe('Rome');
    expect(document.getElementById('tour-mini-head')!.textContent).toContain('ローマ');

    // 同じ登録済みルートを再選択しても、保存済み経由データの最新行を毎回取得する。
    romeRow.click();
    const latestCalls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/latest-waypoint-set?') === 0);
    expect(latestCalls).toHaveLength(3);
  });
});

describe('heritage-journeyページ: 経由地データありの行を薄緑色でハイライト', () => {
  const ROUTES_WITH_WAYPOINT_FLAG = [
    { id: 1, start: 'パリ', end: 'ローマ', straightKm: 1100.4, hasWaypointSet: true },
    { id: 2, start: 'パリ', end: 'ロンドン', straightKm: 340.2, hasWaypointSet: false },
    { id: 3, start: '東京', end: 'ローマ', straightKm: 9600.1, hasWaypointSet: true },
  ];

  it('hasWaypointSet:trueの行だけregistered-routes-has-waypointクラスが付き、falseの行には付かない', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: ROUTES_WITH_WAYPOINT_FLAG }) }));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const body = document.getElementById('registered-routes-table-body')!;
    const rows = body.querySelectorAll('tr');
    // start==='パリ'のid1,2のみ表示される(id3は東京なのでフィルタで除外)
    expect(rows.length).toBe(2);
    expect(rows[0].classList.contains('registered-routes-has-waypoint')).toBe(true);
    expect(rows[1].classList.contains('registered-routes-has-waypoint')).toBe(false);
  });

  it('ハイライト行(registered-routes-has-waypoint)のtd文字色は.in-course同様の濃色(#064e3b)で、非ハイライト行の文字色は変更されない', () => {
    const html = getHeritageJourneyPage();
    const highlightTextMatch = html.match(/\.registered-routes-has-waypoint td\{color:(#[0-9a-fA-F]{3,6})\}/);
    const inCourseMatch = html.match(/\.heritage-add-name\.in-course\{background:#[0-9a-fA-F]{3,6};color:(#[0-9a-fA-F]{3,6})/);
    expect(highlightTextMatch).not.toBeNull();
    expect(inCourseMatch).not.toBeNull();
    expect(highlightTextMatch![1]).toBe(inCourseMatch![1]);
    expect(highlightTextMatch![1]).toBe('#064e3b');
    // 通常行(th/td)の文字色トークン(#cbd5e1)は従来通り維持されている
    expect(html).toContain('.registered-routes-table th,.registered-routes-table td{border:1px solid #334155;padding:4px 8px;text-align:left;color:#cbd5e1}');
  });

  it('registered-routes-has-waypointクラスの背景色は.in-course(#bbf7d0)と同じ既存の薄緑トークンを再利用している', () => {
    const html = getHeritageJourneyPage();
    const inCourseMatch = html.match(/\.heritage-add-name\.in-course\{background:(#[0-9a-fA-F]{3,6});/);
    const hasWaypointMatch = html.match(/\.registered-routes-has-waypoint\{background:(#[0-9a-fA-F]{3,6})\}/);
    expect(inCourseMatch).not.toBeNull();
    expect(hasWaypointMatch).not.toBeNull();
    expect(hasWaypointMatch![1]).toBe(inCourseMatch![1]);
    expect(hasWaypointMatch![1]).toBe('#bbf7d0');
  });

  it('hasWaypointSetが未定義(古いキャッシュ応答等)でも例外を投げず、ハイライトなしで表示する', async () => {
    const ROUTES_WITHOUT_FLAG = [
      { id: 1, start: 'パリ', end: 'ローマ', straightKm: 1100.4 },
    ];
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: ROUTES_WITHOUT_FLAG }) }));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    expect(() => btn.click()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const body = document.getElementById('registered-routes-table-body')!;
    const rows = body.querySelectorAll('tr');
    expect(rows.length).toBe(1);
    expect(rows[0].classList.contains('registered-routes-has-waypoint')).toBe(false);
  });
});

describe('heritage-journeyページ: 登録済みルートテーブルの出発地フィルタ', () => {
  const MULTI_CITY_ROUTES = [
    { id: 1, start: 'パリ', end: 'ローマ', straightKm: 1100.4 },
    { id: 2, start: 'パリ', end: 'ロンドン', straightKm: 340.2 },
    { id: 3, start: '東京', end: 'ローマ', straightKm: 9600.1 },
    { id: 4, start: 'ロンドン', end: 'パリ', straightKm: 340.2 },
  ];

  it('#start-cityの現在値(パリ)と一致する行だけを表示し、他の出発地の行は表示しない', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: MULTI_CITY_ROUTES }) }));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const body = document.getElementById('registered-routes-table-body')!;
    const rows = body.querySelectorAll('tr');
    expect(rows.length).toBe(2);
    const ids = Array.from(rows).map((row) => row.querySelector('td')!.textContent);
    expect(ids).toEqual(['1', '2']);
    expect(body.textContent).not.toContain('東京');
  });

  it('#start-cityを変更してからモーダルを開くと、新しい出発地(ロンドン)で再フィルタされる(開いたまま裏を操作するライブ同期ではなく、開く/再取得のたびに現在値を読み直す実装)', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: MULTI_CITY_ROUTES }) }));
    await new Promise((r) => setTimeout(r, 0));

    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    startSel.value = 'London';
    startSel.dispatchEvent(new Event('change'));

    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const body = document.getElementById('registered-routes-table-body')!;
    const rows = body.querySelectorAll('tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('ロンドン');
    expect(rows[0].textContent).toContain('4');
  });

  it('現在の出発地に一致する登録済みルートが0件の場合、空テーブルではなく出発地名を含む案内メッセージを表示する', async () => {
    const ROUTES_ONLY_TOKYO = [
      { id: 9, start: '東京', end: 'ローマ', straightKm: 9600.1 },
    ];
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: ROUTES_ONLY_TOKYO }) }));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const body = document.getElementById('registered-routes-table-body')!;
    // 初期値の#start-cityは'パリ'なので、東京のみのルートは全て除外される
    expect(body.textContent).toContain('パリ');
    expect(body.textContent).toContain('登録済みルートはありません');
    expect(body.textContent).not.toContain('東京');
  });
});

describe('heritage-journeyページ: モーダルを閉じる操作', () => {
  it('閉じるボタン・背景クリック・Escapeキーでそれぞれモーダルが閉じる', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: SAMPLE_ROUTES }) }));
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    const overlay = document.getElementById('registered-routes-modal-overlay') as HTMLElement;
    const closeBtn = document.getElementById('registered-routes-modal-close') as HTMLButtonElement;

    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(overlay.classList.contains('open')).toBe(true);
    closeBtn.click();
    expect(overlay.classList.contains('open')).toBe(false);

    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(overlay.classList.contains('open')).toBe(true);
    overlay.dispatchEvent(new Event('click', { bubbles: true }));
    Object.defineProperty(overlay, 'target', {});
    overlay.click();
    expect(overlay.classList.contains('open')).toBe(false);

    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(overlay.classList.contains('open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.classList.contains('open')).toBe(false);
  });
});

describe('heritage-journeyページ: サーバーエラー・空リストの扱い', () => {
  it('エラーレスポンスでも例外を投げず、空表示になる', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: [], error: 'DB unavailable' }) }));
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    expect(() => btn.click()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const body = document.getElementById('registered-routes-table-body')!;
    expect(body.textContent).toContain('登録済みルートはありません');
    const startFreq = document.getElementById('registered-routes-start-freq')!;
    expect(startFreq.textContent).toContain('データがありません');
  });

  it('fetch自体が失敗(reject)しても例外を投げず処理が継続する', async () => {
    setupPage(() => Promise.reject(new Error('network error')));
    await new Promise((r) => setTimeout(r, 0));
    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    expect(() => btn.click()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const overlay = document.getElementById('registered-routes-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
  });
});
