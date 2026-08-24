// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  HTMLCanvasElement.prototype.getContext = ((() => ({
    clearRect() {}, beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, fillText() {},
  })) as unknown) as typeof HTMLCanvasElement.prototype.getContext;
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
}

function candidateCheckboxesEndingWith(suffix: string): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('#cand-list input[data-cand]'))
    .filter((input) => (input.getAttribute('data-cand') || '').endsWith(suffix));
}

describe('heritage-journeyページ: 駅・空港候補の一括ON/OFF', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('候補操作列の近接選択ボタンの右側に駅・空港トグルがある', () => {
    setupPage();
    const toolbarIds = Array.from(document.querySelectorAll('#select-near-btn ~ button')).map((el) => el.id);
    expect(toolbarIds.slice(0, 2)).toEqual(['toggle-stations-btn', 'toggle-airports-btn']);
    expect(document.getElementById('toggle-stations-btn')?.textContent).toBe('駅ON/OFF');
    expect(document.getElementById('toggle-airports-btn')?.textContent).toBe('空港ON/OFF');
  });

  // 経由地候補の初期値変更(すべて解除+駅OFF+空港ON+城ON)により、空港トグルは
  // 既定でONになった(駅は従来どおり既定OFF)。そのため「クリックでON」固定では
  // なく、現在のaria-pressedを見て「クリックで反転する」ことだけを検証する。
  it.each([
    ['toggle-stations-btn', '駅'],
    ['toggle-airports-btn', '空港'],
  ])('%sをクリックするたびに末尾が「%s」の全候補のON/OFFが反転する', (buttonId, suffix) => {
    setupPage();
    const button = document.getElementById(buttonId) as HTMLButtonElement;
    const inputs = candidateCheckboxesEndingWith(suffix);
    expect(inputs.length).toBeGreaterThan(0);
    const initiallyOn = button.getAttribute('aria-pressed') === 'true';

    button.click();
    expect(button.getAttribute('aria-pressed')).toBe(initiallyOn ? 'false' : 'true');
    expect(candidateCheckboxesEndingWith(suffix).every((input) => input.checked === !initiallyOn)).toBe(true);

    button.click();
    expect(button.getAttribute('aria-pressed')).toBe(initiallyOn ? 'true' : 'false');
    expect(candidateCheckboxesEndingWith(suffix).every((input) => input.checked === initiallyOn)).toBe(true);
  });
});
