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

  it('mdInline が $\\rightarrow$ を変換するロジックを含む', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function mdInline');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('rightarrow');
    expect(fn).toContain('→');
  });

  it('mdInline の LaTeX 変換マップに主要な記号が含まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function mdInline');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('times');
    expect(fn).toContain('geq');
    expect(fn).toContain('leq');
  });

  it('mdInline が $\\command$ 形式のインライン数式に対応する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function mdInline');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('latexMap');
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
    const fnBody = html.slice(idx, idx + 900);
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

  it('impressions モーダルが kwCount（キーワード数）を左端カラムに表示する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1900);
    expect(fnBody).toContain('kwCount');
    expect(fnBody).toContain('kwSorted.length');
  });

  it('impressions モーダルが impression_count で並べ替えしない（keywords.length で降順）', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 600);
    expect(fnBody).toContain('keywords');
    expect(fnBody).not.toContain('impression_count');
  });

  it('impressions モーダルがキーワードバッジを表示する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 1900);
    expect(fnBody).toContain('kw-analysis-badge');
  });

  it('impressions 質問セルに data-share-id が付与される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 2500);
    expect(fnBody).toContain('data-share-id');
  });

  it('impressions 質問セルクリックで showHistoryModal を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openHistoryModalByShareId(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 500);
    expect(fnBody).toContain('showHistoryModal');
    expect(fnBody).toContain('shareId');
  });

  it('impressions Escape キーで historyModal が開いている時は閉じない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchImpressionsOverlay.classList.contains');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 200);
    expect(fnBody).toContain('historyModalBackdrop');
  });

  it('searchImpressions モーダルに最終検索トグルボタンが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="impressionsDateToggleBtn"');
  });

  it('最終検索トグルの状態が Cookie に保存される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('IMPR_DATE_COOKIE');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 100);
    expect(fnBody).toContain('aichat_impressions_show_date');
  });

  it('最終検索カラムの日付セルがカレンダーリンクとして機能する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 3300);
    expect(fnBody).toContain('data-month');
    expect(fnBody).toContain('data-date');
  });

  it('最終検索セルのカレンダーリンクでサイドバーとカレンダーが開く', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchImpressionsBody.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fnBody = html.slice(idx, idx + 800);
    expect(fnBody).toContain('loadCalendar');
    expect(fnBody).toContain('doDateLoad');
    expect(fnBody).toContain('closeSearchImpressions');
  });

  it('renderImpressionsTable がサブクエリマップを受け取る', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 200);
    expect(fn).toContain('subqueryMap');
  });

  it('renderImpressionsTable がサブクエリ持ち行に背景色を付ける', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('has-subquery');
  });

  it('has-subquery クラスは td（質問カラム）に付与される（tr ではない）', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    // td に has-subquery が付く
    expect(fn).toContain("'td.search-log-q has-subquery'");
    // tr には付かない
    expect(fn).not.toContain("tr' + rowClass");
  });

  it('has-subquery の質問セル内に span.impr-q-text が生成される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('impr-q-text');
  });

  it('キーワードバッジに data-keyword 属性が付与される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('data-keyword');
  });

  it('renderImpressionsTable が keywordFilter パラメータを受け取る', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 200);
    expect(fn).toContain('keywordFilter');
  });

  it('th にアクティブフィルタバッジ impr-kw-filter-active が埋め込まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderImpressionsTable(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('impr-kw-filter-active');
  });

  it('クリックハンドラがバッジクリックでフィルタを設定して再描画する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchImpressionsBody.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('kw-analysis-badge');
    expect(fn).toContain('data-keyword');
    expect(fn).toContain('impressionsKeywordFilter');
  });

  it('クリックハンドラがフィルタバッジクリックでフィルタをクリアする', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchImpressionsBody.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('impr-kw-filter-active');
    expect(fn).toContain('null');
  });

  it('クリックハンドラが span.impr-q-text クリックで過去ログモーダルを開く', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchImpressionsBody.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1700);
    expect(fn).toContain('impr-q-text');
    expect(fn).toContain('openHistoryModalByShareId');
  });

  it('openSearchImpressions が share-subquery-links/all も fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSearchImpressions(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('/api/aichat/share-subquery-links/all');
    expect(fn).toContain('fetch');
  });

  it('impressionsSubqueryModal が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="impressionsSubqueryModal"');
  });

  it('searchImpressionsBody のクリックハンドラがサブクエリ行の処理を含む', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('searchImpressionsBody.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('has-subquery');
    expect(fn).toContain('openImpressionsSubqueryModal');
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
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('closeSearchImpressions');
    expect(fn).toContain('doSearch');
    expect(fn).toContain('sidebarSearch');
  });

  it('doHistoryModalSearch が closeSearchKwAnalysis も呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doHistoryModalSearch()');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('closeSearchKwAnalysis');
  });

  it('doHistoryModalSearch がサイドバーを開く', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doHistoryModalSearch()');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
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

describe('AIチャット: サブクエリ一覧', () => {
  it('タブバーに subqueriesBtn ボタンが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="subqueriesBtn"');
  });

  it('subqueriesOverlay が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="subqueriesOverlay"');
  });

  it('subqueries 新規追加ボタンが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="subqueriesAddBtn"');
  });

  it('subqueriesAddBtn がモーダルヘッダ（search-log-head）内に配置される', () => {
    const html = getAiChatPage(minimalUser);
    const headStart = html.indexOf('id="subqueriesOverlay"');
    expect(headStart).toBeGreaterThan(-1);
    const overlay = html.slice(headStart, headStart + 600);
    const headEnd = overlay.indexOf('</div>');
    const headSection = overlay.slice(0, headEnd + 6);
    expect(headSection).toContain('id="subqueriesAddBtn"');
  });

  it('subqueriesAddBtn がモーダルボディ（search-log-body）の外に移動している', () => {
    const html = getAiChatPage(minimalUser);
    const bodyStart = html.indexOf('id="subqueriesBody"');
    expect(bodyStart).toBeGreaterThan(-1);
    const bodySection = html.slice(bodyStart, bodyStart + 800);
    expect(bodySection).not.toContain('id="subqueriesAddBtn"');
  });

  it('subqueries 新規追加フォームが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="subqueriesAddInput"');
  });

  it('openSubqueries 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function openSubqueries(');
  });

  it('openSubqueries が /api/aichat/subqueries を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSubqueries(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('/api/aichat/subqueries');
    expect(fn).toContain('fetch');
  });

  it('subqueries 新規追加の重複チェックが存在する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('subqueriesAddBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const handler = html.slice(idx, idx + 1000);
    expect(handler).toContain('/api/aichat/subqueries');
    expect(handler).toContain('fetch');
  });

  it('subqueries 追加確定ボタン subqueriesAddSubmit が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="subqueriesAddSubmit"');
  });

  it('openSubqueries が /api/aichat/keyword-categories-summary を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSubqueries(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('/api/aichat/keyword-categories-summary');
  });

  it('openSubqueries が /api/aichat/category-groups を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSubqueries(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('/api/aichat/category-groups');
  });

  it('renderSubqueriesList が kw-cat-summary-badge を出力する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('kw-cat-summary-badge');
  });

  it('renderSubqueriesList が kw-group-summary-badge と「大分類 :」を出力する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('kw-group-summary-badge');
    expect(fn).toContain('大分類 :');
  });

  it('renderSubqueriesList がカテゴリフィルタを th より前に配置する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    const catIdx = fn.indexOf('kw-cat-summary-badge');
    const thIdx = fn.indexOf('<th');
    expect(catIdx).toBeGreaterThan(-1);
    expect(thIdx).toBeGreaterThan(-1);
    expect(catIdx).toBeLessThan(thIdx);
  });

  it('sqSelectedCats / sqSelectedGroupId 状態変数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('sqSelectedCats');
    expect(html).toContain('sqSelectedGroupId');
  });

  it('renderSubqueriesList がカテゴリ選択時にキーワードバッジへ sq-kw-badge-active を付与する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4000);
    expect(fn).toContain('sq-kw-badge-active');
  });

  it('renderSubqueriesList が sqSelectedCats を参照してキーワードハイライトを制御する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4000);
    const kwBadgeSection = fn.indexOf('kwHtml +=');
    expect(kwBadgeSection).toBeGreaterThan(-1);
    // sqSelectedCats はキーワードバッジ生成の直前（isActive 判定）に現れる
    const kwBadgeSnippet = fn.slice(Math.max(0, kwBadgeSection - 700), kwBadgeSection + 200);
    expect(kwBadgeSnippet).toContain('sqSelectedCats');
  });

  it('renderSubqueriesList がカテゴリカラーを --kwcat-color で注入する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4000);
    expect(fn).toContain('--kwcat-color');
  });
});

