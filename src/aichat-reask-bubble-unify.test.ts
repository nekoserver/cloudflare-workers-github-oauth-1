import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

function sliceFn(html: string, name: string, len: number): string {
  const idx = html.indexOf('function ' + name);
  expect(idx).toBeGreaterThan(-1);
  return html.slice(idx, idx + len);
}

// ===========================================================
// 別モデル再質問の応答バブルをトップページ検索と共通化する
// buildAssistantBubble: コピーボタン・フォールバック通知・
// トークン数表示を含む応答バブル生成の共通関数
// ===========================================================
describe('応答バブル共通化: buildAssistantBubble', () => {
  it('buildAssistantBubble 関数が定義されている', () => {
    expect(buildPage()).toContain('function buildAssistantBubble(');
  });

  it('buildAssistantBubble がコピーボタン (bubble-copy-btn) を生成する', () => {
    const fn = sliceFn(buildPage(), 'buildAssistantBubble(', 3000);
    expect(fn).toContain('bubble-copy-btn');
    expect(fn).toContain('navigator.clipboard.writeText');
  });

  it('buildAssistantBubble がトークン数表示を生成する', () => {
    const fn = sliceFn(buildPage(), 'buildAssistantBubble(', 3000);
    expect(fn).toContain('input_tokens');
    expect(fn).toContain('output_tokens');
    expect(fn).toContain('total_tokens');
    expect(fn).toContain("' tokens'");
  });

  it('buildAssistantBubble がフォールバック通知を生成する', () => {
    const fn = sliceFn(buildPage(), 'buildAssistantBubble(', 3000);
    expect(fn).toContain('bubble-fallback-notice');
  });

  it('usage が欠落していてもトークン表示をスキップするガードがある', () => {
    const fn = sliceFn(buildPage(), 'buildAssistantBubble(', 3000);
    expect(fn).toMatch(/usage && \(usage\.input_tokens != null \|\| usage\.total_tokens != null\)/);
  });
});

describe('応答バブル共通化: 呼び出し元', () => {
  it('appendBubble が buildAssistantBubble を呼ぶ', () => {
    const fn = sliceFn(buildPage(), 'appendBubble(', 1500);
    expect(fn).toContain('buildAssistantBubble(');
  });

  it('renderAiResultInModal が buildAssistantBubble を呼ぶ', () => {
    const fn = sliceFn(buildPage(), 'renderAiResultInModal', 1000);
    expect(fn).toContain('buildAssistantBubble(');
  });

  it('renderAiResultInModal が extractRespUsage でトークン情報を渡す', () => {
    const fn = sliceFn(buildPage(), 'renderAiResultInModal', 1000);
    expect(fn).toContain('extractRespUsage(');
  });

  it('renderAiResultInModal がフォールバック有無を判定して渡す', () => {
    const fn = sliceFn(buildPage(), 'renderAiResultInModal', 1000);
    expect(fn).toContain('fallbackUsed');
    expect(fn).toContain('usedModel');
  });

  it('チャット送信側も extractRespUsage を使う', () => {
    const html = buildPage();
    const idx = html.indexOf("appendBubble(responseText, 'assistant', lastModel");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(Math.max(0, idx - 400), idx);
    expect(snippet).toContain('extractRespUsage(');
  });
});

describe('応答バブル共通化: extractRespUsage', () => {
  it('extractRespUsage 関数が定義されている', () => {
    expect(buildPage()).toContain('function extractRespUsage(');
  });

  it('input_tokens / output_tokens / total_tokens を null フォールバック付きで返す', () => {
    const fn = sliceFn(buildPage(), 'extractRespUsage(', 500);
    expect(fn).toContain('input_tokens');
    expect(fn).toContain('output_tokens');
    expect(fn).toContain('total_tokens');
    expect(fn).toContain('?? null');
  });
});
