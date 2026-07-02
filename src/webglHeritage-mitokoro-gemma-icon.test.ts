import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産ツールチップ: 見どころ×gemma-4-26b-a4b-it キャッシュの👀アイコン', () => {
  const html = getWebGLHeritagePage('tester');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('ページ読み込み時に見どころ×gemmaキャッシュを一括取得する', () => {
    expect(html).toContain("fetch('/api/aichat/check-heritage-mitokoro-gemma-batch'");
    expect(html).toContain('heritageMitokoroGemmaShareId');
  });

  it('キャッシュがある世界遺産のツールチップ名の行末に👀アイコンを表示する', () => {
    expect(html).toMatch(/var gemmaShareId = heritageMitokoroGemmaShareId\[d\.n\];/);
    expect(html).toMatch(/var gemmaIcon = gemmaShareId \? ' <span id="tt-mitokoro-gemma-btn"/);
    expect(html).toMatch(/d\.n \+ cityIcon \+ gemmaIcon/);
  });

  it('👀アイコンをタップすると最上位レイヤーのモーダル(openHeritageMitokoroGemmaModal)を開く', () => {
    expect(html).toContain('function openHeritageMitokoroGemmaModal(heritageName, shareId)');
    expect(html).toMatch(/openHeritageMitokoroGemmaModal\(name, shareId\);/);
  });

  it('モーダルは getNextZ() で最上位の z-index を動的に算出する', () => {
    expect(html).toContain('function getNextZ()');
    expect(html).toMatch(/z-index:' \+ getNextZ\(\) \+/);
  });

  it('モーダルは /api/aichat/shares/:id から回答本文を取得して表示する', () => {
    expect(html).toContain("fetch('/api/aichat/shares/' + encodeURIComponent(shareId))");
    expect(html).toMatch(/body\.textContent = data\.answer \|\| data\.error \|\| '（応答なし）';/);
  });
});
