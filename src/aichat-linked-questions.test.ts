import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const FULL_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const COLORS = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5',
  '@cf/google/gemma-4-26b-a4b-it': '#16a34a',
};

function buildPage(): string {
  return getAiChatPage({
    name: 'テストユーザー',
    username: 'testuser',
    aiChatModel: FULL_MODEL,
    modelColors: COLORS,
  });
}

describe('サブクエリを持つ質問一覧: モデルカラー表示', () => {
  it('renderLinkedQuestions 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function renderLinkedQuestions');
  });

  it('renderLinkedQuestions が lk.models を参照している', () => {
    const html = buildPage();
    expect(html).toContain('lk.models');
  });

  it('リンク行にモデルカラードットを設定するコードを含む', () => {
    const html = buildPage();
    expect(html).toContain('MODEL_COLORS[m]');
  });

  it('質問セルには border-left カラーを設定しない（リンク行に移動）', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderLinkedQuestions(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).not.toContain('borderStyle = modelColor');
  });

  it('linkedQuestionsAllItems 変数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('linkedQuestionsAllItems');
  });

  it('linkedQuestionsFilter 変数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('linkedQuestionsFilter');
  });
});

describe('サブクエリを持つ質問一覧: question_hash バッジ', () => {
  it('question_hash を参照するコードが HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('question_hash');
  });

  it('openQuestionHashModal 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function openQuestionHashModal');
  });

  it('openQuestionHashModal が getNextZ() で z-index を設定する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openQuestionHashModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('getNextZ()');
  });

  it('shares-by-question-hash エンドポイントを呼び出すコードを含む', () => {
    const html = buildPage();
    expect(html).toContain('shares-by-question-hash');
  });
});

describe('サブクエリを持つ質問一覧: モデルフィルター', () => {
  it('openLinkedQuestionsFilter 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function openLinkedQuestionsFilter');
  });

  it('フィルターモーダルに「すべて」オプションが含まれる', () => {
    const html = buildPage();
    expect(html).toContain("'all'");
    expect(html).toContain('すべて');
  });

  it('フィルター選択後に renderLinkedQuestions を再描画するコードを含む', () => {
    const html = buildPage();
    expect(html).toContain('renderLinkedQuestions(linkedQuestionsAllItems)');
  });

  it('フィルターがリンクの models 配列を参照している', () => {
    const html = buildPage();
    const idx = html.indexOf('function openLinkedQuestionsFilter');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('lk.models');
  });

  it('フィルター状態を openLinkedQuestions 開示時に all にリセットするコードを含む', () => {
    const html = buildPage();
    expect(html).toContain("linkedQuestionsFilter = 'all'");
  });

  it('shortModelName をフィルターモーダルのラベルに使用している', () => {
    const html = buildPage();
    const idx = html.indexOf('function openLinkedQuestionsFilter(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('shortModelName');
  });

  it('renderLinkedQuestions のフィルターが lk.models で絞り込む', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderLinkedQuestions');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('lk.models');
  });
});

describe('詳細プレビューからの別モデル再問い合わせ', () => {
  it('openHistoryModelSelectModal 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function openHistoryModelSelectModal');
  });

  it('openReAskConfirmModal 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function openReAskConfirmModal');
  });

  it('openReAskResponseModal 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function openReAskResponseModal');
  });

  it('historyModalCurrentModel 変数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('historyModalCurrentModel');
  });

  it('確認モーダルに「この言語モデルに改めて問い合わせますか？」テキストが含まれる', () => {
    const html = buildPage();
    expect(html).toContain('この言語モデルに改めて問い合わせますか？');
  });

  it('確認モーダルに「はい」「いいえ」ボタンテキストが含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function openReAskConfirmModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3200);
    expect(fn).toContain('はい');
    expect(fn).toContain('いいえ');
  });

  it('確認モーダルが getNextZ() で z-index を動的設定する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openReAskConfirmModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3200);
    expect(fn).toContain('getNextZ()');
  });

  it('「はい」押下時に historyModalBackdrop を閉じるコードが含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function openReAskConfirmModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3200);
    expect(fn).toContain('historyModalBackdrop');
  });

  it('応答モーダルが /api/aichat を呼び出す', () => {
    const html = buildPage();
    const idx = html.indexOf('function openReAskResponseModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3200);
    expect(fn).toContain('/api/aichat');
  });

  it('応答モーダルが選択モデルを POST body に含める', () => {
    const html = buildPage();
    const idx = html.indexOf('function openReAskResponseModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3200);
    expect(fn).toContain('model');
    expect(fn).toContain('message');
  });

  it('showHistoryModal が historyModalCurrentModel をセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1600);
    expect(fn).toContain('historyModalCurrentModel');
  });

  it('モデル名クリック時に openHistoryModelSelectModal を呼ぶ', () => {
    const html = buildPage();
    expect(html).toContain('openHistoryModelSelectModal()');
  });

  it('renderAiResultInModal にフォールバック通知コードが含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderAiResultInModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('usedModel');
  });
});

