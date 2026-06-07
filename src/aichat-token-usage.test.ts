import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};
function buildPage(): string { return getAiChatPage(minimalUser); }

// ===========================================================
// index.ts: マイグレーション & AI 呼び出し
// ===========================================================
describe('トークン使用量: index.ts バックエンド', () => {
  it('マイグレーション 0050 が input_tokens カラム追加を含む', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf("'0050'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 300);
    expect(snippet).toContain('input_tokens');
    expect(snippet).toContain('output_tokens');
    expect(snippet).toContain('total_tokens');
  });

  it('runAi が usage オブジェクトを取得するコードを持つ', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    // AiUsage 型定義 + aichat 専用 runAi を探す
    const idx = src.indexOf('AiUsage');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 3500);
    expect(fn).toContain('usage');
    expect(fn).toContain('input_tokens');
  });

  it('autoSave が input_tokens / output_tokens / total_tokens を INSERT する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('const autoSave');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 1200);
    expect(fn).toContain('input_tokens');
    expect(fn).toContain('output_tokens');
    expect(fn).toContain('total_tokens');
  });

  it('/api/aichat/token-usage エンドポイントが存在する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    expect(src).toContain('/api/aichat/token-usage');
  });

  it('token-usage が model / input_tokens / output_tokens で GROUP BY する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/token-usage');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 1200);
    expect(snippet).toContain('model');
    expect(snippet).toContain('SUM');
    expect(snippet).toContain('GROUP BY');
  });
});

// ===========================================================
// フロントエンド: サイドバー内グラフボタン
// ===========================================================
describe('トークン使用量: フロントエンド', () => {
  it('カレンダーヘッドにトークングラフボタンがある', () => {
    const html = buildPage();
    expect(html).toContain('tokenUsageBtn');
  });

  it('tokenUsageModal または tokenUsageOverlay が HTML に含まれる', () => {
    const html = buildPage();
    const hasModal = html.includes('tokenUsageModal') || html.includes('tokenUsageOverlay');
    expect(hasModal).toBe(true);
  });

  it('/api/aichat/token-usage を fetch するコードがある', () => {
    const html = buildPage();
    expect(html).toContain('/api/aichat/token-usage');
  });

  it('SVG またはグラフ描画コードが含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('/api/aichat/token-usage');
    expect(idx).toBeGreaterThan(-1);
    const surrounding = html.slice(Math.max(0, idx - 200), idx + 3000);
    const hasSvg = surrounding.includes('svg') || surrounding.includes('SVG') || surrounding.includes('rect') || surrounding.includes('canvas');
    expect(hasSvg).toBe(true);
  });
});
