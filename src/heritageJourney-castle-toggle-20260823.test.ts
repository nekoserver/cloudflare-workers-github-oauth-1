// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { buildEmbeddedJourneyPoints, getHeritageJourneyPage } from './views/heritageJourney';

type DrawCall = { canvasId: string; kind: 'text' | 'arc' | 'clear'; value: string | number; fillStyle: string };

function setupPage(): DrawCall[] {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const calls: DrawCall[] = [];
  HTMLCanvasElement.prototype.getContext = (function(this: HTMLCanvasElement) {
    const canvasId = this.id;
    const ctx = {
      globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
      // renderGlobeToCanvas()は描画のたびに必ずclearRect()から始めるため、そのcanvasに
      // ついて最後に記録されたclearRect以降のcallsだけが「実際に画面へ残る最終状態」になる
      // (applyRouteCountryFilter()がrecompute()の途中でrenderAll()を余分に1回呼ぶため、
      // 1回のクリックでも各canvasにつきclearRect→描画が2回走ることがある。同期処理内の
      // 中間状態はブラウザ上では実際には描画されない(1フレームとして合成される)ため、
      // テストでも最後のclearRect以降だけを「見える結果」として検証する)。
      clearRect() { calls.push({ canvasId, kind: 'clear', value: '', fillStyle: '' }); },
      beginPath() {}, ellipse() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, fillRect() {},
      arc(_x: number, _y: number, radius: number) { calls.push({ canvasId, kind: 'arc', value: radius, fillStyle: ctx.fillStyle }); },
      fillText(value: string) { calls.push({ canvasId, kind: 'text', value, fillStyle: ctx.fillStyle }); },
    };
    return ctx;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  calls.length = 0;
  return calls;
}

/** 指定canvasについて、最後に記録されたclearRect以降のcallsだけを返す(=実際に画面に残る最終状態)。 */
function lastRenderOf(calls: DrawCall[], canvasId: string): DrawCall[] {
  const own = calls.filter((c) => c.canvasId === canvasId);
  const lastClearIdx = own.map((c) => c.kind).lastIndexOf('clear');
  return lastClearIdx === -1 ? own : own.slice(lastClearIdx + 1);
}

describe('heritage-journeyページ: 巡回地球儀の城ON/OFF', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('空港ON/OFFの右隣に城トグルを配置する(マークアップ既定はON。経由地候補の初期値「空港ON/城ON」に合わせたもので、実際の初期表示ではrecompute()実行後にupdateTransportToggleButtons()が選択状態から再計算する)', () => {
    const html = getHeritageJourneyPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const airport = document.getElementById('toggle-airports-btn');
    const castle = document.getElementById('toggle-castles-btn');
    expect(airport?.nextElementSibling).toBe(castle);
    expect(castle?.textContent).toBe('城ON/OFF');
    expect(castle?.getAttribute('aria-pressed')).toBe('true');
  });

  // 対象: 経由地候補の初期値変更(すべて解除+駅OFF+空港ON+城ON)により、
  // #toggle-castles-btnは駅/空港と同じ「経由地候補の選択トグル」も兼ねるようになった。
  // ページ読み込み直後は既定で城ON(全城座標を描画)であり、1回目のクリックでOFFになる
  // (以前の「クリックでON」とは逆になった)。
  it('既定でON(全ての城座標をモーダルには🏰、スコープには薄水色の3px丸で描画)、クリックでOFFにして消せる', () => {
    const castleCount = buildEmbeddedJourneyPoints().filter((point) => point.e === '🏰').length;
    expect(castleCount).toBeGreaterThan(0);
    const calls = setupPage();
    const button = document.getElementById('toggle-castles-btn') as HTMLButtonElement;

    // setupPage()はスクリプト実行(初回recompute()によるrenderAll()含む)直後にcallsを
    // クリアしているため、既定ON状態の描画を捕捉するには改めて描画をトリガーする必要がある
    // (巡回テストモーダルを開く#tour-test-btnのクリックはopenTourModal()内でrenderAll()を
    // 呼ぶため、実際のユーザー操作としても自然なトリガーになる)。
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();

    // 城が実際に選択中の経由地(tourPoints)にもなっている場合、通常の経由地アイコン
    // 描画パス(drawWaypointPoint)でも🏰が描かれるため、「全城オーバーレイ」分の
    // castleCountちょうどではなく、それ以上になりうる(下限のみ検証する)。
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(lastRenderOf(calls, 'tour-globe-canvas').filter((call) => call.kind === 'text' && call.value === '🏰').length).toBeGreaterThanOrEqual(castleCount);
    expect(lastRenderOf(calls, 'tour-mini-canvas').filter((call) => call.kind === 'arc' && call.value === 3 && call.fillStyle === '#bae6fd').length).toBeGreaterThanOrEqual(castleCount);

    calls.length = 0;
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    // クリック直後のrecompute()内では、applyRouteCountryFilter()由来の中間renderAll()が
    // トグル反映前の古い状態で1回、syncMiniGlobe()由来の最終renderAll()が新しい状態で
    // もう1回、同期的に走る(いずれもブラウザ上では1フレームとして合成され、中間状態は
    // 実際には見えない)。そのため最後のclearRect以降(=実際に画面に残る最終状態)だけを見る。
    expect(lastRenderOf(calls, 'tour-globe-canvas').some((call) => call.value === '🏰')).toBe(false);
    expect(lastRenderOf(calls, 'tour-mini-canvas').some((call) => call.fillStyle === '#bae6fd')).toBe(false);

    calls.length = 0;
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(lastRenderOf(calls, 'tour-globe-canvas').filter((call) => call.kind === 'text' && call.value === '🏰').length).toBeGreaterThanOrEqual(castleCount);
  }, 15_000);
});