describe('AI 応答表示の一本化 (appendAiResponseRow / renderAiResultInModal)', () => {
  it('appendAiResponseRow 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function appendAiResponseRow');
  });

  it('renderAiResultInModal 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function renderAiResultInModal');
  });

  it('appendShareBtn は appendAiResponseRow を呼ぶ薄いラッパーである', () => {
    const html = buildPage();
    const idx = html.indexOf('function appendShareBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('appendAiResponseRow');
  });

  it('appendAiResponseRow は chat-share-row を生成する', () => {
    const html = buildPage();
    const idx = html.indexOf('function appendAiResponseRow');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('chat-share-row');
  });

  it('appendAiResponseRow は chat-share-btn を生成する', () => {
    const html = buildPage();
    const idx = html.indexOf('function appendAiResponseRow');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('chat-share-btn');
  });

  it('appendAiResponseRow はコンテナ引数に appendChild する', () => {
    const html = buildPage();
    const idx = html.indexOf('function appendAiResponseRow');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('container.appendChild');
  });

  it('renderAiResultInModal は appendAiResponseRow を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderAiResultInModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('appendAiResponseRow');
  });

  it('openReAskResponseModal は renderAiResultInModal を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function openReAskResponseModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3200);
    expect(fn).toContain('renderAiResultInModal');
  });
});

describe('z-index 動的管理: getNextZ', () => {
  it('getNextZ 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function getNextZ');
  });

  it('getNextZ が data-overlay 属性でスキャンする（ブラウザ正規化の影響を受けない）', () => {
    const html = buildPage();
    const idx = html.indexOf('function getNextZ');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('data-overlay');
    expect(fn).not.toContain('position:fixed');
  });

  it('getNextZ が zIndex を読み取る', () => {
    const html = buildPage();
    const idx = html.indexOf('function getNextZ');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('zIndex');
  });

  it('openAddSubqueryModal が getNextZ を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function openAddSubqueryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('getNextZ');
  });

  it('openQuestionHashModal が動的オーバーレイに data-overlay を付与する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openQuestionHashModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('data-overlay');
  });

  it('openReAskResponseModal が動的オーバーレイに data-overlay を付与する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openReAskResponseModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('data-overlay');
  });

  it('openHistoryModelSelectModal が動的オーバーレイに data-overlay を付与する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHistoryModelSelectModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('data-overlay');
  });

  it('openQuestionHashModal が getNextZ を呼ぶ（固定 z-index を持たない）', () => {
    const html = buildPage();
    const idx = html.indexOf('function openQuestionHashModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('getNextZ');
    expect(fn).not.toContain('z-index:1100');
  });

  it('openHistoryModelSelectModal が getNextZ を呼ぶ（固定 z-index を持たない）', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHistoryModelSelectModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('getNextZ');
    expect(fn).not.toContain('z-index:1100');
  });

  it('openReAskConfirmModal が getNextZ を呼ぶ（固定 z-index を持たない）', () => {
    const html = buildPage();
    const idx = html.indexOf('function openReAskConfirmModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('getNextZ');
    expect(fn).not.toContain('z-index:1200');
  });

  it('openReAskResponseModal が getNextZ を呼ぶ（固定 z-index を持たない）', () => {
    const html = buildPage();
    const idx = html.indexOf('function openReAskResponseModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('getNextZ');
    expect(fn).not.toContain('z-index:1100');
  });

  it('openLinkedQuestionsFilter が getNextZ を呼ぶ（固定 z-index を持たない）', () => {
    const html = buildPage();
    const idx = html.indexOf('function openLinkedQuestionsFilter(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('getNextZ');
    expect(fn).not.toContain('z-index:1100');
  });

  it('appendAiResponseRow の追加質問ボタンが stopPropagation を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function appendAiResponseRow');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('stopPropagation');
  });

  it('appendAiResponseRow の追加質問ボタンが親 data-overlay の z-index を読み取る', () => {
    const html = buildPage();
    const idx = html.indexOf('function appendAiResponseRow');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('data-overlay');
    expect(fn).toContain('parentNode');
  });

  it('openAddSubqueryModal が baseZ 引数を受け取り上位レイヤーに表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openAddSubqueryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('baseZ');
  });
});

describe('サブクエリ一覧: サブクエリセルタップで選択→質問一覧モーダル', () => {
  it('subqueriesAllItems 変数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('subqueriesAllItems');
  });

  it('renderSubqueriesList が sq-query-cell クラスの td を生成する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueriesList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1600);
    expect(fn).toContain('sq-query-cell');
  });

  it('openSubquerySelectModal 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function openSubquerySelectModal');
  });

  it('openSubqueryLinkedQuestionsModal 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function openSubqueryLinkedQuestionsModal');
  });

  it('openSubquerySelectModal が動的オーバーレイに data-overlay を付与する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openSubquerySelectModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('data-overlay');
    expect(fn).toContain('getNextZ');
  });

  it('openSubqueryLinkedQuestionsModal が動的オーバーレイに data-overlay を付与する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openSubqueryLinkedQuestionsModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('data-overlay');
    expect(fn).toContain('getNextZ');
  });

  it('openSubquerySelectModal が link_count 降順ソートを行う', () => {
    const html = buildPage();
    const idx = html.indexOf('function openSubquerySelectModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('link_count');
    expect(fn).toContain('sort');
  });

  it('openSubqueryLinkedQuestionsModal が subquery_id でフィルタする', () => {
    const html = buildPage();
    const idx = html.indexOf('function openSubqueryLinkedQuestionsModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('subquery_id');
  });

  it('renderLinkedQuestionsInto 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function renderLinkedQuestionsInto');
  });

  it('openSubqueryLinkedQuestionsModal が share-subquery-links/all を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function openSubqueryLinkedQuestionsModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('share-subquery-links/all');
  });
});
