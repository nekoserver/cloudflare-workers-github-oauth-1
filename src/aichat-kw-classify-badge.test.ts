import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

const SQ_BADGE_RADIUS = 'border-radius:10px';
const SQ_BADGE_FONT   = 'font-size:11px';
const SQ_BADGE_PAD    = 'padding:0 6px';
const SQ_BADGE_MARGIN = 'margin:1px 2px';

describe('キーワード分類モーダル: kw-cat-summary-badge のサイズ・形', () => {
  it('border-radius が 10px である', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain(SQ_BADGE_RADIUS);
  });

  it('font-size が 11px である', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain(SQ_BADGE_FONT);
  });

  it('padding が 0 6px である（上下 0px・左右 6px）', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain(SQ_BADGE_PAD);
  });

  it('padding:1px 6px は使われない', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).not.toContain('padding:1px 6px');
  });

  it('margin が 1px 2px である', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain(SQ_BADGE_MARGIN);
  });

  it('border-radius:14px は使われない', () => {
    const html = buildPage();
    const idx = html.indexOf('kw-cat-summary-badge');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).not.toContain('border-radius:14px');
  });
});

describe('キーワード分類モーダル: kw-classify-kw-badge のサイズ・形', () => {
  it('分類済みバッジの font-size が 11px である', () => {
    const html = buildPage();
    const idx = html.indexOf('var st = kw.is_classified');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain(SQ_BADGE_FONT);
  });

  it('分類済みバッジの padding が 0 6px である（上下 0px・左右 6px）', () => {
    const html = buildPage();
    const idx = html.indexOf('var st = kw.is_classified');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain(SQ_BADGE_PAD);
  });

  it('padding:1px 6px は使われない', () => {
    const html = buildPage();
    const idx = html.indexOf('var st = kw.is_classified');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).not.toContain('padding:1px 6px');
  });

  it('分類済みバッジの margin が 1px 2px である', () => {
    const html = buildPage();
    const idx = html.indexOf('var st = kw.is_classified');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain(SQ_BADGE_MARGIN);
  });

  it('font-size:13px は使われない', () => {
    const html = buildPage();
    const idx = html.indexOf('var st = kw.is_classified');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).not.toContain('font-size:13px');
  });
});
