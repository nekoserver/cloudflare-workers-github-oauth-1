import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';

// 対象: 活断層ページ(/webgl-faults)の (1) ツールバーボタン群(.canvas-ctrl-btns)のz-index、
// (2) 地球儀ドラッグ回転の感度スケーリング。
//
// 背景(1): 断層ツールチップ(#fault-tooltip, z-index:65)・火山ツールチップ(#mk-tooltip,
// z-index:60)は position:fixed でクリック位置に応じて画面上の任意の場所に表示されうる。
// 一方ツールバーボタン(.canvas-ctrl-btns、「エリアズーム」ボタン等)は従来 z-index:5 しか
// なく、ツールチップが偶然ボタンの上に重なった場合、クリックがツールチップ側に奪われて
// ボタンに届かなくなっていた。特に「エリアズーム」ボタンの位置にピン留めされたツールチップの
// ヘッダー(ドラッグ可能領域)が重なると、ボタンをタップしたつもりが実際にはツールチップの
// ドラッグ開始とみなされ、タップした地点にツールチップが移動してしまっていた。
// Playwrightで実ブラウザ検証し、ツールバーのz-indexを全ツールチップより高い110に
// 引き上げることで解消することを確認した。
//
// 背景(2): 地球儀のドラッグ回転感度が `*0.008` の固定係数だったため、カメラ距離(zoom)が
// 小さい(最大ズームに近い)ほど、同じピクセル移動量でも画面上の見た目の回転量が大きくなり、
// 最大ズーム時はカーソルをわずかに動かしただけで画面内の対象物が画面外まで吹き飛ぶように
// 見えていた。感度係数を現在のzoom値に比例させる(zoom/3.2、3.2は既定のズーム値)ことで、
// ズームレベルによらず見た目のドラッグ感度が一定になるようにした。
//
// 故障シナリオ:
//   (1) z-indexを上げすぎて、本来ボタンより手前に出るべきモーダル(getNextZ()で200以上を
//       割り当てられるもの)の下に埋もれてしまう
//   (2) マウスドラッグ側だけ感度を修正し、タッチドラッグ側の修正を忘れる
//   (3) 感度係数が0や負になり、ズーム時に回転操作自体が効かなくなる

describe('活断層ページ: ツールバーボタン(.canvas-ctrl-btns)のz-index', () => {
  const html = getWebGLFaultsPage('tester');

  it('.canvas-ctrl-btns のz-indexが全ツールチップ(最大100)より高い', () => {
    const idx = html.indexOf('.canvas-ctrl-btns {');
    expect(idx).toBeGreaterThan(-1);
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    const m = rule.match(/z-index:(\d+)/);
    expect(m).not.toBeNull();
    const btnZ = parseInt(m![1], 10);
    expect(btnZ).toBeGreaterThan(100);
  });

  it('getNextZ()が返す動的モーダルのz-index(最低200)より低い(モーダルの下に隠れない)', () => {
    const idx = html.indexOf('.canvas-ctrl-btns {');
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    const btnZ = parseInt(rule.match(/z-index:(\d+)/)![1], 10);
    expect(btnZ).toBeLessThan(200);
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

describe('活断層ページ: 地球儀ドラッグ回転感度のズーム比例スケーリング', () => {
  const html = getWebGLFaultsPage('tester');

  it('マウスドラッグの回転感度が zoom に比例してスケーリングされている', () => {
    const idx = html.indexOf("window.addEventListener('mousemove', function(e) {\n    if (volTtDragging) return;");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('var dragSens=0.008*(zoom/3.2);');
    expect(block).toContain('(e.clientX-lx)*dragSens');
    expect(block).toContain('(e.clientY-ly)*dragSens');
  });

  it('タッチドラッグの回転感度も同様に zoom に比例してスケーリングされている', () => {
    const idx = html.indexOf('canvas.addEventListener(\'touchmove\'');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 500);
    expect(block).toContain('var dragSens=0.008*(zoom/3.2);');
    expect(block).toContain('(e.touches[0].clientX-lx)*dragSens');
    expect(block).toContain('(e.touches[0].clientY-ly)*dragSens');
  });

  it('固定係数0.008を直接乗算する古いコードが残っていない(ドラッグ回転部分)', () => {
    expect(html).not.toContain('(e.clientX-lx)*0.008');
    expect(html).not.toContain('(e.touches[0].clientX-lx)*0.008');
  });

  it('ホイールズームの係数(0.006)やピンチズームの係数(0.008、感度とは無関係の別処理)は変更されていない', () => {
    expect(html).toContain('zoomTarget+e.deltaY*0.006');
    expect(html).toContain('zoomTarget-(d-pinch0)*0.008');
  });
});
