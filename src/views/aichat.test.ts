import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: 'claude-sonnet-4-6',
};

describe('AIチャット詳細パネル: Markdownプレビュー', () => {
  it('parseMd 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function parseMd(');
  });

  it('showResultsPanel が回答を innerHTML で描画する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showResultsPanel(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain('resultsPanelA.innerHTML');
    expect(fnBody).not.toContain('resultsPanelA.textContent');
  });

  it('showResultsPanel が parseMd を呼び出す', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showResultsPanel(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain('parseMd(');
  });

  it('Markdown用CSSクラスが results-col-text に適用される', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('results-col-text');
    expect(html).toContain('preview-area');
  });
});

describe('AIチャット詳細プレビューモーダル: 吹き出し配置', () => {
  it('モーダル内ユーザー吹き出しが左寄せ（flex-start）になっている', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.history-modal .chat-bubble.user');
    expect(html).toContain('align-self: flex-start');
  });

  it('モーダル内アシスタント吹き出しが右寄せ（flex-end）になっている', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.history-modal .chat-bubble.assistant');
    expect(html).toContain('align-self: flex-end');
  });
});

describe('AIチャット詳細プレビューモーダル: 日付リンク', () => {
  it('historyModalDateLink 要素が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="historyModalDateLink"');
  });

  it('history-modal-date-link CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.history-modal-date-link');
  });

  it('historyModalDateLink のクリックハンドラが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('historyModalDateLink.addEventListener');
  });

  it('日付リンクのクリックでサイドバーを開く処理が含まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('historyModalDateLink.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 900);
    expect(fnBody).toContain('loadCalendar');
    expect(fnBody).toContain('doDateLoad');
  });

  it('日付リンクのクリックで質問分析モーダルが開いていれば閉じる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('historyModalDateLink.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 900);
    expect(fnBody).toContain('searchKwAnalysisOverlay');
    expect(fnBody).toContain('closeSearchKwAnalysis');
  });
});

describe('AIチャットサイドバー: フォーカスなし・ハイライトなし', () => {
  it('renderSidebarResults に selected クラスを付与するコードがない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSidebarResults(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1500);
    expect(fnBody).not.toContain("' selected'");
    expect(fnBody).not.toContain('" selected"');
  });

  it('renderSidebarResults に highlight-origin クラスを付与するコードがない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSidebarResults(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1500);
    expect(fnBody).not.toContain('highlight-origin');
    expect(fnBody).not.toContain('sidebarHighlightId');
  });

  it('サイドバー項目クリックで selectedIdx を変更してから renderSidebarResults を呼ばない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("'click', function()");
    expect(idx).toBeGreaterThan(-1);
    const clickBody = html.slice(idx, idx + 300);
    expect(clickBody).not.toContain('selectedIdx = i');
  });
});

describe('AIチャットサイドバー: スワイプ削除', () => {
  it('削除確認ダイアログの HTML が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="deleteConfirmOverlay"');
    expect(html).toContain('id="deleteConfirmOk"');
    expect(html).toContain('id="deleteConfirmCancel"');
  });

  it('result-delete-btn CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.result-delete-btn');
  });

  it('delete-confirm-overlay CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.delete-confirm-overlay');
  });

  it('result-swipe-inner CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.result-swipe-inner');
  });

  it('addSwipeBehavior 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function addSwipeBehavior(');
  });

  it('削除 API が DELETE メソッドで呼ばれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('deleteConfirmOk.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain("method: 'DELETE'");
    expect(fnBody).toContain('/api/aichat/shares/');
  });

  it('animateDeleteItem 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function animateDeleteItem(');
  });

  it('renderSidebarResults が result-delete-btn と result-swipe-inner を生成する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSidebarResults(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 2000);
    expect(fnBody).toContain('result-delete-btn');
    expect(fnBody).toContain('result-swipe-inner');
    expect(html).toContain('addSwipeBehavior(item, inner)');
  });

  it('削除ボタンはデフォルト opacity:0 で swipe-open 時のみ opacity:1 になる', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('opacity: 0');
    expect(html).toContain('.sidebar-result-item.swipe-open .result-delete-btn');
  });
});

