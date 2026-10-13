import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getConversationStreamPanel } from './conversationStreamPanel';
import { getAiChatPage } from './aichat';

describe('本体チャットに埋め込む閲覧専用ストリーム', () => {
  it('開いたときだけ読み込み、4方式を切替えても通常入力へ触れない', () => {
    const dom = new JSDOM('<textarea id="messageInput">通常の質問</textarea>' + getConversationStreamPanel(), { runScripts: 'dangerously', url: 'https://example.com/aichat' });
    const doc = dom.window.document;
    const frame = doc.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBeNull();
    const panel = doc.getElementById('conversationStreamPanel') as unknown as HTMLDetailsElement;
    panel.open = true;
    panel.dispatchEvent(new dom.window.Event('toggle'));
    expect(new URL(frame.src).searchParams.get('protocol')).toBe('websocket');
    for (const protocol of ['sse', 'websocket', 'ndjson', 'jsonseq']) {
      (doc.querySelector('[data-conversation-protocol="' + protocol + '"]') as unknown as HTMLButtonElement).click();
      const url = new URL(frame.src);
      expect(url.origin).toBe('https://mynw.nekomaneki.work');
      expect(url.pathname).toBe('/lib/conversation-embed.html');
      expect(url.searchParams.get('protocol')).toBe(protocol);
    }
    expect((doc.getElementById('messageInput') as unknown as HTMLTextAreaElement).value).toBe('通常の質問');
    panel.open = false;
    panel.dispatchEvent(new dom.window.Event('toggle'));
    expect(frame.getAttribute('src')).toBeNull();
    dom.window.close();
  });
  it('本体ページに欄が存在し、生成された全スクリプトを解析できる', () => {
    const html = getAiChatPage({ username: 'testuser', aiChatModel: 'test-model' });
    expect(html).toContain('id="conversationStreamPanel"');
    for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(() => new Function(match[1])).not.toThrow();
  });
});
