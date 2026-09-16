import { describe, expect, it, vi } from 'vitest';
import { interpretAichatSlashCommand } from './utils/aichatSlashCommand';

const baseDeps = { fetchLatestCommitAgentLog: async () => null };

describe('/neko tree', () => {
  it('既定2階層でowner/repoのツリーを取得する', async () => {
    const repositoryTree = vi.fn().mockResolvedValue('## owner/repo ディレクトリツリー');
    const result = await interpretAichatSlashCommand('/neko tree owner/repo', new Date(), { ...baseDeps, repositoryTree });
    expect(repositoryTree).toHaveBeenCalledWith('owner/repo', 2, false);
    expect(result).toEqual({ handled: true, response: '## owner/repo ディレクトリツリー' });
  });

  it('3・4階層と隠しパス表示オプションを渡せる', async () => {
    const repositoryTree = vi.fn().mockResolvedValue('tree');
    await interpretAichatSlashCommand('/neko tree owner/repo --depth 3 --all', new Date(), { ...baseDeps, repositoryTree });
    await interpretAichatSlashCommand('/neko tree owner/repo -d 4 -a', new Date(), { ...baseDeps, repositoryTree });
    expect(repositoryTree).toHaveBeenNthCalledWith(1, 'owner/repo', 3, true);
    expect(repositoryTree).toHaveBeenNthCalledWith(2, 'owner/repo', 4, true);
  });

  it('不正な深さや不足した引数をAPI呼び出し前に拒否する', async () => {
    const repositoryTree = vi.fn();
    const missing = await interpretAichatSlashCommand('/neko tree', new Date(), { ...baseDeps, repositoryTree });
    const invalidDepth = await interpretAichatSlashCommand('/neko tree owner/repo --depth 5', new Date(), { ...baseDeps, repositoryTree });
    expect(missing.handled && missing.response).toContain('リポジトリを指定');
    expect(invalidDepth.handled && invalidDepth.response).toContain('1から4');
    expect(repositoryTree).not.toHaveBeenCalled();
  });
});
