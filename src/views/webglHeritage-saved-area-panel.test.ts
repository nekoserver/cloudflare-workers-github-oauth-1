import { describe, expect, it } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

describe('世界遺産ページ 保存済みエリアパネル', () => {
  const html = getWebGLHeritagePage('tester');

  it('コントロールタブをエリアタブへ置き換え、凡例を地図左下へ移動する', () => {
    expect(html).not.toContain('⚙ コントロール');
    expect(html).toContain('id="tabArea">⬜︎ エリア 🚩');
    expect(html).toContain('id="canvasLegend"');
    expect(html).toContain('文化遺産');
  });

  it('保存済みエリア一覧を関数化したエリアメニューとして読み込み、行クリックでboxエリアへ移動する', () => {
    expect(html).toContain('function loadSavedAreaMenu()');
    expect(html).toContain('function renderSavedAreaMenu(areas)');
    expect(html).toContain('function focusSavedArea(area)');
    expect(html).toContain("fetch('/api/heritage-area-boxes')");
    expect(html).toContain('areaCenterFromBox(area)');
    expect(html).toContain("if ((area.box || 'box') !== 'box') return;");
    expect(html).toContain('renderSavedAreaItems(area, entries)');
  });

  it('エリアタブのエリア番号から呼び出す保存済みエリアは毎回最大ズームへ切り替える', () => {
    const focusMatch = html.match(/function focusSavedArea\(area\) \{[\s\S]*?\n  \}/);
    expect(focusMatch).not.toBeNull();
    const fn = focusMatch![0];
    expect(fn).toContain('zoom = 10;');
    expect(fn).not.toContain('var newZoom = Math.max(1.8, Math.min(9, 9 - span / 25));');
  });

});
