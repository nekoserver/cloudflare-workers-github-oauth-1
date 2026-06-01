import { describe, it, expect } from 'vitest';
import { mergeAllCategories, DEFAULT_KEYWORD_LABELS, resolveKeywordDisplayLabels } from './index';

describe('mergeAllCategories', () => {
  it('DBラベルが空の場合はデフォルトカテゴリのみ返す', () => {
    const result = mergeAllCategories([]);
    expect(result).toEqual(expect.arrayContaining(['feature', 'ui', 'tech', 'database', 'bugfix', 'ops', 'uncategorized']));
    expect(result.length).toBe(DEFAULT_KEYWORD_LABELS.length);
  });

  it('uncategorized は末尾に固定される', () => {
    const result = mergeAllCategories(['security', 'performance']);
    expect(result[result.length - 1]).toBe('uncategorized');
  });

  it('DBの追加ラベルはデフォルトとマージされる', () => {
    const result = mergeAllCategories(['security', 'performance']);
    expect(result).toContain('security');
    expect(result).toContain('performance');
    expect(result).toContain('feature');
  });

  it('重複除去される', () => {
    const result = mergeAllCategories(['feature', 'feature', 'ui']);
    const featureCount = result.filter((l) => l === 'feature').length;
    expect(featureCount).toBe(1);
  });

  it('空文字列や falsy なラベルは除外される', () => {
    const result = mergeAllCategories(['', 'security', '']);
    expect(result).not.toContain('');
    expect(result).toContain('security');
  });

  it('uncategorized がDBラベルに含まれていても末尾に1つだけ現れる', () => {
    const result = mergeAllCategories(['security', 'uncategorized', 'performance']);
    const uncat = result.filter((l) => l === 'uncategorized');
    expect(uncat.length).toBe(1);
    expect(result[result.length - 1]).toBe('uncategorized');
  });
});

describe('resolveKeywordDisplayLabels', () => {
  it('multiCategoriesが空でない場合はそれを返す', () => {
    expect(resolveKeywordDisplayLabels(['feature', 'ui'], 'bugfix')).toEqual(['feature', 'ui']);
  });

  it('multiCategoriesがnullの場合はsingleLabelを配列で返す', () => {
    expect(resolveKeywordDisplayLabels(null, 'feature')).toEqual(['feature']);
  });

  it('multiCategoriesがundefinedの場合はsingleLabelを配列で返す', () => {
    expect(resolveKeywordDisplayLabels(undefined, 'bugfix')).toEqual(['bugfix']);
  });

  it('multiCategoriesが空配列の場合はsingleLabelを配列で返す', () => {
    expect(resolveKeywordDisplayLabels([], 'ui')).toEqual(['ui']);
  });

  it('singleLabelが空文字の場合はuncategorizedを返す', () => {
    expect(resolveKeywordDisplayLabels(null, '')).toEqual(['uncategorized']);
  });
});
