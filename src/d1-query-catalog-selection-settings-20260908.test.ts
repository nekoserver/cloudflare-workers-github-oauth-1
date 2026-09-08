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
    expect(html).toContain('<span class="table-badge-name">many</span><span class="table-column-count" aria-label="9カラム">9</span>');
    expect(html).toContain('id="tableBadgeSortToggle"');
    expect(html).toContain('出現回数 / カラム数');
    expect(html).toContain("nextSort === 'columns' ? 'data-column-count' : 'data-occurrence-count'");
  });

  it('テーブルバッジを丸・角丸・三角の構成にし、呼び出し元ファイル由来の色を付ける', () => {
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
    expect(html).toContain('border-left: 22px solid var(--source-color)');
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
