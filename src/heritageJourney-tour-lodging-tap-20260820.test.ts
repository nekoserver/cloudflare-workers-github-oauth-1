// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🌐 巡回テスト」モーダル内の地球儀。
// 経由地点(宿泊予定地)の丸を薄ピンク色で描画し、タップするとその世界遺産名を
// 7秒間表示する(#tour-tap-label)。また巡回中は「次の目的地」の名称を
// (#tour-next-label)、移動中の丸が到着するまで表示し続け、到着と同時に消す。
//
// 故障シナリオ:
//   (1) 宿泊予定地の丸が薄ピンク色で描画されない
//   (2) 丸をタップしても名称が表示されない、または7秒経っても消えない/
//       7秒経たないうちに消えてしまう
//   (3) 「次の目的地」の名称が巡回開始前から表示されてしまう
//   (4) 移動中の丸が次の地点に到着しても名称が消え残る、
//       または到着前に消えてしまう
//   (5) 最後の地点に到着した後も「次の目的地」が表示され続ける

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
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { arcCalls };
}

describe('heritage-journeyページ: 巡回テストモーダルの宿泊予定地の丸は薄ピンク色で描画される', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('経由地点(半径5の丸)の少なくとも1つが薄ピンク色(#f9a8d4)で描画される', () => {
    const { arcCalls } = setupPage();
    const wpCalls = arcCalls.filter((c) => c.r === 5);
    expect(wpCalls.length).toBeGreaterThan(0);
    expect(wpCalls.some((c) => c.fillStyle === '#f9a8d4')).toBe(true);
  });
});

describe('heritage-journeyページ: 宿泊予定地の丸をタップすると名称が7秒間表示される', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('丸をタップすると#tour-tap-labelにその世界遺産名が表示され、7秒後に消える', () => {
    vi.useFakeTimers();
    const { arcCalls } = setupPage();
    const canvas = document.getElementById('tour-globe-canvas') as HTMLCanvasElement;
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, right: canvas.width, bottom: canvas.height,
      width: canvas.width, height: canvas.height, x: 0, y: 0, toJSON: () => ({}),
    });

    const firstWpDot = arcCalls.find((c) => c.r === 5)!;
    expect(firstWpDot).toBeDefined();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe('');

    canvas.dispatchEvent(new MouseEvent('click', { clientX: firstWpDot.x, clientY: firstWpDot.y, bubbles: true }));

    expect(tapLabel.textContent).not.toBe('');
    expect(tapLabel.style.display).not.toBe('none');

    vi.advanceTimersByTime(6999);
    expect(tapLabel.textContent).not.toBe('');

    vi.advanceTimersByTime(1);
    expect(tapLabel.textContent).toBe('');
    expect(tapLabel.style.display).toBe('none');
  });

  it('関係ない場所をタップしても名称は表示されない', () => {
    setupPage();
    const canvas = document.getElementById('tour-globe-canvas') as HTMLCanvasElement;
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, right: canvas.width, bottom: canvas.height,
      width: canvas.width, height: canvas.height, x: 0, y: 0, toJSON: () => ({}),
    });
    const tapLabel = document.getElementById('tour-tap-label')!;
    canvas.dispatchEvent(new MouseEvent('click', { clientX: -9999, clientY: -9999, bubbles: true }));
    expect(tapLabel.textContent).toBe('');
  });
});

describe('巡回テストモーダル: 「次の目的地」表示(純粋関数)', () => {
  function loadNextLabelFn(html: string) {
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
      'function updateRouteSideFocus() {}',
      extractFn('updateNextLabel', ''),
      'return { updateNextLabel: updateNextLabel, setState: function(pts, prog) { tourPoints = pts; animProgress = prog; }, getNextLabel: function() { return nextLabel; } };',
    ].join('\n');
    // eslint-disable-next-line no-new-func
    return new Function(src)() as {
      updateNextLabel: () => void;
      setState: (pts: { name: string }[], prog: number) => void;
      getNextLabel: () => { textContent: string };
    };
  }

  it('巡回開始前(animProgress=0)は「次の目的地」を表示しない', () => {
    const html = getHeritageJourneyPage();
    const fns = loadNextLabelFn(html);
    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 0);
    fns.updateNextLabel();
    expect(fns.getNextLabel().textContent).toBe('');
  });

  it('区間を移動中は次の地点の名称を表示し続ける', () => {
    const html = getHeritageJourneyPage();
    const fns = loadNextLabelFn(html);
    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 0.5);
    fns.updateNextLabel();
    expect(fns.getNextLabel().textContent).toContain('B');
  });

  it('次の地点に到着すると同時に「次の目的地」表示が消える', () => {
    const html = getHeritageJourneyPage();
    const fns = loadNextLabelFn(html);
    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 1);
    fns.updateNextLabel();
    expect(fns.getNextLabel().textContent).toBe('');
  });

  it('到着後、次の区間に入るとまた次の地点の名称が表示される', () => {
    const html = getHeritageJourneyPage();
    const fns = loadNextLabelFn(html);
    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 1.5);
    fns.updateNextLabel();
    expect(fns.getNextLabel().textContent).toContain('C');
  });

  it('最後の地点に到着した後は「次の目的地」を表示しない', () => {
    const html = getHeritageJourneyPage();
    const fns = loadNextLabelFn(html);
    fns.setState([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 2);
    fns.updateNextLabel();
    expect(fns.getNextLabel().textContent).toBe('');
  });
});