describe('AIチャットサイドバー: デフォルトプレビューモードと下パネル', () => {
  it('getHistoryPreviewMode のデフォルトが center-modal', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function getHistoryPreviewMode(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 200);
    expect(fnBody).toContain("'center-modal'");
    expect(fnBody).not.toContain("'bottom-panel'");
  });

  it('resultsPanelToModal ボタンが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="resultsPanelToModal"');
  });

  it('resultsPanelToModal クリックで center-modal Cookie を保存してパネルを閉じる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("resultsPanelToModal').addEventListener");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('center-modal');
    expect(snippet).toContain('closeResultsPanel');
  });
});

describe('AIチャットサイドバー: 検索キーワードハイライト', () => {
  it('kw-highlight CSS クラスが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.kw-highlight');
  });

  it('applyKeywordHighlight 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function applyKeywordHighlight(');
  });

  it('showHistoryModal がキーワード引数を受け取りハイライトを適用する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showHistoryModal(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 500);
    expect(fnBody).toContain('keyword');
    expect(fnBody).toContain('applyKeywordHighlight');
  });

  it('showResultsPanel がキーワード引数を受け取りハイライトを適用する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showResultsPanel(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain('keyword');
    expect(fnBody).toContain('applyKeywordHighlight');
  });

  it('showHistoryPreview が search モード時に search-log API を POST 呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showHistoryPreview(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 600);
    expect(fnBody).toContain('/api/aichat/search-log');
    expect(fnBody).toContain("method: 'POST'");
  });

  it('showHistoryPreview が keyword を showHistoryModal または showResultsPanel に渡す', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showHistoryPreview(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 600);
    expect(fnBody).toContain('showHistoryModal(r, keyword)');
    expect(fnBody).toContain('showResultsPanel(r, keyword)');
  });

  it('showHistoryPreview が POST body に resultCount を含める', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showHistoryPreview(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 600);
    expect(fnBody).toContain('resultCount');
    expect(fnBody).toContain('currentResults.length');
  });
});

describe('AIチャット: 検索履歴モーダル', () => {
  it('searchLogBtn ボタンが navbar に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="searchLogBtn"');
  });

  it('searchLogOverlay が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="searchLogOverlay"');
    expect(html).toContain('id="searchLogClose"');
    expect(html).toContain('id="searchLogBody"');
  });

  it('openSearchLog 関数が存在し /api/aichat/search-log を GET で呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchLog(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 400);
    expect(fnBody).toContain('/api/aichat/search-log');
  });

  it('search-log-table CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.search-log-table');
  });

  it('search-log-overlay CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.search-log-overlay');
  });

  it('escHtml 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function escHtml(');
  });

  it('テーブルヘッダーにキーワード・質問・選択回数列が含まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchLog(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 800);
    expect(fnBody).toContain('キーワード');
    expect(fnBody).toContain('選択回数');
  });
});

describe('AIチャット: 検索明細履歴モーダル（aichat_search_history）', () => {
  it('searchHistoryBtn ボタンが navbar に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="searchHistoryBtn"');
  });

  it('searchHistoryBtn が searchLogBtn より前（左）に配置されている', () => {
    const html = getAiChatPage(minimalUser);
    const idxHistory = html.indexOf('id="searchHistoryBtn"');
    const idxLog = html.indexOf('id="searchLogBtn"');
    expect(idxHistory).toBeGreaterThan(-1);
    expect(idxLog).toBeGreaterThan(-1);
    expect(idxHistory).toBeLessThan(idxLog);
  });

  it('searchHistoryOverlay が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="searchHistoryOverlay"');
    expect(html).toContain('id="searchHistoryClose"');
    expect(html).toContain('id="searchHistoryBody"');
  });

  it('openSearchHistory 関数が存在し /api/aichat/search-history を GET で呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchHistory(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 500);
    expect(fnBody).toContain('/api/aichat/search-history');
  });

  it('openSearchHistory テーブルヘッダーにキーワード・seq_num・検索日時列が含まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchHistory(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 800);
    expect(fnBody).toContain('キーワード');
    expect(fnBody).toContain('seq_num');
    expect(fnBody).toContain('検索日時');
  });
});

