import { describe, it, expect, vi } from 'vitest';
import { saveSummaryFiles } from './aiSummaryFiles';

describe('saveSummaryFiles', () => {
  it('filePathsが空ならdb.batchを呼ばない', async () => {
    const db = { batch: vi.fn(), prepare: vi.fn() } as unknown as D1Database;
    await saveSummaryFiles(db, 'req-1', [], '2026-10-10T00:00:00.000Z');
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('ファイル毎にINSERT OR IGNORE文をbatchで実行し、拡張子も一緒に保存する', async () => {
    const bind = vi.fn().mockReturnValue('bound-stmt');
    const prepare = vi.fn().mockReturnValue({ bind });
    const batch = vi.fn().mockResolvedValue([]);
    const db = { batch, prepare } as unknown as D1Database;
    await saveSummaryFiles(db, 'req-1', ['src/index.ts', 'README.md'], '2026-10-10T00:00:00.000Z');
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(prepare.mock.calls[0][0]).toContain('INSERT OR IGNORE INTO ai_summary_files');
    expect(prepare.mock.calls[0][0]).toContain('SELECT id, ?, ?, ? FROM ai_summary_log WHERE request_id = ?');
    expect(bind).toHaveBeenNthCalledWith(1, 'src/index.ts', 'ts', '2026-10-10T00:00:00.000Z', 'req-1');
    expect(bind).toHaveBeenNthCalledWith(2, 'README.md', 'md', '2026-10-10T00:00:00.000Z', 'req-1');
    expect(batch).toHaveBeenCalledWith(['bound-stmt', 'bound-stmt']);
  });

  it('拡張子がないファイルは「(拡張子なし)」として保存する', async () => {
    const bind = vi.fn().mockReturnValue('bound-stmt');
    const prepare = vi.fn().mockReturnValue({ bind });
    const batch = vi.fn().mockResolvedValue([]);
    const db = { batch, prepare } as unknown as D1Database;
    await saveSummaryFiles(db, 'req-1', ['Dockerfile'], '2026-10-10T00:00:00.000Z');
    expect(bind).toHaveBeenCalledWith('Dockerfile', '(拡張子なし)', '2026-10-10T00:00:00.000Z', 'req-1');
  });
});
