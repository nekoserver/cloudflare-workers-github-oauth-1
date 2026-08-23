import { describe, expect, it } from 'vitest';
import { buildAirportNetworkRoutes, buildEmbeddedAirportPoints, getHeritageJourneyPage } from './heritageJourney';

describe('heritage-journey 空港発着便', () => {
  it('airline-network共通データから出発便と到着便を構築する', () => {
    const routes = buildAirportNetworkRoutes('LHR');
    expect(routes.some((route) => route.direction === '出発' && route.iata === 'BA')).toBe(true);
    expect(routes.some((route) => route.direction === '到着' && route.destinationCode === 'LHR')).toBe(true);
    expect(routes.every((route) => route.flightsPerWeek > 0)).toBe(true);
  });

  it('空港候補にIATAコードと発着便を埋め込む', () => {
    const heathrow = buildEmbeddedAirportPoints().find((point) => point.airportCode === 'LHR');
    expect(heathrow?.airportRoutes?.length).toBeGreaterThan(0);
  });

  it('airline-networkと同じ列書式の発着便モーダルを表示する', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('id="airport-network-modal-overlay"');
    expect(html).toContain('<th>航空会社</th><th>拠点空港</th><th>乗り入れ空港</th><th>便数(週)</th>');
    expect(html).toContain('発着便・航空会社');
  });
});