describe('AIチャット: 過去ログモーダルの追加質問登録', () => {
  it('過去ログモーダルに addSubqueryBtn ボタンが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="historyModalAddSubqueryBtn"');
  });

  it('addSubqueryModal が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="addSubqueryModal"');
  });

  it('addSubqueryModal に subquery 選択リストが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="addSubqueryList"');
  });

  it('addSubqueryModal に URL 入力欄が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="addSubqueryUrl"');
  });

  it('addSubqueryModal に 追加ボタンが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="addSubquerySubmit"');
  });

  it('openAddSubqueryModal 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function openAddSubqueryModal(');
  });

  it('openAddSubqueryModal が /api/aichat/subqueries を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openAddSubqueryModal(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('/api/aichat/subqueries');
    expect(fn).toContain('fetch');
  });

  it('addSubquerySubmit が /api/aichat/share-subquery-links に POST する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('addSubquerySubmit.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const handler = html.slice(idx, idx + 800);
    expect(handler).toContain('/api/aichat/share-subquery-links');
    expect(handler).toContain('POST');
  });
});

describe('AIチャット: 過去ログモーダルのサブクエリリンク表示', () => {
  it('showHistoryModal が /api/aichat/share-subquery-links を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function loadSubqueryLinks(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('/api/aichat/share-subquery-links');
    expect(fn).toContain('fetch');
  });

  it('historyModalSubqueryLinks エリアが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="historyModalSubqueryLinks"');
  });
});

