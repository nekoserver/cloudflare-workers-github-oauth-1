import { describe, expect, it } from 'vitest';
import {
  buildGithubRepositoryApiUrl,
  buildGithubTreeApiUrl,
  parseDefaultBranch,
} from './repositoryTree';

describe('repository tree GitHub API helpers', () => {
  it('Repository APIのURLを組み立てる', () => {
    expect(buildGithubRepositoryApiUrl('owner', 'repo')).toBe('https://api.github.com/repos/owner/repo');
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
