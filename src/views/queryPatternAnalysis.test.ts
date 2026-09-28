import { describe, expect, it } from 'vitest';
import { getQueryPatternAnalysisPage } from './queryPatternAnalysis';

const html = getQueryPatternAnalysisPage(
  { username: 'tester' },
  [{
    tableName: 'sample_table',
    description: 'サンプル',
    sql: "CREATE TABLE sample_table (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL DEFAULT 'demo'\n);",
    scores: {},
  }],
);

describe('getQueryPatternAnalysisPage', () => {
  it('各テーブル名をJev評価SQLを開くリンクとして描画する', () => {
    expect(html).toContain('class="table-sql-link"');
    expect(html).toContain('data-table="sample_table"');
    expect(html).toContain('aria-label="sample_table のJev評価SQLを表示"');
    expect(html).toContain('data-sql="CREATE TABLE sample_table (');
    expect(html).toContain('DEFAULT &#39;demo&#39;');
  });

  it('トップレイヤーのdialogとSQLシンタックスハイライト処理を備える', () => {
    expect(html).toContain('<dialog id="table-sql-dialog"');
    expect(html).toContain('sqlDialog.showModal()');
    expect(html).toContain("span.className = 'sql-keyword'");
    expect(html).toContain("span.className = 'sql-type'");
    expect(html).toContain("span.className = 'sql-string'");
  });

  it('閉じるボタンと背景タップでモーダルを閉じられる', () => {
    expect(html).toContain("sqlDialog.querySelector('.sql-dialog-close').addEventListener");
    expect(html).toContain('if (event.target === sqlDialog) sqlDialog.close()');
  });

  it('テーマ切り替え処理をscript要素内に描画する', () => {
    expect(html).toMatch(/<script>\s+function toggleTheme\(\)/);
    expect(html).not.toMatch(/<\/dialog>\s+function toggleTheme\(\)/);
  });
});
