import { describe, it, expect } from 'vitest';
import { getCfContainersPage } from './cfContainers';

// template literal内の'\n'が実改行になりページ全体のscriptが壊れる事故(CLAUDE.mdルール29)の回帰防止。
describe('getCfContainersPage', () => {
  it('埋め込みscriptがJavaScriptとして構文エラーにならない', () => {
    const html = getCfContainersPage();
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const src of scripts) {
      expect(() => new Function(src)).not.toThrow();
    }
  });
});