describe('AIチャット: サブクエリを持つ質問一覧', () => {
  it('linkedQuestionsBtn ボタンが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="linkedQuestionsBtn"');
  });

  it('linkedQuestionsOverlay が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="linkedQuestionsOverlay"');
  });

  it('openLinkedQuestions 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function openLinkedQuestions(');
  });

  it('openLinkedQuestions が /api/aichat/share-subquery-links を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openLinkedQuestions(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('/api/aichat/share-subquery-links');
    expect(fn).toContain('fetch');
  });

  it('index.ts に GET /api/aichat/share-subquery-links/all エンドポイントが存在する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/share-subquery-links/all'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('all エンドポイントが question 単位に集計する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/share-subquery-links/all'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 800);
    expect(handler).toContain('aichat_share_subquery_links');
    expect(handler).toContain('aichat_subqueries');
  });

  it('all エンドポイントが ai_chat_shares を JOIN して share_id を返す', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/share-subquery-links/all'");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 800);
    expect(handler).toContain('ai_chat_shares');
    expect(handler).toContain('share_id');
  });
});

describe('renderLinkedQuestions — 過去ログモーダル連携', () => {
  it('renderLinkedQuestions 内の質問セルに data-share-id が付与される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderLinkedQuestions(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4000);
    expect(fn).toContain('data-share-id');
  });

  it('renderLinkedQuestions のクリックハンドラが openHistoryModalByShareId を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderLinkedQuestions(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3500);
    expect(fn).toContain('openHistoryModalByShareId');
  });
});

describe('サイドバー サブクエリ保有質問のハイライト', () => {
  it('CSS に .sidebar-result-item.has-subquery スタイルが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.sidebar-result-item.has-subquery');
  });

  it('sidebarSubqueries 変数が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('sidebarSubqueries');
  });

  it('fetchSidebarSubqueries 関数が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function fetchSidebarSubqueries(');
  });

  it('fetchSidebarSubqueries が /api/aichat/share-subquery-links/all を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function fetchSidebarSubqueries(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('/api/aichat/share-subquery-links/all');
  });

  it('renderSidebarResults が has-subquery クラスを付与するコードを含む', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSidebarResults(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1200);
    expect(fn).toContain('has-subquery');
  });

  it('doSearch が fetchSidebarSubqueries を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doSearch(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('fetchSidebarSubqueries');
  });

  it('addSubquerySubmit 成功後に sidebarSubqueries をリセットする', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('addSubquerySubmit.addEventListener(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('sidebarSubqueries');
  });
});

