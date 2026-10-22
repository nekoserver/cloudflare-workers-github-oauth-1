import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import { getAiChatPage } from './views/aichat';

it('renders the reset timestamp centered in the AI response modal', () => {
  const html = getAiChatPage({ username: 'alice', aiChatModel: 'test' });
  const start = html.indexOf('function renderAiResultInModal(');
  const end = html.indexOf('function openReAskResponseModal(', start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const dom = new JSDOM('<body><div id="box"></div></body>');
  try {
    const buildBubble = (text: string) => {
      const element = dom.window.document.createElement('div');
      element.textContent = text;
      return element;
    };
    const save = vi.fn();
    const render = new Function('buildAssistantBubble', 'extractRespUsage', 'appendAiResponseRow',
      html.slice(start, end) + '; return renderAiResultInModal;')(buildBubble, () => null, save);
    const box = dom.window.document.getElementById('box')!;
    render(box, '/status', 'test', { response: '2026-10-22 23:14:36', responseAlign: 'center', usedModel: 'local/neko' });
    expect(box.firstElementChild?.textContent).toBe('2026-10-22 23:14:36');
    expect((box.firstElementChild as HTMLElement).style.textAlign).toBe('center');
    expect(save).not.toHaveBeenCalled();
  } finally { dom.window.close(); }
});
