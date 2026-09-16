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

  it('globでファイル名を絞り込み、ファイルだけを得られる', () => {
    const input = 'src\ttree\nsrc/lib.rs\tblob\nsrc/app.ts\tblob\nREADME.md\tblob';
    expect(formatTreeViaWasm(input, 'repo', 3, { pattern: '*.rs', filesOnly: true })).toBe(
      '- repo/\n  - src/\n    - lib.rs',
    );
  });

  it('タイムスタンプの新しい順と逆順に並べられる', () => {
    const input = 'old.txt\tblob\t1767225600000\nnew.txt\tblob\t1788220800000';
    const newest = formatTreeViaWasm(input, 'repo', 1, { sort: 'time' });
    const oldest = formatTreeViaWasm(input, 'repo', 1, { sort: 'time', reverse: true });
    expect(newest.indexOf('new.txt')).toBeLessThan(newest.indexOf('old.txt'));
    expect(oldest.indexOf('old.txt')).toBeLessThan(oldest.indexOf('new.txt'));
  });

  it('隠しファイルとディレクトリ限定をオプションで表示できる', () => {
    const input = '.github\ttree\nsrc\ttree\nsrc/lib.rs\tblob';
    expect(formatTreeViaWasm(input, 'repo', 2, { includeHidden: true, directoriesOnly: true }))
      .toBe('- repo/\n  - .github/\n  - src/');
  });
});