describe('サイドバー開時の自動日付ロード', () => {
  it('sidebarToggle クリックハンドラが doDateLoad を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sidebarToggle.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('doDateLoad');
  });

  it('sidebarToggle クリックハンドラが calSelectedDay に当日をセットする', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sidebarToggle.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('calSelectedDay');
  });

  it('doDateLoad が fetchSidebarSubqueries を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doDateLoad(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('fetchSidebarSubqueries');
  });

  it('renderCalendar が cal-today クラスを付与する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderCalendar(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3200);
    expect(fn).toContain('cal-today');
  });

  it('CSS に .cal-today スタイルが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.cal-today');
  });
});

describe('appendShareBtn — 別タブで開くボタン', () => {
  it('chat-share-open-btn クラスが HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('chat-share-open-btn');
  });

  it('appendAiResponseRow が window.open を呼ぶコードを含む', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function appendAiResponseRow(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('window.open');
  });

  it('appendAiResponseRow の window.open に _blank が含まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function appendAiResponseRow(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain("'_blank'");
  });

  it('appendAiResponseRow 内でコピーと開くの両方が同じ shareUrl を使う（cachedUrl 共有）', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function appendAiResponseRow(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('cachedUrl');
  });
});

describe('appendShareBtn — 追加質問ボタン', () => {
  it('appendAiResponseRow 内に追加質問ボタン（＋）が存在する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function appendAiResponseRow(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('追加質問');
  });

  it('追加質問ボタンクリック時に currentHistoryQuestion をセットする', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function appendAiResponseRow(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('currentHistoryQuestion');
  });

  it('追加質問ボタンクリック時に openAddSubqueryModal を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function appendAiResponseRow(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('openAddSubqueryModal');
  });

  it('追加質問ボタンが リンクをコピー ボタンの前（左）に配置される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function appendAiResponseRow(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    const addIdx = fn.indexOf('追加質問');
    const copyIdx = fn.indexOf('リンクをコピー');
    expect(addIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeLessThan(copyIdx);
  });
});

describe('回答バブル コピーボタン', () => {
  it('buildAssistantBubble 関数に bubble-copy-btn クラスのボタンが含まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function buildAssistantBubble(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('bubble-copy-btn');
  });

  it('コピーボタンに navigator.clipboard.writeText が紐づいている', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function buildAssistantBubble(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('navigator.clipboard.writeText');
  });

  it('.bubble-copy-btn の CSS スタイルが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.bubble-copy-btn');
  });

  it('コピーボタンは opacity:0 を持たず常時表示である', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('.bubble-copy-btn');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).not.toContain('opacity: 0');
    expect(snippet).not.toContain('opacity:0');
  });

  it('コピーボタンは bottom / left で左下に配置される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('.bubble-copy-btn');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('bottom');
    expect(snippet).toContain('left');
  });
});

