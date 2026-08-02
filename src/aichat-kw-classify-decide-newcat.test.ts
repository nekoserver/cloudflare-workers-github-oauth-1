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

function sliceDecideHandler(html: string): string {
  const idx = html.indexOf('decideBtn.addEventListener');
  expect(idx).toBeGreaterThan(-1);
  return html.slice(idx, idx + 3200);
}

// ===========================================================
// バグ: 分類モーダルでテキストボックスに新カテゴリ名を入れたまま
// 「分類決定」を押すと入力が無視され、新カテゴリが作成されない
// ===========================================================
describe('分類モーダル: 分類決定ボタンが未登録の入力カテゴリ名を処理する', () => {
  it('decideBtn ハンドラが catInput の値を参照する', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toContain('catInput.value');
  });

  it('decideBtn ハンドラが新カテゴリ作成 API (/api/aichat/keyword-categories) を呼ぶ', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toContain('/api/aichat/keyword-categories');
  });

  it('decideBtn ハンドラが既存カテゴリ名との重複（新規性）チェックを行う', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toContain('data-cat-id');
  });

  it('decideBtn ハンドラが作成されたカテゴリ ID をマッピング対象に追加する', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toContain('category.id');
  });

  it('decideBtn ハンドラが従来どおり keyword-category-map API を呼ぶ', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toContain('/api/aichat/keyword-category-map');
  });

  it('decideBtn ハンドラが選択カテゴリ0件でも入力があれば処理を継続する', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toMatch(/selectedCatIds\.length === 0 && !pendingName/);
  });
});

describe('分類モーダル: 分類決定ボタンの活性条件', () => {
  it('updateDecideBtn がカテゴリ選択またはテキスト入力で活性化する', () => {
    const html = buildPage();
    const idx = html.indexOf('function updateDecideBtn');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('selectedCatIds.length > 0');
    expect(fn).toContain('catInput.value');
  });

  it('catInput の input イベントで updateDecideBtn が呼ばれる', () => {
    const html = buildPage();
    const idx = html.indexOf("catInput.addEventListener('input'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('updateDecideBtn');
  });
});

describe('分類モーダル: API 失敗時の復帰', () => {
  it('decideBtn ハンドラがカテゴリ作成失敗時にボタンを復帰させる', () => {
    const fn = sliceDecideHandler(buildPage());
    const catchCount = (fn.match(/\.catch\(/g) || []).length;
    expect(catchCount).toBeGreaterThanOrEqual(2);
  });
});
