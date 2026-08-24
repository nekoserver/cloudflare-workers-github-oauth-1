import { describe, expect, it } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

describe('heritage-journeyページ: 空港の到着便・出発便チェック', () => {
  it('薄緑色の空港行の行末に独立した到着・出発チェックボックスを描画する', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('class="tour-route-flight-control arrival"');
    expect(html).toContain('data-airport-flight-direction="arrival"');
    expect(html).toContain('>到着</label>');
    expect(html).toContain('class="tour-route-flight-control departure"');
    expect(html).toContain('data-airport-flight-direction="departure"');
    expect(html).toContain('>出発</label>');
    expect(html).toMatch(/\.tour-route-flight-controls\{[^}]*margin-left:auto/);
  });

  it('到着便を赤、出発便を青で地球儀へ描画する', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain("ctx.strokeStyle = isArrival ? '#ef4444' : '#2563eb'");
    expect(html).toContain("var from = isArrival ? other : airport");
    expect(html).toContain("var to = isArrival ? airport : other");
    expect(html).toContain('airportFlightLineSelection[code][direction] = flightCheck.checked');
  });
});
