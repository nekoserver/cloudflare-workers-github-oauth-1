import { describe, expect, it, vi } from 'vitest';
import { interpretAichatSlashCommand } from './utils/aichatSlashCommand';

const baseDeps = { fetchLatestCommitAgentLog: async () => null };

describe('/neko tree', () => {
  it('既定2階層でowner/repoのツリーを取得する', async () => {
    const repositoryTree = vi.fn().mockResolvedValue('## owner/repo ディレクトリツリー');
    const result = await interpretAichatSlashCommand('/neko tree owner/repo', new Date(), { ...baseDeps, repositoryTree });
    expect(repositoryTree).toHaveBeenCalledWith('owner/repo', 2);
    expect(result).toEqual({ handled: true, response: '## owner/repo ディレクトリツリー' });
  });

  it('--depthの空白区切り・イコール区切り・略記を解釈する', async () => {
    const repositoryTree = vi.fn().mockResolvedValue('tree');
    await interpretAichatSlashCommand('/neko tree owner/repo --depth 3', new Date(), { ...baseDeps, repositoryTree });
    await interpretAichatSlashCommand('/neko tree owner/repo --depth=4', new Date(), { ...baseDeps, repositoryTree });
    await interpretAichatSlashCommand('/neko tree owner/repo -d=1', new Date(), { ...baseDeps, repositoryTree });
    expect(repositoryTree).toHaveBeenNthCalledWith(1, 'owner/repo', 3);
    expect(repositoryTree).toHaveBeenNthCalledWith(2, 'owner/repo', 4);
    expect(repositoryTree).toHaveBeenNthCalledWith(3, 'owner/repo', 1);
  });

  it('em dashで入力された—depthも解釈する', async () => {
    const repositoryTree = vi.fn().mockResolvedValue('tree');
    await interpretAichatSlashCommand('/neko tree owner/repo —depth 3', new Date(), { ...baseDeps, repositoryTree });
    expect(repositoryTree).toHaveBeenCalledWith('owner/repo', 3);
  });

  it('高負荷な--allオプションは受け付けない', async () => {
    const repositoryTree = vi.fn();
    const result = await interpretAichatSlashCommand('/neko tree owner/repo --all', new Date(), { ...baseDeps, repositoryTree });
    expect(result.handled && result.response).toContain('不明なオプション');
    expect(repositoryTree).not.toHaveBeenCalled();
  });

  it('不正な深さや不足した引数をAPI呼び出し前に拒否する', async () => {
    const repositoryTree = vi.fn();
    const missing = await interpretAichatSlashCommand('/neko tree', new Date(), { ...baseDeps, repositoryTree });
    const invalidDepth = await interpretAichatSlashCommand('/neko tree owner/repo --depth 5', new Date(), { ...baseDeps, repositoryTree });
    expect(missing.handled && missing.response).toContain('リポジトリを指定');
    expect(invalidDepth.handled && invalidDepth.response).toContain('1から4');
    expect(repositoryTree).not.toHaveBeenCalled();
  });

  it('GitHub Trees APIが404を返した場合は取得エラーをそのまま表示する', async () => {
    const repositoryTree = vi.fn().mockRejectedValue(
      new Error('ディレクトリツリーの取得に失敗しました(404: Not Found)'),
    );

    const result = await interpretAichatSlashCommand(
      '/neko tree missing-owner/missing-repo',
      new Date(),
      { ...baseDeps, repositoryTree },
    );

    expect(repositoryTree).toHaveBeenCalledWith('missing-owner/missing-repo', 2);
    expect(result).toEqual({
      handled: true,
      response: '❌ /neko tree の実行中にエラーが発生しました: ディレクトリツリーの取得に失敗しました(404: Not Found)',
    });
  });
});
