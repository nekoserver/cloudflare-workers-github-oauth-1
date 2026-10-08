// @vitest-environment jsdom
// 対象: /s/:userHash/:id 共有ページでclaude/codex回答のコードブロックに
// シンタックスハイライトが実際に適用されることを、埋め込みスクリプトを
// jsdomで実行して確認する(配線の存在確認だけでなく実際の出力を検証する)。
import { describe, it, expect } from 'vitest';
import { getAiChatSharePage } from './views/aichat-share';

function runShareScriptAndGetAnswerHtml(model: string, answer: string): string {
  const html = getAiChatSharePage({
    question: 'q',
    answer,
    model,
    created_at: '2026-06-15T00:00:00.000Z',
    access_count: 1,
  });
  document.body.innerHTML = '<div class="chat-bubble assistant" id="shareAnswer"></div>';
  const scriptMatch = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find((m) => m[1].includes('rawAnswer'));
  if (!scriptMatch) throw new Error('script not found');
  // eslint-disable-next-line no-new-func
  new Function('document', 'window', scriptMatch[1])(document, window);
  return document.getElementById('shareAnswer')!.innerHTML;
}

describe('共有ページ: claude/codexのコードブロックに実際にハイライトが適用される', () => {
  it("model='claude'のコードブロックはtok-kw等のspanでハイライトされる", () => {
    const answerHtml = runShareScriptAndGetAnswerHtml('claude', '```javascript\nconst x = 1;\n```');
    expect(answerHtml).toContain('<span class="tok-kw">const</span>');
  });

  it("model='codex'でも同様にハイライトされる", () => {
    const answerHtml = runShareScriptAndGetAnswerHtml('codex', '```python\ndef f():\n    pass\n```');
    expect(answerHtml).toContain('<span class="tok-kw">def</span>');
    expect(answerHtml).toContain('<span class="tok-kw">pass</span>');
  });

  it('通常モデルの回答はハイライトせず、コード本文はエスケープのみで表示される', () => {
    const answerHtml = runShareScriptAndGetAnswerHtml('@cf/meta/llama-3.3-70b-instruct-fp8-fast', '```javascript\nconst x = 1;\n```');
    expect(answerHtml).not.toContain('tok-kw');
    expect(answerHtml).toContain('const x = 1;');
  });
});
