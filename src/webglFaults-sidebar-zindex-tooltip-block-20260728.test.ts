import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';

// 対象: 活断層ページ(/webgl-faults)で、ピン留めされた断層/火山ツールチップ
// (#fault-tooltip, #mk-tooltip)が右サイドバー・エリアメニュー・各種ドロワーの
// ボタンを覆ってしまい、それらのクリックがツールチップに奪われてタップした地点へ
// ツールチップ自身が移動してしまう不具合の根本原因の修正。
//
// 背景: 前回(#1195)はツールバー(.canvas-ctrl-btns)のz-index(5→110)のみを
// 修正したが、実際にはツールチップより低いz-index(または未設定=auto)の
// インタラクティブ要素が他にも複数存在しており、修正が不完全だった。
//   - .side(右サイドバー本体: 断層リスト・タイプフィルターボタン・自転速度スライダー・
//     設定パネルすべてを含む) — z-index未設定(auto)。#fault-tooltip/#mk-tooltipは
//     position:fixed+z-index:60〜65で独自のスタッキングコンテキストを持つため、
//     z-index未設定の.sideは常にツールチップの下に埋もれていた
//   - エリアメニュー(#areaMenuEl、JSで生成)— z-index:55(ツールチップの65より低い)
//   - .area-tour-drawer — z-index:45(同上)
//   - .airport-drawer — z-index:20(同上)
// これらすべてをツールチップより高いz-index:110に引き上げた。
// ただし#apt-tooltip(空港ドロワー内の個別ツールチップ、z-index:70)は
// .airport-drawer自身より上に表示される必要があるため、ドロワーの引き上げに
// 合わせてz-index:115へ引き上げ、内部の相対関係を維持した。
//
// 故障シナリオ:
//   (1) .side のz-indexを上げ忘れ、サイドバーのボタン(フィルター・断層リスト項目・
//       自転速度スライダー・設定タブ)がツールチップに覆われたまま操作不能になる
//   (2) エリアメニューやドロワーのz-index引き上げを一部だけ行い、修正が再び不完全になる
//   (3) .airport-drawer を引き上げた際に #apt-tooltip との相対順序が崩れ、
//       空港ドロワー内の個別ツールチップがドロワー自身の背後に隠れてしまう
//   (4) z-indexを上げすぎて、動的モーダル(getNextZ()で常に200以上)の下に埋もれる

describe('活断層ページ: サイドバー・エリアメニュー・ドロワーのz-index修正', () => {
  const html = getWebGLFaultsPage('tester');

  function ruleZ(selectorStart: string): number {
    const idx = html.indexOf(selectorStart);
    expect(idx, selectorStart + ' が見つからない').toBeGreaterThan(-1);
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    const m = rule.match(/z-index:(\d+)/);
    expect(m, selectorStart + ' にz-indexが見つからない').not.toBeNull();
    return parseInt(m![1], 10);
  }

  it('.side (右サイドバー本体)のz-indexが全ツールチップ(最大100)より高い', () => {
    const z = ruleZ('.side {');
    expect(z).toBeGreaterThan(100);
    expect(z).toBeLessThan(200);
  });

  it('.area-tour-drawer のz-indexが全ツールチップより高い', () => {
    const z = ruleZ('.area-tour-drawer {');
    expect(z).toBeGreaterThan(100);
    expect(z).toBeLessThan(200);
  });

  it('.airport-drawer のz-indexが全ツールチップより高い', () => {
    const z = ruleZ('.airport-drawer {');
    expect(z).toBeGreaterThan(100);
    expect(z).toBeLessThan(200);
  });

  it('#apt-tooltip は .airport-drawer 自身よりさらに高いz-indexを維持している(ドロワー内個別ツールチップの可視性を保つ)', () => {
    const drawerZ = ruleZ('.airport-drawer {');
    const tooltipZ = ruleZ('#apt-tooltip {');
    expect(tooltipZ).toBeGreaterThan(drawerZ);
  });

  it('エリアメニュー(areaMenuEl)のインラインz-indexが全ツールチップより高い', () => {
    const idx = html.indexOf('areaMenuEl.style.cssText');
    expect(idx).toBeGreaterThan(-1);
    const line = html.slice(idx, html.indexOf(';\'', idx) + 2);
    const m = line.match(/z-index:(\d+)/);
    expect(m).not.toBeNull();
    const z = parseInt(m![1], 10);
    expect(z).toBeGreaterThan(100);
    expect(z).toBeLessThan(200);
  });

  it('全ての引き上げ対象は動的モーダル(getNextZ()で常に200以上)より低い', () => {
    ['.side {', '.area-tour-drawer {', '.airport-drawer {'].forEach((sel) => {
      expect(ruleZ(sel)).toBeLessThan(200);
    });
  });

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
});
