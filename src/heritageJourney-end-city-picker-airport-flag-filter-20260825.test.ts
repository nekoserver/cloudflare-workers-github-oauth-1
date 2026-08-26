// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

function setupPage() {
  document.cookie = 'heritage_journey_dest_country_filter=; Path=/; Max-Age=0';
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  window.HTMLCanvasElement.prototype.getContext = (() => ({
    clearRect() {}, beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, fillText() {},
  })) as never;
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ exists: false }) })));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  document.cookie = 'heritage_journey_dest_country_filter=; Path=/; Max-Age=0';
});

describe('到着地選択モーダル: 空港の国旗表示と国旗フィルタ', () => {
  it('空港を選ぶと各空港行の行頭を「✈︎国旗」で表示する', () => {
    setupPage();
    (document.getElementById('end-city-picker-airports-cb') as HTMLInputElement).click();
    (document.getElementById('end-city-picker-btn') as HTMLButtonElement).click();

    const airportRows = Array.from(document.querySelectorAll('#end-city-picker-table-body tr'))
      .filter((row) => row.getAttribute('data-city-name')?.startsWith('TP::') && row.querySelector('.end-city-picker-airport-td')?.textContent === '✈︎');
    expect(airportRows.length).toBeGreaterThan(0);
    airportRows.forEach((row) => expect(row.querySelector('td')?.textContent).toMatch(/^✈︎\p{Regional_Indicator}{2}$/u));
  }, 15_000);

  it('行頭カラムのthから国を選ぶと、その国の空港行だけを表示する', () => {
    setupPage();
    (document.getElementById('end-city-picker-cities-cb') as HTMLInputElement).click();
    (document.getElementById('end-city-picker-airports-cb') as HTMLInputElement).click();
    (document.getElementById('end-city-picker-btn') as HTMLButtonElement).click();
    document.getElementById('end-city-picker-flag-th')!.click();
    (document.querySelector('#dist-country-filter-list [data-country="イタリア"]') as HTMLElement).click();

    const rows = Array.from(document.querySelectorAll('#end-city-picker-table-body tr'));
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => expect(row.querySelector('td')?.textContent).toBe('✈︎🇮🇹'));
  }, 15_000);
});
