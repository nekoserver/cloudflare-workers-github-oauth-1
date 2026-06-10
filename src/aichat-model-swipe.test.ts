import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: {
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5',
    '@cf/google/gemma-4-26b-a4b-it': '#16a34a',
  },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

describe('詳細プレビューモーダル: マルチモデルスワイプ — 状態変数', () => {
  it('historyModalSwipeItems 変数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('historyModalSwipeItems');
  });

  it('historyModalSwipeIndex 変数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('historyModalSwipeIndex');
  });

  it('historyModalSwipeDataCache 変数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('historyModalSwipeDataCache');
  });
});

describe('詳細プレビューモーダル: マルチモデルスワイプ — 関数', () => {
  it('historyModalSwipeNavigate 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function historyModalSwipeNavigate');
  });

  it('renderHistoryModalModelDots 関数が HTML に含まれる', () => {
    const html = buildPage();
    expect(html).toContain('function renderHistoryModalModelDots');
  });

  it('historyModalSwipeNavigate が /api/aichat/shares/ を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function historyModalSwipeNavigate');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('/api/aichat/shares/');
  });

  it('historyModalSwipeNavigate がフェードアウト (opacity 0) を行う', () => {
    const html = buildPage();
    const idx = html.indexOf('function historyModalSwipeNavigate');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain("opacity");
    expect(fn).toContain("'0'");
  });

  it('historyModalSwipeNavigate がフェードイン (opacity 1) を行う', () => {
    const html = buildPage();
    const idx = html.indexOf('function historyModalSwipeNavigate');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain("'1'");
  });
});

describe('詳細プレビューモーダル: マルチモデルスワイプ — ドット表示', () => {
  it('renderHistoryModalModelDots が data-swipe-index を生成する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderHistoryModalModelDots');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('data-swipe-index');
  });

  it('renderHistoryModalModelDots がアクティブなドットを大きく表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderHistoryModalModelDots');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('isActive');
  });

  it('historyModalMeta の click ハンドラが data-swipe-index を処理する', () => {
    const html = buildPage();
    const idx = html.indexOf('historyModalMeta.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('data-swipe-index');
  });
});

describe('詳細プレビューモーダル: マルチモデルスワイプ — タッチ・キーボード', () => {
  it('historyModalChat に touchstart リスナーが設定される', () => {
    const html = buildPage();
    expect(html).toContain('touchstart');
    expect(html).toContain('historyModalChat');
  });

  it('historyModalChat に touchend リスナーが設定される', () => {
    const html = buildPage();
    expect(html).toContain('touchend');
  });

  it('ArrowLeft / ArrowRight でスワイプナビゲーションを呼ぶ', () => {
    const html = buildPage();
    expect(html).toContain('ArrowLeft');
    expect(html).toContain('ArrowRight');
    expect(html).toContain('historyModalSwipeNavigate');
  });

  it('showHistoryModal が question_hash 存在時に shares-by-question-hash を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2500);
    expect(fn).toContain('question_hash');
    expect(fn).toContain('shares-by-question-hash');
  });
});
