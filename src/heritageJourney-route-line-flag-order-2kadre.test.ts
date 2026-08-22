// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「ルート順序」パネル(#route-line)、および
// 「🌐 巡回テスト」モーダル内のルート順序サイドパネル(#tour-route-side-list)の
// 各行における国旗(.wp-flag)・アイコンの表示位置。
//
// 変更前は各行内で「アイコン(名称)バッジ → 国旗」の順(バッジ→国旗)だったが、
// 以下の順序に変更する:
//   ・中間の経由地(トグル可能なbutton.wp-badge): 行と行の間の区切り
//     (.wp-arrow「→」)の直後に国旗が来るよう「国旗 → アイコン(名称)バッジ」の
//     順に並び替える。サイドパネルにも同じ表示ルール(国旗をアイコン/名称の
//     直前に置く)を適用する。
//   ・出発地(先頭行)・到着地(最終行)の固定マーカー(.wp-badge-fixed): アイコン
//     (📍/🏁)は先頭のまま、国旗を都市名の直前に移動する
//     (「アイコン 国旗 都市名」の順)。加えて到着地のアイコンは📍から🏁に
//     変更し、出発地(📍)と区別する。
//
// 故障シナリオ:
//   (1) 中間の経由地の行内で国旗がバッジより後ろに残ってしまう(並び替え漏れ)
//   (2) 国旗が空("")の地点で空のwp-flag要素が残ってしまう(既存仕様の破壊)
//   (3) サイドパネル側に国旗自体が反映されない、またはnum/checkboxより前に
//       置かれてしまう(先頭のインジケータより前に来てはならない)
//   (4) 出発地・到着地の固定マーカーでアイコンより国旗が先に来てしまう
//       (アイコンは常に先頭でなければならない)
//   (5) 到着地のアイコンが🏁に変わっていない(出発地の📍のままになっている)

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
  it('中間の経由地の行で国旗(.wp-flag)がバッジ(button.wp-badge)より前に来る', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const items = routeItems();
    expect(items.length).toBeGreaterThanOrEqual(3);
    const middleItems = items.slice(1, -1);
    const withFlag = middleItems.filter((it) => it.querySelector('.wp-flag'));
    expect(withFlag.length).toBeGreaterThan(0);
    withFlag.forEach((it) => {
      const children = Array.from(it.children);
      const flagIdx = children.findIndex((c) => c.classList.contains('wp-flag'));
      const badgeIdx = children.findIndex((c) => c.classList.contains('wp-badge'));
      expect(flagIdx).toBeGreaterThanOrEqual(0);
      expect(badgeIdx).toBeGreaterThanOrEqual(0);
      expect(flagIdx).toBeLessThan(badgeIdx);
    });
  });

  it('出発地(先頭行)の固定マーカーは 📍 国旗 都市名 の順で描画される(アイコンが常に先頭)', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const items = routeItems();
    const first = items[0];
    const marker = first.querySelector('.wp-badge-fixed') as HTMLElement;
    expect(marker).not.toBeNull();
    const html = marker.innerHTML;
    expect(html.indexOf('📍')).toBe(0);
    const flagEl = marker.querySelector('.wp-flag');
    if (flagEl) {
      const flagIdx = html.indexOf(flagEl.outerHTML);
      expect(flagIdx).toBeGreaterThan(0);
      const afterFlag = html.slice(flagIdx + flagEl.outerHTML.length);
      expect(afterFlag.trim().length).toBeGreaterThan(0);
    }
  });

  it('到着地(最終行)の固定マーカーは🏁アイコンに変わり、🏁 国旗 都市名 の順で描画される', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const items = routeItems();
    const last = items[items.length - 1];
    const marker = last.querySelector('.wp-badge-fixed') as HTMLElement;
    expect(marker).not.toBeNull();
    const html = marker.innerHTML;
    expect(html.indexOf('🏁')).toBe(0);
    expect(html.indexOf('📍')).toBe(-1);
    const flagEl = marker.querySelector('.wp-flag');
    if (flagEl) {
      const flagIdx = html.indexOf(flagEl.outerHTML);
      expect(flagIdx).toBeGreaterThan(0);
      const afterFlag = html.slice(flagIdx + flagEl.outerHTML.length);
      expect(afterFlag.trim().length).toBeGreaterThan(0);
    }
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
