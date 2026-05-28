/**
 * コミット履歴モーダル 共起キーワードタグ・フィルタ機能テスト
 * 検索履歴モーダル 対象リポジトリセレクト & 共起ハイライト機能テスト
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

describe('コミット履歴モーダル: 初回ロード0件時の自動すべて切り替え', () => {
  it('commitHistoryIsInitialLoad フラグが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('commitHistoryIsInitialLoad');
  });

  it('fetchCommitMonthsAndInit で commitHistoryIsInitialLoad を true にセットする', () => {
    const html = getRepositoriesPage(minimalUser);
    const fnMatch = html.match(/function fetchCommitMonthsAndInit[\s\S]*?^    \}/m);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('commitHistoryIsInitialLoad = true');
  });

  it('renderCommitHistoryContent が0件かつ初回ロード時に commitHistoryMonthSelect を空にする', () => {
    const html = getRepositoriesPage(minimalUser);
    const fnMatch = html.match(/function renderCommitHistoryContent[\s\S]*?^    \}/m);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('commitHistoryIsInitialLoad');
    expect(fn).toContain("commitHistoryMonthSelect.value = ''");
  });

  it('renderCommitHistoryContent が初回ロードフラグを false にリセットする', () => {
    const html = getRepositoriesPage(minimalUser);
    const fnMatch = html.match(/function renderCommitHistoryContent[\s\S]*?^    \}/m);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('commitHistoryIsInitialLoad = false');
  });
});

describe('検索履歴モーダル: インクリメントサーチ', () => {
  it('historyIncrSearchToggle ボタンが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="historyIncrSearchToggle"');
  });

  it('isIncrementalSearchEnabled 変数が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('isIncrementalSearchEnabled');
  });

  it('history_incr_search Cookie を参照する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('history_incr_search');
  });

  it('getIncrementalFilteredItems 関数が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('function getIncrementalFilteredItems()');
  });

  it('refreshGrid が getIncrementalFilteredItems を使用する', () => {
    const html = getRepositoriesPage(minimalUser);
    const fnMatch = html.match(/function refreshGrid[\s\S]*?^    \}/m);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('getIncrementalFilteredItems');
  });

  it('input イベントでインクリメントサーチを発動する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain("addEventListener('input'");
    expect(html).toContain('isIncrementalSearchEnabled');
  });
});

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

describe('検索履歴モーダル: 詳細パネルクローズ後のリポジトリセレクト保持', () => {
  it('詳細パネルクローズ時に hRepoSelect の選択肢を上書きしない', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).not.toContain("hRepoSelect.innerHTML = '<option value=\"\">すべて</option>'");
  });

  it('closeBtn2 クローズハンドラが selectedRepo をリセットしない', () => {
    const html = getRepositoriesPage(minimalUser);
    const closeHandlerMatch = html.match(/closeBtn2\.addEventListener\('click'[\s\S]{0,500}?\}\);/);
    expect(closeHandlerMatch).not.toBeNull();
    const handler = closeHandlerMatch![0];
    expect(handler).not.toContain("selectedRepo = ''");
    expect(handler).not.toContain('hRepoSelect');
  });

  it('showKeywordDetail が hRepoSelect をキーワード専用リポジトリで上書きしない', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).not.toContain('data.repoStats.forEach');
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
