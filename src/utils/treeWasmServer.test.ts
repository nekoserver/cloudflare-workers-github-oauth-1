import { describe, expect, it } from 'vitest';
import { formatTreeViaWasm } from './treeWasmServer';

describe('formatTreeViaWasm', () => {
  it('tree-wasmと同じ名前順・階層のMarkdownを返す', () => {
    const input = 'src/index.ts\tblob\nREADME.md\tblob\nsrc\ttree';
    expect(formatTreeViaWasm(input, 'owner/repo', 2)).toBe(
      '- owner/repo/\n  - README.md\n  - src/\n    - index.ts'
    );
  });

  it('深さを制御し、隠しパスは常に除外する', () => {
    const input = '.github\ttree\n.github/workflows/ci.yml\tblob\nsrc\ttree\nsrc/lib.rs\tblob';
    expect(formatTreeViaWasm(input, 'repo', 1)).toBe('- repo/\n  - src/');
    expect(formatTreeViaWasm(input, 'repo', 3)).not.toContain('.github/');
  });
});
