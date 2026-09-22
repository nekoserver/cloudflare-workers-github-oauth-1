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
    expect(updateTreeView).toHaveBeenCalledWith(false);
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

  it('更新対象が0件なら実行成功と表示せず、設定確認を促す', async () => {
    const result = await interpretAichatSlashCommand('/neko tvupdate', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView: async () => ({ status: 'no_repositories', updated: [], unchanged: [], failed: [] }),
    });

    expect(result.handled && result.response).toContain('更新対象のリポジトリが0件');
    expect(result.handled && result.response).toContain('installation_permissions');
    expect(result.handled && result.response).not.toContain('手動更新を実行しました');
  });

  it('ヘルプにコマンドを掲載する', () => {
    expect(formatAichatSlashCommandHelp()).toContain('| /neko tvupdate [owner/repo] [--force] |');
  });

  it('owner/repoをリポジトリ指定として確定してから後続オプションを解釈する', async () => {
    const updateTreeView = vi.fn().mockResolvedValue({
      status: 'updated' as const, updated: [], unchanged: ['nekoserver/repo-a'], failed: [],
    });
    await interpretAichatSlashCommand('/neko tvupdate nekoserver/repo-a --force', new Date(), {
      fetchLatestCommitAgentLog: async () => null, updateTreeView,
    });
    expect(updateTreeView).toHaveBeenCalledWith(true, 'nekoserver/repo-a');
  });

  it('スラッシュを含む不正な指定はオプション扱いせず形式エラーにする', async () => {
    const updateTreeView = vi.fn();
    const result = await interpretAichatSlashCommand('/neko tvupdate owner/repo/extra --force', new Date(), {
      fetchLatestCommitAgentLog: async () => null, updateTreeView,
    });
    expect(updateTreeView).not.toHaveBeenCalled();
    expect(result.handled && result.response).toContain('owner/repo 形式');
  });

  it('--forceを強制更新フラグとして渡す', async () => {
    const updateTreeView = vi.fn().mockResolvedValue({
      status: 'updated' as const, updated: [], unchanged: ['nekoserver/repo-a'], failed: [],
    });

    await interpretAichatSlashCommand('/neko tvupdate --force', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView,
    });

    expect(updateTreeView).toHaveBeenCalledWith(true);
  });

  it.each(['—force', '–force', '－－force'])(
    'チャットやIMEでハイフンが変換された%sも強制更新として扱う',
    async (forceOption) => {
      const updateTreeView = vi.fn().mockResolvedValue({
        status: 'updated' as const, updated: [], unchanged: [], failed: [],
      });

      await interpretAichatSlashCommand(`/neko tvupdate ${forceOption}`, new Date(), {
        fetchLatestCommitAgentLog: async () => null,
        updateTreeView,
      });

      expect(updateTreeView).toHaveBeenCalledWith(true);
    }
  );

  it('未知のオプションを拒否する', async () => {
    const updateTreeView = vi.fn();
    const result = await interpretAichatSlashCommand('/neko tvupdate --unknown', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView,
    });

    expect(updateTreeView).not.toHaveBeenCalled();
    expect(result.handled && result.response).toContain('--force');
  });

  it('--forceのGitHub最新状態と本番DBの差分を報告する', async () => {
    const result = await interpretAichatSlashCommand('/neko tvupdate --force', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView: async () => ({
        status: 'updated', updated: ['nekoserver/changed'], unchanged: [], failed: [],
        differences: [
          { repoName: 'nekoserver/changed', status: 'changed' },
          { repoName: 'nekoserver/same', status: 'unchanged' },
        ],
      }),
    });

    expect(result.handled && result.response).toContain('GitHub最新状態と本番DBの差分');
    expect(result.handled && result.response).toContain('本番DBを更新せずに差分を確認しました');
    expect(result.handled && result.response).toContain('| nekoserver/changed | 内容変更 |');
    expect(result.handled && result.response).toContain('一致: 1件');
  });
});
