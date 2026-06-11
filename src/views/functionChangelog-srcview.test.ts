import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(path.join(__dirname, 'functionChangelog.ts'), 'utf-8');

// ===========================================================
// 関数名クリック → ソースビューアモーダル テスト
// ===========================================================

describe('functionChangelog: fn-link クラス', () => {
  it('主テーブル col-func セルの code 要素に fn-link クラスが付いている', () => {
    expect(src).toMatch(/col-func[^>]*>.*?<code[^>]*class="fn-link"/s);
  });

  it('カタログテーブル行の code 要素に fn-link クラスが付いている', () => {
    // JS レンダリング部分（最後の出現箇所）で fn-link が含まれることを確認
    const catIdx = src.lastIndexOf('col-cat-func');
    const block = src.slice(catIdx, catIdx + 300);
    expect(block).toContain('fn-link');
  });

  it('fn-link に data-func と data-file 属性が含まれる（主テーブル）', () => {
    expect(src).toMatch(/fn-link[^>]*data-func=/);
    expect(src).toMatch(/fn-link[^>]*data-file=/);
  });
});

describe('functionChangelog: ソースビューアモーダル HTML', () => {
  it('srcViewOverlay が存在する', () => {
    expect(src).toMatch(/id=["']srcViewOverlay["']/);
  });

  it('srcViewModal が存在する', () => {
    expect(src).toMatch(/id=["']srcViewModal["']/);
  });

  it('srcViewClose ボタンが存在する', () => {
    expect(src).toMatch(/id=["']srcViewClose["']/);
  });

  it('srcViewBody が存在する', () => {
    expect(src).toMatch(/id=["']srcViewBody["']/);
  });
});

describe('functionChangelog: ソースビューア JS', () => {
  it('openSrcViewer 関数が存在する', () => {
    expect(src).toContain('function openSrcViewer');
  });

  it('highlightTs 関数が存在する', () => {
    expect(src).toContain('function highlightTs');
  });

  it('getNextZ 関数が存在する', () => {
    expect(src).toContain('function getNextZ');
  });

  it('srcViewOverlay を開く際に getNextZ() で z-index を設定する', () => {
    expect(src).toMatch(/srcViewOverlay[^;]{0,200}getNextZ\(\)/s);
  });

  it('srcViewOverlay の close ハンドラが存在する', () => {
    expect(src).toContain('srcViewClose');
  });

  it('tableBody に対するイベントデリゲーションが存在する', () => {
    expect(src).toMatch(/tableBodyEl[^}]{0,200}fn-link/s);
  });

  it('catalogBody に対するイベントデリゲーションが存在する', () => {
    expect(src).toMatch(/catalogBodyEl[^}]{0,200}fn-link/s);
  });
});

describe('functionChangelog: シンタックスハイライト CSS', () => {
  it('hl-comment クラスが light-dark で定義されている', () => {
    const idx = src.indexOf('.hl-comment');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 100);
    expect(block).toContain('light-dark(');
  });

  it('hl-string クラスが light-dark で定義されている', () => {
    const idx = src.indexOf('.hl-string');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 100);
    expect(block).toContain('light-dark(');
  });

  it('hl-kw クラスが存在する', () => {
    expect(src).toContain('.hl-kw');
  });

  it('hl-type クラスが存在する', () => {
    expect(src).toContain('.hl-type');
  });

  it('hl-num クラスが存在する', () => {
    expect(src).toContain('.hl-num');
  });
});

describe('functionChangelog: getNextZ の staticZDefaults に両モーダルが登録されている', () => {
  it('staticZDefaults に historyOverlay が含まれる', () => {
    const idx = src.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 300);
    expect(block).toContain('historyOverlay');
  });

  it('staticZDefaults に srcViewOverlay が含まれる', () => {
    const idx = src.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 300);
    expect(block).toContain('srcViewOverlay');
  });
});