describe('ナビバー モデル選択ドロップダウン', () => {
  it('modelSelect セレクト要素が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="modelSelect"');
  });

  it('navbar-model-select クラスが HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('navbar-model-select');
  });

  it('モデルリストに llama-3.3-70b が含まれる', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('llama-3.3-70b');
  });

  it('モデルリストに llama-3.1-8b が含まれる', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('llama-3.1-8b');
  });

  it('modelSelect change イベントで lastModel を更新する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("modelSelect.addEventListener('change'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 200);
    expect(fn).toContain('lastModel');
  });

  it('chatForm submit が model フィールドを送信する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("chatForm.addEventListener('submit'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('model:');
  });

  it('CSS に .navbar-model-select スタイルが存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('.navbar-model-select');
  });

  it('index.ts に AICHAT_ALLOWED_MODELS が存在する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    expect(src).toContain('AICHAT_ALLOWED_MODELS');
  });

  it('index.ts の /api/aichat が body.model を読む', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1900);
    expect(fn).toContain('body.model');
  });

  it('index.ts の /api/aichat が /neko スラッシュコマンドをAIバインディング未設定チェックより前に判定する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1500);
    const slashCommandIdx = fn.indexOf('interpretAichatSlashCommand(');
    const aiBindingCheckIdx = fn.indexOf('AI バインディングが未設定です');
    expect(slashCommandIdx).toBeGreaterThan(-1);
    expect(aiBindingCheckIdx).toBeGreaterThan(-1);
    expect(slashCommandIdx).toBeLessThan(aiBindingCheckIdx);
  });

  it('/neko コマンドの応答時はモデルラベルを表示しない（isLocalCommand なら model に null を渡す）', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("chatForm.addEventListener('submit'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1600);
    expect(fn).toContain("var isLocalCommand = usedModel === 'local/neko';");
    expect(fn).toContain("appendBubble(responseText, 'assistant', isLocalCommand ? null : lastModel, data.fallbackUsed, respUsage);");
  });

  it('/neko コマンドの応答時は応答バブル下の共有リンク行を表示しない（appendShareBtn を呼ばない）', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("chatForm.addEventListener('submit'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1600);
    const guardIdx = fn.indexOf('if (!isLocalCommand) {');
    const shareBtnIdx = fn.indexOf('appendShareBtn(currentMsg,');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(shareBtnIdx).toBeGreaterThan(guardIdx);
  });

  it('index.ts の /api/aichat が fetchLatestCommitAgentLog で commit_agent_log の最新行を取得する（/neko clog用）', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1500);
    expect(fn).toContain('fetchLatestCommitAgentLog:');
    expect(fn).toContain('SELECT commit_sha, commit_message, detected_agent_name, created_at FROM commit_agent_log ORDER BY id DESC LIMIT 1');
  });

  it('renderAiResultInModal も /neko コマンドの応答時は共有リンク行(appendAiResponseRow)を表示しない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderAiResultInModal(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain("var isLocalCommand = usedModel === 'local/neko';");
    const guardIdx = fn.indexOf('if (!isLocalCommand) {');
    const appendRowIdx = fn.indexOf('appendAiResponseRow(box,');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(appendRowIdx).toBeGreaterThan(guardIdx);
  });

  it('モデルオプションのラベルテキストに llama-3.3-70b-instruct-fp8-fast のフルネームが表示される', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('>llama-3.3-70b-instruct-fp8-fast<');
  });

  it('llama-3.3-70b-instruct-fp8-fast がデフォルト選択状態になる', () => {
    const userWithLlama = {
      username: 'testuser',
      aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    };
    const html = getAiChatPage(userWithLlama);
    const idx = html.indexOf('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx - 30, idx + 60);
    expect(snippet).toContain('selected');
  });

  it('index.ts の /aichat GET fallbackModel が llama-3.3-70b-instruct-fp8-fast', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 300);
    expect(fn).toContain('llama-3.3-70b-instruct-fp8-fast');
  });
});

describe('サブクエリ一覧モーダル：#カラム削除・追加質問総数表示・多い順ソート', () => {
  it('renderSubqueriesList に # カラムが含まれない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).not.toContain('<th>#</th>');
  });

  it('renderSubqueriesList に link_count カラムが含まれる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4200);
    expect(fn).toContain('link_count');
  });

  it('index.ts の GET /api/aichat/subqueries が link_count を返す', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 400);
    expect(fn).toContain('link_count');
  });

  it('index.ts の GET /api/aichat/subqueries が link_count DESC でソートする', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 700);
    expect(fn).toContain('link_count DESC');
  });

  it('index.ts の GET /api/aichat/subqueries が LEFT JOIN を含む', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 700);
    expect(fn).toContain('LEFT JOIN');
  });
});

describe('サブクエリ一覧モーダル：追加質問カラム左端・キーワードバッジ', () => {
  it('renderSubqueriesList のテーブルヘッダーで 追加質問数 が サブクエリ列 より前にある', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2600);
    const posLinkCount = fn.indexOf('追加質問数');
    const posSubquery = fn.indexOf('<th>サブクエリ</th>');
    expect(posLinkCount).toBeGreaterThan(-1);
    expect(posSubquery).toBeGreaterThan(-1);
    expect(posLinkCount).toBeLessThan(posSubquery);
  });

  it('renderSubqueriesList がキーワードバッジを描画する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3200);
    expect(fn).toContain('sq-kw-badge');
  });

  it('renderSubqueriesList のキーワードバッジが "keyword (N)" 形式', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3900);
    expect(fn).toContain('kw.cnt');
  });

  it('renderSubqueriesList のキーワード td がサブクエリ td の後に html += される', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSubqueriesList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 4500);
    const posQueryTd = fn.indexOf('sq-query-cell');
    const posKwTd = fn.indexOf("html += '<td>' + kwHtml");
    expect(posQueryTd).toBeGreaterThan(-1);
    expect(posKwTd).toBeGreaterThan(-1);
    expect(posQueryTd).toBeLessThan(posKwTd);
  });

  it('index.ts の /api/aichat/subqueries が aichat_search_history を JOIN する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1200);
    expect(fn).toContain('aichat_search_history');
  });

  it('index.ts の /api/aichat/subqueries の keywords が cnt DESC でソートされる', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/subqueries'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1200);
    expect(fn).toContain('cnt DESC');
  });
});

