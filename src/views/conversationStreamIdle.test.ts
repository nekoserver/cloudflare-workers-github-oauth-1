import { expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getConversationStreamPanel, getConversationStreamToggle } from './conversationStreamPanel';

it('never probes while closed, stops after close, and resumes only on explicit open', async () => {
  vi.useFakeTimers();
  const probe = vi.fn(async () => ({ ok: true, json: async () => ({ healthy: true, availableHosts: ['mygw'] }) }));
  const dom = new JSDOM(getConversationStreamToggle() + getConversationStreamPanel(), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/aichat',
    beforeParse(w) { w.fetch = probe; w.AbortSignal = AbortSignal as typeof w.AbortSignal; w.setInterval = setInterval as typeof w.setInterval; w.clearInterval = clearInterval; },
  });
  try {
    const d = dom.window.document;
    await vi.advanceTimersByTimeAsync(90000);
    d.dispatchEvent(new dom.window.Event('visibilitychange'));
    dom.window.dispatchEvent(new dom.window.Event('pageshow'));
    await Promise.resolve();
    expect(probe).not.toHaveBeenCalled();
    d.getElementById('conversationStreamToggle')!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(d.getElementById('conversationStreamFrame')!.getAttribute('src')).toContain('mygw.');
    d.getElementById('conversationStreamClose')!.click();
    const calls = probe.mock.calls.length;
    await vi.advanceTimersByTimeAsync(90000);
    expect(probe).toHaveBeenCalledTimes(calls);
    expect(d.getElementById('conversationStreamFrame')!.hasAttribute('src')).toBe(false);
    d.getElementById('conversationStreamToggle')!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(calls + 2);
  } finally { dom.window.close(); vi.useRealTimers(); }
});

it('does not probe other hosts when a manual destination is selected', async () => {
  const probe = vi.fn();
  const dom = new JSDOM(getConversationStreamToggle() + getConversationStreamPanel(), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/aichat',
    beforeParse(w) { w.fetch = probe; w.AbortSignal = AbortSignal as typeof w.AbortSignal; },
  });
  try {
    const d = dom.window.document;
    const select = d.getElementById('conversationStreamHost') as HTMLSelectElement;
    select.value = 'redmine'; select.dispatchEvent(new dom.window.Event('change'));
    d.getElementById('conversationStreamToggle')!.click();
    await Promise.resolve();
    expect(probe.mock.calls.map(call => call[0])).toEqual(['/api/aichat/conversation-stream/worker-health']);
    expect(d.getElementById('conversationStreamFrame')!.getAttribute('src')).toContain('r9.');
  } finally { dom.window.close(); }
});

it('disconnects and suspends health checks in a hidden tab, then resumes the open panel', async () => {
  vi.useFakeTimers();
  const probe = vi.fn(async () => ({ ok: true, json: async () => ({ healthy: true, availableHosts: ['mygw'] }) }));
  const dom = new JSDOM(getConversationStreamToggle() + getConversationStreamPanel(), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/aichat',
    beforeParse(w) { w.fetch = probe; w.AbortSignal = AbortSignal as typeof w.AbortSignal; w.setInterval = setInterval as typeof w.setInterval; w.clearInterval = clearInterval; },
  });
  try {
    const d = dom.window.document;
    d.getElementById('conversationStreamToggle')!.click();
    await vi.advanceTimersByTimeAsync(0);
    Object.defineProperty(d, 'hidden', { configurable: true, value: true });
    d.dispatchEvent(new dom.window.Event('visibilitychange'));
    const calls = probe.mock.calls.length;
    expect(d.getElementById('conversationStreamFrame')!.hasAttribute('src')).toBe(false);
    await vi.advanceTimersByTimeAsync(90000);
    expect(probe).toHaveBeenCalledTimes(calls);
    Object.defineProperty(d, 'hidden', { configurable: true, value: false });
    d.dispatchEvent(new dom.window.Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(calls + 1);
    expect(d.getElementById('conversationStreamFrame')!.getAttribute('src')).toContain('mygw.');
  } finally { dom.window.close(); vi.useRealTimers(); }
});
