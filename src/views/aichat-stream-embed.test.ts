import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getConversationStreamPanel, getConversationStreamToggle } from './conversationStreamPanel';
import { getAiChatPage } from './aichat';

function makeDom(availableHosts: string[] = ['mygw', 'mynw']) {
  const dom = new JSDOM(getConversationStreamToggle() + getConversationStreamPanel(), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/aichat',
    beforeParse(window) {
      window.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ healthy: availableHosts.length > 0, availableHosts }),
      });
      window.AbortSignal = AbortSignal as unknown as typeof window.AbortSignal;
    },
  });
  return dom;
}

describe('本体チャットに埋め込む閲覧専用ストリーム', () => {
  it('サーバー障害を赤枠にし、復旧後は緑枠へ戻す', async () => {
    let availableHosts: string[] = [];
    const probe = vi.fn().mockImplementation(async () => ({
      ok: true, status: 200, json: async () => ({ healthy: availableHosts.length > 0, availableHosts }),
    }));
    const dom = new JSDOM(getConversationStreamToggle() + getConversationStreamPanel(), {
      runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/aichat',
      beforeParse(window) {
        window.fetch = probe;
        window.AbortSignal = AbortSignal as unknown as typeof window.AbortSignal;
      },
    });
    try {
      const toggle = dom.window.document.getElementById('conversationStreamToggle')!;
      await vi.waitFor(() => expect(toggle.getAttribute('data-server-state')).toBe('error'));
      expect(dom.window.getComputedStyle(toggle).borderTopColor).toBe('rgb(220, 38, 38)');
      expect(dom.window.getComputedStyle(toggle).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      availableHosts = ['mynw'];
      dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
      await vi.waitFor(() => expect(toggle.getAttribute('data-server-state')).toBe('healthy'));
      expect(dom.window.getComputedStyle(toggle).borderTopColor).toBe('rgb(22, 163, 74)');
      expect(dom.window.getComputedStyle(toggle).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      toggle.click();
      const frame = dom.window.document.getElementById('conversationStreamFrame')!;
      await vi.waitFor(() => expect(new URL((frame as HTMLIFrameElement).src).origin).toBe('https://mynw.nekomaneki.work'));
      dom.window.dispatchEvent(new dom.window.Event('pagehide'));
      expect(frame.getAttribute('src')).toBeNull();
      dom.window.dispatchEvent(new dom.window.Event('pageshow'));
      await vi.waitFor(() => expect(frame.getAttribute('src')).toContain('/lib/conversation-embed.html'));
    } finally { dom.window.close(); }
  });
  it('自動は上から優先し、手動のmygw/mynw選択と4方式の切替に対応する', async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const frame = doc.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
    const toggle = doc.getElementById('conversationStreamToggle')!;
    const host = doc.getElementById('conversationStreamHost') as unknown as HTMLSelectElement;
    expect(Array.from(host.options).map(option => option.value)).toEqual(['auto', 'mygw', 'mynw']);
    expect(host.value).toBe('auto');
    expect(frame.getAttribute('src')).toBeNull();
    toggle.click();
    await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://mygw.nekomaneki.work'));
    expect(new URL(frame.src).searchParams.get('protocol')).toBe('websocket');
    for (const protocol of ['sse', 'websocket', 'ndjson', 'jsonseq']) {
      (doc.querySelector('[data-conversation-protocol="' + protocol + '"]') as unknown as HTMLButtonElement).click();
      await vi.waitFor(() => expect(new URL(frame.src).searchParams.get('protocol')).toBe(protocol));
    }
    host.value = 'mynw'; host.dispatchEvent(new dom.window.Event('change'));
    await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://mynw.nekomaneki.work'));
    host.value = 'mygw'; host.dispatchEvent(new dom.window.Event('change'));
    await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://mygw.nekomaneki.work'));
    host.value = 'auto'; host.dispatchEvent(new dom.window.Event('change'));
    await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://mygw.nekomaneki.work'));
    doc.getElementById('conversationStreamClose')!.click();
    expect(frame.getAttribute('src')).toBeNull();
    toggle.click();
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect((doc.getElementById('conversationStreamPanel') as HTMLElement).hidden).toBe(true);
    expect(frame.getAttribute('src')).toBeNull();
    dom.window.close();
  });
  it('選択中ホストだけへ操作を送り、そのホストからの通知だけを受信する', async () => {
    const dom = makeDom();
    try {
      const doc = dom.window.document;
      doc.getElementById('conversationStreamToggle')!.click();
      const frame = doc.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
      await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://mygw.nekomaneki.work'));
      const post = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
      const start = doc.getElementById('conversationStreamStart') as unknown as HTMLButtonElement;
      const stop = doc.getElementById('conversationStreamStop') as unknown as HTMLButtonElement;
      const notify = (origin: string, source = frame.contentWindow) => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin, source: source as unknown as Window, data: { type: 'conversation-state', busy: false },
      }));
      frame.dispatchEvent(new dom.window.Event('load'));
      expect(post).toHaveBeenCalledWith({ type: 'conversation-controls' }, 'https://mygw.nekomaneki.work');
      notify('https://mynw.nekomaneki.work');
      expect(start.disabled).toBe(true);
      notify('https://mygw.nekomaneki.work', dom.window as unknown as Window);
      expect(start.disabled).toBe(true);
      notify('https://mygw.nekomaneki.work');
      expect(start.disabled).toBe(false);
      start.click();
      expect(post).toHaveBeenCalledWith({ type: 'conversation-start' }, 'https://mygw.nekomaneki.work');
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin: 'https://mygw.nekomaneki.work', source: frame.contentWindow as unknown as Window,
        data: { type: 'conversation-state', busy: true },
      }));
      stop.click();
      expect(post).toHaveBeenCalledWith({ type: 'conversation-stop' }, 'https://mygw.nekomaneki.work');
      doc.documentElement.setAttribute('data-theme', 'dark');
      await vi.waitFor(() => expect(post).toHaveBeenCalledWith({ type: 'conversation-theme', theme: 'dark' }, 'https://mygw.nekomaneki.work'));
    } finally { dom.window.close(); }
  });
  it('キー入力フォームの送信を許可し、無関係なsandbox権限を追加しない', () => {
    const dom = makeDom();
    try {
      const frame = dom.window.document.getElementById('conversationStreamFrame')!;
      expect(new Set(frame.getAttribute('sandbox')!.split(/\s+/))).toEqual(new Set([
        'allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox',
      ]));
    } finally { dom.window.close(); }
  });
  it('本体ページに接続先選択欄があり、生成された全スクリプトを解析できる', () => {
    const html = getAiChatPage({ username: 'testuser', aiChatModel: 'test-model' });
    expect(html).toContain('id="conversationStreamPanel"');
    expect(html).toContain('id="conversationStreamHost"');
    for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(() => new Function(match[1])).not.toThrow();
  });
});