describe('AIチャット: 質問×キーワード分析モーダル', () => {
  it('searchKwAnalysisBtn ボタンが navbar に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="searchKwAnalysisBtn"');
  });

  it('searchKwAnalysisBtn が searchHistoryBtn より前（左）に配置されている', () => {
    const html = getAiChatPage(minimalUser);
    const idxAnalysis = html.indexOf('id="searchKwAnalysisBtn"');
    const idxHistory = html.indexOf('id="searchHistoryBtn"');
    expect(idxAnalysis).toBeGreaterThan(-1);
    expect(idxHistory).toBeGreaterThan(-1);
    expect(idxAnalysis).toBeLessThan(idxHistory);
  });

  it('searchKwAnalysisOverlay が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="searchKwAnalysisOverlay"');
    expect(html).toContain('id="searchKwAnalysisClose"');
    expect(html).toContain('id="searchKwAnalysisBody"');
  });

  it('openSearchKwAnalysis 関数が存在し /api/aichat/search-keyword-analysis を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchKwAnalysis(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 600);
    expect(fnBody).toContain('/api/aichat/search-keyword-analysis');
  });

  it('テーブルヘッダーに総数・連番・質問・キーワード列が含まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchKwAnalysis(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1000);
    expect(fnBody).toContain('総数');
    expect(fnBody).toContain('No.');
    expect(fnBody).toContain('質問');
    expect(fnBody).toContain('キーワード');
  });

  it('キーワード総数の降順でソートしてから上位30件に絞る', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchKwAnalysis(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1600);
    expect(fnBody).toContain('.sort(');
    expect(fnBody).toContain('.slice(0, 30)');
  });

  it('連番は降順ソート後に idx+1 で付与される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchKwAnalysis(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1800);
    expect(fnBody).toContain('idx + 1');
  });

  it('kw-analysis-badge CSS が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.kw-analysis-badge');
  });

  it('share_id に紐づく全キーワードをフィルタせず表示する（テキスト包含チェックしない）', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchKwAnalysis(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1600);
    expect(fnBody).not.toContain("qText.indexOf");
    expect(fnBody).not.toContain('.filter(function');
  });

  it('キーワードバッジが max_seq_num を括弧内に表示する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchKwAnalysis(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1600);
    expect(fnBody).toContain('max_seq_num');
    expect(fnBody).toContain('kw-analysis-badge');
  });

  it('質問セルに data-share-id 属性が付与される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchKwAnalysis(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 2000);
    expect(fnBody).toContain('data-share-id');
  });

  it('質問セルに data-keywords 属性が付与される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchKwAnalysis(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 2000);
    expect(fnBody).toContain('data-keywords');
  });

  it('質問セルクリックで /api/aichat/shares/ を fetch して showHistoryModal を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchKwAnalysis(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 3300);
    expect(fnBody).toContain('/api/aichat/shares/');
    expect(fnBody).toContain('showHistoryModal');
    expect(fnBody).toContain('data-share-id');
  });

  it('質問クリック時に closeSearchKwAnalysis を呼ばず分析モーダルを保持する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchKwAnalysisBody.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 700);
    expect(fnBody).not.toContain('closeSearchKwAnalysis()');
  });

  it('過去ログモーダルが開いている間は Escape で分析モーダルを閉じない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchKwAnalysisOverlay.classList.contains');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 200);
    expect(fnBody).toContain('historyModalBackdrop');
  });

  it('history-modal-backdrop の z-index が search-log-overlay より高い', () => {
    const html = getAiChatPage(minimalUser);
    const historyZMatch = html.match(/\.history-modal-backdrop[\s\S]{0,200}?z-index:\s*(\d+)/);
    const overlayZMatch = html.match(/\.search-log-overlay[\s\S]{0,200}?z-index:\s*(\d+)/);
    expect(historyZMatch).not.toBeNull();
    expect(overlayZMatch).not.toBeNull();
    expect(Number(historyZMatch![1])).toBeGreaterThan(Number(overlayZMatch![1]));
  });
});

