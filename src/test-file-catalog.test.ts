/**
 * 対象: /test-file-catalog ページ(src/views/testFileCatalog.ts)が使う純粋関数群。
 * テストファイルカタログ(test_file_catalog)の評価(A+〜E-)の数値変換・
 * リポジトリ別集計・全体評価分布・並び替えロジックを検証する。
 */
import { describe, it, expect } from 'vitest';
import {
  gradeToScore,
  scoreToGrade,
  buildRepoAggregates,
  buildOverallGradeDistribution,
  sortRows,
  getTestFileCatalogPage,
  type TestFileCatalogRow,
} from './views/testFileCatalog';

function makeRow(overrides: Partial<TestFileCatalogRow> = {}): TestFileCatalogRow {
  return {
    repo_name: 'nekoserver/example',
    file_path: 'src/foo.test.ts',
    test_count: 1,
    test_summary: 'foo',
    test_types: '値判定',
    grade: 'C',
    created_at: '2026-01-01',
    last_evaluated_at: '2026-01-01',
    ...overrides,
  };
}

describe('gradeToScore / scoreToGrade', () => {
  it('A+は最高値14、E-は最低値0を返す', () => {
    expect(gradeToScore('A+')).toBe(14);
    expect(gradeToScore('E-')).toBe(0);
  });

  it('未知の評価文字列は0(E-相当)として扱う', () => {
    expect(gradeToScore('不明')).toBe(0);
  });

  it('scoreToGradeはgradeToScoreの逆変換になっている(全15段階で往復一致)', () => {
    const levels = ['E-', 'E', 'E+', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
    for (const grade of levels) {
      expect(scoreToGrade(gradeToScore(grade))).toBe(grade);
    }
  });

  it('範囲外のスコアは0〜14にクランプする', () => {
    expect(scoreToGrade(-5)).toBe('E-');
    expect(scoreToGrade(100)).toBe('A+');
  });

  it('小数のスコアは四捨五入してから評価文字列に変換する', () => {
    expect(scoreToGrade(6.4)).toBe(scoreToGrade(6));
    expect(scoreToGrade(6.6)).toBe(scoreToGrade(7));
  });
});

describe('buildRepoAggregates', () => {
  it('リポジトリごとにファイル数・テスト件数合計・平均評価を正しく集計する', () => {
    const rows = [
      makeRow({ repo_name: 'nekoserver/a', test_count: 3, grade: 'A' }),
      makeRow({ repo_name: 'nekoserver/a', test_count: 5, grade: 'C' }),
      makeRow({ repo_name: 'nekoserver/b', test_count: 2, grade: 'E-' }),
    ];
    const agg = buildRepoAggregates(rows);
    const a = agg.find(r => r.repo === 'nekoserver/a');
    const b = agg.find(r => r.repo === 'nekoserver/b');
    expect(a?.count).toBe(2);
    expect(a?.totalTests).toBe(8);
    expect(a?.avgScore).toBeCloseTo((gradeToScore('A') + gradeToScore('C')) / 2);
    expect(b?.count).toBe(1);
    expect(b?.avgScore).toBe(0);
  });

  it('件数の多いリポジトリから降順に並ぶ', () => {
    const rows = [
      makeRow({ repo_name: 'nekoserver/small' }),
      makeRow({ repo_name: 'nekoserver/big' }),
      makeRow({ repo_name: 'nekoserver/big' }),
    ];
    const agg = buildRepoAggregates(rows);
    expect(agg[0].repo).toBe('nekoserver/big');
    expect(agg[0].count).toBe(2);
  });

  it('空配列を渡すと空配列を返す(0除算によるNaNを発生させない)', () => {
    expect(buildRepoAggregates([])).toEqual([]);
  });
});

describe('buildOverallGradeDistribution', () => {
  it('15段階すべてを含み、出現しない評価は0件として返す', () => {
    const rows = [makeRow({ grade: 'A+' }), makeRow({ grade: 'A+' }), makeRow({ grade: 'E-' })];
    const dist = buildOverallGradeDistribution(rows);
    expect(dist).toHaveLength(15);
    expect(dist.find(d => d.grade === 'A+')?.count).toBe(2);
    expect(dist.find(d => d.grade === 'E-')?.count).toBe(1);
    expect(dist.find(d => d.grade === 'B')?.count).toBe(0);
  });

  it('A+が先頭、E-が末尾の降順で並ぶ', () => {
    const dist = buildOverallGradeDistribution([]);
    expect(dist[0].grade).toBe('A+');
    expect(dist[dist.length - 1].grade).toBe('E-');
  });
});

describe('sortRows', () => {
  const rows = [
    makeRow({ file_path: 'b.test.ts', grade: 'B', test_count: 5, last_evaluated_at: '2026-01-02' }),
    makeRow({ file_path: 'a.test.ts', grade: 'A+', test_count: 1, last_evaluated_at: '2026-01-03' }),
    makeRow({ file_path: 'c.test.ts', grade: 'E-', test_count: 10, last_evaluated_at: '2026-01-01' }),
  ];

  it('grade_descは評価が高い順', () => {
    const sorted = sortRows(rows, 'grade_desc');
    expect(sorted.map(r => r.grade)).toEqual(['A+', 'B', 'E-']);
  });

  it('grade_ascは評価が低い順', () => {
    const sorted = sortRows(rows, 'grade_asc');
    expect(sorted.map(r => r.grade)).toEqual(['E-', 'B', 'A+']);
  });

  it('test_count_descはテスト件数が多い順', () => {
    const sorted = sortRows(rows, 'test_count_desc');
    expect(sorted.map(r => r.test_count)).toEqual([10, 5, 1]);
  });

  it('last_evaluated_descは最終評価日が新しい順', () => {
    const sorted = sortRows(rows, 'last_evaluated_desc');
    expect(sorted.map(r => r.last_evaluated_at)).toEqual(['2026-01-03', '2026-01-02', '2026-01-01']);
  });

  it('デフォルト(file_path)はrepo_name+file_pathの文字列順で、元配列を破壊しない', () => {
    const original = [...rows];
    const sorted = sortRows(rows, 'file_path');
    expect(sorted.map(r => r.file_path)).toEqual(['a.test.ts', 'b.test.ts', 'c.test.ts']);
    expect(rows).toEqual(original);
  });
});

describe('getTestFileCatalogPage: HTML構造', () => {
  it('検索語・選択中のリポジトリ/評価/並び順がフォームに反映される', () => {
    const html = getTestFileCatalogPage({
      rows: [makeRow()],
      allRepos: ['nekoserver/example'],
      filterRepo: 'nekoserver/example',
      filterGrade: 'C',
      filterQuery: 'foo',
      sort: 'grade_desc',
    });
    expect(html).toContain('value="foo"');
    expect(html).toContain('<option value="nekoserver/example" selected>');
    expect(html).toContain('<option value="C" selected>');
    expect(html).toContain('<option value="grade_desc" selected>');
  });

  it('ファイルパス・テスト概要・アサーション種別のHTML特殊文字をエスケープする(XSS対策)', () => {
    const html = getTestFileCatalogPage({
      rows: [makeRow({
        file_path: '<script>alert(1)</script>.test.ts',
        test_summary: '<img src=x onerror=alert(2)>',
      })],
      allRepos: ['nekoserver/example'],
      filterRepo: null,
      filterGrade: null,
      filterQuery: '',
      sort: 'file_path',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('該当行が0件のときは空状態メッセージを表示する', () => {
    const html = getTestFileCatalogPage({
      rows: [],
      allRepos: [],
      filterRepo: null,
      filterGrade: null,
      filterQuery: '',
      sort: 'file_path',
    });
    expect(html).toContain('条件に一致するテストファイルがありません');
  });
});
