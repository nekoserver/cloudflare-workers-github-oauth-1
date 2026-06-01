import { describe, it, expect } from 'vitest';
import { buildKeywordClassificationPrompt, pickBestLabelFromResponse, shouldReclassifyKeyword } from './index';

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

describe('shouldReclassifyKeyword', () => {
  it('rowがnull/undefinedの場合はfalseを返す（INSERT時に新規扱いになるため）', () => {
    expect(shouldReclassifyKeyword(null)).toBe(false);
    expect(shouldReclassifyKeyword(undefined)).toBe(false);
  });

  it('labelがuncategorized以外の場合はfalseを返す', () => {
    expect(shouldReclassifyKeyword({ label: 'feature', classify_status: null })).toBe(false);
    expect(shouldReclassifyKeyword({ label: 'bugfix', classify_status: 'ai_success' })).toBe(false);
    expect(shouldReclassifyKeyword({ label: 'ui', classify_status: undefined })).toBe(false);
  });

  it('classify_statusがai_successの場合はfalseを返す（AI正常終了済み・再分類不要）', () => {
    expect(shouldReclassifyKeyword({ label: 'uncategorized', classify_status: 'ai_success' })).toBe(false);
  });

  it('classify_statusがnullの場合はtrueを返す（未分類・AI未実行）', () => {
    expect(shouldReclassifyKeyword({ label: 'uncategorized', classify_status: null })).toBe(true);
  });

  it('classify_statusが未定義の場合はtrueを返す（旧スキーマ互換）', () => {
    expect(shouldReclassifyKeyword({ label: 'uncategorized' })).toBe(true);
  });

  it('classify_statusがai_fallbackの場合はtrueを返す（フォールバック使用・再分類可）', () => {
    expect(shouldReclassifyKeyword({ label: 'uncategorized', classify_status: 'ai_fallback' })).toBe(true);
  });

  it('classify_statusがpendingの場合はtrueを返す（明示的に未処理）', () => {
    expect(shouldReclassifyKeyword({ label: 'uncategorized', classify_status: 'pending' })).toBe(true);
  });
});
