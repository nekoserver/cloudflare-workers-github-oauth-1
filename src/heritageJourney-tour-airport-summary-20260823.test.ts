import { describe, expect, it } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

describe('heritage-journeyページ: 巡回ルートの空港表示', () => {
  const html = getHeritageJourneyPage();

  it('宿泊推奨地モーダルの下段にコード・空港名・緯度・経度の表を配置する', () => {
    const lodging = html.indexOf('class="lodging-recommend-controls"');
    const summary = html.indexOf('id="tour-airport-summary"');
    expect(summary).toBeGreaterThan(lodging);
    expect(html).toContain('<th>コード</th><th>空港名</th><th>緯度</th><th>経度</th>');
    expect(html).toContain('class="tour-airport-coordinate"');
  });

  it('巡回対象の空港だけを表へ抽出し、座標を4桁に揃える', () => {
    expect(html).toContain("tourPoints.filter(function(p) { return !!p.airportCode; })");
    expect(html).toContain("Number(p.lat).toFixed(4)");
    expect(html).toContain("Number(p.lon).toFixed(4)");
  });

  it('ルート行とルート順序サイドパネルの行末に空港コードを付ける', () => {
    expect(html).toContain("var airportCode = p.airportCode ? ' <span class=\"airport-network-code\">'");
    expect(html).toContain("(p.airportCode ? ' <span class=\"airport-network-code\">'");
  });
});
