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
// テーブルはID昇順(サーバー側のORDER BY id ASCに依存)で表示する。
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
  it('APIが返した各ルートを1行ずつ、正しい値で表示する', async () => {
    setupPage(() => Promise.resolve({ json: () => Promise.resolve({ routes: SAMPLE_ROUTES }) }));
    await new Promise((r) => setTimeout(r, 0));

    const btn = document.getElementById('view-registered-routes-btn') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const body = document.getElementById('registered-routes-table-body')!;
    const rows = body.querySelectorAll('tr');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('1');
    expect(rows[0].textContent).toContain('パリ');
    expect(rows[0].textContent).toContain('ローマ');
    expect(rows[0].textContent).toContain('1100.4 km');
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
