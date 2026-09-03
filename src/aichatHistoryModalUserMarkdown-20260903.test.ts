import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: 詳細プレビューモーダル(appendHistoryModalBubble)・再質問確認モーダル
// (qBubble)の質問バブルも、メインのチャットログ(appendBubble)と同様に
// parseMdでMarkdown描画する。ソースレベルでの配線確認(E2Eは
// aichat-user-bubble-markdown-20260903.test.tsのメインチャットログで実施済み)。
//
// 故障シナリオ:
//   (1) appendHistoryModalBubbleだけ対応を忘れ、メインのチャットログと
//       詳細プレビューモーダルで質問の見た目が食い違う
//   (2) 生テキストのままinnerHTMLに渡してしまい(parseMdを経由しない)、
//       過去に保存された質問にHTMLタグが含まれる場合にXSSになる

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

describe('appendHistoryModalBubble: 質問バブルもMarkdown描画する', () => {
  it('role!==assistant分岐でparseMd(truncateForHistoryPreview(text))をinnerHTMLに渡す', () => {
    const html = getAiChatPage(minimalUser);
    const start = html.indexOf('function appendHistoryModalBubble(text, role, imageDataUrl)');
    expect(start).toBeGreaterThan(-1);
    const body = html.slice(start, start + 900);
    expect(body).toContain("el.className = 'chat-bubble user preview-area';");
    expect(body).toContain('textEl.innerHTML = parseMd(truncateForHistoryPreview(text));');
    expect(body).not.toContain('textEl.textContent = text;');
  });
});

describe('再質問確認モーダル: qBubbleもMarkdown描画する', () => {
  it("qBubble.classNameがpreview-areaを含み、innerHTML=parseMd(question)を使う", () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf("qBubble.className = 'chat-bubble user preview-area';");
    expect(idx).toBeGreaterThan(-1);
    const body = html.slice(idx, idx + 200);
    expect(body).toContain('qBubble.innerHTML = parseMd(question);');
  });
});
