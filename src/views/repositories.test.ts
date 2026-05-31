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

describe('検索履歴モーダル: ラベルフィルタUI', () => {
  it('historyLabelFilter コンテナが HTML に存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="historyLabelFilter"');
  });

  it('すべてボタン（data-label=""）が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('data-label=""');
    expect(html).toContain('すべて');
  });

  it('各ラベルボタンが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    for (const label of ['feature', 'ui', 'tech', 'database', 'bugfix', 'ops']) {
      expect(html).toContain(`data-label="${label}"`);
    }
  });

  it('未分類ボタンが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('data-label="uncategorized"');
    expect(html).toContain('未分類');
  });

  it('初期状態ですべてボタンが active クラスを持つ', () => {
    const html = getRepositoriesPage(minimalUser);
    // マルチ選択トグル式に変更: すべてボタンは active クラスを持つ
    expect(html).toContain('history-label-btn active');
    expect(html).toContain('data-label=""');
  });

  it('activeLabels (Set) がマルチ選択状態管理に使われる', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('activeLabels');
    expect(html).toContain('new Set()');
  });

  it('ラベルフィルタのクリックイベントリスナが存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('historyLabelFilter');
    expect(html).toContain('history-label-btn');
    expect(html).toContain('activeLabels');
  });

  it('dedupeAndSort が label フィールドを保持する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain("label: item.label || 'uncategorized'");
  });

  it('activeLabels でラベルフィルタリングを行う', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('activeLabels.has(');
  });

  it('closeHistoryModal が activeLabels をリセットする', () => {
    const html = getRepositoriesPage(minimalUser);
    const closeMatch = html.match(/function closeHistoryModal\(\)[\s\S]*?\}/);
    expect(closeMatch).not.toBeNull();
    // activateAllLabels() でリセット
    expect(closeMatch![0]).toContain('activateAllLabels');
  });

  it('updateTitle がフィルタ件数を表示する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('function updateTitle()');
    expect(html).toContain('getIncrementalFilteredItems().length');
    expect(html).toContain("' / '");
  });
});

describe('ページ基本構造: 主要UI要素の存在', () => {
  it('検索ボタン (commitSearchBtn) が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="commitSearchBtn"');
  });

  it('検索入力欄 (commitSearchInput) が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="commitSearchInput"');
  });

  it('ドロップダウンメニュー (dropdownMenu) が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="dropdownMenu"');
  });

  it('toggleDropdown 関数が JS に存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('function toggleDropdown()');
  });

  it('検索履歴ボタン行 (searchHistoryRow) が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="searchHistoryRow"');
  });

  it('検索履歴ボタン (searchHistoryOpenBtn) が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="searchHistoryOpenBtn"');
  });

  it('カテゴリグループ編集モーダル (categoryGroupEditModal) が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="categoryGroupEditModal"');
  });

  it('カテゴリグループ削除確認モーダル (cgDeleteConfirmModal) が存在する', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('id="cgDeleteConfirmModal"');
  });

  it('openCategoryGroupEditModal がグローバル関数として公開されている', () => {
    const html = getRepositoriesPage(minimalUser);
    expect(html).toContain('window.openCategoryGroupEditModal');
  });
});

describe('ページ基本構造: script タグ内 JS の構文チェック', () => {
  it('script タグ内の JS に構文エラーがない', () => {
    const html = getRepositoriesPage(minimalUser);
    // <script>タグを全部抽出してacornでパース
    const scriptContents: string[] = [];
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      scriptContents.push(m[1]);
    }
    expect(scriptContents.length).toBeGreaterThan(0);

    for (const js of scriptContents) {
      // new Function() はfunctionの引数にカッコがあるとエラーになるため
      // ラッパー関数で包んで構文チェック
      expect(() => {
        new Function(`(function(){\n${js}\n})`);
      }).not.toThrow();
    }
  });
});
