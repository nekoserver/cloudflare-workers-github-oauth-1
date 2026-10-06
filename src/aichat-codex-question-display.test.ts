import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 故障想定: 本文の引用符や改行を消す、または送信まで本文だけにしてCodexコマンドを壊す。
describe('Codex質問のチャット表示と送信', () => {
  it.each(['"', '“'])('開始引用符%sの質問は本文だけを表示・共有し、送信コマンドは保持する', async (quote) => {
    const question = '◯  詳しく\n"引用"を説明してください';
    const message = '/neko askgk codex_prompt=' + quote + question + '"';
    const html = getAiChatPage({ username: 'test', aiChatModel: 'test-model' });
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    for (const script of scripts) expect(() => new Function(script[1])).not.toThrow();
    const script = scripts[scripts.length - 1][1];
    const submit = script.slice(script.indexOf('    var formatCodexAskgkQuestion ='), script.lastIndexOf('    chatInput.focus();'));
    const bubbles: Array<{ text: string; role: string }> = [];
    const sent: string[] = [];
    const shared: string[] = [];
    let handler: (event: { preventDefault(): void }) => void = () => {};
    const bindings = {
      chatForm: { addEventListener: (_event: string, callback: typeof handler) => { handler = callback; } },
      chatInput: { value: message, style: { height: '' }, focus() {} },
      pendingImageDataUrl: null,
      appendBubble: (text: string, role: string) => { bubbles.push({ text, role }); return { isConnected: false }; },
      clearAttachedImage() {}, chatSendBtn: { disabled: false }, lastModel: 'test-model',
      langModeSelect: { value: 'a' }, currentThreadId: '', aichatStreamToggle: { checked: false },
      AICHAT_TUNABLE_MODEL_CONFIG: {},
      fetch: async (_url: string, init: { body: string }) => { sent.push(JSON.parse(init.body).message); return {}; },
      readAichatResponse: async () => ({ response: '回答', usedModel: 'codex', shareId: 'share' }),
      prepareAichatRubyResponse: (data: unknown) => data,
      extractRespUsage() {}, showAichatSendToast() {}, MODEL_COLORS: {},
      appendShareBtn: (text: string) => { shared.push(text); },
    };
    new Function(...Object.keys(bindings), submit)(...Object.values(bindings));
    handler({ preventDefault() {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bubbles.find((bubble) => bubble.role === 'user')?.text).toBe(question);
    expect(sent).toEqual([message]);
    expect(shared).toEqual([question]);
  });
});
