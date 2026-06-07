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

function sliceFunc(html: string, funcName: string, size = 3000): string {
  const idx = html.indexOf(funcName);
  if (idx === -1) return '';
  return html.slice(idx, idx + size);
}

describe('別のモデルに質問するモーダル: キャッシュ済みモデルの検出', () => {
  it('openHistoryModelSelectModal が historyModalSwipeItems を参照する', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    expect(fn).toContain('historyModalSwipeItems');
  });

  it('openHistoryModelSelectModal が cachedModelMap を構築する', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    expect(fn).toContain('cachedModelMap');
  });

  it('openHistoryModelSelectModal が isCached フラグを使う', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    expect(fn).toContain('isCached');
  });
});

describe('別のモデルに質問するモーダル: キャッシュ済みモデルの背景色', () => {
  it('キャッシュ済みモデルに薄い水色の背景色が適用される', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    expect(fn).toMatch(/#eff6ff|#dbeafe/);
  });

  it('キャッシュ済みモデルに水色のボーダーが適用される', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    expect(fn).toMatch(/#bfdbfe|#93c5fd/);
  });
});

describe('別のモデルに質問するモーダル: 回答済みバッジ', () => {
  it('回答済みバッジのテキストが含まれる', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    expect(fn).toContain('回答済み');
  });

  it('回答済みバッジに青系の文字色が適用される', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    const idx = fn.indexOf('回答済み');
    const badge = fn.slice(Math.max(0, idx - 200), idx + 20);
    expect(badge).toMatch(/#1d4ed8|#2563eb|#1e40af/);
  });
});

describe('別のモデルに質問するモーダル: キャッシュ済みクリック動作', () => {
  it('キャッシュ済みモデルのクリックで historyModalSwipeNavigate を呼ぶ', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    expect(fn).toContain('historyModalSwipeNavigate');
  });

  it('キャッシュ済みモデルのクリックで overlay を閉じる', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    expect(fn).toContain('removeChild');
  });

  it('キャッシュ済みでないモデルは openReAskConfirmModal を呼ぶ', () => {
    const html = buildPage();
    const fn = sliceFunc(html, 'function openHistoryModelSelectModal');
    expect(fn).toContain('openReAskConfirmModal');
  });
});
