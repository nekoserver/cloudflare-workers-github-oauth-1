import { describe, expect, it } from 'vitest';
import { mergeColumnsFromRows } from '../index';

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
