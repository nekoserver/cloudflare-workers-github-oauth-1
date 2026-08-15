import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';

// 対象: 活断層ページ(/webgl-faults)の活火山マーカー(.vol-mk、地球儀上の🌋アイコン)の
// タップ可能領域。
//
// 背景: .vol-mkは絵文字1文字(font-size:14px、選択中は18px)のみで構成された
// 非常に小さい要素で、position:absoluteで地球儀(#c canvas)の上にpointer-events:auto
// で重ねて配置されている。タップ位置がこの小さな絵文字の実描画範囲からわずかでも
// ズレると、タップイベントは.vol-mkではなく1枚下のレイヤーであるcanvasが受け取って
// しまい、ツールチップが開かず地球儀のドラッグ回転(canvasのtouchstart/mousedown)が
// 起動してしまっていた。
//
// 修正: .vol-mkにmin-width/min-height:32pxとflexによる中央揃えを追加し、
// transform:translate(-50%,-50%)による中心基準の配置を保ったまま見た目の絵文字サイズは
// 変えずに実際のタップ可能領域だけを拡大した。またtouch-action:manipulationを
// 指定し、タップの認識を安定させた。
//
// 故障シナリオ:
//   (1) タップ領域を拡大する際に transform:translate(-50%,-50%) を崩し、
//       マーカーの表示位置(緯度経度に対応する画面座標)がズレてしまう
//   (2) min-width/min-heightを追加した結果、絵文字自体の見た目のサイズまで
//       変わってしまう(font-sizeが変化する)
//   (3) .vol-mk.active(選択中)のスタイルが拡大領域と衝突し、選択状態の見た目が
//       崩れる
//   (4) pointer-events:autoが失われ、再びタップがcanvasに抜けてしまう

describe('活断層ページ: 活火山マーカー(.vol-mk)のタップ可能領域の拡大', () => {
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

  it('.vol-mk に十分なタップ可能領域(min-width/min-height 32px以上)が確保されている', () => {
    const idx = html.indexOf('.vol-mk {');
    expect(idx).toBeGreaterThan(-1);
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    const minWMatch = rule.match(/min-width:(\d+)px/);
    const minHMatch = rule.match(/min-height:(\d+)px/);
    expect(minWMatch).not.toBeNull();
    expect(minHMatch).not.toBeNull();
    expect(parseInt(minWMatch![1], 10)).toBeGreaterThanOrEqual(32);
    expect(parseInt(minHMatch![1], 10)).toBeGreaterThanOrEqual(32);
  });

  it('.vol-mk は中心基準の配置(translate(-50%,-50%))とpointer-events:autoを維持している', () => {
    const idx = html.indexOf('.vol-mk {');
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    expect(rule).toContain('transform:translate(-50%,-50%)');
    expect(rule).toContain('pointer-events:auto');
    expect(rule).toContain('position:absolute');
  });

  it('.vol-mk は絵文字を拡大した領域の中央に揃えて表示する(flexによる中央揃え)', () => {
    const idx = html.indexOf('.vol-mk {');
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    expect(rule).toContain('display:flex');
    expect(rule).toContain('align-items:center');
    expect(rule).toContain('justify-content:center');
  });

  it('タップ操作の認識を安定させるtouch-action:manipulationが指定されている', () => {
    const idx = html.indexOf('.vol-mk {');
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    expect(rule).toContain('touch-action:manipulation');
  });

  it('.vol-mk.active の絵文字サイズ拡大(font-size:18px)は変わらず維持されている', () => {
    expect(html).toContain('.vol-mk.active { font-size:18px; }');
  });

  it('マーカーの画面座標はleft/topスタイルで設定され、拡大したボックスサイズの影響を受けない', () => {
    expect(html).toContain("el.style.left = ((mcx/mcw + 1) * W / 2) + 'px';");
    expect(html).toContain("el.style.top = ((-mcy/mcw + 1) * H / 2) + 'px';");
  });
});
