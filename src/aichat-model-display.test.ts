import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(model: string): string {
  return getAiChatPage({
    name: 'テストユーザー',
    username: 'testuser',
    aiChatModel: model,
  });
}

const FULL_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const SHORT_MODEL = 'llama-3.3-70b-instruct-fp8-fast';

describe('aichat.ts モデル名表示', () => {
  it('.bubble-label CSS クラスが HTML に含まれる', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain('.bubble-label');
  });

  it('.chat-bubble-wrap CSS クラスが HTML に含まれる', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain('.chat-bubble-wrap');
  });

  it('shortModelName 関数が HTML に含まれる', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain('function shortModelName');
  });

  it('shortModelName が model.split(\'/\').pop() を使用している', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain("model.split('/').pop()");
  });

  it('formatHistoryMeta が shortModelName を使用している', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain('shortModelName(r.model)');
  });

  it('historyModalMeta の設定で shortModelName を使用している', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain('shortModelName(r.model)');
  });

  it('appendBubble が bubble-label を生成するコードを含む', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain("lbl.className = 'bubble-label'");
  });

  it('appendBubble が shortModelName を呼び出している', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain('shortModelName(model)');
  });

  it('送信ハンドラーが usedModel 変数を使用している', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain('var usedModel = data.usedModel || lastModel');
  });

  it('appendBubble の呼び出しに usedModel が渡されている', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain('appendBubble(responseText, \'assistant\', usedModel)');
  });

  it('model select に初期モデルが selected 属性付きで存在する', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain(`value="${FULL_MODEL}" selected`);
  });

  it('初期モデルのラベルが select option に含まれる', () => {
    const html = buildPage(FULL_MODEL);
    expect(html).toContain(`>${SHORT_MODEL}</option>`);
  });
});
