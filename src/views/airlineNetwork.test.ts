import { describe, expect, it } from 'vitest';
import { getAirlineNetworkPage } from './airlineNetwork';
import { AIRLINE_NETWORK } from '../data/airlineNetwork';

describe('/airline-network ページ: 各国航空会社ネットワーク一覧', () => {
  const html = getAirlineNetworkPage();

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('国別の切り替えボタンがすべて表示される', () => {
    for (const c of AIRLINE_NETWORK) {
      expect(html).toContain(`data-country="${c.country}"`);
      expect(html).toContain(`${c.flag} ${c.country}`);
    }
  });

  it('全ての航空会社・拠点空港・乗り入れ空港・便数がテーブルに含まれる', () => {
    for (const c of AIRLINE_NETWORK) {
      for (const airline of c.airlines) {
        expect(html).toContain(airline.name);
        expect(html).toContain(airline.hubName);
        for (const dest of airline.destinations) {
          expect(html).toContain(dest.name);
          expect(html).toContain(String(dest.flightsPerWeek));
        }
      }
    }
  });

  it('サマリーバーに国数・航空会社数・路線数の集計値が表示される', () => {
    const countryCount = AIRLINE_NETWORK.length;
    const airlineCount = AIRLINE_NETWORK.reduce((sum, c) => sum + c.airlines.length, 0);
    const routeCount = AIRLINE_NETWORK.reduce(
      (sum, c) => sum + c.airlines.reduce((s2, a) => s2 + a.destinations.length, 0),
      0
    );
    expect(html).toContain(`<b>${countryCount}</b>`);
    expect(html).toContain(`<b>${airlineCount}</b>`);
    expect(html).toContain(`<b>${routeCount}</b>`);
  });

  it('検索ボックスと国別フィルタが両方JSに実装されている', () => {
    expect(html).toContain("document.getElementById('search-box')");
    expect(html).toContain('matchesCountry');
    expect(html).toContain('matchesSearch');
  });

  it('該当0件の場合の空表示メッセージ要素が存在する', () => {
    expect(html).toContain('id="no-hit"');
    expect(html).toContain('該当する路線が見つかりません');
  });
});
