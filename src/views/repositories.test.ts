/**
 * コミット履歴モーダル 共起キーワードタグ・フィルタ機能テスト
 */
import { describe, it, expect } from 'vitest';
import { getRepositoriesPage } from './repositories';

const minimalUser = {
  username: 'testuser',
  repositories: [],
  commitHistoryPageSize: 10,
};

describe('コミット履歴モーダル: 共起キーワードタグセクション HTML', () => {
  it('commitCoKeySection が HTML に存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="commitCoKeySection"');
  });

  it('commitCoKeyInput が HTML に存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="commitCoKeyInput"');
  });

  it('commitCoKeyClear が HTML に存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="commitCoKeyClear"');
  });

  it('commitCoKeyTags が HTML に存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="commitCoKeyTags"');
  });
});

describe('コミット履歴モーダル: 共起キーワードタグ JS ロジック', () => {
  it('commitKeywordFilter 変数が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('commitKeywordFilter');
  });

  it('loadCommitCoKeywords 関数が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('function loadCommitCoKeywords(');
  });

  it('loadCommitCoKeywords が repo-keywords エンドポイントを呼び出す', () => {
    const html = getRepositoriesPage(minimalUser);
    const fnMatch = html.match(/function loadCommitCoKeywords\([\s\S]*?^    \}/m);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('repo-keywords');
  });

  it('applyCommitKeywordFilter 関数が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('function applyCommitKeywordFilter(');
  });

  it('applyCommitKeywordFilter が commitKeywordFilter でコミットをフィルタする', () => {
    const html = getRepositoriesPage(minimalUser);
    const fnMatch = html.match(/function applyCommitKeywordFilter\([\s\S]*?^    \}/m);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('commitKeywordFilter');
    expect(fn).toContain('message');
  });

  it('renderCommitHistoryContent が applyCommitKeywordFilter を使用する', () => {
    const html = getRepositoriesPage(minimalUser);
    const fnMatch = html.match(/function renderCommitHistoryContent[\s\S]*?^    \}/m);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('applyCommitKeywordFilter');
  });

  it('マージフィルタ変更時に applyCommitKeywordFilter を適用する', () => {
    const html = getRepositoriesPage(minimalUser);
    const handlerMatch = html.match(/commitHistoryFilterSelect\.addEventListener\('change'[\s\S]*?\}\)/);
    expect(handlerMatch).not.toBeNull();
    const handler = handlerMatch![0];
    expect(handler).toContain('applyCommitKeywordFilter');
  });

  it('openCommitHistoryModal が loadCommitCoKeywords を呼び出す', () => {
    const html = getRepositoriesPage(minimalUser);
    const fnMatch = html.match(/function openCommitHistoryModal\(\)[\s\S]*?^    \}/m);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('loadCommitCoKeywords');
  });

  it('closeCommitHistoryModal がキーワードフィルタをリセットする', () => {
    const html = getRepositoriesPage(minimalUser);
    const fnMatch = html.match(/function closeCommitHistoryModal\(\)[\s\S]*?^    \}/m);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('commitKeywordFilter');
  });

  it('タグクリック時に commitKeywordFilter を更新しコミットを再描画する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('commitCoKeyTags');
    expect(html).toContain('commitKeywordFilter');
    expect(html).toContain('renderCommitHistoryRows');
  });
});

describe('コミット履歴モーダル: 共起キーワードタグ CSS', () => {
  it('commit-cokey-section スタイルが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('commit-cokey-section');
  });

  it('commit-cokey-tag スタイルが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('commit-cokey-tag');
  });

  it('commit-cokey-input スタイルが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('commit-cokey-input');
  });
});
