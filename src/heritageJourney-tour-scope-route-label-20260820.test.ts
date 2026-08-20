// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「巡回ルートスコープ」表記
// (ミニ地球儀プレビューの見出し#tour-mini-head、および巡回テストモーダルの
// タイトル#tour-scope-title)。従来は両方とも静的な「🌐 巡回テスト」だったが、
// 「出発地から見た目的地別プラン分布」の都市チップクリック等で出発地/到着地が
// 変わったとき、実際のルート「(国旗)出発地名 - (国旗)到着地名」を表示するよう
// 変更した(recompute()内のupdateTourScopeHeaderLabel()経由)。
//
// 故障シナリオ:
//   (1) 分布チップ経由でend-cityが変わってもヘッダが更新されない
//       (chip固有の処理にしか組み込まれていない場合に起きる)
//   (2) start-city変更(出発地)経由ではヘッダが更新されない
//       (recompute()レベルではなくchip固有ハンドラにのみ組み込んだ場合に起きる)
//   (3) 都市が解決できない(CITIESに存在しない値)場合にクラッシュする、
//       または壊れた文字列("undefined - パリ"等)を表示してしまう
//   (4) ヘッダのテキスト変更によって#tour-mini-headのドラッグ用イベント
//       リスナー(pointerdown等)が巻き添えで失われる

function setupPage(fetchImpl: (input: unknown, init?: unknown) => Promise<{ json: () => Promise<unknown> }> = () =>
  Promise.resolve({ json: () => Promise.resolve({ exists: false }) })) {
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

function openBucketWithChips(): HTMLElement {
  const rows = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
  for (const row of rows) {
    row.dispatchEvent(new Event('click', { bubbles: true }));
    const idx = row.getAttribute('data-bucket');
    const citiesEl = document.getElementById('dist-cities-' + idx) as HTMLElement;
    if (citiesEl.querySelector('.dist-city-chip')) return citiesEl;
  }
  throw new Error('チップを持つバケットが見つかりません(テストデータ側の問題)');
}

describe('heritage-journeyページ: 巡回ルートスコープのヘッダラベル', () => {
  it('初期表示(デフォルトのパリ→ローマ)で#tour-mini-headと#tour-scope-titleが「🇫🇷パリ - 🇮🇹ローマ」になる', () => {
    setupPage();
    const miniHead = document.getElementById('tour-mini-head') as HTMLElement;
    const modalTitle = document.getElementById('tour-scope-title') as HTMLElement;
    expect(miniHead.textContent).toBe('🇫🇷パリ - 🇮🇹ローマ');
    expect(modalTitle.textContent).toBe('🇫🇷パリ - 🇮🇹ローマ');
  });

  it('分布チップクリックで到着地を変更すると、両ヘッダの到着地側だけが更新される(出発地側は不変)', () => {
    setupPage();
    const citiesEl = openBucketWithChips();
    const chip = citiesEl.querySelector('.dist-city-chip') as HTMLButtonElement;
    expect(chip).not.toBeNull();

    chip.dispatchEvent(new Event('click', { bubbles: true }));

    const endSel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    const miniHead = document.getElementById('tour-mini-head') as HTMLElement;
    const modalTitle = document.getElementById('tour-scope-title') as HTMLElement;

    expect(miniHead.textContent).toContain('🇫🇷パリ - ');
    expect(miniHead.textContent).not.toBe('🇫🇷パリ - 🇮🇹ローマ');
    expect(miniHead.textContent).toBe(modalTitle.textContent);
    expect(endSel.value).toBe(chip.getAttribute('data-city'));
  });

  it('出発地(#start-city)を変更しても両ヘッダが更新される(recompute()レベルの汎用配線であることの確認)', () => {
    setupPage();
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    const options = Array.from(startSel.options).map((o) => o.value);
    const otherStart = options.find((v) => v !== startSel.value);
    expect(otherStart).toBeTruthy();

    startSel.value = otherStart as string;
    startSel.dispatchEvent(new Event('change', { bubbles: true }));

    const miniHead = document.getElementById('tour-mini-head') as HTMLElement;
    const modalTitle = document.getElementById('tour-scope-title') as HTMLElement;
    expect(miniHead.textContent).not.toBe('🌐 巡回テスト');
    expect(miniHead.textContent).toContain(' - 🇮🇹ローマ');
    expect(miniHead.textContent).toBe(modalTitle.textContent);
  });

  it('#tour-mini-headのドラッグ挙動はヘッダ文言変更後も維持される(既存ドラッグ機能の回帰確認)', () => {
    setupPage();
    const panel = document.getElementById('tour-mini-panel') as HTMLElement;
    panel.style.display = 'block';
    panel.style.left = '10px';
    panel.style.top = '10px';
    const head = document.getElementById('tour-mini-head') as HTMLElement;

    head.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 30, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 230, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(parseInt(panel.style.left, 10)).toBeGreaterThan(10);
    expect(parseInt(panel.style.top, 10)).toBeGreaterThan(10);
  });
});
