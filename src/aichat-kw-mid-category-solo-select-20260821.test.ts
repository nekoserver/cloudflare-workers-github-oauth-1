import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

// ===========================================================
// 大分類が未選択の状態で単独の中分類カテゴリが選択された時の
// 「単独中分類分離モード」に関するテスト
// ===========================================================

describe('単独中分類分離モード: 状態変数・関数の宣言', () => {
  it('kwMidSoloActive がモジュールスコープで宣言されている', () => {
    const html = buildPage();
    const renderIdx = html.indexOf('function renderKwClassifyList');
    const idx = html.lastIndexOf('var kwMidSoloActive', renderIdx);
    expect(idx).toBeGreaterThan(-1);
  });

  it('kwMidSoloCatId がモジュールスコープで宣言されている', () => {
    const html = buildPage();
    const renderIdx = html.indexOf('function renderKwClassifyList');
    const idx = html.lastIndexOf('var kwMidSoloCatId', renderIdx);
    expect(idx).toBeGreaterThan(-1);
  });

  it('enterKwMidSoloMode 関数が宣言されている', () => {
    const html = buildPage();
    expect(html).toContain('function enterKwMidSoloMode(catId)');
  });

  it('exitKwMidSoloMode 関数が宣言されている', () => {
    const html = buildPage();
    expect(html).toContain('function exitKwMidSoloMode()');
  });

  it('.kw-cat-badge-solo-disabled が pointer-events:none で実際に非活性化される', () => {
    const html = buildPage();
    const idx = html.indexOf('.kw-cat-badge-solo-disabled');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 120);
    expect(snippet).toContain('pointer-events:none');
  });

  it('openKwClassifyList がベースライン状態にリセットする(kwMidSoloActive/kwMidSoloCatId)', () => {
    const html = buildPage();
    const idx = html.indexOf('function openKwClassifyList');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('kwMidSoloActive = false');
    expect(fn).toContain('kwMidSoloCatId = null');
  });
});

describe('単独中分類分離モード: トリガー条件', () => {
  it('大分類未選択(!selectedGroupId)かつ selCount === 1 で enterKwMidSoloMode を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2200);
    expect(fn).toContain('!selectedGroupId && selCount === 1 && !kwMidSoloActive');
    expect(fn).toContain('enterKwMidSoloMode(catId)');
  });

  it('大分類選択中(selectedGroupId)の既存分岐より後に単独分離判定を置く(add/removeフローを妨げない)', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    const fn = html.slice(idx, idx + 2200);
    const groupBranchIdx = fn.indexOf('selectedGroupId && selectedCats[catId]');
    const soloTriggerIdx = fn.indexOf('!selectedGroupId && selCount === 1');
    expect(groupBranchIdx).toBeGreaterThan(-1);
    expect(soloTriggerIdx).toBeGreaterThan(groupBranchIdx);
  });

  it('選択カウントが1以外に戻り分離モード中なら exitKwMidSoloMode を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    const fn = html.slice(idx, idx + 2200);
    expect(fn).toContain('kwMidSoloActive && selCount !== 1');
    expect(fn).toContain('exitKwMidSoloMode()');
  });

  it('クリックハンドラの先頭で非活性な中分類のクリックを早期returnで無効化する(真の非活性)', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('if (kwMidSoloActive && catId !== kwMidSoloCatId) return;');
  });

  it('大分類バッジクリック時に分離モード中なら exitKwMidSoloMode を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("grpEl.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('if (kwMidSoloActive) exitKwMidSoloMode();');
  });
});

