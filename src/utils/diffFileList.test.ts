import { describe, it, expect } from 'vitest';
import { parseChangedFilePaths, fileExtension } from './diffFileList';

describe('parseChangedFilePaths', () => {
  it('diffが空文字なら空配列', () => {
    expect(parseChangedFilePaths('')).toEqual([]);
  });

  it('diff --git行が無ければ空配列', () => {
    expect(parseChangedFilePaths('some unrelated text\nwithout diff headers')).toEqual([]);
  });

  it('複数ファイルのdiff --git行からb側のパスを出現順に返す', () => {
    const diff = [
      'diff --git a/src/index.ts b/src/index.ts',
      '--- a/src/index.ts',
      '+++ b/src/index.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
      'diff --git a/README.md b/README.md',
      '--- a/README.md',
      '+++ b/README.md',
    ].join('\n');
    expect(parseChangedFilePaths(diff)).toEqual(['src/index.ts', 'README.md']);
  });

  it('リネームされたファイルもb側のパスとして取れる', () => {
    const diff = 'diff --git a/old-name.ts b/new-name.ts\nsimilarity index 100%\nrename from old-name.ts\nrename to new-name.ts';
    expect(parseChangedFilePaths(diff)).toEqual(['new-name.ts']);
  });

  it('同じファイルのdiff --git行が重複していても1回だけ返す', () => {
    const diff = 'diff --git a/x.ts b/x.ts\n+line\ndiff --git a/x.ts b/x.ts\n+line2';
    expect(parseChangedFilePaths(diff)).toEqual(['x.ts']);
  });
});

describe('fileExtension', () => {
  it('通常の拡張子を小文字で返す', () => {
    expect(fileExtension('src/views/foo.TS')).toBe('ts');
  });

  it('ネストしたパスでも末尾のファイル名から拡張子を取る', () => {
    expect(fileExtension('a/b/c/style.module.scss')).toBe('scss');
  });

  it('拡張子がないファイル(Dockerfile)は「(拡張子なし)」', () => {
    expect(fileExtension('Dockerfile')).toBe('(拡張子なし)');
  });

  it('dotfile(.gitignore)は拡張子として誤認識せず「(拡張子なし)」', () => {
    expect(fileExtension('.gitignore')).toBe('(拡張子なし)');
  });

  it('パス区切りの前に拡張子らしきドットがあっても末尾ファイル名だけを見る', () => {
    expect(fileExtension('a.b/c/README')).toBe('(拡張子なし)');
  });
});