describe('サイドバー：モデル名削除・新着/キーワードトグル・キーワードフィルタ', () => {
  it('renderSidebarResults の result-meta にモデル名テキスト表示コードが含まれない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSidebarResults(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1400);
    // r.model はカラー取得（MODEL_COLORS[r.model]）での参照は許容する
    // textContent / innerHTML への直接代入がないことを確認する
    expect(fn).not.toContain('textContent = r.model');
    expect(fn).not.toContain('innerHTML = r.model');
    expect(fn).not.toContain('shortModelName(r.model)');
  });

  it('sidebarModeToggle 要素が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('sidebarModeToggle');
  });

  it('新着ボタン（sidebarModeNew）が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('sidebarModeNew');
  });

  it('キーワードボタン（sidebarModeKw）が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('sidebarModeKw');
  });

  it('sidebarKwModal 要素が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('sidebarKwModal');
  });

  it('doKeywordLoad 関数が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function doKeywordLoad(');
  });

  it('doKeywordLoad が /api/aichat/shares/by-keyword を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doKeywordLoad(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('/api/aichat/shares/by-keyword');
  });

  it('openSidebarKeywordModal 関数が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function openSidebarKeywordModal(');
  });

  it('openSidebarKeywordModal が /api/aichat/keywords/monthly を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSidebarKeywordModal(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('/api/aichat/keywords/monthly');
  });

  it('index.ts に GET /api/aichat/keywords/monthly エンドポイントが存在する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/api/aichat/keywords/monthly'");
  });

  it('index.ts に GET /api/aichat/shares/by-keyword エンドポイントが存在する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/api/aichat/shares/by-keyword'");
  });
});

describe('キーワードモーダル位置修正 — サイドバー外 fixed 配置', () => {
  it('sidebar-kw-modal の CSS が position: fixed を含む', () => {
    const html = getAiChatPage(minimalUser);
    const cssIdx = html.indexOf('.sidebar-kw-modal');
    expect(cssIdx).toBeGreaterThan(-1);
    const css = html.slice(cssIdx, cssIdx + 200);
    expect(css).toContain('position: fixed');
  });

  it('sidebar-kw-modal の CSS が left: 260px を含む', () => {
    const html = getAiChatPage(minimalUser);
    const cssIdx = html.indexOf('.sidebar-kw-modal');
    expect(cssIdx).toBeGreaterThan(-1);
    const css = html.slice(cssIdx, cssIdx + 200);
    expect(css).toContain('260px');
  });

  it('sidebar-kw-modal の CSS が top: 44px を含む', () => {
    const html = getAiChatPage(minimalUser);
    const cssIdx = html.indexOf('.sidebar-kw-modal');
    expect(cssIdx).toBeGreaterThan(-1);
    const css = html.slice(cssIdx, cssIdx + 200);
    expect(css).toContain('44px');
  });

  it('sidebarKwModal HTML 要素がサイドバー div の外側にある', () => {
    const html = getAiChatPage(minimalUser);
    const sidebarCloseIdx = html.indexOf('</div>', html.indexOf('<div class="sidebar"'));
    const kwModalIdx = html.indexOf('id="sidebarKwModal"');
    expect(kwModalIdx).toBeGreaterThan(sidebarCloseIdx);
  });

  it('fetchSidebarSubqueries が Promise を返す（return で始まる）', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function fetchSidebarSubqueries(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('return ');
  });
});

