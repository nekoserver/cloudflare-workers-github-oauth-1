import { describe, expect, it } from 'vitest';
import { getD1QueryCatalogPage, type D1QueryCatalogRow } from './views/d1QueryCatalog';
import { getSettingsPage } from './views/settings';

const row = (table_name: string, query_name: string): D1QueryCatalogRow => ({
  query_name, command: 'many', command_confirmed: 1, table_name,
  source_file: 'src/index.ts', source_line: 1, sql_text: `SELECT * FROM ${table_name}`,
  migration_file: null, last_commit_hash: null, last_commit_at: null,
});

describe('D1クエリカタログのテーブル選択設定', () => {
  it('単一選択をデフォルトとし、Cookie由来の複数選択も描画できる', () => {
    expect(getD1QueryCatalogPage('u', [row('a', 'A')])).toContain("var tableSelectionMode = 'single'");
    expect(getD1QueryCatalogPage('u', [row('a', 'A')], 'count', {}, false)).toContain("var tableSelectionMode = 'multiple'");
  });

  it('各テーブル名の末尾にカラム数を表示し、2基準のトグルを持つ', () => {
    const html = getD1QueryCatalogPage('u', [row('few', 'A'), row('many', 'B'), row('many', 'C')], 'count', { few: 2, many: 9 });
    expect(html).toContain('<span class="table-badge-name">many</span> <span class="table-column-count">(9カラム)</span>');
    expect(html).toContain('id="tableBadgeSortToggle"');
    expect(html).toContain('出現回数 / カラム数');
    expect(html).toContain("nextSort === 'columns' ? 'data-column-count' : 'data-occurrence-count'");
  });

  it('設定ページで単一選択ルールを変更できる', () => {
    const html = getSettingsPage({ username: 'u', issuedAt: '', expiresAt: '', expiresAtTimestamp: 0, d1QueryCatalogSingleTable: 'off' });
    expect(html).toContain('D1クエリカタログ: テーブル選択の対象を常に1つに限定する（デフォルト）');
    expect(html).toContain("fetch('/api/settings/d1-query-catalog-single-table'");
    expect(html).toContain('id="d1QueryCatalogSingleTableCheckbox"');
  });
});
