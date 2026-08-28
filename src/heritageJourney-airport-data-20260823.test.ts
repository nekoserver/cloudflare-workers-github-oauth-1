import { describe, expect, it } from 'vitest';
import { AIRLINE_NETWORK } from './data/airlineNetwork';
import { buildAirportNetworkRoutes, getHeritageJourneyPage } from './views/heritageJourney';

describe('heritage-journey: 空港ボタンのデータ表示', () => {
  it.each(['ZRH', 'VIE', 'CPH'])('%s の主要発着便データを表示できる', (code) => {
    const routes = buildAirportNetworkRoutes(code);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.some((route) => route.direction === '出発')).toBe(true);
  });

  it('追加した航空会社に空の路線や重複した到着空港コードがない', () => {
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

  it('発着便データがある空港ボタンとルート小窓の行を薄緑色にする', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('.airport-network-btn.has-data{background:#bbf7d0');
    expect(html).toContain("(c.airportRoutes && c.airportRoutes.length) ? ' has-data' : ''");
    expect(html).toContain('.tour-route-side-row.airport-has-data{background:#bbf7d0');
    expect(html).toContain("(airportHasData ? ' airport-has-data' : '')");
  });

  it('地球儀またはルート小窓で空港をタップすると対応行へスクロールする', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('function scrollAirportSideRowIntoView(point)');
    expect(html).toContain("target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });");
    expect(html).toContain('scrollAirportSideRowIntoView(tourPoints[hitIdx]);');
    expect(html).toContain('scrollAirportSideRowIntoView(point);');
  });
});
