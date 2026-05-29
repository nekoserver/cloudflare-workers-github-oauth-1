import { describe, it, expect } from 'vitest';
import { buildKeywordClassificationPrompt } from './index';

describe('buildKeywordClassificationPrompt', () => {
  it('キーワードとラベル一覧をプロンプトに含める', () => {
    const result = buildKeywordClassificationPrompt('typescript', ['feature', 'bugfix', 'docs']);
    expect(result).toContain('typescript');
    expect(result).toContain('feature, bugfix, docs');
  });

  it('キーワードがダブルクォートで囲まれている', () => {
    const result = buildKeywordClassificationPrompt('fix login', ['bugfix', 'feature']);
    expect(result).toContain('"fix login"');
  });

  it('ラベルが空配列でも例外が起きない', () => {
    expect(() => buildKeywordClassificationPrompt('hello', [])).not.toThrow();
  });

  it('プロンプトにカテゴリ名のみを返すよう指示が含まれる', () => {
    const result = buildKeywordClassificationPrompt('ui update', ['ui', 'feature']);
    expect(result).toContain('カテゴリ名のみを返してください');
  });
});
