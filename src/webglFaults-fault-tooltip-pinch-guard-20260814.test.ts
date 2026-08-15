import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';

// 対象: 活断層ページ(/webgl-faults)の地球儀ピンチ操作時、ピン留めされた
// 断層ツールチップ(#fault-tooltip)がドラッグ操作を奪ってしまう不具合の修正。
//
// 背景: ピン留め状態の#fault-tooltipは pointer-events:auto かつ position:fixed で
// 画面左上(または下)に固定表示される。2本指でピンチズームする際、片方の指が
// たまたまツールチップの上に乗ると、その指のtouchstartがツールチップ自身の
// ドラッグ開始処理(_faultTtTouchHandler)を起動してしまい、本来ピンチには無関係な
// ツールチップが指を追従して動いてしまっていた(見た目上ツールチップに
// フォーカスが当たってしまう)。
//
// 修正: _faultTtTouchHandlerに「touchstart時点で2本以上の指が触れている場合は
// ドラッグを開始しない」ガードを追加した。またwindowのtouchmoveハンドラでも
// 2本以上の指が触れている間はfaultTtDraggingによる追従を無視するようにし、
// touchend時にfaultTtDraggingを確実にリセットするようにした。
//
// 故障シナリオ:
//   (1) touchstartのガードだけ追加し、touchmove側で2本指中の追従処理が
//       止まらずツールチップが動き続けてしまう
//   (2) touchendでfaultTtDraggingがリセットされず、ピンチ後も
//       ツールチップが誤ってドラッグされ続ける
//   (3) 1本指での正規のドラッグ操作(ピン留めツールチップの意図的な移動)まで
//       止めてしまう(過剰なガード)

describe('活断層ページ: ピンチ操作中に断層ツールチップがフォーカスを奪わない', () => {
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

  it('_faultTtTouchHandlerは2本指以上のtouchstartではドラッグを開始しない(1本指の場合は開始する)', () => {
    const idx = html.indexOf('_faultTtTouchHandler = function(ev) {');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    const boxZoomGuardIdx = block.indexOf('if (boxZoomMode) return;');
    const pinchGuardIdx = block.indexOf('if (ev.touches.length > 1) return;');
    expect(boxZoomGuardIdx).toBeGreaterThan(-1);
    expect(pinchGuardIdx).toBeGreaterThan(boxZoomGuardIdx);
    expect(block.indexOf('faultTtDragging = true;')).toBeGreaterThan(pinchGuardIdx);
  });

  it('windowのtouchmoveハンドラは2本指以上の間はfaultTtDraggingによる追従を行わない', () => {
    const idx = html.indexOf("window.addEventListener('touchmove', function(e) {");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    expect(block).toContain('if (faultTtDragging && e.touches.length <= 1) {');
  });

  it('windowのtouchendハンドラでfaultTtDraggingが確実にリセットされる', () => {
    expect(html).toContain("window.addEventListener('touchend', function() { volTtDragging = false; faultTtDragging = false; });");
  });
});
