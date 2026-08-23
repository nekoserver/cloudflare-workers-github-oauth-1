import { describe, expect, it } from 'vitest';
import { AIRLINE_NETWORK } from './data/airlineNetwork';
import { buildAirportNetworkRoutes, getHeritageJourneyPage } from './views/heritageJourney';

describe('heritage-journey: 空港ボタンのデータ表示', () => {
  it.each(['ZRH', 'VIE', 'CPH'])('%s の主要発着便データを表示できる', (code) => {
    const routes = buildAirportNetworkRoutes(code);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.some((route) => route.direction === '出発')).toBe(true);
  });

  it('追加した航空会社・空港コードに重複や空の路線がない', () => {
    const iataCodes = AIRLINE_NETWORK.flatMap((country) => country.airlines.map((airline) => airline.iata));
    expect(new Set(iataCodes).size).toBe(iataCodes.length);
    for (const country of AIRLINE_NETWORK) for (const airline of country.airlines) {
      expect(airline.destinations.length).toBeGreaterThan(0);
      expect(new Set(airline.destinations.map((destination) => destination.code)).size).toBe(airline.destinations.length);
    }
  });

  it('空港ON/OFFは名称の末尾ではなくairportCodeで空港を判定する', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain("category === 'airport' ? !!c.airportCode");
    expect(html).toContain("{ id: 'toggle-airports-btn', matches: function(c) { return !!c.airportCode; } }");
  });
});
