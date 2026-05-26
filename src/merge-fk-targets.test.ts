import { describe, it, expect } from 'vitest';
import { mergeFkTargetsFromDb, COLUMN_FK_TARGETS } from './index';

describe('mergeFkTargetsFromDb', () => {
  const base = {
    tableA: { col1: 'tableX', col2: 'tableY' },
    tableB: { col3: 'tableZ' },
  };

  it('DBが空の場合は base をそのまま返す', () => {
    expect(mergeFkTargetsFromDb(base, [])).toEqual(base);
  });

  it('DB行が base のエントリを上書きする', () => {
    const rows = [{ table_name: 'tableA', column_name: 'col1', fk_target_table: 'tableOverridden' }];
    const result = mergeFkTargetsFromDb(base, rows);
    expect(result.tableA.col1).toBe('tableOverridden');
    expect(result.tableA.col2).toBe('tableY');
    expect(result.tableB.col3).toBe('tableZ');
  });

  it('DB行が base にない新規FK関係を追加する', () => {
    const rows = [{ table_name: 'tableC', column_name: 'col4', fk_target_table: 'tableW' }];
    const result = mergeFkTargetsFromDb(base, rows);
    expect(result.tableC?.col4).toBe('tableW');
    expect(result.tableA.col1).toBe('tableX');
    expect(result.tableB.col3).toBe('tableZ');
  });

  it('DB行が base の一部しかカバーしない場合、base の残りが失われない', () => {
    const rows = [{ table_name: 'tableA', column_name: 'col1', fk_target_table: 'tableX' }];
    const result = mergeFkTargetsFromDb(base, rows);
    expect(result.tableB).toBeDefined();
    expect(result.tableB.col3).toBe('tableZ');
    expect(result.tableA.col2).toBe('tableY');
  });

  it('base を変更しない（純粋関数）', () => {
    const rows = [{ table_name: 'tableA', column_name: 'col1', fk_target_table: 'CHANGED' }];
    mergeFkTargetsFromDb(base, rows);
    expect(base.tableA.col1).toBe('tableX');
  });

  it('COLUMN_FK_TARGETS を base として渡したとき、DB行が部分的でも全FKが保持される', () => {
    const partialDbRows = [
      { table_name: 'ai_summary_reviews', column_name: 'summary_request_id', fk_target_table: 'ai_summary_log' },
      { table_name: 'email_send_log', column_name: 'source_id', fk_target_table: 'resend_webhook_sources' },
    ];
    const result = mergeFkTargetsFromDb(COLUMN_FK_TARGETS, partialDbRows);

    expect(result['cache_stats']?.user_id).toBe('user_sessions');
    expect(result['commit_search_history']?.user_id).toBe('user_sessions');
    expect(result['commit_search_hit_details']?.search_history_id).toBe('commit_search_history');
    expect(result['ai_summary_reviews']?.summary_request_id).toBe('ai_summary_log');
    expect(result['email_send_log']?.source_id).toBe('resend_webhook_sources');
  });
});
