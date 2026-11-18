// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { AICHAT_PENDING_SCRIPT, AICHAT_PENDING_CSS } from './aichatPending';
import { getAiChatPage } from './aichat';

// ユーザー指定(2026-11-07): 質問を送ってから回答を得るまで、入力窓と応答バブルの外枠を同じ色にして点滅させ、
// 「考え中...」の右に、縦長の3本線が左から右へ波のように上下するSVGアイコンを置く。
type Pending = {
  beginAichatPending(input: HTMLElement, bubble: HTMLElement | null, color: string): void;
  markAichatPendingBubble(bubble: HTMLElement | null): void;
  endAichatPending(input: HTMLElement): void;
};
// 待ちの件数はscriptの中の変数に持つので、テストごとに新しく読み込む
const load = () => new Function(`${AICHAT_PENDING_SCRIPT}\nreturn { beginAichatPending, markAichatPendingBubble, endAichatPending };`)() as Pending;
let pending: Pending;

describe('AIチャットの回答待ちの表示', () => {
  let input: HTMLTextAreaElement;
  let bubble: HTMLDivElement;
  beforeEach(() => {
    document.body.innerHTML = '<textarea id="chatInput"></textarea><div id="chatLog"><div class="chat-bubble thinking"><div>考え中...</div></div></div>';
    input = document.getElementById('chatInput') as HTMLTextAreaElement;
    bubble = document.querySelector('.chat-bubble.thinking') as HTMLDivElement;
    pending = load();
  });

  it('入力窓と考え中のバブルに同じ色を設定して点滅させ、文言の右に3本線の波形アイコンを置く', () => {
    pending.beginAichatPending(input, bubble, '#0ea5e9');
    for (const el of [input, bubble]) {
      expect(el.classList.contains('aichat-pending')).toBe(true);
      expect(el.style.getPropertyValue('--aichat-pending-color')).toBe('#0ea5e9');
    }
    const text = bubble.firstElementChild!;
    const svg = text.querySelector('svg.aichat-pending-wave')!;
    expect(svg).not.toBeNull();
    expect(text.textContent).toBe('考え中...');
    expect(svg.querySelectorAll('rect')).toHaveLength(3);
    // 縦長の線を左から右へ並べ、遅れを付けて波にする
    const rects = [...svg.querySelectorAll('rect')];
    const xs = rects.map((r) => Number(r.getAttribute('x')));
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(rects.every((r) => Number(r.getAttribute('height')) > Number(r.getAttribute('width')))).toBe(true);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('色が無ければアクセント色を使う', () => {
    pending.beginAichatPending(input, bubble, '');
    expect(input.style.getPropertyValue('--aichat-pending-color')).toBe('var(--accent-color, #667eea)');
  });

  it('回答が表示され始めた応答バブルも同じ色で点滅させ、終わったら入力窓とすべてのバブルの点滅を止める', () => {
    pending.beginAichatPending(input, bubble, '#0ea5e9');
    const streaming = document.createElement('div');
    document.getElementById('chatLog')!.appendChild(streaming);
    pending.markAichatPendingBubble(streaming);
    expect(streaming.classList.contains('aichat-pending')).toBe(true);
    expect(streaming.style.getPropertyValue('--aichat-pending-color')).toBe('#0ea5e9');
    pending.endAichatPending(input);
    expect(document.querySelectorAll('.aichat-pending')).toHaveLength(0);
  });

  it('前回の送信の続きと新しい送信が重なったら、両方が終わるまで入力窓の点滅を続ける', () => {
    pending.beginAichatPending(input, bubble, '#0ea5e9');
    pending.beginAichatPending(input, null, '#0ea5e9');
    pending.endAichatPending(input);
    expect(input.classList.contains('aichat-pending')).toBe(true);
    pending.endAichatPending(input);
    expect(input.classList.contains('aichat-pending')).toBe(false);
  });

  it('CSSは外枠を点滅させ、3本線を時間差で上下させる(Museの枠色のインライン指定より、点滅中はアニメーションが優先される)', () => {
    expect(AICHAT_PENDING_CSS).toMatch(/\.aichat-pending \{[^}]*animation: aichat-pending-blink [^;]*infinite;/);
    expect(AICHAT_PENDING_CSS).toContain('@keyframes aichat-pending-blink');
    expect(AICHAT_PENDING_CSS).toContain('border-color: var(--aichat-pending-color)');
    expect(AICHAT_PENDING_CSS).toMatch(/\.aichat-pending-wave rect \{[^}]*animation: aichat-pending-wave [^;]*infinite;/);
    expect(AICHAT_PENDING_CSS).toMatch(/rect:nth-child\(2\) \{ animation-delay: [0-9.]+s; \}/);
    expect(AICHAT_PENDING_CSS).toMatch(/rect:nth-child\(3\) \{ animation-delay: [0-9.]+s; \}/);
  });
});

describe('AIチャットの回答待ちの表示: ページ', () => {
  const page = getAiChatPage({ username: 'u', aiChatModel: 'm' });
  it('送信で開始し、ストリームの応答バブルにも付け、完了・失敗のどちらでも止める', () => {
    const submitAt = page.indexOf("chatForm.addEventListener('submit'");
    const submit = page.slice(submitAt, page.indexOf('resumePendingAichatJobs();', submitAt));
    expect(submit).toContain("beginAichatPending(chatInput, thinking, getModelDotColor(lastModel));");
    expect(submit).toContain('endAichatPending(chatInput);');
    expect(submit.indexOf('endAichatPending(chatInput);')).toBeGreaterThan(submit.indexOf('.finally(function() {'));
    expect(page).toContain('markAichatPendingBubble(state.bubble);');
    expect(page).toContain('.aichat-pending-wave rect');
  });
});
