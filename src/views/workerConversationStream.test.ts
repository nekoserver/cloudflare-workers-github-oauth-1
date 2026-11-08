import { expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getConversationStreamPanel, getConversationStreamToggle } from './conversationStreamPanel';
import { getWorkerConversationStreamPage } from './workerConversationStream';
it('Worker receives safe live snapshots and respects stop/start and message origin', () => {
  const dom = new JSDOM(getWorkerConversationStreamPage(), { url: 'https://app.test/aichat/worker-stream', runScripts: 'outside-only' });
  const w = dom.window;
  w.eval([...getWorkerConversationStreamPage().matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1]);
  function send(data: unknown, origin = 'https://app.test') { w.dispatchEvent(new w.MessageEvent('message', { origin, source: w.parent, data })); }
  send({ type: 'conversation-snapshot', turns: [{ role: 'user', text: '<script>unsafe</script>' }, { role: 'assistant', text: 'Museの回答' }] });
  expect(w.document.body.textContent).toContain('Museの回答'); expect(w.document.querySelector('#turns script')).toBeNull();
  send({ type: 'conversation-stop' }); send({ type: 'conversation-snapshot', turns: [{ role: 'assistant', text: 'stopped update' }] });
  expect(w.document.body.textContent).not.toContain('stopped update');
  send({ type: 'conversation-start' }); send({ type: 'conversation-snapshot', turns: [{ role: 'assistant', text: 'foreign update' }] }, 'https://evil.test');
  expect(w.document.body.textContent).not.toContain('foreign update'); dom.window.close();
});
it('offers Worker, probes it before marking green, embeds same-origin view, and sends current conversation', async () => {
  const html = getConversationStreamToggle() + getConversationStreamPanel() + '<div id="chatLog"><div class="chat-bubble user">質問</div><div class="chat-bubble assistant">回答</div></div>';
  const dom = new JSDOM(html, { url: 'https://app.test/aichat', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w, 'fetch', { value: vi.fn(async () => Response.json({ healthy: true, service: 'worker-conversation-stream' })) });
  w.eval([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1]);
  const select = w.document.getElementById('conversationStreamHost') as unknown as HTMLSelectElement;
  expect([...select.options].map(o => o.value)).toContain('worker');
  select.value = 'worker'; select.dispatchEvent(new w.Event('change'));
  w.document.getElementById('conversationStreamToggle')!.click();
  await vi.waitFor(() => expect(w.document.querySelector<HTMLElement>('[data-value="worker"]')!.style.color).toBe('rgb(22, 163, 74)'));
  expect(w.document.querySelector('iframe')!.src).toContain('/aichat/worker-stream');
  dom.window.close();
});
