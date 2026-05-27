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

  it('loadRepoFilter が repo-keywords エンドポイントを呼び出す', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('repo-keywords?repo=');
  });

  it('data.keywords 配列でハイライト対象を構築する', () => {
    const html = getRepositoriesPage(minimalUser);
    const loadRepoFilterMatch = html.match(/function loadRepoFilter\(repo\)[\s\S]*?^      \}/m);
    expect(loadRepoFilterMatch).not.toBeNull();
    const fn = loadRepoFilterMatch![0];
    expect(fn).toContain('data.keywords');
    expect(fn).toContain('.search_query');
  });

  it('applyRepoHighlight がリポジトリ選択時にすべての非マッチ行を dimmed にする（selectedKeyword 例外なし）', () => {
    const html = getRepositoriesPage(minimalUser);
    const applyMatch = html.match(/function applyRepoHighlight\(\)[\s\S]*?^      \}/m);
    expect(applyMatch).not.toBeNull();
    const fn = applyMatch![0];
    expect(fn).not.toContain('selectedKeyword');
  });
});

describe('検索履歴モーダル: 当該カラム', () => {
  it('当該カラムのヘッダーが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('>当該<');
  });

  it('ヒット数カラムが総ヒット数に変更されている', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('>総ヒット数<');
    expect(html).not.toContain('>ヒット数<');
  });

  it('repo_hit_count フィールドで当該件数を取得する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('repo_hit_count');
  });

  it('リポジトリ選択時に repoHitCount の降順でソートする', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('repoHitCount');
    expect(html).toContain('b.repoHitCount - a.repoHitCount');
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

describe('検索履歴モーダル: 対象リポジトリ変更時の詳細パネル自動クローズ', () => {
  it('リポジトリ変更時に keywordDetailPanel を非表示にするコードが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    const changeHandlerMatch = html.match(/hRepoSelect\.addEventListener\('change'[\s\S]*?\}\)/);
    expect(changeHandlerMatch).not.toBeNull();
    const handler = changeHandlerMatch![0];
    expect(handler).toContain('keywordDetailPanel');
    expect(handler).toContain("'none'");
  });

  it('リポジトリ変更時に selectedKeyword をリセットするコードが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    const changeHandlerMatch = html.match(/hRepoSelect\.addEventListener\('change'[\s\S]*?\}\)/);
    expect(changeHandlerMatch).not.toBeNull();
    const handler = changeHandlerMatch![0];
    expect(handler).toContain('selectedKeyword');
    expect(handler).toContain('null');
  });
});
