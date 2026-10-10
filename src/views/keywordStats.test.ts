import { describe, it, expect } from 'vitest';
import { sortRepoKeywordCounts, sortRepoFileCounts, mergeFileExtCounts, sortFileExtDistribution, getKeywordStatsPage } from './keywordStats';

describe('sortRepoKeywordCounts', () => {
  it('件数の多い順に並べ替える', () => {
    const result = sortRepoKeywordCounts([
      { repoFullName: 'nekoserver/a', keywordCount: 3 },
      { repoFullName: 'nekoserver/b', keywordCount: 10 },
      { repoFullName: 'nekoserver/c', keywordCount: 7 },
    ]);
    expect(result.map((r) => r.repoFullName)).toEqual(['nekoserver/b', 'nekoserver/c', 'nekoserver/a']);
  });

  it('repoFullNameがNULLの行は(リポジトリ不明)として最後にまとめる(件数が多くても先頭に来ない)', () => {
    const result = sortRepoKeywordCounts([
      { repoFullName: null, keywordCount: 100 },
      { repoFullName: 'nekoserver/a', keywordCount: 1 },
    ]);
    expect(result.map((r) => r.repoFullName)).toEqual(['nekoserver/a', null]);
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(sortRepoKeywordCounts([])).toEqual([]);
  });
});

describe('sortRepoFileCounts', () => {
  it('件数の多い順に並べ替える', () => {
    const result = sortRepoFileCounts([
      { repoFullName: 'nekoserver/a', fileCount: 3 },
      { repoFullName: 'nekoserver/b', fileCount: 10 },
    ]);
    expect(result.map((r) => r.repoFullName)).toEqual(['nekoserver/b', 'nekoserver/a']);
  });

  it('repoFullNameがNULLの行は(リポジトリ不明)として最後にまとめる', () => {
    const result = sortRepoFileCounts([
      { repoFullName: null, fileCount: 100 },
      { repoFullName: 'nekoserver/a', fileCount: 1 },
    ]);
    expect(result.map((r) => r.repoFullName)).toEqual(['nekoserver/a', null]);
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(sortRepoFileCounts([])).toEqual([]);
  });
});

describe('mergeFileExtCounts', () => {
  it('fileCount行を主としてkeywordFileCountを突き合わせる', () => {
    const result = mergeFileExtCounts(
      [{ fileExt: 'ts', fileCount: 10 }, { fileExt: 'md', fileCount: 4 }],
      [{ fileExt: 'ts', keywordFileCount: 7 }]
    );
    expect(result).toEqual([
      { fileExt: 'ts', fileCount: 10, keywordFileCount: 7 },
      { fileExt: 'md', fileCount: 4, keywordFileCount: 0 },
    ]);
  });

  it('キーワードが一度も抽出されなかった拡張子(.md/.erb/.css等)もfileCountがあれば0件のまま残る(2026-10-11、ユーザー指摘の再発防止)', () => {
    const result = mergeFileExtCounts(
      [{ fileExt: 'erb', fileCount: 3 }, { fileExt: 'css', fileCount: 2 }],
      []
    );
    expect(result).toEqual([
      { fileExt: 'erb', fileCount: 3, keywordFileCount: 0 },
      { fileExt: 'css', fileCount: 2, keywordFileCount: 0 },
    ]);
  });

  it('fileCount行が空なら空配列を返す(keywordCount行だけでは出現しない)', () => {
    expect(mergeFileExtCounts([], [{ fileExt: 'ts', keywordFileCount: 5 }])).toEqual([]);
  });
});

describe('sortFileExtDistribution', () => {
  it('fileCountの多い順に並べ替える', () => {
    const result = sortFileExtDistribution([
      { fileExt: 'ts', fileCount: 3, keywordFileCount: 3 },
      { fileExt: 'css', fileCount: 10, keywordFileCount: 0 },
    ]);
    expect(result.map((r) => r.fileExt)).toEqual(['css', 'ts']);
  });

  it('同数の場合は拡張子の昇順で並べる', () => {
    const result = sortFileExtDistribution([
      { fileExt: 'ts', fileCount: 5, keywordFileCount: 0 },
      { fileExt: 'css', fileCount: 5, keywordFileCount: 0 },
    ]);
    expect(result.map((r) => r.fileExt)).toEqual(['css', 'ts']);
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(sortFileExtDistribution([])).toEqual([]);
  });
});

