import { describe, expect, it, vi } from 'vitest';
import { fetchRepositoryTreeMarkdown } from './githubRepositoryTree';

describe('fetchRepositoryTreeMarkdown', () => {
  it('Repository APIのdefault_branchをTrees APIへ渡す', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: 'develop/next' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tree: [{ path: 'src', type: 'tree' }] }), { status: 200 }));
    const result = await fetchRepositoryTreeMarkdown({
      owner: 'owner', repo: 'repo', accessToken: 'secret', depth: 2, showHidden: false, fetchImpl,
    });
    expect(fetchImpl.mock.calls[1][0]).toBe('https://api.github.com/repos/owner/repo/git/trees/develop%2Fnext?recursive=1');
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({ 'X-GitHub-Api-Version': '2022-11-28' });
    expect(result).toContain('- owner/repo/\n  - src/');
  });

  it('Repository APIの失敗をTrees APIの失敗と区別する', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }));
    await expect(fetchRepositoryTreeMarkdown({
      owner: 'owner', repo: 'missing', accessToken: 'secret', depth: 2, showHidden: false, fetchImpl,
    })).rejects.toThrow('リポジトリ情報の取得に失敗しました(404: Not Found)');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
