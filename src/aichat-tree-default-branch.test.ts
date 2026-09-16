import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('/neko tree GitHub API wiring', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

  it('存在しないHEAD疑似refではなくRepository APIのdefault_branchをTrees APIへ渡す', () => {
    expect(source).toContain("repoRes.json<{ default_branch?: unknown }>()");
    expect(source).toContain("encodeURIComponent(repoBody.default_branch)");
    expect(source).not.toContain('/git/trees/HEAD?recursive=1');
  });

  it('GitHub REST APIのバージョンを明示する', () => {
    expect(source).toContain("'X-GitHub-Api-Version': '2022-11-28'");
  });
});
