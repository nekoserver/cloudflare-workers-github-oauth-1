import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('キーワード履歴モーダル: モデルカラム', () => {
  it('.kw-model-tag CSS が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.kw-model-tag');
  });

  it('renderKwList 内に kw-model-tag が含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('kw-model-tag');
  });

  it('renderKwList が models フィールドを参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwList');
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('models');
  });

  it('バックエンドの monthly エンドポイントが models を含む SQL を使う', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/keywords/monthly');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 600);
    expect(snippet).toContain('model');
  });

  it('バックエンドが GROUP_CONCAT または配列で models を返す', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/keywords/monthly');
    const snippet = src.slice(idx, idx + 600);
    const hasGroupConcat = snippet.includes('GROUP_CONCAT') || snippet.includes('group_concat');
    expect(hasGroupConcat).toBe(true);
  });
});
