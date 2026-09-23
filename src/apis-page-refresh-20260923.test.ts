import { describe, expect, it } from 'vitest';
import { getApisPage } from './views/apis';

describe('/apis page: refreshed landing experience', () => {
  const html = getApisPage();

  it('introduces the API explorer and shows live catalog totals', () => {
    expect(html).toContain('APIを探して、すぐ試す。');
    expect(html).toContain('id="welcome-endpoint-count"');
    expect(html).toContain('id="welcome-group-count"');
    expect(html).toContain('id="welcome-method-count"');
    expect(html).toContain('new Set(APIS.flatMap(g => g.endpoints.map(ep => ep.method))).size');
  });

  it('offers an accessible keyboard shortcut for endpoint search', () => {
    expect(html).toContain('<kbd>/</kbd> でエンドポイント検索へ移動');
    expect(html).toContain("event.key !== '/'");
    expect(html).toContain("searchInput.focus()");
  });

  it('keeps the sidebar, description panel, and main content in one body row', () => {
    const bodyRow = html.slice(html.indexOf('<div id="body-row">'), html.indexOf('<script>'));
    expect(bodyRow).toContain('<div id="sidebar">');
    expect(bodyRow).toContain('<div id="desc-panel">');
    expect(bodyRow).toContain('<div id="main">');
    expect(bodyRow.indexOf('<div id="desc-panel">')).toBeLessThan(bodyRow.lastIndexOf('</div>'));
  });
});
