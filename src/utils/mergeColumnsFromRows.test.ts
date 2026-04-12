import { describe, expect, it } from 'vitest';
import { mergeColumnsFromRows, getColumnKeyType, isAiSummaryLinkColumn, isFilterableColumn, getFilterableColumns, buildGroupErData, TABLE_GROUP_MAP, TABLE_COLUMN_KEYS, COLUMN_FK_TARGETS } from '../index';

describe('mergeColumnsFromRows', () => {
  it('rowsが空なら元のカラムをそのまま返す', () => {
    const pragma = ['id', 'name'];
    const result = mergeColumnsFromRows(pragma, []);
    expect(result).toEqual(['id', 'name']);
  });

  it('rowsのキーがPRAGMAと完全一致ならカラムは増えない', () => {
    const pragma = ['id', 'name'];
    const rows = [{ id: 1, name: 'test' }];
    const result = mergeColumnsFromRows(pragma, rows);
    expect(result).toEqual(['id', 'name']);
  });

  it('JOINカラムなどPRAGMAにないキーが末尾に追加される', () => {
    const pragma = ['id', 'summary_request_id', 'rating'];
    const rows = [{ id: 1, summary_request_id: 'abc', rating: 'good', repo_full_name: 'owner/repo', pr_number: 42 }];
    const result = mergeColumnsFromRows(pragma, rows);
    expect(result).toEqual(['id', 'summary_request_id', 'rating', 'repo_full_name', 'pr_number']);
  });

  it('元の配列を変更しない', () => {
    const pragma = ['id'];
    const rows = [{ id: 1, extra: 'value' }];
    mergeColumnsFromRows(pragma, rows);
    expect(pragma).toEqual(['id']);
  });

  it('PRAGMAが空でもrowsのキーからカラムが生成される', () => {
    const rows = [{ id: 1, name: 'test' }];
    const result = mergeColumnsFromRows([], rows);
    expect(result).toEqual(['id', 'name']);
  });

  it('返却されたcolumnsの全キーでrows内の全行から値が取れる', () => {
    const pragma = ['id', 'rating'];
    const rows = [
      { id: 1, rating: 'good', repo_full_name: 'owner/repo' },
      { id: 2, rating: 'bad', repo_full_name: 'owner/repo2' },
    ];
    const columns = mergeColumnsFromRows(pragma, rows);
    for (const row of rows) {
      for (const col of columns) {
        expect(row[col as keyof typeof row], `row[${col}]がundefined`).not.toBeUndefined();
      }
    }
  });
});

describe('getColumnKeyType', () => {
  it('PKカラムに対してpkを返す', () => {
    expect(getColumnKeyType('ai_summary_log', 'id')).toBe('pk');
    expect(getColumnKeyType('user_sessions', 'id')).toBe('pk');
  });

  it('FKカラムに対してfkを返す', () => {
    expect(getColumnKeyType('ai_summary_reviews', 'summary_request_id')).toBe('fk');
    expect(getColumnKeyType('workspaces', 'team_id')).toBe('fk');
    expect(getColumnKeyType('email_send_log', 'source_id')).toBe('fk');
  });

  it('PK+FKの複合キーに対してpk+fkを返す', () => {
    expect(getColumnKeyType('team_members', 'team_id')).toBe('pk+fk');
    expect(getColumnKeyType('repo_group_members', 'group_id')).toBe('pk+fk');
  });

  it('複合PKの各カラムにpkを返す', () => {
    expect(getColumnKeyType('team_members', 'user_id')).toBe('pk');
    expect(getColumnKeyType('repo_group_members', 'repo_name')).toBe('pk');
  });

  it('キーでないカラムにnullを返す', () => {
    expect(getColumnKeyType('ai_summary_log', 'summary')).toBeNull();
    expect(getColumnKeyType('user_sessions', 'timezone')).toBeNull();
  });

  it('存在しないテーブルにnullを返す', () => {
    expect(getColumnKeyType('nonexistent_table', 'id')).toBeNull();
  });
});

describe('isAiSummaryLinkColumn', () => {
  it('ai_summary_log.request_id はリンク対象', () => {
    expect(isAiSummaryLinkColumn('ai_summary_log', 'request_id')).toBe(true);
  });

  it('ai_summary_reviews.summary_request_id はリンク対象', () => {
    expect(isAiSummaryLinkColumn('ai_summary_reviews', 'summary_request_id')).toBe(true);
  });

  it('他のテーブル・カラムの組み合わせはリンク対象外', () => {
    expect(isAiSummaryLinkColumn('ai_summary_log', 'id')).toBe(false);
    expect(isAiSummaryLinkColumn('ai_summary_reviews', 'request_id')).toBe(false);
    expect(isAiSummaryLinkColumn('user_sessions', 'id')).toBe(false);
  });
});

