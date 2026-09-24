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
    expect(updateTreeView).toHaveBeenCalledWith(undefined, false);
    expect(result.handled && result.response).toContain('手動更新を実行しました');
    expect(result.handled && result.response).toContain('更新あり: 1件');
    expect(result.handled && result.response).toContain('変更なし: 1件');
  });

  it('手動更新にかかった時間を応答に表示する', async () => {
    vi.useFakeTimers();
    try {
      const updateTreeView = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1234));
        return {
          status: 'updated' as const,
          updated: [],
          unchanged: [],
          failed: [],
        };
      });

      const resultPromise = interpretAichatSlashCommand('/neko tvupdate', new Date(), {
        fetchLatestCommitAgentLog: async () => null,
        updateTreeView,
      });
      await vi.advanceTimersByTimeAsync(1234);
      const result = await resultPromise;

      expect(result.handled && result.response).toContain('実行時間: 1.234秒');
    } finally {
      vi.useRealTimers();
    }
  });

  it('必要なD1テーブルがない場合は更新しない', async () => {
    const missing = await interpretAichatSlashCommand('/neko tvupdate', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView: async () => ({ status: 'table_missing', updated: [], unchanged: [], failed: [] }),
    });

    expect(missing.handled && missing.response).toContain('必要なD1テーブルがありません');
  });

  it('直近の実行履歴があっても待機せず毎回GitHubから再取得する(1時間規制は撤去済み)', async () => {
    const updateTreeView = vi.fn().mockResolvedValue({
      status: 'updated' as const, updated: ['nekoserver/repo-a'], unchanged: [], failed: [],
    });

    const result = await interpretAichatSlashCommand('/neko tvupdate', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView,
    });

    expect(updateTreeView).toHaveBeenCalledOnce();
    expect(result.handled && result.response).not.toContain('過去1時間以内');
    expect(result.handled && result.response).toContain('更新あり: 1件');
  });

  it('更新対象が0件なら実行成功と表示せず、設定確認を促す', async () => {
    const result = await interpretAichatSlashCommand('/neko tvupdate', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView: async () => ({ status: 'no_repositories', updated: [], unchanged: [], failed: [] }),
    });

    expect(result.handled && result.response).toContain('更新対象のリポジトリが0件');
    expect(result.handled && result.response).toContain('tree_view_snapshots');
    expect(result.handled && result.response).not.toContain('手動更新を実行しました');
  });

  it('ヘルプにコマンドを掲載する', () => {
    expect(formatAichatSlashCommandHelp()).toContain('| /neko tvupdate [--dryrun] [-R owner/repo] |');
  });

  it('--forceは互換性のため受け付けるが、渡す引数には影響しない(no-op)', async () => {
    const updateTreeView = vi.fn().mockResolvedValue({
      status: 'updated' as const, updated: [], unchanged: ['nekoserver/repo-a'], failed: [],
    });

    await interpretAichatSlashCommand('/neko tvupdate --force', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView,
    });

    expect(updateTreeView).toHaveBeenCalledWith(undefined, false);
  });

  it.each(['—force', '–force', '－－force'])(
    'チャットやIMEでハイフンが変換された%sもno-opの--forceとして受け付ける',
    async (forceOption) => {
      const updateTreeView = vi.fn().mockResolvedValue({
        status: 'updated' as const, updated: [], unchanged: [], failed: [],
      });

      await interpretAichatSlashCommand(`/neko tvupdate ${forceOption}`, new Date(), {
        fetchLatestCommitAgentLog: async () => null,
        updateTreeView,
      });

      expect(updateTreeView).toHaveBeenCalledWith(undefined, false);
    }
  );

  it('変換された--forceでも更新結果と実行時間を表示する', async () => {
    vi.useFakeTimers();
    try {
      const updateTreeView = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return {
          status: 'updated' as const,
          updated: ['nekoserver/repo-a'],
          unchanged: [],
          failed: [],
        };
      });

      const resultPromise = interpretAichatSlashCommand('/neko tvupdate —force', new Date(), {
        fetchLatestCommitAgentLog: async () => null,
        updateTreeView,
      });
      await vi.advanceTimersByTimeAsync(250);
      const result = await resultPromise;

      expect(updateTreeView).toHaveBeenCalledWith(undefined, false);
      expect(result.handled && result.response).toContain('更新あり: 1件');
      expect(result.handled && result.response).toContain('実行時間: 0.250秒');
    } finally {
      vi.useRealTimers();
    }
  });

  it('未知のオプションを拒否する', async () => {
    const updateTreeView = vi.fn();
    const result = await interpretAichatSlashCommand('/neko tvupdate --unknown', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView,
    });

    expect(updateTreeView).not.toHaveBeenCalled();
    expect(result.handled && result.response).toContain('--force');
  });

  it('-Rの直後の引数を対象リポジトリ名として渡す', async () => {
    const updateTreeView = vi.fn().mockResolvedValue({
      status: 'updated' as const, updated: ['nekoserver/repo-a'], unchanged: [], failed: [],
    });

    await interpretAichatSlashCommand('/neko tvupdate --force -R nekoserver/repo-a', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView,
    });

    expect(updateTreeView).toHaveBeenCalledWith('nekoserver/repo-a', false);
  });

  it('-Rの引数欠落と不正なリポジトリ名を拒否する', async () => {
    const updateTreeView = vi.fn();
    const missing = await interpretAichatSlashCommand('/neko tvupdate -R', new Date(), {
      fetchLatestCommitAgentLog: async () => null, updateTreeView,
    });
    const invalid = await interpretAichatSlashCommand('/neko tvupdate -R other/repo', new Date(), {
      fetchLatestCommitAgentLog: async () => null, updateTreeView,
    });

    expect(missing.handled && missing.response).toContain('-R owner/repo');
    expect(invalid.handled && invalid.response).toContain('nekoserver/');
    expect(updateTreeView).not.toHaveBeenCalled();
  });

  it('--dryrunのGitHub最新状態と本番DBの差分を報告する', async () => {
    const updateTreeView = vi.fn().mockResolvedValue({
      status: 'updated', updated: ['nekoserver/changed'], unchanged: [], failed: [],
      differences: [
        { repoName: 'nekoserver/changed', status: 'changed', addedPaths: ['src/new.ts'] },
        { repoName: 'nekoserver/same', status: 'unchanged', addedPaths: [] },
      ],
    });
    const result = await interpretAichatSlashCommand('/neko tvupdate --dryrun', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      updateTreeView,
    });

    expect(updateTreeView).toHaveBeenCalledWith(undefined, true);
    expect(result.handled && result.response).toContain('GitHub最新状態と本番DBの差分');
    expect(result.handled && result.response).toContain('本番DBを更新せずに差分を確認しました');
    expect(result.handled && result.response).toContain('| nekoserver/changed | src/new.ts |');
    expect(result.handled && result.response).toContain('一致: 1件');
  });
});
