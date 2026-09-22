import { describe, expect, it, vi } from 'vitest';
import { formatAichatSlashCommandHelp, interpretAichatSlashCommand } from './utils/aichatSlashCommand';

describe('/neko tvupdate', () => {
  it('tree-viewの手動更新を実行して結果を表示する', async () => {
    const updateTreeView = vi.fn().mockResolvedValue({
      status: 'updated' as const,
      updated: ['nekoserver/repo-a'],
      unchanged: ['nekoserver/repo-b'],
      failed: [],
    });

    const result = await interpretAichatSlashCommand('/neko tvupdate', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView,
    });

    expect(updateTreeView).toHaveBeenCalledOnce();
    expect(result.handled && result.response).toContain('手動更新を実行しました');
    expect(result.handled && result.response).toContain('更新あり: 1件');
    expect(result.handled && result.response).toContain('変更なし: 1件');
  });

  it('必要なD1テーブルがない場合と直近1時間に実行済みの場合は更新しない', async () => {
    const missing = await interpretAichatSlashCommand('/neko tvupdate', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView: async () => ({ status: 'table_missing', updated: [], unchanged: [], failed: [] }),
    });
    const recent = await interpretAichatSlashCommand('/neko tvupdate', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView: async () => ({ status: 'recent', updated: [], unchanged: [], failed: [] }),
    });

    expect(missing.handled && missing.response).toContain('必要なD1テーブルがありません');
    expect(recent.handled && recent.response).toContain('過去1時間以内');
  });

  it('ヘルプにコマンドを掲載する', () => {
    expect(formatAichatSlashCommandHelp()).toContain('| /neko tvupdate |');
  });
});
