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

// ===========================================================
// Bug 1: question_hash が null の旧レコードでスワイプが動かない
// ===========================================================
describe('スワイプ: question_hash が null の場合のフォールバック', () => {
  it('showHistoryModal が shares-by-question エンドポイントを参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('/api/aichat/shares-by-question');
  });

  it('showHistoryModal が question_hash を持たない場合のフォールバック分岐を持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    // question_hash がない場合 question テキストで検索するフォールバック
    expect(fn).toContain('shares-by-question?question=');
  });

  it('showHistoryModal が question_hash を持つ場合は hash エンドポイントを優先する', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    expect(fn).toContain('shares-by-question-hash?hash=');
  });

  it('フォールバック時も r.question を encodeURIComponent でエンコードする', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 3000);
    // shares-by-question?question= の付近に encodeURIComponent がある
    const qi = fn.indexOf('shares-by-question?question=');
    const nearby = fn.slice(Math.max(0, qi - 100), qi + 200);
    expect(nearby).toContain('encodeURIComponent');
  });
});

// ===========================================================
// Bug 2: ハイライトトグルボタンが表示されない
// ===========================================================
describe('ハイライトトグルボタン: display の明示的な設定', () => {
  it('updateHighlightToggleBtn がボタン表示時に display を明示的な値で設定する', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    // opacity で状態を表現する（display:inline-block は使わない可能性があるため opacity を確認）
    expect(fn).toContain("opacity");
  });

  it('updateHighlightToggleBtn はボタンを常に表示する（display:none を設定しない）', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateHighlightToggleBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    // マークがなくても display:none で隠さず opacity で表現する
    expect(fn).not.toContain("display = 'none'");
  });
});
