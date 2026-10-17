import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getConversationStreamPanel, getConversationStreamToggle } from './conversationStreamPanel';
import { getAiChatPage } from './aichat';

describe('本体チャットに埋め込む閲覧専用ストリーム', () => {
  it('サーバー障害を赤枠にし、復旧後は緑枠へ戻す', async () => {
    const probe = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ healthy: false }) });
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
      probe.mockResolvedValue({ ok: true, status: 200, json: async () => ({ healthy: true }) });
      dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
      await vi.waitFor(() => expect(toggle.getAttribute('data-server-state')).toBe('healthy'));
      expect(dom.window.getComputedStyle(toggle).borderTopColor).toBe('rgb(22, 163, 74)');
      expect(dom.window.getComputedStyle(toggle).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      toggle.click();
      const frame = dom.window.document.getElementById('conversationStreamFrame')!;
      dom.window.dispatchEvent(new dom.window.Event('pagehide'));
      expect(frame.getAttribute('src')).toBeNull();
      dom.window.dispatchEvent(new dom.window.Event('pageshow'));
      expect(frame.getAttribute('src')).toContain('/lib/conversation-embed.html');
    } finally { dom.window.close(); }
  });
  it('開いたときだけ読み込み、4方式を切替えても通常入力へ触れない', () => {
    const dom = new JSDOM('<textarea id="messageInput">通常の質問</textarea>' + getConversationStreamToggle() + getConversationStreamPanel(), { runScripts: 'dangerously', url: 'https://example.com/aichat' });
    const doc = dom.window.document;
    const frame = doc.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBeNull();
    const panel = doc.getElementById('conversationStreamPanel') as unknown as HTMLElement;
    const toggle = doc.getElementById('conversationStreamToggle')!;
    toggle.click();
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(new URL(frame.src).searchParams.get('protocol')).toBe('websocket');
    for (const protocol of ['sse', 'websocket', 'ndjson', 'jsonseq']) {
      (doc.querySelector('[data-conversation-protocol="' + protocol + '"]') as unknown as HTMLButtonElement).click();
      const url = new URL(frame.src);
      expect(url.origin).toBe('https://mygw.nekomaneki.work');
      expect(url.pathname).toBe('/lib/conversation-embed.html');
      expect(url.searchParams.get('protocol')).toBe(protocol);
    }
    expect((doc.getElementById('messageInput') as unknown as HTMLTextAreaElement).value).toBe('通常の質問');
    doc.getElementById('conversationStreamClose')!.click();
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(frame.getAttribute('src')).toBeNull();
    toggle.click();
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.hidden).toBe(true);
    expect(frame.getAttribute('src')).toBeNull();
    dom.window.close();
  });
  it('mygwへ操作を送り、mygwの埋め込み画面からの通知だけを受信する', async () => {
    const dom = new JSDOM(getConversationStreamToggle() + getConversationStreamPanel(), {
      runScripts: 'dangerously', url: 'https://example.com/aichat',
    });
    try {
      const doc = dom.window.document;
      doc.getElementById('conversationStreamToggle')!.click();
      const frame = doc.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
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
  it('本体ページに欄が存在し、生成された全スクリプトを解析できる', () => {
    const html = getAiChatPage({ username: 'testuser', aiChatModel: 'test-model' });
    expect(html).toContain('id="conversationStreamPanel"');
    for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(() => new Function(match[1])).not.toThrow();
  });
});
