// 対象: AIチャットでclaude/codex(/neko askgk claude_prompt=/codex_prompt=)の
// 回答文に含まれるリンクを脚注化する機能(ユーザー要望)。
// 変換ロジック自体はsrc/utils/aichatLinkFootnotes.test.tsで検証済み。
// このファイルは「どこで・どの条件で呼ばれるか」という配線を検証する。
import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { getAiChatSharePage } from './views/aichat-share';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

describe('AIチャット本体(buildAssistantBubble): claude/codexの回答だけリンクを脚注化する', () => {
  const html = getAiChatPage(minimalUser);

  it('convertAnswerLinksToFootnotesがインポート元からtoString()で埋め込まれている', () => {
    expect(html).toContain('var convertAnswerLinksToFootnotes = function convertAnswerLinksToFootnotes(markdown)');
  });

  it("buildAssistantBubbleがmodelが'claude'または'codex'のときだけconvertAnswerLinksToFootnotesを呼ぶ", () => {
    const idx = html.indexOf('function buildAssistantBubble(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain("(model === 'claude' || model === 'codex') ? convertAnswerLinksToFootnotes(text) : text");
    expect(fn).toContain('parseMd(renderText)');
  });
});

describe('共有ページ(getAiChatSharePage): claude/codexの回答だけリンクを脚注化する', () => {
  const baseShare = {
    question: '質問',
    created_at: '2026-06-15T00:00:00.000Z',
    access_count: 1,
  };

  it("model='claude'の場合、重複リンクが通し番号になり末尾に一覧が付く", () => {
    const html = getAiChatSharePage({
      ...baseShare,
      model: 'claude',
      answer: '[公式](https://example.com/docs)を見てください。再掲[公式](https://example.com/docs)。',
    });
    expect(html).toContain('[1](https://example.com/docs)を見てください。再掲[1](https://example.com/docs)。');
    expect(html).toContain('1. [https://example.com/docs](https://example.com/docs)');
  });

  it("model='codex'の場合も同様に脚注化される", () => {
    const html = getAiChatSharePage({
      ...baseShare,
      model: 'codex',
      answer: '[リンク](https://example.com/a)',
    });
    expect(html).toContain('[1](https://example.com/a)');
    expect(html).toContain('1. [https://example.com/a](https://example.com/a)');
  });

  it('claude/codex以外の通常モデルの回答は変換しない(元のリンク表示をそのまま保持)', () => {
    const html = getAiChatSharePage({
      ...baseShare,
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      answer: '[公式ドキュメント](https://example.com/docs)を見てください。',
    });
    expect(html).toContain('[公式ドキュメント](https://example.com/docs)を見てください。');
    expect(html).not.toContain('1. [https://example.com/docs]');
  });
});
