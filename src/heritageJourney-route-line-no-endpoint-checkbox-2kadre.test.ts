// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「ルート順序」パネル(#route-line)の各行。
// 出発地(先頭行)・到着地(最終行)にはON/OFFトグルバッジ(button.wp-badge,
// data-wp-name属性)を表示しない。出発地・到着地はルートの起点・終点であり
// 巡回テストから除外する対象になり得ないため、トグル操作自体が無意味かつ
// 誤操作の原因になるので撤去する。中間の経由地(世界遺産/空港/駅)は従来通り
// button.wp-badgeとして表示し、タップでON/OFFをトグルできる。
//
// 故障シナリオ:
//   (1) 出発地・到着地の行にも従来通りbutton.wp-badge(data-wp-name)が
//       描画されてしまう(撤去できていない)
//   (2) 出発地・到着地の名称・国旗・アイコンといった表示自体が消えてしまう
//       (トグル機能だけを消すべきで、行の情報表示は維持する)
//   (3) 中間の経由地からもbutton.wp-badgeが消えてしまう、またはトグルが
//       効かなくなる
//   (4) 「適用する」ボタン(#route-apply-btn)のアクティブ化・適用処理が、
//       出発地・到着地にバッジが無いことでエラーになる、またはbadges配列の
//       長さがordered配列の長さと一致する前提の処理が壊れる
//   (5) 国別フィルタ(applyRouteCountryFilter)が出発地・到着地の行を
//       グレーアウトしようとした際、バッジ要素が無いことで例外を投げる

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
}

function routeItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll('#route-line .route-line-item')) as HTMLElement[];
}

describe('heritage-journeyページ: ルート順序パネルの出発地・到着地にはトグルバッジを描画しない', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('先頭行(出発地)・最終行(到着地)にはbutton.wp-badge(data-wp-name)が存在しない', () => {
    setupPage();
    const items = routeItems();
    expect(items.length).toBeGreaterThanOrEqual(3);
    const first = items[0];
    const last = items[items.length - 1];
    expect(first.querySelector('button.wp-badge[data-wp-name]')).toBeNull();
    expect(last.querySelector('button.wp-badge[data-wp-name]')).toBeNull();
  });

  it('先頭行・最終行にも名称・アイコンの表示は維持される(非interactiveなマーカーとして残る)', () => {
    setupPage();
    const items = routeItems();
    const first = items[0];
    const last = items[items.length - 1];
    const firstMarker = first.querySelector('.wp-badge-fixed');
    const lastMarker = last.querySelector('.wp-badge-fixed');
    expect(firstMarker).not.toBeNull();
    expect(lastMarker).not.toBeNull();
    expect((firstMarker!.textContent || '').trim().length).toBeGreaterThan(0);
    expect((lastMarker!.textContent || '').trim().length).toBeGreaterThan(0);
  });

  it('中間の経由地には従来通りbutton.wp-badge(data-wp-name)が描画され、タップでトグルできる', () => {
    setupPage();
    const items = routeItems();
    expect(items.length).toBeGreaterThanOrEqual(3);
    const middle = items[1];
    const btn = middle.querySelector('button.wp-badge[data-wp-name]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(btn.classList.contains('wp-badge-off')).toBe(true);
  });

  it('先頭行・最終行の固定マーカーをクリックしても何も起きない(トグル不可)', () => {
    setupPage();
    const items = routeItems();
    const first = items[0];
    const marker = first.querySelector('.wp-badge-fixed') as HTMLElement;
    expect(marker.tagName.toLowerCase()).not.toBe('button');
    marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const applyBtn = document.getElementById('route-apply-btn') as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
  });

  it('「適用する」ボタンは中間の経由地のトグルだけでも従来通り機能する', () => {
    setupPage();
    const items = routeItems();
    const middleBtn = items[1].querySelector('button.wp-badge[data-wp-name]') as HTMLButtonElement;
    middleBtn.click();
    const applyBtn = document.getElementById('route-apply-btn') as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);
    applyBtn.click();
    expect(applyBtn.disabled).toBe(true);
  });

  it('国別フィルタを切り替えても出発地・到着地の行(バッジなし)で例外にならない', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = document.getElementById('route-country-filter') as unknown as HTMLSelectElement;
    expect(sel).toBeTruthy();
    if (sel.options.length > 1) {
      expect(() => {
        sel.value = sel.options[1].value;
        sel.dispatchEvent(new Event('change'));
      }).not.toThrow();
      const items = routeItems();
      const first = items[0];
      const last = items[items.length - 1];
      // バッジが無い行でも.route-line-item自体は存在しdimmedクラスの
      // 付け外しでエラーにならないこと
      expect(first).toBeTruthy();
      expect(last).toBeTruthy();
    }
  });
});
