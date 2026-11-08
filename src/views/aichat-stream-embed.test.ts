import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getConversationStreamPanel, getConversationStreamToggle } from './conversationStreamPanel';
import { getAiChatPage } from './aichat';
import { resolveConversationStreamRoutes } from '../utils/conversationStreamRoutes';

function makeDom(availableHosts: string[] = ['testcfc']) {
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
  it('自動選択では可能な候補を緑、不可をグレーにし、接続先の応答確認後だけ緑丸を付ける', async () => {
    const dom = makeDom(['mygw', 'testcfc']);
    try {
      const doc = dom.window.document;
      const choice = (name: string) => doc.querySelector('[role="option"][data-value="' + name + '"]') as HTMLElement;
      doc.getElementById('conversationStreamToggle')!.click();
      await vi.waitFor(() => expect(choice('mygw').dataset.streamState).toBe('available'));
      expect(choice('mygw').style.color).toBe('rgb(22, 163, 74)');
      expect(choice('testcfc').style.color).toBe('rgb(22, 163, 74)');
      expect(choice('mynw').style.color).toBe('rgb(156, 163, 175)');
      expect(choice('mynw').title).toContain('接続不可');
      const frame = doc.getElementById('conversationStreamFrame') as HTMLIFrameElement;
      await vi.waitFor(() => expect(frame.src).toContain('mygw.nekomaneki.work'));
      expect(choice('mygw').textContent).not.toContain('🟢');
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin: 'https://evil.example', source: frame.contentWindow as Window, data: { type: 'conversation-state', busy: false },
      }));
      expect(choice('mygw').textContent).not.toContain('🟢');
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin: 'https://mygw.nekomaneki.work', source: frame.contentWindow as Window, data: { type: 'conversation-state', busy: false },
      }));
      expect(choice('mygw').textContent).toBe('🟢 mygw.nekomaneki.work');
      expect(choice('mygw').dataset.streamState).toBe('connected');
      expect(choice('testcfc').textContent).not.toContain('🟢');
      doc.getElementById('conversationStreamClose')!.click();
      expect(choice('mygw').textContent).not.toContain('🟢');
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });

  it('接続先が落ちたとき古い丸を消し、切替先の応答を待って表示を更新する', async () => {
    const available = ['mygw'];
    const dom = makeDom(available);
    try {
      const doc = dom.window.document;
      const frame = doc.getElementById('conversationStreamFrame') as HTMLIFrameElement;
      const choice = (name: string) => doc.querySelector('[role="option"][data-value="' + name + '"]') as HTMLElement;
      const notify = (host: string) => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin: 'https://' + host + '.nekomaneki.work', source: frame.contentWindow as Window, data: { type: 'conversation-state', busy: true },
      }));
      doc.getElementById('conversationStreamToggle')!.click();
      await vi.waitFor(() => expect(frame.src).toContain('mygw.nekomaneki.work'));
      notify('mygw');
      expect(choice('mygw').textContent).toContain('🟢');
      available.splice(0, 1, 'mynw');
      doc.dispatchEvent(new dom.window.Event('visibilitychange'));
      await vi.waitFor(() => expect(frame.src).toContain('mynw.nekomaneki.work'));
      expect(choice('mygw').style.color).toBe('rgb(156, 163, 175)');
      expect(choice('mygw').textContent).not.toContain('🟢');
      expect(choice('mynw').textContent).not.toContain('🟢');
      notify('mygw');
      expect(choice('mynw').textContent).not.toContain('🟢');
      notify('mynw');
      expect(choice('mynw').textContent).toContain('🟢');
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });

  it('色付きメニューをキーボードで操作でき、手動選択時は自動の表示装飾を外す', async () => {
    const dom = makeDom();
    try {
      const doc = dom.window.document;
      const picker = doc.getElementById('conversationStreamHostPicker')!;
      const options = doc.getElementById('conversationStreamHostOptions')!;
      const host = doc.getElementById('conversationStreamHost') as HTMLSelectElement;
      doc.getElementById('conversationStreamToggle')!.click();
      await vi.waitFor(() => expect(doc.querySelector('[data-value="testcfc"]')?.getAttribute('data-stream-state')).toBe('available'));
      picker.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(options.hidden).toBe(false);
      expect(doc.activeElement?.getAttribute('data-value')).toBe('auto');
      doc.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(doc.activeElement?.getAttribute('data-value')).toBe('mygw');
      doc.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(host.value).toBe('mygw');
      expect(options.hidden).toBe(true);
      expect(picker.textContent).toBe('mygw.nekomaneki.work ▾');
      expect((doc.querySelector('[data-value="mygw"]') as HTMLElement).style.color).toBe('');
      picker.click();
      doc.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      doc.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(host.value).toBe('auto');
      expect((doc.querySelector('[data-value="mygw"]') as HTMLElement).style.color).toBe('rgb(156, 163, 175)');
      picker.click();
      doc.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(options.hidden).toBe(true);
      expect(doc.activeElement).toBe(picker);
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });

  it('遅れて戻った古い生存確認で接続先や色を巻き戻さない', async () => {
    let finishOld!: (value: unknown) => void;
    const probe = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ healthy: true, availableHosts: ['testcfc'] }) });
    const dom = new JSDOM(getConversationStreamToggle() + getConversationStreamPanel(), {
      runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/aichat',
      beforeParse(window) { window.fetch = probe; window.AbortSignal = AbortSignal as unknown as typeof window.AbortSignal; },
    });
    try {
      const doc = dom.window.document;
      doc.getElementById('conversationStreamToggle')!.click();
      const frame = doc.getElementById('conversationStreamFrame') as HTMLIFrameElement;
      doc.getElementById('conversationStreamClose')!.click();
      doc.getElementById('conversationStreamToggle')!.click();
      await vi.waitFor(() => expect(frame.src).toContain('stream.test.cfc.nekomaneki.work'));
      finishOld({ ok: true, status: 200, json: async () => ({ healthy: true, availableHosts: ['mygw'] }) });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(frame.src).toContain('stream.test.cfc.nekomaneki.work');
      expect(doc.querySelector('[data-value="mygw"]')?.getAttribute('data-stream-state')).toBe('unavailable');
      expect(doc.querySelector('[data-value="testcfc"]')?.getAttribute('data-stream-state')).toBe('available');
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });

  it('認証エラーで確認不能になった場合は緑表示と接続済みの丸を残さない', async () => {
    const dom = makeDom();
    try {
      const doc = dom.window.document;
      doc.getElementById('conversationStreamToggle')!.click();
      const frame = doc.getElementById('conversationStreamFrame') as HTMLIFrameElement;
      const choice = doc.querySelector('[data-value="testcfc"]') as HTMLElement;
      await vi.waitFor(() => expect(frame.src).toContain('stream.test.cfc.nekomaneki.work'));
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin: 'https://stream.test.cfc.nekomaneki.work', source: frame.contentWindow as Window, data: { type: 'conversation-state', busy: false },
      }));
      expect(choice.textContent).toContain('🟢');
      vi.mocked(dom.window.fetch).mockResolvedValue({ ok: false, status: 403 } as Response);
      doc.dispatchEvent(new dom.window.Event('visibilitychange'));
      await vi.waitFor(() => expect(choice.dataset.streamState).toBe('unknown'));
      expect(choice.textContent).not.toContain('🟢');
      expect(choice.style.color).toBe('rgb(156, 163, 175)');
      expect(choice.title).toContain('確認できません');
      await vi.waitFor(() => expect(frame.getAttribute('src')).toBeNull());
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });
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
      toggle.click();
      await vi.waitFor(() => expect(toggle.getAttribute('data-server-state')).toBe('error'));
      expect(dom.window.getComputedStyle(toggle).borderTopColor).toBe('rgb(220, 38, 38)');
      expect(dom.window.getComputedStyle(toggle).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      availableHosts = ['testcfc'];
      dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
      await vi.waitFor(() => expect(toggle.getAttribute('data-server-state')).toBe('healthy'));
      expect(dom.window.getComputedStyle(toggle).borderTopColor).toBe('rgb(22, 163, 74)');
      expect(dom.window.getComputedStyle(toggle).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      const frame = dom.window.document.getElementById('conversationStreamFrame')!;
      await vi.waitFor(() => expect(new URL((frame as HTMLIFrameElement).src).origin).toBe('https://stream.test.cfc.nekomaneki.work'));
      dom.window.dispatchEvent(new dom.window.Event('pagehide'));
      expect(frame.getAttribute('src')).toBeNull();
      dom.window.dispatchEvent(new dom.window.Event('pageshow'));
      await vi.waitFor(() => expect(frame.getAttribute('src')).toContain('/lib/conversation-embed.html'));
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });
  it('自動選択・mygw/mynw/CFCの手動選択と4方式の切替に対応する', async () => {
    const dom = makeDom();
    const doc = dom.window.document;
    const frame = doc.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
    const toggle = doc.getElementById('conversationStreamToggle')!;
    const host = doc.getElementById('conversationStreamHost') as unknown as HTMLSelectElement;
    expect(Array.from(host.options).map(option => option.value)).toEqual(['auto', 'mygw', 'mynw', 'testcfc', 'redmine', 'worker']);
    expect(host.value).toBe('auto');
    expect(frame.getAttribute('src')).toBeNull();
    toggle.click();
    await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://stream.test.cfc.nekomaneki.work'));
    expect(new URL(frame.src).searchParams.get('protocol')).toBe('websocket');
    for (const protocol of ['sse', 'websocket', 'ndjson', 'jsonseq']) {
      (doc.querySelector('[data-conversation-protocol="' + protocol + '"]') as unknown as HTMLButtonElement).click();
      await vi.waitFor(() => expect(new URL(frame.src).searchParams.get('protocol')).toBe(protocol));
    }
    for (const name of ['mygw', 'mynw']) {
      host.value = name; host.dispatchEvent(new dom.window.Event('change'));
      await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://' + name + '.nekomaneki.work'));
    }
    host.value = 'testcfc'; host.dispatchEvent(new dom.window.Event('change'));
    await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://stream.test.cfc.nekomaneki.work'));
    host.value = 'redmine'; host.dispatchEvent(new dom.window.Event('change'));
    await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://r9.nekomaneki.work'));
    host.value = 'auto'; host.dispatchEvent(new dom.window.Event('change'));
    await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://stream.test.cfc.nekomaneki.work'));
    doc.getElementById('conversationStreamClose')!.click();
    expect(frame.getAttribute('src')).toBeNull();
    toggle.click();
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect((doc.getElementById('conversationStreamPanel') as HTMLElement).hidden).toBe(true);
    expect(frame.getAttribute('src')).toBeNull();
    dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close();
  });
  it('渡された接続先の表から選択肢と埋め込みURLを組み立て、表示名をエスケープする', async () => {
    const routes = resolveConversationStreamRoutes({
      autoPriority: ['next'],
      routes: [{ id: 'mygw', origin: 'https://mygw.nekomaneki.work' }, { id: 'next', origin: 'https://stream.next.example', label: '<b>次</b>' }],
    });
    const dom = new JSDOM(getConversationStreamToggle() + getConversationStreamPanel(routes), {
      runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/aichat',
      beforeParse(window) {
        window.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ healthy: true, availableHosts: ['next'] }) });
        window.AbortSignal = AbortSignal as unknown as typeof window.AbortSignal;
      },
    });
    try {
      const doc = dom.window.document;
      const host = doc.getElementById('conversationStreamHost') as unknown as HTMLSelectElement;
      expect(Array.from(host.options).map(option => [option.value, option.textContent])).toEqual([['auto', '自動'], ['mygw', 'mygw.nekomaneki.work'], ['next', '<b>次</b>'], ['worker', 'Worker']]);
      expect(doc.querySelector('#conversationStreamHost b')).toBeNull();
      doc.getElementById('conversationStreamToggle')!.click();
      const frame = doc.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
      await vi.waitFor(() => expect(frame.src).toContain('https://stream.next.example/lib/conversation-embed.html'));
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });
  it('接続先の設定エラーを表示し、開始できないようにする', () => {
    const dom = new JSDOM(getConversationStreamToggle() + getConversationStreamPanel(null, '会話ストリームの接続先の設定が不正です'), { runScripts: 'dangerously', url: 'https://example.com/aichat' });
    try {
      const doc = dom.window.document;
      expect(doc.getElementById('conversationStreamConfigError')?.textContent).toContain('会話ストリームの接続先の設定が不正です');
      expect(Array.from((doc.getElementById('conversationStreamHost') as unknown as HTMLSelectElement).options).map(option => option.value)).toEqual(['auto', 'worker']);
      expect((doc.getElementById('conversationStreamToggle') as HTMLButtonElement).disabled).toBe(true);
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });
  it('トンネル専用ホストを自動選択し、正確なパスとOriginを使う', async () => {
    const dom = makeDom(['testcfc']);
    try {
      const doc = dom.window.document;
      doc.getElementById('conversationStreamToggle')!.click();
      const frame = doc.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
      await vi.waitFor(() => expect(frame.src).toContain('https://stream.test.cfc.nekomaneki.work/lib/conversation-embed.html'));
      const post = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
      frame.dispatchEvent(new dom.window.Event('load'));
      expect(post).toHaveBeenCalledWith({ type: 'conversation-controls' }, 'https://stream.test.cfc.nekomaneki.work');
      const select = doc.getElementById('conversationStreamHost') as unknown as HTMLSelectElement;
      select.value = 'testcfc'; select.dispatchEvent(new dom.window.Event('change'));
      await vi.waitFor(() => expect(new URL(frame.src).pathname).toBe('/lib/conversation-embed.html'));
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });
  it('死活確認に未知の接続先が混入しても許可済み候補だけを使う', async () => {
    const dom = makeDom(['https://evil.example', '__proto__', 'testcfc']);
    try {
      dom.window.document.getElementById('conversationStreamToggle')!.click();
      const frame = dom.window.document.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
      await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://stream.test.cfc.nekomaneki.work'));
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });
  it('選択中ホストだけへ操作を送り、そのホストからの通知だけを受信する', async () => {
    const dom = makeDom();
    try {
      const doc = dom.window.document;
      doc.getElementById('conversationStreamToggle')!.click();
      const frame = doc.getElementById('conversationStreamFrame') as unknown as HTMLIFrameElement;
      await vi.waitFor(() => expect(new URL(frame.src).origin).toBe('https://stream.test.cfc.nekomaneki.work'));
      const post = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
      const start = doc.getElementById('conversationStreamStart') as unknown as HTMLButtonElement;
      const stop = doc.getElementById('conversationStreamStop') as unknown as HTMLButtonElement;
      const notify = (origin: string, source = frame.contentWindow) => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin, source: source as unknown as Window, data: { type: 'conversation-state', busy: false },
      }));
      frame.dispatchEvent(new dom.window.Event('load'));
      expect(post).toHaveBeenCalledWith({ type: 'conversation-controls' }, 'https://stream.test.cfc.nekomaneki.work');
      notify('https://untrusted.example');
      expect(start.disabled).toBe(true);
      notify('https://stream.test.cfc.nekomaneki.work', dom.window as unknown as Window);
      expect(start.disabled).toBe(true);
      notify('https://stream.test.cfc.nekomaneki.work');
      expect(start.disabled).toBe(false);
      start.click();
      expect(post).toHaveBeenCalledWith({ type: 'conversation-start' }, 'https://stream.test.cfc.nekomaneki.work');
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin: 'https://stream.test.cfc.nekomaneki.work', source: frame.contentWindow as unknown as Window,
        data: { type: 'conversation-state', busy: true },
      }));
      stop.click();
      expect(post).toHaveBeenCalledWith({ type: 'conversation-stop' }, 'https://stream.test.cfc.nekomaneki.work');
      doc.documentElement.setAttribute('data-theme', 'dark');
      await vi.waitFor(() => expect(post).toHaveBeenCalledWith({ type: 'conversation-theme', theme: 'dark' }, 'https://stream.test.cfc.nekomaneki.work'));
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });
  it('キー入力フォームの送信を許可し、無関係なsandbox権限を追加しない', () => {
    const dom = makeDom();
    try {
      const frame = dom.window.document.getElementById('conversationStreamFrame')!;
      expect(new Set(frame.getAttribute('sandbox')!.split(/\s+/))).toEqual(new Set([
        'allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox',
      ]));
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
  });
  it('本体ページに接続先選択欄があり、生成された全スクリプトを解析できる', () => {
    const html = getAiChatPage({ username: 'testuser', aiChatModel: 'test-model' });
    expect(html).toContain('id="conversationStreamPanel"');
    expect(html).toContain('id="conversationStreamHost"');
    for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(() => new Function(match[1])).not.toThrow();
  });
});
