import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ===========================================================
// バグ: AIラベル自動分類完了通知が z-index:10000 固定のため
// モーダルが開いている状態だと通知が裏に隠れる
// ===========================================================

function sliceRepoTs(): string {
  return fs.readFileSync(path.join(__dirname, 'views', 'repositories.ts'), 'utf-8');
}

describe('repositories.ts: getNextZ 関数の存在', () => {
  it('getNextZ 関数が定義されている', () => {
    expect(sliceRepoTs()).toContain('function getNextZ()');
  });

  it('getNextZ が DOM 上の全要素を走査して z-index を収集する', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function getNextZ()');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 800);
    expect(fn).toContain('querySelectorAll');
    expect(fn).toContain('zIndex');
  });

  it('getNextZ が maxZ + 100 を返す', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function getNextZ()');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 800);
    expect(fn).toContain('+ 100');
  });
});

describe('repositories.ts: showToast が getNextZ を使う', () => {
  it('showToast 内で getNextZ を呼ぶ', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function showToast(');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 600);
    expect(fn).toContain('getNextZ()');
  });

  it('showToast が toastEl.style.zIndex を動的にセットする', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function showToast(');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 600);
    expect(fn).toContain('toastEl.style.zIndex');
  });

  it('.toast の CSS に固定 z-index が残っていない', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('.toast {');
    expect(idx).toBeGreaterThan(-1);
    const css = src.slice(idx, idx + 200);
    expect(css).not.toContain('z-index');
  });
});

describe('repositories.ts: ラベル通知が showToast 経由になっている', () => {
  it('autoLabel 通知で notif を直接 document.body.appendChild しなくなった', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('autoLabel != null');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 1000);
    expect(snippet).not.toMatch(/notif\.style\.cssText[\s\S]{0,200}z-index:10000/);
  });

  it('autoLabel 通知が showToast を呼ぶ', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('autoLabel != null');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 600);
    expect(snippet).toContain('showToast(');
  });
});

// ===========================================================
// バグ再修正: 検索履歴モーダル内からの検索（hSearchBtn）にも
// 旧来の z-index:10000 固定 notif が残っていた
// ===========================================================
describe('repositories.ts: 固定 z-index notif の全廃', () => {
  it('z-index:10000 固定の notif 生成コードがファイル全体から消えている', () => {
    const src = sliceRepoTs();
    expect(src).not.toContain("var notif = document.createElement");
  });

  it('autoLabel 通知の showToast 呼び出しが2パスとも存在する', () => {
    const src = sliceRepoTs();
    const matches = src.match(/showToast\(notifMsg, isSuccess \? 'success' : 'info', 9000\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('履歴モーダル内検索パス（hSearchBtn）でも showToast を使う', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('hSearchBtn.disabled = false');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 1500);
    expect(snippet).toContain('showToast(');
    expect(snippet).not.toContain('z-index:10000');
  });
});

describe('repositories.ts: showClassifyDebugModal の z-index 動的化', () => {
  it('showClassifyDebugModal が getNextZ を使う', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('function showClassifyDebugModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 500);
    expect(fn).toContain('getNextZ()');
    expect(fn).not.toContain('z-index:10100');
  });
});

describe('repositories.ts: トーストはモーダルより後に最上位を取得する', () => {
  it('検索ボタンパス: showClassifyDebugModal の後に showToast が呼ばれる', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf("searchBtn.disabled = false");
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 2000);
    const debugIdx = snippet.indexOf('showClassifyDebugModal(');
    const toastIdx = snippet.indexOf('showToast(');
    expect(debugIdx).toBeGreaterThan(-1);
    expect(toastIdx).toBeGreaterThan(-1);
    expect(debugIdx).toBeLessThan(toastIdx);
  });

  it('履歴モーダル内検索パス: showClassifyDebugModal の後に showToast が呼ばれる', () => {
    const src = sliceRepoTs();
    const idx = src.indexOf('hSearchBtn.disabled = false');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 2000);
    const debugIdx = snippet.indexOf('showClassifyDebugModal(');
    const toastIdx = snippet.indexOf('showToast(');
    expect(debugIdx).toBeGreaterThan(-1);
    expect(toastIdx).toBeGreaterThan(-1);
    expect(debugIdx).toBeLessThan(toastIdx);
  });
});
