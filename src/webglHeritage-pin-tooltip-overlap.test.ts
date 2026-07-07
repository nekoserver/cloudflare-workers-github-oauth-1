import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産ページ: F1/駅ツールチップの閉じるボタンと重なり回避', () => {
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

  it('F1サーキットピンラベルの右上に適切なタップ範囲を持つ×ボタンが存在する', () => {
    expect(html).toContain('id="f1-circuit-pin-close-btn"');
    expect(html).toContain('class="pin-label-close-btn"');
    expect(html).toMatch(/\.pin-label-close-btn\s*\{[^}]*width:26px[^}]*height:26px/);
  });

  it('駅ピンラベルの右上に適切なタップ範囲を持つ×ボタンが存在する', () => {
    expect(html).toContain('id="rail-station-pin-close-btn"');
  });

  it('F1ピンの×ボタンはタップでピン・ラベルを非表示にし座標を破棄する', () => {
    expect(html).toMatch(/document\.getElementById\('f1-circuit-pin-close-btn'\)\.addEventListener\('click', function\(e\) \{\s*e\.stopPropagation\(\);\s*stopF1Tour\(\);\s*f1CircuitPin3d = null;\s*f1CircuitPin\.style\.display = 'none';\s*f1CircuitPinLabel\.style\.display = 'none';/);
  });

  it('駅ピンの×ボタンはタップでピン・ラベルを非表示にし座標を破棄する', () => {
    expect(html).toMatch(/document\.getElementById\('rail-station-pin-close-btn'\)\.addEventListener\('click', function\(e\) \{\s*e\.stopPropagation\(\);\s*stopRailTour\(\);\s*railStationPin3d = null;\s*railStationPin\.style\.display = 'none';\s*railStationPinLabel\.style\.display = 'none';/);
  });

  it('positionTooltip は駅・F1ラベルとの重なりを避ける関数(avoidPinLabelOverlap)を呼び出す', () => {
    expect(html).toContain('function avoidPinLabelOverlap()');
    expect(html).toMatch(/function positionTooltip\(vx, vy\) \{[\s\S]*?avoidPinLabelOverlap\(\);\s*\}/);
  });

  it('avoidPinLabelOverlap は表示中の駅・F1ラベルの最小top座標と世界遺産ツールチップの最大bottom座標を比較する', () => {
    expect(html).toMatch(/otherMinTop === null \|\| r\.top < otherMinTop/);
    expect(html).toMatch(/if \(tRect\.bottom > otherMinTop\) \{/);
  });

  it('世界遺産名ツールチップはポインター操作で自由にドラッグ移動できる', () => {
    expect(html).toMatch(/#mk-tooltip\s*\{[^}]*cursor:move[^}]*touch-action:none/);
    expect(html).toContain("var ttDragging = false, ttDragOX = 0, ttDragOY = 0;");
    expect(html).toMatch(/tooltip\.addEventListener\('pointerdown',[\s\S]*?tooltip\.style\.transform = 'none';[\s\S]*?tooltip\.setPointerCapture\(ev\.pointerId\);/);
    expect(html).toMatch(/tooltip\.addEventListener\('pointermove',[\s\S]*?tooltip\.style\.left = \(ev\.clientX - ttDragOX\) \+ 'px';[\s\S]*?tooltip\.style\.top = \(ev\.clientY - ttDragOY\) \+ 'px';/);
    expect(html).toContain("tooltip.addEventListener('pointercancel', function() { ttDragging = false; });");
  });

});
