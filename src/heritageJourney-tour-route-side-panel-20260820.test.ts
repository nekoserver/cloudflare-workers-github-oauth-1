// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🌐 巡回テスト」モーダルが表示された際、
// モーダルの右側と画面端の間に表示するルート順序サイドパネル
// (#tour-route-side-panel / #tour-route-side-list)。#route-lineと同じ
// 出発点から順の並びで各世界遺産名を縦に列挙し、グレーアウト
// (routeLineExcluded)の状態も#route-lineと同期させる。また巡回中は
// 「次の目的地」の行に薄黄色の枠でフォーカスし、フォーカスが別の地点に
// 移るたびにその行の枠を3回点滅させる。
//
// 故障シナリオ:
//   (1) サイドパネルがマークアップに存在しない、または#route-lineと
//       並び順・地点数が食い違う
//   (2) #route-lineでグレーアウトを切り替えてもサイドパネル側が
//       グレーアウトのまま/解除されないままになる
//   (3) 巡回中に「次の目的地」の行にフォーカス(枠色)が当たらない
//   (4) フォーカスが同じ地点にとどまっている間も毎回点滅してしまう
//       (点滅は地点が切り替わった瞬間だけであるべき)
//   (5) 巡回終了(最後の地点に到着)後もどこかの行にフォーカスが
//       残り続けてしまう

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

describe('heritage-journeyページ: 巡回テストモーダルのルート順序サイドパネル', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('#tour-route-side-panel/#tour-route-side-listがモーダル内(overlay直下)にマークアップされる', () => {
    setupPage();
    const overlay = document.getElementById('tour-modal-overlay')!;
    const panel = document.getElementById('tour-route-side-panel');
    expect(panel).not.toBeNull();
    expect(overlay.contains(panel)).toBe(true);
    expect(document.getElementById('tour-route-side-list')).not.toBeNull();
  });

  it('サイドパネルの並び順・地点数は#route-lineと一致する(出発点から順)', () => {
    setupPage();
    const routeNames = Array.from(document.querySelectorAll('#route-line [data-wp-name]')).map((el) => el.getAttribute('data-wp-name'));
    const sideNames = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]')).map((el) => el.getAttribute('data-side-name'));
    expect(sideNames).toEqual(routeNames);
    expect(sideNames.length).toBeGreaterThan(0);
  });

  it('#route-lineでグレーアウトを切り替えると、サイドパネル側の該当行も同期してグレーアウトする', () => {
    setupPage();
    const routeBtn = document.querySelector('#route-line [data-wp-name]') as HTMLButtonElement;
    const name = routeBtn.getAttribute('data-wp-name')!;
    const sideRow = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]'))
      .find((el) => el.getAttribute('data-side-name') === name)!;
    expect(sideRow.classList.contains('off')).toBe(false);

    routeBtn.click();
    expect(routeBtn.classList.contains('wp-badge-off')).toBe(true);
    expect(sideRow.classList.contains('off')).toBe(true);

    routeBtn.click();
    expect(sideRow.classList.contains('off')).toBe(false);
  });
});

describe('巡回テストモーダル: ルート順序サイドパネルの次の目的地フォーカス・点滅(純粋関数)', () => {
  function loadFocusFns(html: string) {
    function extractFn(name: string, argsPattern: string): string {
      const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n  \\}');
      const m = html.match(re);
      if (!m) throw new Error(name + ' が生成HTMLから見つからない');
      return m[0];
    }
    const src = [
      'var nextLabel = { textContent: "" };',
      'var tourPoints = [];',
      'var animProgress = 0;',
      'var lastFocusedSideName = null;',
      extractFn('updateRouteSideFocus', 'name'),
      extractFn('updateNextLabel', ''),
      'return { updateNextLabel: updateNextLabel, setState: function(pts, prog) { tourPoints = pts; animProgress = prog; } };',
    ].join('\n');
    // eslint-disable-next-line no-new-func
    return new Function(src)() as {
      updateNextLabel: () => void;
      setState: (pts: { name: string }[], prog: number) => void;
    };
  }

  function setupRows() {
    document.body.innerHTML = '<div id="tour-route-side-list">'
      + '<div class="tour-route-side-row" data-side-name="A"></div>'
      + '<div class="tour-route-side-row" data-side-name="B"></div>'
      + '<div class="tour-route-side-row" data-side-name="C"></div>'
      + '</div>';
  }

  afterEach(() => { document.body.innerHTML = ''; });

  it('区間移動中は次の目的地の行に.focused/.blinkが付く', () => {
    setupRows();
    const html = getHeritageJourneyPage();
    const fns = loadFocusFns(html);
    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 0.5);
    fns.updateNextLabel();

    const rowA = document.querySelector('[data-side-name="A"]')!;
    const rowB = document.querySelector('[data-side-name="B"]')!;
    const rowC = document.querySelector('[data-side-name="C"]')!;
    expect(rowB.classList.contains('focused')).toBe(true);
    expect(rowB.classList.contains('blink')).toBe(true);
    expect(rowA.classList.contains('focused')).toBe(false);
    expect(rowC.classList.contains('focused')).toBe(false);
  });

  it('フォーカスが次の地点へ切り替わると、前の地点の枠は消え新しい地点の枠が点滅する', () => {
    setupRows();
    const html = getHeritageJourneyPage();
    const fns = loadFocusFns(html);
    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 0.5);
    fns.updateNextLabel();

    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 1.5);
    fns.updateNextLabel();

    const rowB = document.querySelector('[data-side-name="B"]')!;
    const rowC = document.querySelector('[data-side-name="C"]')!;
    expect(rowB.classList.contains('focused')).toBe(false);
    expect(rowC.classList.contains('focused')).toBe(true);
    expect(rowC.classList.contains('blink')).toBe(true);
  });

  it('巡回開始前・最後の地点への到着後はどの行にもフォーカスが当たらない', () => {
    setupRows();
    const html = getHeritageJourneyPage();
    const fns = loadFocusFns(html);
    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 0);
    fns.updateNextLabel();
    expect(document.querySelectorAll('#tour-route-side-list .focused').length).toBe(0);

    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 1.5);
    fns.updateNextLabel();
    expect(document.querySelectorAll('#tour-route-side-list .focused').length).toBe(1);

    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 2);
    fns.updateNextLabel();
    expect(document.querySelectorAll('#tour-route-side-list .focused').length).toBe(0);
  });
});
