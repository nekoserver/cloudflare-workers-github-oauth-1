import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('追加質問リンク: 色丸表示', () => {
  it('renderSubqueryLinks 関数が存在する', () => {
    expect(buildPage()).toContain('function renderSubqueryLinks(items)');
  });

  it('renderSubqueryLinks が border-radius:50% の色丸を描画する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueryLinks(items)');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 900);
    expect(fn).toContain('border-radius:50%');
  });

  it('renderSubqueryLinks が MODEL_COLORS を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueryLinks(items)');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('MODEL_COLORS');
  });

  it('renderSubqueryLinks が item.model を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueryLinks(items)');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('item.model');
  });

  it('renderSubqueryLinks がフォールバック色 #aaaaaa を持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueryLinks(items)');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('#aaaaaa');
  });

  it('renderSubqueryLinks が flex-shrink:0 で色丸を配置する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueryLinks(items)');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 900);
    expect(fn).toContain('flex-shrink:0');
  });

  it('renderSubqueryLinks が title 属性でモデル名を表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueryLinks(items)');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 900);
    expect(fn).toContain('title');
  });
});
