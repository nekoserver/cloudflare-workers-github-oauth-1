import { describe, expect, it } from 'vitest';
import { getApisPage } from './views/apis';

describe('/apis ページ: API利用状況へのナビゲーション', () => {
  const html = getApisPage();

  it('ワークフロー別のAPI参照状況ページへ移動できる', () => {
    expect(html).toContain('href="/wf-browser"');
    expect(html).toContain('↗ 利用状況');
    expect(html).toContain('ワークフローから参照されているAPIを確認');
  });

  it('ヘッダーに全エンドポイント数を動的に表示する', () => {
    expect(html).toContain('APIS.reduce((sum, g) => sum + g.endpoints.length, 0)');
    expect(html).toContain("endpointCount + ' endpoints");
    expect(html).toContain('nav-home-count');
  });

  it('ヘッダーの用途を支援技術へ伝える', () => {
    expect(html).toContain('aria-label="APIカテゴリーナビゲーション"');
  });
});
