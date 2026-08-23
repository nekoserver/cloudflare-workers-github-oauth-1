// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { buildEmbeddedJourneyPoints, getHeritageJourneyPage } from './views/heritageJourney';

type DrawCall = { canvasId: string; kind: 'text' | 'arc'; value: string | number; fillStyle: string };

function setupPage(): DrawCall[] {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const calls: DrawCall[] = [];
  HTMLCanvasElement.prototype.getContext = (function(this: HTMLCanvasElement) {
    const canvasId = this.id;
    const ctx = {
      globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
      clearRect() {}, beginPath() {}, ellipse() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, fillRect() {},
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

describe('heritage-journeyページ: 巡回地球儀の城ON/OFF', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('空港ON/OFFの右隣に、初期OFFの城トグルを配置する', () => {
    const html = getHeritageJourneyPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const airport = document.getElementById('toggle-airports-btn');
    const castle = document.getElementById('toggle-castles-btn');
    expect(airport?.nextElementSibling).toBe(castle);
    expect(castle?.textContent).toBe('城ON/OFF');
    expect(castle?.getAttribute('aria-pressed')).toBe('false');
  });

  it('ONで全ての城座標をモーダルには🏰、スコープには薄水色の3px丸で描画し、OFFで消す', () => {
    const castleCount = buildEmbeddedJourneyPoints().filter((point) => point.e === '🏰').length;
    expect(castleCount).toBeGreaterThan(0);
    const calls = setupPage();
    const button = document.getElementById('toggle-castles-btn') as HTMLButtonElement;

    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(calls.filter((call) => call.canvasId === 'tour-globe-canvas' && call.kind === 'text' && call.value === '🏰')).toHaveLength(castleCount);
    expect(calls.filter((call) => call.canvasId === 'tour-mini-canvas' && call.kind === 'arc' && call.value === 3 && call.fillStyle === '#bae6fd')).toHaveLength(castleCount);

    calls.length = 0;
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(calls.some((call) => call.value === '🏰' || call.fillStyle === '#bae6fd')).toBe(false);
  }, 15_000);
});