describe('isFilterableColumn / getFilterableColumns', () => {
  it('table_catalog.group_name はフィルタ対象', () => {
    expect(isFilterableColumn('table_catalog', 'group_name')).toBe(true);
  });

  it('table_catalog.sync_policy はフィルタ対象', () => {
    expect(isFilterableColumn('table_catalog', 'sync_policy')).toBe(true);
  });

  it('table_catalog.table_name はフィルタ対象外', () => {
    expect(isFilterableColumn('table_catalog', 'table_name')).toBe(false);
  });

  it('table_column_keys.key_type はフィルタ対象', () => {
    expect(isFilterableColumn('table_column_keys', 'key_type')).toBe(true);
  });

  it('未定義テーブルはフィルタ対象外', () => {
    expect(isFilterableColumn('user_sessions', 'id')).toBe(false);
  });

  it('getFilterableColumns でフィルタ対象カラム一覧を取得', () => {
    expect(getFilterableColumns('table_catalog')).toEqual(['group_name', 'sync_policy']);
    expect(getFilterableColumns('user_sessions')).toEqual([]);
  });
});

describe('buildGroupErData', () => {
  const descriptions: Record<string, string> = {
    ai_summary_log: 'AI要約ログ',
    ai_summary_reviews: 'AI要約レビュー',
    commit_agent_log: 'コミットエージェント検出ログ',
    ai_summary_link_access_log: 'AI要約リンクアクセス監査ログ',
  };
  const pragmaCols: Record<string, string[]> = {
    ai_summary_log: ['id', 'request_id', 'summary'],
    ai_summary_reviews: ['id', 'summary_request_id', 'rating'],
    commit_agent_log: ['id', 'request_id', 'detected_agent_name'],
    ai_summary_link_access_log: ['id', 'route', 'request_id', 'found', 'issue_code', 'created_at'],
  };

  it('指定テーブルと同グループの全テーブルを返す', () => {
    const result = buildGroupErData('ai_summary_reviews', TABLE_GROUP_MAP, descriptions, TABLE_COLUMN_KEYS, COLUMN_FK_TARGETS, pragmaCols);
    expect(result).not.toBeNull();
    expect(result!.groupName).toBe('ai');
    expect(result!.groupLabel).toBe('AI Summary');
    expect(result!.tables.map(t => t.tableName)).toContain('ai_summary_log');
    expect(result!.tables.map(t => t.tableName)).toContain('ai_summary_reviews');
  });

  it('各テーブルのカラムにPK/FK情報が含まれる', () => {
    const result = buildGroupErData('ai_summary_reviews', TABLE_GROUP_MAP, descriptions, TABLE_COLUMN_KEYS, COLUMN_FK_TARGETS, pragmaCols);
    const reviews = result!.tables.find(t => t.tableName === 'ai_summary_reviews')!;
    const idCol = reviews.columns.find(c => c.name === 'id')!;
    expect(idCol.keyType).toBe('pk');
    const fkCol = reviews.columns.find(c => c.name === 'summary_request_id')!;
    expect(fkCol.keyType).toBe('fk');
    expect(fkCol.fkTarget).toBe('ai_summary_log');
  });

  it('存在しないテーブルにはnullを返す', () => {
    const result = buildGroupErData('nonexistent', TABLE_GROUP_MAP, descriptions, TABLE_COLUMN_KEYS, COLUMN_FK_TARGETS, pragmaCols);
    expect(result).toBeNull();
  });

  it('グループカラーが返される', () => {
    const result = buildGroupErData('ai_summary_log', TABLE_GROUP_MAP, descriptions, TABLE_COLUMN_KEYS, COLUMN_FK_TARGETS, pragmaCols);
    expect(result!.groupColor).toBe('#d29922');
  });

  it('commit_agent_log が AI グループに含まれ、request_id のFK先が解決される', () => {
    const result = buildGroupErData('commit_agent_log', TABLE_GROUP_MAP, descriptions, TABLE_COLUMN_KEYS, COLUMN_FK_TARGETS, pragmaCols);
    expect(result).not.toBeNull();
    expect(result!.groupName).toBe('ai');
    expect(result!.tables.map((t) => t.tableName)).toContain('commit_agent_log');
    const commitAgentTable = result!.tables.find((t) => t.tableName === 'commit_agent_log')!;
    const requestIdCol = commitAgentTable.columns.find((c) => c.name === 'request_id')!;
    expect(requestIdCol.fkTarget).toBe('ai_summary_log');
  });

  it('ai_summary_link_access_log.request_id のFK先が ai_summary_log に解決される', () => {
    const result = buildGroupErData('ai_summary_link_access_log', TABLE_GROUP_MAP, descriptions, TABLE_COLUMN_KEYS, COLUMN_FK_TARGETS, pragmaCols);
    expect(result).not.toBeNull();
    expect(result!.groupName).toBe('ai');
    expect(result!.tables.map((t) => t.tableName)).toContain('ai_summary_link_access_log');
    const accessLogTable = result!.tables.find((t) => t.tableName === 'ai_summary_link_access_log')!;
    const requestIdCol = accessLogTable.columns.find((c) => c.name === 'request_id')!;
    expect(requestIdCol.fkTarget).toBe('ai_summary_log');
  });

  it('COLUMN_FK_TARGETS に ai_summary_link_access_log.request_id が登録されている', () => {
    expect(COLUMN_FK_TARGETS.ai_summary_link_access_log).toBeDefined();
    expect(COLUMN_FK_TARGETS.ai_summary_link_access_log.request_id).toBe('ai_summary_log');
  });

  it('COLUMN_FK_TARGETS に commit_agent_log.request_id が登録されている', () => {
    expect(COLUMN_FK_TARGETS.commit_agent_log).toBeDefined();
    expect(COLUMN_FK_TARGETS.commit_agent_log.request_id).toBe('ai_summary_log');
  });
});
