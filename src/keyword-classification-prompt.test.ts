import { describe, it, expect } from 'vitest';
import { buildKeywordClassificationPrompt, pickBestLabelFromResponse } from './index';

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

  it('複数カテゴリに該当する場合に1つだけ返すよう指示が含まれる', () => {
    const result = buildKeywordClassificationPrompt('x', ['a', 'b']);
    expect(result).toContain('最も適切な1つだけ返してください');
  });
});

describe('pickBestLabelFromResponse', () => {
  it('1つだけ一致する場合はそのラベルを返す', () => {
    expect(pickBestLabelFromResponse('bugfix', ['feature', 'bugfix', 'ui'])).toBe('bugfix');
  });

  it('一致がない場合は uncategorized を返す', () => {
    expect(pickBestLabelFromResponse('something else', ['feature', 'bugfix'])).toBe('uncategorized');
  });

  it('複数一致する場合はレスポンス内で最初に登場するラベルを返す', () => {
    expect(pickBestLabelFromResponse('ui and feature', ['feature', 'ui', 'bugfix'])).toBe('ui');
  });

  it('カスタムラベルにも対応する', () => {
    expect(pickBestLabelFromResponse('docs', ['feature', 'bugfix', 'docs', 'security'])).toBe('docs');
  });

  it('空レスポンスの場合は uncategorized を返す', () => {
    expect(pickBestLabelFromResponse('', ['feature', 'bugfix'])).toBe('uncategorized');
  });
});
