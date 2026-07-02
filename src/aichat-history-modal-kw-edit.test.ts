import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

describe('AIチャット詳細プレビュー: キーワード分類モード切替ボタン', () => {
  it('タイトルの左に📝ボタン(historyModalKwEditToggleBtn)が配置される', () => {
    const html = buildPage();
    const titleIdx = html.indexOf('id="historyModalTitle"');
    const btnIdx = html.indexOf('id="historyModalKwEditToggleBtn"');
    expect(btnIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(-1);
    expect(btnIdx).toBeLessThan(titleIdx);
    expect(html).toContain('📝');
  });

  it('クリックで historyModalKwEditMode をトグルする', () => {
    const html = buildPage();
    expect(html).toContain('historyModalKwEditMode = !historyModalKwEditMode;');
  });

  it('編集モード中に未分類キーワードをタップするとキーワード分類モーダル(openKwClassifyModal)を開く', () => {
    const html = buildPage();
    expect(html).toMatch(/if \(historyModalKwEditMode && !isClassified\) \{\s*openKwClassifyModal\(kw, function\(\) \{/);
  });

  it('分類保存後に historyModalCurrentId のキーワードを再取得してチップを再描画する', () => {
    const html = buildPage();
    expect(html).toMatch(/fetchShareKeywords\(historyModalCurrentId, function\(\) \{ renderKeywordChips\(true\); \}\);/);
  });

  it('openKwClassifyModal は保存完了時に任意の onSaved コールバックを呼び出す', () => {
    const html = buildPage();
    expect(html).toContain('function openKwClassifyModal(keyword, onSaved)');
    expect(html).toContain("if (typeof onSaved === 'function') onSaved();");
  });
});
