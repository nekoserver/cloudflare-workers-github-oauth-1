/**
 * 検索履歴モーダル 対象リポジトリセレクト & 共起ハイライト機能テスト
 */
import { describe, it, expect } from 'vitest';
import { getRepositoriesPage } from './repositories';

const minimalUser = {
  username: 'testuser',
  repositories: [],
  commitHistoryPageSize: 10,
};

describe('検索履歴モーダル: 対象リポジトリセレクト', () => {
  it('historyRepoSelect が HTML に存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="historyRepoSelect"');
  });

  it('対象リポジトリラベルが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('対象リポジトリ');
  });

  it('history-repo-select CSS クラスが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('history-repo-select');
  });

  it('デフォルト選択肢「すべて」が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('>すべて<');
  });

  it('モーダルオープン時に repo-list エンドポイントを呼び出す', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('/api/repositories/search/repo-list');
  });

  it('populateRepoSelect 関数が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('function populateRepoSelect(repos)');
  });
});

describe('検索履歴モーダル: 共起ハイライト JS ロジック', () => {
  it('applyRepoHighlight 関数が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('function applyRepoHighlight()');
  });

  it('loadRepoFilter 関数が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('function loadRepoFilter(repo)');
  });

  it('activeCokeySet 変数が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('activeCokeySet');
  });

  it('keyword-stats API に repo パラメータを付与して呼び出す', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('keyword-stats?q=');
    expect(html).toContain('&repo=');
  });
});

describe('検索履歴モーダル: ハイライト CSS', () => {
  it('history-row-cokey スタイルが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('history-row-cokey');
  });

  it('history-row-dimmed スタイルが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('history-row-dimmed');
  });
});
