import { describe, expect, it } from 'vitest';
import { getD1QueryCatalogPage, type D1QueryCatalogRow } from './views/d1QueryCatalog';
import { getSettingsPage } from './views/settings';

const row = (table_name: string, query_name: string): D1QueryCatalogRow => ({
  query_name, command: 'many', command_confirmed: 1, table_name,
  source_file: 'src/index.ts', source_line: 1, sql_text: `SELECT * FROM ${table_name}`,
  migration_file: null, last_commit_hash: null, last_commit_at: null,
});

describe('D1クエリカタログのテーブル選択設定', () => {
  it('全SQLをFK分類カテゴリ別に集計した円グラフと件数・割合を表示する', () => {
    const html = getD1QueryCatalogPage('u', [
      row('auth_sessions', 'A'),
      row('auth_sessions', 'B'),
      row('ai_logs', 'C'),
      row('unclassified', 'D'),
    ], 'count', {}, true, {
      auth_sessions: { group: 'auth', groupLabel: '認証', color: '#388bfd', fkRole: 'source' },
      ai_logs: { group: 'ai', groupLabel: 'AI', color: '#a371f7', fkRole: 'both' },
    });

    expect(html).toContain('id="categoryChartTitle">内訳</figcaption>');
    expect(html).toContain('class="category-chart-pie" role="img"');
    expect(html).toContain('aria-label="全4件。認証 2件、AI 1件、未分類 1件"');
    expect(html).toContain('--category-chart-gradient:conic-gradient(#388bfd 0.00% 50.00%, #a371f7 50.00% 75.00%, #8b949e 75.00% 100.00%)');
    expect(html).toMatch(/<li><span class="category-chart-swatch"[^<]*<\/span><span class="category-chart-label">認証<\/span><strong>2件<\/strong><span class="category-chart-percent">50\.0%<\/span>/);
    expect(html).toContain('<span class="category-chart-label">未分類</span><strong>1件</strong><span class="category-chart-percent">25.0%</span>');
  });

  it('内訳を縦にスワイプすると内訳を畳み、下のFK分類をせり上げる', () => {
    const html = getD1QueryCatalogPage('u', [row('auth_sessions', 'A')]);

    expect(html).toContain("categoryChart.addEventListener('touchstart'");
    expect(html).toContain("categoryChart.addEventListener('touchend'");
    expect(html).toContain("if (Math.abs(swipeDistance) >= 48) categoryFilterSidebar.classList.add('chart-collapsed');");
    expect(html).toMatch(/\.category-filter-sidebar\.chart-collapsed \.category-chart\s*\{[^}]*max-height:\s*0;[^}]*transform:\s*translateY\(-18px\)/s);
  });

  it('SQLがない場合は円グラフの代わりに空状態を表示する', () => {
    const html = getD1QueryCatalogPage('u', []);
    expect(html).toContain('集計対象のSQLがありません');
    expect(html).not.toContain('class="category-chart-pie"');
  });

  it('左サイドパネルに分類カテゴリを該当テーブル数の多い順で表示し、右側の表をカテゴリで絞り込める', () => {
    const html = getD1QueryCatalogPage('u', [
      row('auth_sessions', 'A'),
      row('auth_users', 'B'),
      row('ai_logs', 'C'),
      row('unclassified', 'D'),
    ], 'count', {}, true, {
      auth_sessions: { group: 'auth', groupLabel: '認証', color: '#388bfd', fkRole: 'source' },
      auth_users: { group: 'auth', groupLabel: '認証', color: '#388bfd', fkRole: 'target' },
      ai_logs: { group: 'ai', groupLabel: 'AI', color: '#a371f7', fkRole: 'both' },
    });

    const sidePanel = html.match(/<aside class="category-filter-sidebar"[\s\S]*?<\/aside>/)?.[0] ?? '';
    expect(sidePanel).toContain('<div class="category-filter-title">FK分類</div>');
    expect(html).toMatch(/\.category-filter-title\s*\{[^}]*text-align:\s*center/);
    expect(sidePanel).toContain('data-group="auth"');
    expect(sidePanel).toContain('<span class="category-filter-count">2</span><span class="category-filter-name">認証</span>');
    expect(sidePanel.indexOf('data-group="auth"')).toBeLessThan(sidePanel.indexOf('data-group="ai"'));
    expect(sidePanel).not.toContain('data-group="undefined"');
    expect(html).toContain('class="catalog-main"');
    expect(html).toContain('class="table-group-badge" data-group="auth"');
    expect(html).toContain("var selectedGroup = selectedCategoryBadge ? selectedCategoryBadge.getAttribute('data-group') : null;");
    expect(html).toContain("var groupMatches = selectedGroup === null || (groupBadge && groupBadge.getAttribute('data-group') === selectedGroup);");
    expect(html).toContain('var visible = groupMatches && tableMatches && verbMatches;');
  });

  it('横断検索とテーブル名選択を最上段のツールバーに並べ、説明見出しを表示しない', () => {
    const html = getD1QueryCatalogPage('u', [row('a', 'A')]);
    const toolbar = html.match(/<div class="catalog-filter-toolbar">([\s\S]*?)<\/div>\s*<div class="filter-panel"/)?.[1] ?? '';

    expect(toolbar).toContain('id="verbFilter"');
    expect(toolbar).toContain('id="tablePanelToggle"');
    expect(toolbar.indexOf('id="verbFilter"')).toBeLessThan(toolbar.indexOf('id="tablePanelToggle"'));
    expect(toolbar).not.toContain('発行SQLで横断検索');
    expect(html).toMatch(/\.panel-toggle\s*\{[^}]*padding:\s*6px 12px;[^}]*margin-top:\s*0;/s);
    expect(html).toContain('<span>クエリーマネージャ</span>');
    expect(html).not.toContain('<div class="title">D1クエリカタログ</div>');
    expect(html).not.toContain('db.prepare()</code> 呼び出しから合成した sqlc 風アノテーション一覧');
  });

  it('単一選択をデフォルトとし、Cookie由来の複数選択も描画できる', () => {
    expect(getD1QueryCatalogPage('u', [row('a', 'A')])).toContain("var tableSelectionMode = 'single'");
    expect(getD1QueryCatalogPage('u', [row('a', 'A')], 'count', {}, false)).toContain("var tableSelectionMode = 'multiple'");
  });

  it('各テーブル名の末尾にカラム数を表示し、2基準のトグルを持つ', () => {
    const html = getD1QueryCatalogPage('u', [row('few', 'A'), row('many', 'B'), row('many', 'C')], 'count', { few: 2, many: 9 });
    expect(html).toContain('<span class="table-badge-name">many</span><span class="table-column-count" aria-label="9カラム">9</span>');
    expect(html).toContain('id="tableBadgeSortToggle"');
    expect(html).toContain('出現回数 / カラム数');
    expect(html).toContain("nextSort === 'columns' ? 'data-column-count' : 'data-occurrence-count'");
  });

  it('テーブルバッジを丸・角丸の構成にし、呼び出し元ファイル由来の色を付ける', () => {
    const html = getD1QueryCatalogPage('u', [
      row('from_index', 'A'),
      { ...row('from_helper', 'B'), source_file: 'src/utils/helper.ts' },
    ]);
    const indexBadge = html.match(/<button[^>]+data-table="from_index"[^>]+>/)?.[0] ?? '';
    const helperBadge = html.match(/<button[^>]+data-table="from_helper"[^>]+>/)?.[0] ?? '';
    expect(indexBadge).toContain('data-source-file="src/index.ts"');
    expect(helperBadge).toContain('data-source-file="src/utils/helper.ts"');
    expect(indexBadge).toContain('--source-color:');
    expect(helperBadge).toContain('--source-color:');
    expect(indexBadge.match(/--source-color:([^";]+)/)?.[1]).not.toBe(helperBadge.match(/--source-color:([^";]+)/)?.[1]);
    expect(html).toContain('.table-badge-count {');
    expect(html).toContain('border-radius: 50%');
    expect(html).toContain('.table-column-count {');
    expect(html).not.toContain('border-left: 22px solid var(--source-color)');
    expect(html).not.toContain('.table-column-count::after');
    expect(html).toMatch(/\.table-badge-list\s*\{[^}]*row-gap:\s*1px/);
  });

  it('statusと共通のテーブル分類色とFK役割をバッジ・帯へ反映する', () => {
    const html = getD1QueryCatalogPage('u', [row('user_preferences', 'A')], 'count', {}, true, {
      user_preferences: { group: 'auth', groupLabel: 'Auth / Session', color: '#388bfd', fkRole: 'source' },
    });

    expect(html).toContain('style="--source-color:#388bfd;');
    expect(html).toContain('data-group="auth" data-fk-role="source"');
    expect(html).toContain('style="--table-color:#388bfd"');
    expect(html).toContain('<span class="table-group-badge" data-group="auth">Auth / Session</span>');
    expect(html).toContain('<span class="table-fk-badge table-fk-source">FK 参照元</span>');
    expect(html).toContain('.band-name {');
    expect(html).toContain('color: var(--table-color, var(--text-primary))');
  });

  it('未選択バッジは同じ中間色で揃え、選択時は選択色で塗りつぶして他をグレーアウトする', () => {
    const html = getD1QueryCatalogPage('u', [row('a', 'A'), row('b', 'B')]);

    expect(html).toContain('--badge-middle: color-mix(in srgb, var(--source-color) 48%, var(--card-bg))');
    expect(html).toMatch(/\.table-badge-count\s*\{[^}]*background:\s*var\(--badge-middle\)/);
    expect(html).toMatch(/\.table-badge-name\s*\{[^}]*background:\s*var\(--badge-middle\)/);
    expect(html).toMatch(/\.table-column-count\s*\{[^}]*background:\s*var\(--badge-middle\)/);
    expect(html).toContain('.table-badge-list.has-selection .table-filter-badge:not([aria-pressed="true"])');
    expect(html).toContain("tableBadgeList.classList.toggle('has-selection', selectedTables.length > 0)");
    expect(html).toMatch(/\.table-filter-badge\[aria-pressed="true"\][^}]+\.table-column-count\s*\{\s*background:\s*var\(--source-color\)/);
  });

  it('テーブル選択パネルを開いたままFK分類外のテーブルバッジをグレーアウトする', () => {
    const html = getD1QueryCatalogPage('u', [row('auth_table', 'A'), row('ai_table', 'B')], 'count', {}, true, {
      auth_table: { group: 'auth', groupLabel: '認証', color: '#388bfd', fkRole: 'source' },
      ai_table: { group: 'ai', groupLabel: 'AI', color: '#a371f7', fkRole: 'target' },
    });

    expect(html).toContain("badge.classList.toggle('category-mismatch', selectedGroup !== null && badge.getAttribute('data-group') !== selectedGroup)");
    expect(html).toMatch(/\.table-badge-list \.table-filter-badge\.category-mismatch\s*\{[^}]*filter:\s*grayscale\(1\);[^}]*opacity:\s*0\.68;/);
    expect(html).toContain('categoryFilterSidebar.contains(event.target)');
  });

  it('パネル外の無関係な場所をクリックするとテーブル選択パネルを閉じる', () => {
    const html = getD1QueryCatalogPage('u', [row('a', 'A')]);

    expect(html).toContain("document.addEventListener('click', function(event)");
    expect(html).toContain('tablePanel.contains(event.target)');
    expect(html).toContain('tablePanelToggle.contains(event.target)');
    expect(html).toContain('setTablePanelExpanded(false)');
  });

  it('表内SQLのキーワード・文字列・数値・パラメータを安全にハイライトする', () => {
    const sqlRow = { ...row('items', 'Highlighted'), sql_text: "PRAGMA table_info('items'); SELECT * FROM items WHERE id = ?1 AND n = 42" };
    const html = getD1QueryCatalogPage('u', [sqlRow]);
    expect(html).toContain('<span class="sql-token sql-keyword">PRAGMA</span>');
    expect(html).toContain('<span class="sql-token sql-keyword">SELECT</span>');
    expect(html).toContain('<span class="sql-token sql-string">&#39;items&#39;</span>');
    expect(html).toContain('<span class="sql-token sql-parameter">?1</span>');
    expect(html).toContain('<span class="sql-token sql-number">42</span>');
  });

  it('設定ページで単一選択ルールを変更できる', () => {
    const html = getSettingsPage({ username: 'u', issuedAt: '', expiresAt: '', expiresAtTimestamp: 0, d1QueryCatalogSingleTable: 'off' });
    expect(html).toContain('D1クエリカタログ: テーブル選択の対象を常に1つに限定する（デフォルト）');
    expect(html).toContain("fetch('/api/settings/d1-query-catalog-single-table'");
    expect(html).toContain('id="d1QueryCatalogSingleTableCheckbox"');
  });
});
