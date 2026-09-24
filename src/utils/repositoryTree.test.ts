import { describe, expect, it } from 'vitest';
import {
  buildGithubRepositoryApiUrl,
  buildGithubTreeApiUrl,
  fetchGithubRepositoryWithPublicFallback,
  parseDefaultBranch,
} from './repositoryTree';

describe('repository tree GitHub API helpers', () => {
  it('Repository APIのURLを組み立てる', () => {
    expect(buildGithubRepositoryApiUrl('owner', 'repo')).toBe('https://api.github.com/repos/owner/repo');
  });

  it('認証付き取得が404でも公開リポジトリを匿名で再取得する', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"message":"Not Found"}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{"default_branch":"main"}', { status: 200 }));
    const result = await fetchGithubRepositoryWithPublicFallback(
      'https://api.github.com/repos/owner/repo',
      { Authorization: 'Bearer token', Accept: 'application/vnd.github+json' },
      fetchMock,
    );

    expect(result.response.status).toBe(200);
    expect(result.usedAnonymousFallback).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.any(String), {
      headers: { Accept: 'application/vnd.github+json' },
    });
  });

  it('匿名取得も404なら失敗応答を返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const result = await fetchGithubRepositoryWithPublicFallback(
      'https://api.github.com/repos/missing/repo',
      { Authorization: 'Bearer token' },
      fetchMock,
    );

    expect(result.response.status).toBe(404);
    expect(result.usedAnonymousFallback).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('HEADではなく既定ブランチ名でTrees APIのURLを組み立てる', () => {
    expect(buildGithubTreeApiUrl('owner', 'repo', 'feature/tree')).toBe(
      'https://api.github.com/repos/owner/repo/git/trees/feature%2Ftree?recursive=1',
    );
    expect(buildGithubTreeApiUrl('owner', 'repo', 'main')).not.toContain('/HEAD');
  });

  it('Repository APIの応答から有効な既定ブランチだけを取り出す', () => {
    expect(parseDefaultBranch({ default_branch: 'main' })).toBe('main');
    expect(parseDefaultBranch({ default_branch: '' })).toBeNull();
    expect(parseDefaultBranch({ default_branch: 42 })).toBeNull();
    expect(parseDefaultBranch(null)).toBeNull();
  });
});
