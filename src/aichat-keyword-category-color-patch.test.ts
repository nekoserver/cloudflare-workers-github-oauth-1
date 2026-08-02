import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAiChatPage } from './views/aichat';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(__dirname, 'index.ts'), 'utf-8');

// 対象: AIチャットの「分類: ◯」モーダルで、既存の分類カテゴリの識別色を変更する機能。
//
// 背景: 当初「新しいカテゴリを登録」用の色スウォッチを流用し、色を変えてから
// 「分類決定」ボタンを押すと選択中のカテゴリの色も更新する、という間接的な実装にしたが、
// (a) 複数カテゴリが選択されている場合は無言でスキップされる、
// (b) ユーザーが「分類決定」まで押さないと保存されないため、色を選んだだけで安心して
//     モーダルを閉じると保存されない、
// という理由で「色を変えても保存されない」報告が繰り返し発生した。
// カテゴリバッジごとに🎨アイコンを設け、色を選んだ瞬間に単独でPATCHして即時保存・即時結果表示する
// 方式に作り直した(「分類決定」ボタンとは完全に独立)。
//
// 故障シナリオ:
//   (1) 色エディタから色を選んでもPATCHが送信されず保存されない
//   (2) PATCHが400/404等で失敗しても握りつぶされて何も表示されない(記録・通知の欠如)
//   (3) バッジに🎨アイコンを追加したことで textContent が変わり、
//       「カテゴリ名を再入力して既存カテゴリと同一視する」ロジック(existingEl判定)が
//       textContent比較のままだと壊れてしまう
//   (4) 不正な色コード・存在しない/他ユーザーのカテゴリIDを指定してもcrashせず400/404を返す

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

function sliceFn(html: string, marker: string, len = 2500): string {
  const idx = html.indexOf(marker);
  expect(idx, marker + ' が見つからない').toBeGreaterThan(-1);
  return html.slice(idx, idx + len);
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

describe('フロントエンド: バッジごとの色エディタが選択と同時にPATCHで即時保存する', () => {
  it('openColorEditor がバッジごとの🎨クリックで呼ばれる', () => {
    const fn = sliceFn(buildPage(), 'function renderCatBadge(cat)', 1600);
    expect(fn).toContain("editDot.textContent = ' 🎨'");
    expect(fn).toContain('openColorEditor(cat.id, col)');
    expect(fn).toContain('e.stopPropagation()');
  });

  it('openColorEditor はスウォッチクリックで即座にPATCH APIを呼ぶ(分類決定ボタンを経由しない)', () => {
    const fn = sliceFn(buildPage(), 'function openColorEditor(catId, currentColor)', 2000);
    expect(fn).toContain("method: 'PATCH'");
    expect(fn).toContain("'/api/aichat/keyword-categories/' + catId");
  });

  it('PATCHが非2xx応答を返した場合はエラーとして扱い、成功時と同様に握りつぶさない', () => {
    const fn = sliceFn(buildPage(), 'function openColorEditor(catId, currentColor)', 2000);
    expect(fn).toContain('if (!r.ok) throw new Error');
  });

  it('色の保存に失敗した場合はモーダル内にエラー文言を表示し、ユーザーに気づける手段を確保する', () => {
    const fn = sliceFn(buildPage(), 'function openColorEditor(catId, currentColor)', 2000);
    expect(fn).toContain("colorEditorStatus.textContent = '色の変更を保存できませんでした: '");
  });

  it('保存成功時はカテゴリ一覧を再取得してバッジ表示を最新化する', () => {
    const fn = sliceFn(buildPage(), 'function openColorEditor(catId, currentColor)', 2000);
    expect(fn).toContain('loadCategories();');
  });
});

describe('フロントエンド: バッジに🎨アイコンを追加しても既存カテゴリ名の同一視ロジックが壊れない', () => {
  it('renderCatBadge が data-cat-name にカテゴリ名(表示装飾を含まない生の名前)を保持する', () => {
    const fn = sliceFn(buildPage(), 'function renderCatBadge(cat)', 800);
    expect(fn).toContain("badge.dataset.catName = cat.name;");
  });

  it('catInput の重複チェックが textContent ではなく data-cat-name で一致判定する', () => {
    const fn = sliceFn(buildPage(), "catInput.addEventListener('input'", 700);
    expect(fn).toContain('el.dataset.catName === val');
    expect(fn).not.toContain('el.textContent === val');
  });

  it('decideBtn ハンドラの既存カテゴリ名マッチングが textContent ではなく data-cat-name で行われる', () => {
    const fn = sliceFn(buildPage(), 'decideBtn.addEventListener', 2000);
    expect(fn).toContain('el.dataset.catName === pendingName');
    expect(fn).not.toContain('el.textContent === pendingName');
  });
});
