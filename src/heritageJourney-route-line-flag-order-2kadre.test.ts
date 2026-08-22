// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「ルート順序」パネル(#route-line)、および
// 「🌐 巡回テスト」モーダル内のルート順序サイドパネル(#tour-route-side-list)の
// 各行における国旗(.wp-flag)の表示位置。
//
// 変更前は各行内で「アイコン(名称)バッジ → 国旗」の順(バッジ→国旗)だったが、
// 行と行の間の区切り(.wp-arrow「→」)の直後に来る要素が国旗になるよう、
// 「国旗 → アイコン(名称)バッジ」の順に並び替える。サイドパネルにも
// 同じ表示ルール(国旗をアイコン/名称の直前に置く)を適用する。
//
// 故障シナリオ:
//   (1) #route-lineの行内で国旗がバッジより後ろに残ってしまう(並び替え漏れ)
//   (2) 国旗が空("")の地点で空のwp-flag要素が残ってしまう(既存仕様の破壊)
//   (3) サイドパネル側に国旗自体が反映されない、またはnum/checkboxより前に
//       置かれてしまう(先頭のインジケータより前に来てはならない)
//   (4) 出発地・到着地(isEndpoint行)で国旗の並びだけ異なる特別扱いになる

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function routeItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll('#route-line .route-line-item')) as HTMLElement[];
}

describe('heritage-journeyページ: ルート順序パネルの国旗表示位置', () => {
  it('#route-lineの各行で国旗(.wp-flag)がバッジ(.wp-badge/.wp-badge-fixed)より前に来る', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const items = routeItems();
    expect(items.length).toBeGreaterThan(0);
    const withFlag = items.filter((it) => it.querySelector('.wp-flag'));
    expect(withFlag.length).toBeGreaterThan(0);
    withFlag.forEach((it) => {
      const children = Array.from(it.children);
      const flagIdx = children.findIndex((c) => c.classList.contains('wp-flag'));
      const badgeIdx = children.findIndex((c) => c.classList.contains('wp-badge') || c.classList.contains('wp-badge-fixed'));
      expect(flagIdx).toBeGreaterThanOrEqual(0);
      expect(badgeIdx).toBeGreaterThanOrEqual(0);
      expect(flagIdx).toBeLessThan(badgeIdx);
    });
  });

  it('出発地・到着地(固定マーカー行)でも国旗が固定マーカーより前に来る', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const items = routeItems();
    const first = items[0];
    const last = items[items.length - 1];
    [first, last].forEach((it) => {
      const flag = it.querySelector('.wp-flag');
      const fixed = it.querySelector('.wp-badge-fixed');
      expect(fixed).not.toBeNull();
      if (flag) {
        expect(flag.compareDocumentPosition(fixed!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });
  });

  it('国旗が空の地点ではwp-flag要素が描画されない(既存挙動を維持)', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const items = routeItems();
    items.forEach((it) => {
      const flag = it.querySelector('.wp-flag');
      if (flag) expect((flag.textContent || '').length).toBeGreaterThan(0);
    });
  });
});

describe('heritage-journeyページ: 巡回テストサイドパネルの国旗表示位置', () => {
  function sideRows(): HTMLElement[] {
    return Array.from(document.querySelectorAll('#tour-route-side-list .tour-route-side-row')) as HTMLElement[];
  }

  it('#tour-route-side-listの各行にも国旗(.wp-flag)が表示され、num/checkboxより後、アイコン(名称)より前に来る', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const rows = sideRows();
    expect(rows.length).toBeGreaterThan(0);
    const withFlag = rows.filter((r) => r.querySelector('.wp-flag'));
    expect(withFlag.length).toBeGreaterThan(0);
    withFlag.forEach((row) => {
      const num = row.querySelector('.tour-route-side-num');
      const flag = row.querySelector('.wp-flag')!;
      const checkbox = row.querySelector('.tour-route-side-check');
      expect(num).not.toBeNull();
      expect(checkbox).not.toBeNull();
      // numとcheckboxは国旗より前(DOM順)にあること
      expect(num!.compareDocumentPosition(flag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(checkbox!.compareDocumentPosition(flag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // 国旗の直後にアイコン/名称のテキストが続く(国旗が最後の要素ではない)
      expect(flag.nextSibling).not.toBeNull();
    });
  });
});
