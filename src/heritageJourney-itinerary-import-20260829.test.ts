import { describe, expect, it } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

describe('heritage-journeyページ: 写真付き旅程表と計画書読み込み', () => {
  const html = getHeritageJourneyPage();

  it('現在のルートを表にして印刷・CSV保存できる操作を表示する', () => {
    expect(html).toContain('🗓️ 写真付き旅程表');
    expect(html).toContain('id="itinerary-table-body"');
    expect(html).toContain('id="itinerary-generate-btn"');
    expect(html).toContain('id="itinerary-print-btn"');
    expect(html).toContain('id="itinerary-csv-btn"');
    expect(html).toContain('window.print()');
    expect(html).toContain("link.download = 'heritage-journey-plan.csv'");
  });

  it('画像・テキスト・CSVの計画書を受け付け、画像は既存のMoondream APIで解析する', () => {
    expect(html).toContain('accept="image/png,image/jpeg,image/webp,.txt,.csv,text/plain,text/csv"');
    expect(html).toContain("fetch('/api/moondream-analyze'");
    expect(html).toContain('TSV形式で1行ずつ出力');
    expect(html).toContain('suggestForImportedPlan(rows)');
    expect(html).toContain('登録済みスポット');
  });
});