describe('単独中分類分離モード: enterKwMidSoloMode の挙動', () => {
  it('他の中分類バッジ全てに kw-cat-badge-solo-disabled をトグルする', () => {
    const html = buildPage();
    const idx = html.indexOf('function enterKwMidSoloMode(catId)');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('function exitKwMidSoloMode()', idx);
    const fn = html.slice(idx, endIdx);
    expect(fn).toContain("cid !== catId");
    expect(fn).toContain('kw-cat-badge-solo-disabled');
  });

  it('キーワードバッジを一旦全て非表示にしてから選択中カテゴリ分だけ表示する(全非表示→部分再表示)', () => {
    const html = buildPage();
    const idx = html.indexOf('function enterKwMidSoloMode(catId)');
    const endIdx = html.indexOf('function exitKwMidSoloMode()', idx);
    const fn = html.slice(idx, endIdx);
    const hideAllIdx = fn.indexOf("el.style.display = 'none';");
    const showMatchIdx = fn.indexOf("if (catIds.indexOf(catId) !== -1) el.style.display = '';");
    expect(hideAllIdx).toBeGreaterThan(-1);
    expect(showMatchIdx).toBeGreaterThan(hideAllIdx);
  });

  it('解除するボタンのラッパーを表示状態にする', () => {
    const html = buildPage();
    const idx = html.indexOf('function enterKwMidSoloMode(catId)');
    const endIdx = html.indexOf('function exitKwMidSoloMode()', idx);
    const fn = html.slice(idx, endIdx);
    expect(fn).toContain("kwMidSoloReleaseWrap");
    expect(fn).toContain("releaseWrap.style.display = '';");
  });
});

describe('単独中分類分離モード: exitKwMidSoloMode の挙動(ページ読み込み時状態への復帰)', () => {
  it('選択中の中分類カテゴリのトグルを解除する(selectedCatsから削除)', () => {
    const html = buildPage();
    const idx = html.indexOf('function exitKwMidSoloMode()');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('delete selectedCats[kwMidSoloCatId]');
  });

  it('全ての中分類バッジから kw-cat-badge-solo-disabled を除去する(非活性解除)', () => {
    const html = buildPage();
    const idx = html.indexOf('function exitKwMidSoloMode()');
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain("catEl.classList.remove('kw-cat-badge-solo-disabled')");
  });

  it('全てのキーワードバッジを非表示に戻す', () => {
    const html = buildPage();
    const idx = html.indexOf('function exitKwMidSoloMode()');
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain("el.style.display = '';");
  });

  it('解除するボタンのラッパーを非表示に戻す', () => {
    const html = buildPage();
    const idx = html.indexOf('function exitKwMidSoloMode()');
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain("releaseWrap.style.display = 'none';");
  });

  it('解除するボタンのクリックで exitKwMidSoloMode を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("var kwMidSoloReleaseBtn = document.getElementById('kwMidSoloReleaseBtn');");
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('exitKwMidSoloMode()');
  });
});

describe('単独中分類分離モード: 解除するボタンのDOM配置(中分類群の最下段・中央寄せ)', () => {
  it('中分類バッジ群を描画する cats.forEach ブロックの直後に kwMidSoloReleaseWrap を配置する', () => {
    const html = buildPage();
    const catsForEachIdx = html.indexOf('cats.forEach(function(cat) {');
    expect(catsForEachIdx).toBeGreaterThan(-1);
    const releaseIdx = html.indexOf('kwMidSoloReleaseWrap', catsForEachIdx);
    expect(releaseIdx).toBeGreaterThan(catsForEachIdx);
  });

  it('kwMidSoloReleaseWrap は text-align:center かつ初期状態は display:none', () => {
    const html = buildPage();
    const idx = html.indexOf('id="kwMidSoloReleaseWrap"');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 100);
    expect(snippet).toContain('display:none');
    expect(snippet).toContain('text-align:center');
  });

  it('解除する ボタンのテキストを含む', () => {
    const html = buildPage();
    expect(html).toContain('>解除する<');
  });
});

describe('回帰確認: 既存の大分類/複数中分類選択フローは変更されていない', () => {
  it('selCount>=2 でグループ束ねモーダルを開く既存分岐が残っている', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    const fn = html.slice(idx, idx + 2600);
    expect(fn).toContain('selCount >= 2');
    expect(fn).toContain('openKwCatGroupModal(selectedIds, catMap');
  });

  it('大分類選択中の add-mode / remove-mode 分岐がそのまま存在する', () => {
    const html = buildPage();
    const idx = html.indexOf("catEl.addEventListener('click'");
    const fn = html.slice(idx, idx + 2600);
    expect(fn).toContain('selectedGroupId && selectedCats[catId]');
    expect(fn).toContain('selectedGroupId && !selectedCats[catId]');
  });

  it('大分類バッジのトグルロジック(selectedGroupId === groupId)は変更されていない', () => {
    const html = buildPage();
    const idx = html.indexOf("grpEl.addEventListener('click'");
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('selectedGroupId === groupId');
  });
});
