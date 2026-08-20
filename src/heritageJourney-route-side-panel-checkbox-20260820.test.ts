// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページのルート順序表示板(#tour-route-side-list)の
// 各行、番号の右側に設置したチェックボックス(data-side-check-name)。
// OFFにすると#route-lineのバッジと同じくグレーアウト(routeLineExcluded)
// 状態がトグルされ、地球儀上のその地点の丸が消え、巡回線もその地点を
// 経由せず前後の地点を直接結ぶようになる(tourPointsから除外されるため)。
//
// 故障シナリオ:
//   (1) チェックボックスが各行にマークアップされない
//   (2) チェックボックスを操作してもrouteLineExcludedがトグルされない
//   (3) チェックボックス操作が同じ行のタップ(地球儀上へのツールチップ表示)
//       と干渉し、意図しない動作(両方同時発火/どちらも発火しない)になる
//   (4) チェックボックスでOFFにした地点が地球儀の丸(tourPoints)から
//       外れない
//   (5) #route-line側のバッジと状態が食い違う(サイドパネルのチェック
//       ボックスと#route-lineのグレーアウト表示が同期しない)

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

describe('heritage-journeyページ: ルート順序表示板のチェックボックスのマークアップ', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('各行の番号の右側にチェックボックスが表示され、初期状態はON(checked)', () => {
    setupPage();
    const rows = Array.from(document.querySelectorAll('#tour-route-side-list .tour-route-side-row'));
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      const num = row.querySelector('.tour-route-side-num')!;
      const check = row.querySelector('[data-side-check-name]') as HTMLInputElement;
      expect(check).not.toBeNull();
      expect(check.type).toBe('checkbox');
      expect(check.checked).toBe(true);
      // 番号の直後にチェックボックスが配置されている(DOM順序)
      expect(num.nextElementSibling).toBe(check);
    });
  });
});

describe('heritage-journeyページ: チェックボックスOFFで地球儀の丸・巡回線が消え、#route-lineと同期する', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('チェックボックスをOFFにすると、その行はグレーアウトされ#route-line側のバッジも同期する', () => {
    setupPage();
    const check = document.querySelector('#tour-route-side-list [data-side-check-name]') as HTMLInputElement;
    const name = check.getAttribute('data-side-check-name')!;

    check.checked = false;
    check.dispatchEvent(new Event('change', { bubbles: true }));

    const rowAfter = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]'))
      .find((el) => el.getAttribute('data-side-name') === name)!;
    expect(rowAfter.classList.contains('off')).toBe(true);

    const routeBtn = Array.from(document.querySelectorAll('#route-line [data-wp-name]'))
      .find((el) => el.getAttribute('data-wp-name') === name)!;
    expect(routeBtn.classList.contains('wp-badge-off')).toBe(true);
  });

  it('チェックボックスをOFFにした地点は地球儀の巡回対象(tourPoints)から外れ、丸が消える', () => {
    const { arcCalls, name } = (() => {
      const html = getHeritageJourneyPage();
      document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
      const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
      const calls: { x: number; y: number; r: number }[] = [];
      const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
      proto.getContext = () => ({
        clearRect: () => {}, beginPath: () => {}, ellipse: () => {},
        arc: (x: number, y: number, r: number) => { calls.push({ x, y, r }); },
        fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
      });
      // eslint-disable-next-line no-new-func
      new Function(scriptSrc)();
      const firstCheck = document.querySelector('#tour-route-side-list [data-side-check-name]') as HTMLInputElement;
      return { arcCalls: calls, name: firstCheck.getAttribute('data-side-check-name')! };
    })();

    // arcCallsは累積されるため、初期描画(1レンダリング分)の丸(半径5)の数を
    // 基準値として切り出しておく
    const lenBeforeToggle = arcCalls.length;
    const countBefore = arcCalls.slice(0, lenBeforeToggle).filter((c) => c.r === 5).length;

    const check = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-check-name]'))
      .find((el) => el.getAttribute('data-side-check-name') === name) as HTMLInputElement;
    check.checked = false;
    check.dispatchEvent(new Event('change', { bubbles: true }));

    // トグル後に新たに追加された描画分(1レンダリング分)だけを見て比較する
    const countAfter = arcCalls.slice(lenBeforeToggle).filter((c) => c.r === 5).length;
    // 丸(半径5)の描画回数が減っている(=対象地点が地球儀から消えている)
    expect(countAfter).toBeLessThan(countBefore);
  });

  it('チェックボックスをクリックしても、同じ行のタップ用ツールチップ(#tour-tap-label)は表示されない', () => {
    setupPage();
    const check = document.querySelector('#tour-route-side-list [data-side-check-name]') as HTMLInputElement;
    check.checked = false;
    check.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    check.dispatchEvent(new Event('change', { bubbles: true }));

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe('');
  });

  it('再度チェックを入れると除外が解除され、行のグレーアウトも解除される', () => {
    setupPage();
    const check = document.querySelector('#tour-route-side-list [data-side-check-name]') as HTMLInputElement;
    const name = check.getAttribute('data-side-check-name')!;

    check.checked = false;
    check.dispatchEvent(new Event('change', { bubbles: true }));
    let row = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]'))
      .find((el) => el.getAttribute('data-side-name') === name)!;
    expect(row.classList.contains('off')).toBe(true);

    const checkAfter = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-check-name]'))
      .find((el) => el.getAttribute('data-side-check-name') === name) as HTMLInputElement;
    checkAfter.checked = true;
    checkAfter.dispatchEvent(new Event('change', { bubbles: true }));

    row = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]'))
      .find((el) => el.getAttribute('data-side-name') === name)!;
    expect(row.classList.contains('off')).toBe(false);
  });
});