describe('AIチャット: applyKeywordHighlight の配列対応', () => {
  it('applyKeywordHighlight が配列キーワードを受け取れる実装になっている', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function applyKeywordHighlight(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 500);
    expect(fnBody).toContain('Array.isArray');
  });

  it('applyKeywordHighlight が複数キーワードを OR 結合の正規表現で処理する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function applyKeywordHighlight(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 500);
    expect(fnBody).toContain('.join(');
  });
});

describe('AIチャット: 露出ログボタンと searchImpressionsOverlay', () => {
  it('searchImpressionsBtn ボタンが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="searchImpressionsBtn"');
  });

  it('searchImpressionsBtn は質問分析ボタン(searchKwAnalysisBtn)より前に配置される', () => {
    const html = getAiChatPage(minimalUser);
    const idxImpr = html.indexOf('id="searchImpressionsBtn"');
    const idxAnalysis = html.indexOf('id="searchKwAnalysisBtn"');
    expect(idxImpr).toBeGreaterThan(-1);
    expect(idxAnalysis).toBeGreaterThan(-1);
    expect(idxImpr).toBeLessThan(idxAnalysis);
  });

  it('searchImpressionsOverlay が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="searchImpressionsOverlay"');
  });

  it('openSearchImpressions 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function openSearchImpressions(');
  });

  it('closeSearchImpressions 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function closeSearchImpressions(');
  });

  it('openSearchImpressions が /api/aichat/search-impressions を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchImpressions(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 600);
    expect(fnBody).toContain('/api/aichat/search-impressions');
  });

  it('impressions モーダルが impression_count（露出回数）を表示する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchImpressions(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1600);
    expect(fnBody).toContain('impression_count');
  });

  it('impressions モーダルがキーワードバッジを表示する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchImpressions(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1600);
    expect(fnBody).toContain('kw-analysis-badge');
  });

  it('impressions 質問セルに data-share-id が付与される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchImpressions(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 2000);
    expect(fnBody).toContain('data-share-id');
  });

  it('impressions 質問セルクリックで showHistoryModal を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchImpressionsBody.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 700);
    expect(fnBody).toContain('showHistoryModal');
    expect(fnBody).toContain('data-share-id');
  });

  it('impressions Escape キーで historyModal が開いている時は閉じない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchImpressionsOverlay.classList.contains');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 200);
    expect(fnBody).toContain('historyModalBackdrop');
  });
});

describe('AIチャット: doSearch が露出ログを POST する', () => {
  it('doSearch 関数が /api/aichat/search-impressions へ POST する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doSearch(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1000);
    expect(fnBody).toContain('/api/aichat/search-impressions');
    expect(fnBody).toContain('POST');
  });

  it('doSearch が shareIds を送信する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doSearch(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1000);
    expect(fnBody).toContain('shareIds');
  });

  it('doSearch が resultCount を送信する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doSearch(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1000);
    expect(fnBody).toContain('resultCount');
  });
});

describe('AIチャット: 過去ログモーダルのヘッダ検索窓', () => {
  it('historyModalSearchInput が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="historyModalSearchInput"');
  });

  it('historyModalSearchBtn が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="historyModalSearchBtn"');
  });

  it('doHistoryModalSearch が closeSearchImpressions と doSearch を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doHistoryModalSearch()');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('closeSearchImpressions');
    expect(fn).toContain('doSearch');
    expect(fn).toContain('sidebarSearch');
  });

  it('doHistoryModalSearch が closeSearchKwAnalysis も呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doHistoryModalSearch()');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('closeSearchKwAnalysis');
  });

  it('doHistoryModalSearch がサイドバーを開く', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doHistoryModalSearch()');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('sidebarOpen');
    expect(fn).toContain("sidebar.classList.add('open')");
  });

  it('historyModalSearchBtn クリックハンドラが stopPropagation してサイドバーが即閉じされない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('historyModalSearchBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const handler = html.slice(idx, idx + 150);
    expect(handler).toContain('stopPropagation');
  });
});

describe('AIチャット: 日付リンクで impressionsOverlay も閉じる', () => {
  it('historyModalDateLink クリックで searchImpressionsOverlay を閉じる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('historyModalDateLink.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const handler = html.slice(idx, idx + 500);
    expect(handler).toContain('closeSearchImpressions');
  });
});
