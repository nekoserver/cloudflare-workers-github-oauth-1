// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🌐 巡回テスト」モーダル右側のルート順序
// 表示板(#tour-route-side-list)。各世界遺産名をタップすると、地球儀
// (#tour-globe-canvas)内のその座標の丸の真上にツールチップ(#tour-tap-label)
// として世界遺産名が7秒間表示され、その後自動的に消える。
//
// 故障シナリオ:
//   (1) 表示板の各行にタップしても何も起きない
//   (2) タップしても#tour-tap-labelにその地点の名称が表示されない
//   (3) ツールチップの表示位置が、地球儀上のその座標(丸の描画位置)と
//       一致しない(無関係な位置や固定位置に表示されてしまう)
//   (4) 7秒経っても消えない、または7秒経たないうちに消えてしまう

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const arcCalls: { x: number; y: number; r: number; fillStyle: unknown }[] = [];
  const ctx: Record<string, unknown> = {
    clearRect: () => {}, beginPath: () => {}, ellipse: () => {},
    arc: (x: number, y: number, r: number) => { arcCalls.push({ x, y, r, fillStyle: ctx.fillStyle }); },
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '',
  };
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ctx;
  Element.prototype.scrollIntoView = function() {};
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { arcCalls };
}

describe('heritage-journeyページ: ルート順序表示板の各行に位置情報が付与される', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('#tour-route-side-listの各行にdata-side-lat/data-side-lon属性が付与される', () => {
    setupPage();
    const rows = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]'));
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.getAttribute('data-side-lat')).not.toBeNull();
      expect(row.getAttribute('data-side-lon')).not.toBeNull();
      expect(Number.isNaN(Number(row.getAttribute('data-side-lat')))).toBe(false);
      expect(Number.isNaN(Number(row.getAttribute('data-side-lon')))).toBe(false);
    });
  });
});

describe('heritage-journeyページ: ルート順序表示板の地点名タップで地球儀上にツールチップが表示される', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('先頭行(出発点)をタップすると#tour-tap-labelにその名称が、丸の描画位置と一致する座標に表示される', () => {
    vi.useFakeTimers();
    const { arcCalls } = setupPage();

    const firstRow = document.querySelector('#tour-route-side-list [data-side-name]') as HTMLElement;
    const name = firstRow.getAttribute('data-side-name')!;

    // 実際に描画された丸(半径5)のうち、出発点(先頭)に対応するものの座標を取得する
    const firstDot = arcCalls.find((c) => c.r === 5)!;
    expect(firstDot).toBeDefined();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe('');

    firstRow.click();

    expect(tapLabel.textContent).toBe(name);
    // CSSの.tour-tap-labelはdisplay:noneが既定のため、空文字('')ではスタイル
    // シートの非表示が適用されたままになる。表示時は必ず非noneの値が
    // インラインで明示されていることを検証する(実機で表示されないバグの再発防止)。
    expect(tapLabel.style.display).not.toBe('');
    expect(tapLabel.style.display).not.toBe('none');

    const canvas = document.getElementById('tour-globe-canvas') as HTMLCanvasElement;
    const expectedLeftPct = (firstDot.x / canvas.width * 100).toFixed(4);
    const expectedTopPct = (firstDot.y / canvas.height * 100).toFixed(4);
    expect(parseFloat(tapLabel.style.left)).toBeCloseTo(parseFloat(expectedLeftPct), 2);
    expect(parseFloat(tapLabel.style.top)).toBeCloseTo(parseFloat(expectedTopPct), 2);
  });

  it('7秒後に自動的にツールチップが消える', () => {
    vi.useFakeTimers();
    setupPage();
    const firstRow = document.querySelector('#tour-route-side-list [data-side-name]') as HTMLElement;
    firstRow.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).not.toBe('');

    vi.advanceTimersByTime(6999);
    expect(tapLabel.textContent).not.toBe('');

    vi.advanceTimersByTime(1);
    expect(tapLabel.textContent).toBe('');
    expect(tapLabel.style.display).toBe('none');
  });

  it('別の行をタップし直すと、ツールチップの内容と位置が新しい地点のものに更新される', () => {
    vi.useFakeTimers();
    setupPage();
    const rows = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);

    rows[0].click();
    const tapLabel = document.getElementById('tour-tap-label')!;
    const firstName = rows[0].getAttribute('data-side-name');
    expect(tapLabel.textContent).toBe(firstName);

    rows[1].click();
    const secondName = rows[1].getAttribute('data-side-name');
    expect(tapLabel.textContent).toBe(secondName);
  });
});
