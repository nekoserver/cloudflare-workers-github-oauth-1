import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

// ===== モーダルHTML構造 =====
describe('大分類カテゴリグループ: モーダルHTML', () => {
  it('kwCatGroupModal が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="kwCatGroupModal"');
  });

  it('kwCatGroupClose ボタンが存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="kwCatGroupClose"');
  });

  it('kwCatGroupBody が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="kwCatGroupBody"');
  });
});

// ===== JS関数 =====
describe('大分類カテゴリグループ: JS関数', () => {
  it('openKwCatGroupModal 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function openKwCatGroupModal');
  });

  it('renderKwCatGroupList 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function renderKwCatGroupList');
  });

  it('loadKwCatGroups 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function loadKwCatGroups');
  });

  it('カテゴリ2つ以上で openKwCatGroupModal を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('openKwCatGroupModal');
    expect(idx).toBeGreaterThan(-1);
    const before = html.slice(Math.max(0, idx - 200), idx);
    expect(before).toMatch(/selectedCats|Object\.keys/);
  });

  it('既存の大分類カテゴリ表示ラベルが含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderKwCatGroupList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('大分類カテゴリ');
  });

  it('/api/aichat/category-groups を fetch する', () => {
    const html = buildPage();
    const idx = html.indexOf('function loadKwCatGroups');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('/api/aichat/category-groups');
  });

  it('POST /api/aichat/category-groups で新規グループを登録する', () => {
    const html = buildPage();
    let searchFrom = 0;
    let found = false;
    while (true) {
      const idx = html.indexOf('/api/aichat/category-groups', searchFrom);
      if (idx === -1) break;
      const snippet = html.slice(Math.max(0, idx - 100), idx + 300);
      if (snippet.includes('POST')) { found = true; break; }
      searchFrom = idx + 1;
    }
    expect(found).toBe(true);
  });

  it('グループ名入力フィールド (kwCatGroupNameInput) が存在する or JS 内に input がある', () => {
    const html = buildPage();
    expect(html).toContain('kwCatGroupNameInput');
  });

  it('登録ボタン (kwCatGroupConfirm) が存在する', () => {
    const html = buildPage();
    expect(html).toContain('kwCatGroupConfirm');
  });
});

// ===== staticZDefaults 登録 =====
describe('大分類カテゴリグループ: staticZDefaults 登録', () => {
  it('staticZDefaults に kwCatGroupModal が含まれる', () => {
    const html = buildPage();
    const idx = html.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 600);
    expect(snippet).toContain('kwCatGroupModal');
  });
});

// ===== バックエンドAPI =====
describe('大分類カテゴリグループ: backend API', () => {
  it('index.ts に /api/aichat/category-groups エンドポイントがある', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain('/api/aichat/category-groups');
  });

  it('GET /api/aichat/category-groups が実装されている', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('/api/aichat/category-groups');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(Math.max(0, idx - 30), idx + 400);
    expect(snippet).toContain('aichat_category_groups');
  });

  it('POST /api/aichat/category-groups が実装されている', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/aichat/category-groups'");
    expect(idx).toBeGreaterThan(-1);
  });

  it('aichat_category_groups テーブルがマイグレーションに含まれる', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain('aichat_category_groups');
  });

  it('category_ids カラムが存在する', () => {
    const src = readFileSync(join(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('aichat_category_groups');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 600);
    expect(snippet).toContain('category_ids');
  });
});