describe('doDateLoad — △/◯件 フォーマット', () => {
  it('doDateLoad のステータスが △/◯件 形式を含む', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doDateLoad(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('sqCount');
  });

  it('doDateLoad が Promise.all を使用する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doDateLoad(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('Promise.all');
  });

  it('doDateLoad のステータスが / 区切りを含む', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doDateLoad(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toMatch(/sqCount.*\/.*currentResults\.length|sqCount.*'\/'|'\/'.*currentResults/);
  });
});

describe('キーワードモーダル：ソートトグル・件数表示・検索窓自動補完', () => {
  it('sidebarKwCount 要素が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('sidebarKwCount');
  });

  it('sidebarKwSortCount ボタンが HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('sidebarKwSortCount');
  });

  it('sidebarKwSortAlpha ボタンが HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('sidebarKwSortAlpha');
  });

  it('renderKwList 関数が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function renderKwList(');
  });

  it('kwSortOrder 変数が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('kwSortOrder');
  });

  it('kwListCache 変数が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('kwListCache');
  });

  it('renderKwList が localeCompare でアルファベット順ソートを行う', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderKwList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('localeCompare');
  });

  it('キーワードクリック時に sidebarKwModal.classList.remove を呼ばない（モーダルを閉じない）', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderKwList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).not.toContain("sidebarKwModal.classList.remove('open')");
  });

  it('キーワードクリック時に sidebarSearch.value を設定する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderKwList(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2200);
    expect(fn).toContain('sidebarSearch.value');
  });

  it('doKeywordLoad が kwSortOrder alpha の場合に localeCompare でソートする', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function doKeywordLoad(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('kwSortOrder');
    expect(fn).toContain('localeCompare');
  });

  it('openSidebarKeywordModal が sidebarKwCount にキーワード件数を設定する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSidebarKeywordModal(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('sidebarKwCount');
  });

  it('sidebarKwSortCount のクリックイベントが HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain("sidebarKwSortCount.addEventListener(");
  });

  it('sidebarKwSortAlpha のクリックイベントが HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain("sidebarKwSortAlpha.addEventListener(");
  });
});

describe('キーワードモーダルクリック時にサイドバーが閉じない', () => {
  it('document click ハンドラが sidebarKwModal.contains チェックを含む', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sidebarOpen && isTapCloseEnabled()");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('sidebarKwModal.contains');
  });

  it('document click ハンドラが sidebarKwModal 内クリックではサイドバーを閉じない条件を持つ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sidebarOpen && isTapCloseEnabled()");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toMatch(/!sidebarKwModal\.contains\(e\.target\)/);
  });
});

describe('新着/キーワードトグル修正・キーワードモーダル外タップ閉じ', () => {
  it('document click ハンドラがキーワードモーダルを外タップで閉じるロジックを含む', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sidebarKwModal.classList.contains('open')");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 200);
    expect(fn).toContain("sidebarKwModal.classList.remove('open')");
  });

  it('document click ハンドラがキーワードモーダルの外クリック判定を含む', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sidebarKwModal.classList.contains('open')");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 200);
    expect(fn).toMatch(/!sidebarKwModal\.contains\(e\.target\)/);
  });

  it('新着ボタンクリック時にキーワードモーダルを閉じる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sidebarModeNew.addEventListener(");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain("sidebarKwModal.classList.remove('open')");
  });

  it('新着ボタンクリック時に currentDateLabel が空でも today にフォールバックする', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sidebarModeNew.addEventListener(");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('toISOString');
  });

  it('closeSidebar がキーワードモーダルも閉じる', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function closeSidebar(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 200);
    expect(fn).toContain("sidebarKwModal.classList.remove('open')");
  });

  it('キーワードトグルボタンがモーダルのトグル動作をする（open時に閉じる）', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sidebarModeKw.addEventListener(");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 200);
    expect(fn).toContain("classList.contains('open')");
  });
});

