import { describe, it, expect } from 'vitest';
import { resolveTreeViewKeywordSearchAutoSave } from './session';

// 対象: /tree-viewの検索窓ヒットから集めた切り出しキー×AIチャット出現回数を
// 検索ごとに自動記録するか、その都度確認するかの設定解決
// (resolveTreeViewKeywordSearchAutoSave)。ルール27(D1優先→Cookie→
// ハードコードデフォルト)に従う。

describe('resolveTreeViewKeywordSearchAutoSave: D1優先の自動保存設定解決', () => {
  it('D1の値が on なら自動保存(true)', () => {
    expect(resolveTreeViewKeywordSearchAutoSave('on', 'off')).toBe(true);
  });

  it('D1の値が off なら確認(false)', () => {
    expect(resolveTreeViewKeywordSearchAutoSave('off', 'on')).toBe(false);
  });

  it('D1の値がnull/undefinedならCookieへフォールバックする', () => {
    expect(resolveTreeViewKeywordSearchAutoSave(null, 'on')).toBe(true);
    expect(resolveTreeViewKeywordSearchAutoSave(undefined, 'off')).toBe(false);
  });

  it('双方欠落・不正値のときはデフォルトのfalse(その都度確認)を返す', () => {
    expect(resolveTreeViewKeywordSearchAutoSave(null, undefined)).toBe(false);
    expect(resolveTreeViewKeywordSearchAutoSave('bogus', 'worse')).toBe(false);
    expect(resolveTreeViewKeywordSearchAutoSave('', '')).toBe(false);
  });
});
