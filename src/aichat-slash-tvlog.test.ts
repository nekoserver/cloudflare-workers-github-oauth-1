import { describe, expect, it, vi } from 'vitest';
import {
  formatAichatSlashCommandHelp,
  formatTreeViewUpdateLogs,
  interpretAichatSlashCommand,
  type TreeViewUpdateLogRow,
} from './utils/aichatSlashCommand';

const rows: TreeViewUpdateLogRow[] = [
  { id: 2, repo_name: 'nekoserver/dynamicneko', update_source: 'manual', changed: 1, executed_at: '2026-09-22T02:00:00.000Z' },
  { id: 1, repo_name: 'nekoserver/example', update_source: 'scheduled', changed: 0, executed_at: '2026-09-22T01:00:00.000Z' },
];

describe('/neko tvlog', () => {
  it('tree-view更新履歴を表に整形する', async () => {
    const fetchTreeViewUpdateLogs = vi.fn().mockResolvedValue(rows);
    const result = await interpretAichatSlashCommand('/neko tvlog', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      fetchTreeViewUpdateLogs,
    });

    expect(result).toEqual({ handled: true, response: formatTreeViewUpdateLogs(rows) });
    expect(result.handled && result.response).toContain('| 2026-09-22T02:00:00.000Z | nekoserver/dynamicneko | 手動 | 更新あり |');
    expect(result.handled && result.response).toContain('| 2026-09-22T01:00:00.000Z | nekoserver/example | cron | 変更なし |');
    expect(fetchTreeViewUpdateLogs).toHaveBeenCalledOnce();
  });

  it('履歴がない場合とDB未設定を区別する', async () => {
    const empty = await interpretAichatSlashCommand('/neko tvlog', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      fetchTreeViewUpdateLogs: async () => [],
    });
    const unavailable = await interpretAichatSlashCommand('/neko tvlog', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(empty.handled && empty.response).toContain('更新履歴はありません');
    expect(unavailable.handled && unavailable.response).toContain('DB未設定');
  });

  it('ヘルプにコマンドを掲載する', () => {
    expect(formatAichatSlashCommandHelp()).toContain('| /neko tvlog |');
  });
});
