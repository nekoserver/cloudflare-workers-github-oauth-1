import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAiChatPage } from './views/aichat';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(__dirname, 'index.ts'), 'utf-8');

// 対象: AIチャットの「分類: ◯」モーダルで、既に選択されている分類カテゴリの識別色を
// 色スウォッチで変更してから「分類決定」ボタンを押した場合に、その変更が
// aichat_keyword_categories.color へ永続化されずに失われるバグの修正。
//
// 背景: 従来の色スウォッチ(KW_CAT_COLORS)は「新しいカテゴリを登録」時の色にしか使われず、
// 既存カテゴリを選択したまま色だけを変えても、分類決定ボタンは
// /api/aichat/keyword-category-map (キーワード⇔カテゴリの紐付け) しか呼ばないため
// 色の変更は一切サーバーへ送信されなかった。
//
// 故障シナリオ:
//   (1) 既存カテゴリを選択し色スウォッチを変更して決定しても色がDBに反映されない(本バグ)
//   (2) 複数カテゴリが選択された状態で色変更すると、どのカテゴリの色を変えるべきか
//       曖昧になり誤ったカテゴリの色が変わってしまう
//   (3) ユーザーが色スウォッチに一切触れていないのに、たまたま初期選択色と異なる既存色を
//       持つカテゴリを選んだだけでPATCHが発生し、意図せず色が書き換わってしまう
//   (4) 不正な色コード・存在しない/他ユーザーのカテゴリIDを指定してもcrashせず400/404を返す

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

describe('バックエンド: PATCH /api/aichat/keyword-categories/:id', () => {
  function getRouteBlock(): string {
    const idx = indexSrc.indexOf("app.patch('/api/aichat/keyword-categories/:id'");
    expect(idx, 'PATCH /api/aichat/keyword-categories/:id ルートが見つからない').toBeGreaterThan(-1);
    const endIdx = indexSrc.indexOf('\n});', idx);
    return indexSrc.slice(idx, endIdx);
  }

  it('ルートが定義されている', () => {
    expect(getRouteBlock()).toContain("app.patch('/api/aichat/keyword-categories/:id'");
  });

  it('color を #RRGGBB 形式でバリデーションする', () => {
    const block = getRouteBlock();
    expect(block).toContain('/^#[0-9a-fA-F]{6}$/');
    expect(block).toContain("return jsonUtf8({ error: 'color は #RRGGBB 形式で指定してください' }, 400);");
  });

  it('user_id で絞り込んでから存在確認する(他ユーザーのカテゴリを操作できない)', () => {
    const block = getRouteBlock();
    expect(block).toMatch(/WHERE id = \? AND user_id = \?/);
    expect(block).toContain("return jsonUtf8({ error: 'カテゴリが見つかりません' }, 404);");
  });

  it('UPDATE文で aichat_keyword_categories.color を更新する', () => {
    const block = getRouteBlock();
    expect(block).toMatch(/UPDATE aichat_keyword_categories SET color = \?/);
  });

  it('色が実際に変わった場合のみ監査ログを記録する', () => {
    const block = getRouteBlock();
    expect(block).toContain('if (existing.color !== color) {');
    expect(block).toContain("action: 'keyword_category_color_updated'");
  });
});

describe('フロントエンド: 分類決定モーダルで既存カテゴリの色変更をPATCHで送信する', () => {
  it('色スウォッチのクリックで colorTouchedByUser フラグが立つ', () => {
    const html = buildPage();
    const idx = html.indexOf('colorTouchedByUser = false');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1600);
    expect(fn).toContain('colorTouchedByUser = true');
  });

  it('decideBtn ハンドラが maybeUpdateCategoryColor 経由でPATCH APIを呼ぶ', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toContain('function maybeUpdateCategoryColor');
    expect(fn).toContain("method: 'PATCH'");
    expect(fn).toContain("'/api/aichat/keyword-categories/' + selectedCatIds[0]");
  });

  it('選択カテゴリが1件かつ色が変更された場合のみPATCHする(複数選択時は色変更しない)', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toMatch(/if \(!colorTouchedByUser \|\| selectedCatIds\.length !== 1\) \{ cb\(\); return; \}/);
  });

  it('PATCHが非2xx応答を返した場合はエラーとして扱い、成功時と同様に握りつぶさない', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toContain('if (!r.ok) throw new Error');
  });

  it('色の保存に失敗した場合はモーダル内にエラー文言を表示し、ユーザーに気づける手段を確保する', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toContain("colorErrorEl.textContent = '色の変更を保存できませんでした: '");
  });

  it('色の保存に失敗した場合は分類決定ボタンを再度押せる状態に戻す(そのまま失敗を握りつぶして先へ進まない)', () => {
    const fn = sliceDecideHandler(buildPage());
    const idx = fn.indexOf('.catch(function(err) {');
    expect(idx).toBeGreaterThan(-1);
    const block = fn.slice(idx, idx + 200);
    expect(block).toContain('restoreDecideBtn();');
  });

  it('新規カテゴリ未入力(pendingNameなし)の決定パスで maybeUpdateCategoryColor を経由してから saveMapping する', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toMatch(/if \(!pendingName\) \{ maybeUpdateCategoryColor\(function\(\) \{ saveMapping\(selectedCatIds\); \}\); return; \}/);
  });

  it('既存カテゴリ名を再入力した決定パスでも maybeUpdateCategoryColor を経由する', () => {
    const fn = sliceDecideHandler(buildPage());
    expect(fn).toMatch(/maybeUpdateCategoryColor\(function\(\) \{ saveMapping\(selectedCatIds\); \}\);\s*\n\s*return;\s*\n\s*\}/);
  });
});
