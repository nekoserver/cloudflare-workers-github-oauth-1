import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';

// 対象: 活断層ページ(/webgl-faults)の断層ホバーツールチップ(#fault-tooltip)の表示位置。
//
// 背景: #fault-tooltip(非ピン留め時のホバー表示)は従来、カーソル/マーカー位置に
// 追従して表示していたため、画面中央付近にある活火山ホバーツールチップ(#mk-tooltip)
// と重なって読みづらくなることがあった。また、エリアズームで矩形選択を確定すると
// 画面左に幅260pxの候補一覧パネル(#areaTourDrawer, .area-tour-drawer)がスライド
// インして表示されるが、断層ツールチップが画面左上に固定表示されているとこのパネルと
// 重なってしまう。
//
// 修正: #fault-tooltipの表示位置をカーソル追従ではなく固定位置に変更した。
//   - エリアズームの左サイドパネル(#areaTourDrawer)が閉じている時: 画面左上に固定
//     (中央の活火山ツールチップと重ならない)
//   - #areaTourDrawerが開いている時: 画面下に固定(左サイドパネルと重ならない)
//
// 故障シナリオ:
//   (1) showFaultTooltip が相変わらずカーソル座標(x/y)をstyle.left/topに直接
//       代入し、画面中央の活火山ツールチップと重なってしまう
//   (2) #areaTourDrawerが開いている状態でも断層ツールチップが左上のままで、
//       サイドパネルの表示領域と重なってしまう
//   (3) ドロワーの開閉状態を判定するクラス名(drawer-open)が付け外しされない

describe('活断層ページ: 断層ホバーツールチップ(#fault-tooltip)の位置', () => {
  const html = getWebGLFaultsPage('tester');

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

  it('#fault-tooltip の既定スタイルは画面左上に固定されている(カーソル追従のtransformは使わない)', () => {
    const idx = html.indexOf('#fault-tooltip {');
    expect(idx).toBeGreaterThan(-1);
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    expect(rule).toContain('left:16px');
    expect(rule).toContain('top:16px');
    expect(rule).toContain('transform:none');
  });

  it('#fault-tooltip.drawer-open は画面下に固定される', () => {
    const idx = html.indexOf('#fault-tooltip.drawer-open {');
    expect(idx).toBeGreaterThan(-1);
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    expect(rule).toContain('top:auto');
    expect(rule).toContain('bottom:16px');
  });

  it('showFaultTooltip はカーソル座標を引数に取らず、style.left/topへの直接代入もしない', () => {
    const fnMatch = html.match(/function showFaultTooltip\(f\) \{[\s\S]*?\n  \}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).not.toMatch(/faultTooltipEl\.style\.left = x \+ 'px';/);
    expect(fn).not.toMatch(/faultTooltipEl\.style\.top = y \+ 'px';/);
    expect(fn).toContain("faultTooltipEl.className = areaTourDrawer.classList.contains('open') ? 'drawer-open' : '';");
  });

  it('呼び出し元(初期化コード)もカーソル座標を渡さなくなっている', () => {
    expect(html).toContain('showFaultTooltip(f);');
    expect(html).not.toContain("showFaultTooltip(f, r.left + r.width/2, r.top);");
  });
});