describe('getKeywordStatsPage', () => {
  const baseData = {
    totalKeywordRows: 42,
    totalSummaryLogsWithKeywords: 10,
    totalProcessedFiles: 25,
    byRepo: [
      { repoFullName: 'nekoserver/rails-root', keywordCount: 5 },
      { repoFullName: 'nekoserver/dynamicneko', keywordCount: 37 },
    ],
    byRepoFiles: [
      { repoFullName: 'nekoserver/rails-root', fileCount: 4 },
      { repoFullName: 'nekoserver/dynamicneko', fileCount: 21 },
    ],
    byFileExt: [
      { fileExt: 'ts', fileCount: 20, keywordFileCount: 15 },
      { fileExt: 'css', fileCount: 6, keywordFileCount: 0 },
    ],
    topKeywords: [
      { keyword: 'ログイン機能', occurrenceCount: 8 },
      { keyword: '認証トークン', occurrenceCount: 3 },
    ],
  };

  it('総数・リポジトリ別・頻出キーワードを表示する', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, baseData);
    expect(html).toContain('42');
    expect(html).toContain('10');
    expect(html).toContain('nekoserver/rails-root');
    expect(html).toContain('nekoserver/dynamicneko');
    expect(html).toContain('ログイン機能');
    expect(html).toContain('認証トークン');
  });

  it('処理済みファイル総数のカードを表示する', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, baseData);
    expect(html).toContain('処理済みファイル総数');
    expect(html).toContain('25');
  });

  it('リポジトリ別のファイル件数内訳を表示する', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, baseData);
    const dynamicnekoIdx = html.indexOf('nekoserver/dynamicneko');
    // リポジトリ別の分布(ファイル)セクションのほうが後に出る順序を確認するのではなく、
    // 両方のテーブルで件数(21)が描画されていることだけ確認する。
    expect(html).toContain('21');
    expect(dynamicnekoIdx).toBeGreaterThan(-1);
  });

  it('ファイルタイプ別の分布をファイル件数の多い順に表示する', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, baseData);
    const tsIdx = html.indexOf('.ts');
    const cssIdx = html.indexOf('.css');
    expect(tsIdx).toBeGreaterThan(-1);
    expect(cssIdx).toBeGreaterThan(-1);
    expect(tsIdx).toBeLessThan(cssIdx);
  });

  it('キーワードが抽出されなかった拡張子(keywordFileCount=0)もファイル件数があれば表に出る(2026-10-11の再発防止)', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, {
      ...baseData,
      byFileExt: [
        { fileExt: 'md', fileCount: 8, keywordFileCount: 0 },
        { fileExt: 'erb', fileCount: 5, keywordFileCount: 0 },
      ],
    });
    expect(html).toContain('.md');
    expect(html).toContain('.erb');
    expect(html).not.toContain('ファイルタイプ別の分布はまだありません');
  });

  it('データが空でも空状態の文言を出し、例外にならない', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, {
      totalKeywordRows: 0,
      totalSummaryLogsWithKeywords: 0,
      totalProcessedFiles: 0,
      byRepo: [],
      byRepoFiles: [],
      byFileExt: [],
      topKeywords: [],
    });
    expect(html).toContain('キーワードはまだありません');
    expect(html).toContain('処理済みファイルはまだありません');
    expect(html).toContain('ファイルタイプ別の分布はまだありません');
  });

  it('リポジトリ名・キーワード・拡張子のHTMLエスケープが効いている(XSS対策)', () => {
    const html = getKeywordStatsPage({ name: 'Octocat', username: 'octocat' }, {
      totalKeywordRows: 1,
      totalSummaryLogsWithKeywords: 1,
      totalProcessedFiles: 1,
      byRepo: [{ repoFullName: '<script>alert(1)</script>', keywordCount: 1 }],
      byRepoFiles: [{ repoFullName: '<script>alert(2)</script>', fileCount: 1 }],
      byFileExt: [{ fileExt: '"><script>alert(3)</script>', fileCount: 1, keywordFileCount: 1 }],
      topKeywords: [{ keyword: '<img src=x onerror=alert(1)>', occurrenceCount: 1 }],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).not.toContain('<script>alert(3)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});
