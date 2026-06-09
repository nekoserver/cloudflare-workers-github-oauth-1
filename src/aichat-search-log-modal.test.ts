import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

// ===== サイドバー結果にモデル表示 =====
describe('検索ログモーダル: サイドバー結果のモデル表示', () => {
  it('result-model-label クラスが renderSidebarResults に含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSidebarResults');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1500);
    expect(fn).toContain('result-model-label');
  });

  it('.result-model-label CSS が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.result-model-label');
  });
});

// ===== 📋 ボタン =====
describe('検索ログモーダル: 📋ボタン', () => {
  it('searchLogRecordBtn が HTML に存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="searchLogRecordBtn"');
  });

  it('📋 アイコンが含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('searchLogRecordBtn');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 80);
    expect(snippet).toContain('📋');
  });
});

// ===== モーダル HTML =====
describe('検索ログモーダル: モーダルHTML', () => {
  it('searchLogRecordModal が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="searchLogRecordModal"');
  });

  it('searchLogRecordModalBody が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="searchLogRecordModalBody"');
  });

  it('searchLogRecordModal が staticZDefaults に登録されている', () => {
    const html = buildPage();
    const idx = html.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 800);
    expect(snippet).toContain('searchLogRecordModal');
  });
});

// ===== CSS =====
describe('検索ログモーダル: CSS', () => {
  it('.slm-entry が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.slm-entry');
  });

  it('.slm-entry-new が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.slm-entry-new');
  });

  it('.slm-entry-new が赤枠 (#e53e3e) を持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('.slm-entry-new');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 150);
    expect(snippet).toContain('#e53e3e');
  });
});

// ===== JS関数 =====
describe('検索ログモーダル: JS関数', () => {
  it('openSearchLogRecordModal 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function openSearchLogRecordModal');
  });

  it('openSearchLogRecordModal が /api/aichat/search-log/open-modal を POST する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openSearchLogRecordModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 600);
    expect(fn).toContain('/api/aichat/search-log/open-modal');
    expect(fn).toContain('POST');
  });

  it('isNew で slm-entry-new クラスを付与する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openSearchLogRecordModal');
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('isNew');
    expect(fn).toContain('slm-entry-new');
  });

  it('searchLogRecordBtn クリックで openSearchLogRecordModal を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('searchLogRecordBtn.addEventListener');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('openSearchLogRecordModal');
  });
});

// ===== バックエンド =====
describe('検索ログモーダル: バックエンド', () => {
  it('/api/aichat/search-log/open-modal エンドポイントが index.ts に存在する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    expect(src).toContain('/api/aichat/search-log/open-modal');
  });

  it('open-modal エンドポイントが isNew を返す', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/search-log/open-modal');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 2000);
    expect(snippet).toContain('isNew');
  });

  it('open-modal が aichat_search_log に INSERT する', () => {
    const fs = require('fs');
    const src = fs.readFileSync(__dirname + '/index.ts', 'utf-8');
    const idx = src.indexOf('/api/aichat/search-log/open-modal');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 2000);
    expect(snippet).toContain('aichat_search_log');
    expect(snippet).toContain('INSERT');
  });
});