describe('サブクエリ一覧モーダル：キーワードバッジクリックで質問一覧モーダル表示', () => {
  it('sqKwQuestionsOverlay が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="sqKwQuestionsOverlay"');
  });

  it('sqKwQuestionsTitle が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="sqKwQuestionsTitle"');
  });

  it('sqKwQuestionsClose が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="sqKwQuestionsClose"');
  });

  it('sqKwQuestionsBody が HTML に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="sqKwQuestionsBody"');
  });

  it('openSqKwQuestions 関数が存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function openSqKwQuestions(');
  });

  it('subqueriesListBody の sq-kw-badge クリックでイベント委譲ハンドラが動く', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("subqueriesListBody.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('sq-kw-badge');
  });

  it('openSqKwQuestions が /api/aichat/subquery-keyword-questions を fetch する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSqKwQuestions(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('/api/aichat/subquery-keyword-questions');
  });

  it('openSqKwQuestions が subquery_id と keyword をクエリパラメータで渡す', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function openSqKwQuestions(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('subquery_id');
    expect(fn).toContain('keyword');
  });

  it('index.ts に GET /api/aichat/subquery-keyword-questions ルートが存在する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/api/aichat/subquery-keyword-questions'");
  });

  it('index.ts の /api/aichat/subquery-keyword-questions が aichat_share_subquery_links を JOIN する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/subquery-keyword-questions'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1000);
    expect(fn).toContain('aichat_share_subquery_links');
  });

  it('index.ts の /api/aichat/subquery-keyword-questions が aichat_search_history を JOIN してキーワードフィルタする', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/subquery-keyword-questions'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1000);
    expect(fn).toContain('aichat_search_history');
  });

  it('index.ts の /api/aichat/subquery-keyword-questions が LIMIT 25 を含む', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/subquery-keyword-questions'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1200);
    expect(fn).toContain('LIMIT 25');
  });

  it('index.ts の /api/aichat/subquery-keyword-questions が keywords フィールドを返す', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/subquery-keyword-questions'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 2200);
    expect(fn).toContain('keywords');
  });
});

describe('サブクエリ一覧：質問一覧モーダルから過去ログモーダルを開く', () => {
  it('renderSqKwQuestionsResult が tr に data-share-id を付与する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSqKwQuestionsResult(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 900);
    expect(fn).toContain('data-share-id');
  });

  it('renderSqKwQuestionsResult の tr が cursor:pointer を持つ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function renderSqKwQuestionsResult(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1100);
    expect(fn).toContain('cursor:pointer');
  });

  it('sqKwQuestionsBody の click ハンドラが openHistoryModalByShareId を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sqKwQuestionsBody.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('openHistoryModalByShareId');
  });

  it('sqKwQuestionsBody の click ハンドラが openHistoryModalByShareId を呼ぶ', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("sqKwQuestionsBody.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('openHistoryModalByShareId');
  });

  it('closeHistoryModal が historyModalBackdrop の zIndex をリセットする', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function closeHistoryModal(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 200);
    expect(fn).toContain('zIndex');
  });
});

describe('AIチャット応答の自動保存（auto-save to ai_chat_shares）', () => {
  it('index.ts の /api/aichat POST が ai_chat_shares に INSERT する', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 5500);
    expect(fn).toContain('INSERT INTO ai_chat_shares');
  });

  it('index.ts の /api/aichat POST レスポンスに shareId が含まれる', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 5400);
    expect(fn).toContain('shareId');
  });

  it('index.ts の /api/aichat POST レスポンスに userHash が含まれる', () => {
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 5000);
    expect(fn).toContain('userHash');
  });

  it('appendAiResponseRow が shareId と userHash を引数に受け取る', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function appendAiResponseRow(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 100);
    expect(fn).toContain('shareId');
    expect(fn).toContain('userHash');
  });

  it('appendAiResponseRow の getShareUrl が shareId 提供時に /api/aichat/share を呼ばない', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function appendAiResponseRow(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    const idxGetUrl = fn.indexOf('function getShareUrl(');
    expect(idxGetUrl).toBeGreaterThan(-1);
    const getUrlFn = fn.slice(idxGetUrl, idxGetUrl + 300);
    expect(getUrlFn).toContain('shareId');
    expect(getUrlFn).toContain('/s/');
  });

  it('chatForm submit が data.shareId を appendShareBtn に渡す', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("chatForm.addEventListener('submit'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1600);
    expect(fn).toContain('data.shareId');
  });

  it('chatForm submit が data.userHash を appendShareBtn に渡す', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("chatForm.addEventListener('submit'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1600);
    expect(fn).toContain('data.userHash');
  });
});
