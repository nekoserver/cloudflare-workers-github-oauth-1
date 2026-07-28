import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';
import { extractFunctionSource } from './utils/extractFunctionSource';

// 対象: 活断層ページ(/webgl-faults)の「エリアズーム」機能に関する3件の不具合修正。
//
// (1) エリアズームボタン押下後、活断層/活火山ツールチップが勝手にボタン位置へ
//     移動してしまう現象。ピン留めされたツールチップ(#fault-tooltip, #vol-tooltip)は
//     position:fixedでキャンバス上の任意の場所に表示されうるため、エリア選択の
//     ドラッグ開始点がツールチップの上に重なると、キャンバス側ではなくツールチップ側の
//     ドラッグ処理(位置追従)が起動してしまっていた。エリアズームモード中は
//     ツールチップのpointer-eventsを無効化してドラッグをキャンバスへ完全に
//     透過させ、かつツールチップ自身のドラッグ開始処理にもboxZoomModeガードを
//     追加する二重の対策とした。
// (2) エリアズームで選択→巡回を最後まで終えると、ズームレベルが既定値(3.2)まで
//     勝手に解除されてしまう現象。stopAreaTour(completed)のcompleted分岐に
//     あった `zoomTarget = 3.2;` が原因だったため削除した(巡回を手動停止した
//     場合は元々ズームが維持されており、その挙動に統一した)。
// (3) 最大ズーム時、エリアズームの矩形選択内の活火山検出精度が悪い現象。
//     矩形の対角2点のみを球面へ逆投影して緯度経度範囲を求めていたため、
//     透視投影による非線形な歪み(特に最大ズーム時はカメラが球面近傍にあり
//     画面端ほど歪みが急激)を反映できていなかった。矩形の4辺を細かく
//     サンプリングし、緯度は単純min/max、経度は円環上の最大の隙間の反対側を
//     真の範囲とする(日付変更線をまたぐケースも扱える)computeLonRange()で
//     求めるように変更した。
//
// 故障シナリオ:
//   (1) pointer-events切り替えの有効化/無効化のどちらか一方を忘れ、モード終了後も
//       ツールチップが操作不能なままになる、またはモード中もドラッグを奪い続ける
//   (2) 手動停止時と自動完了時でズームの扱いが再び食い違う
//   (3) computeLonRange が単一点/2点/日付変更線をまたぐケースで正しく動作しない
//   (4) 緯度経度サンプリングの結果が一切得られない(球体の外に矩形が外れる等)場合に
//       例外を投げる、またはlastBoxBoundsが不正な値(NaN等)になる

describe('活断層ページ: エリアズーム中のツールチップ操作干渉の解消', () => {
  const html = getWebGLFaultsPage('tester');

  it('エリアズームボタンのクリックハンドラが断層・火山ツールチップのpointer-eventsを切り替える', () => {
    const idx = html.indexOf("btnBoxZoom.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 500);
    expect(block).toContain("faultTooltipEl.style.pointerEvents = boxZoomMode ? 'none' : '';");
    expect(block).toContain("volTooltipEl.style.pointerEvents = boxZoomMode ? 'none' : '';");
  });

  it('断層ツールチップのドラッグ開始処理(mousedown/touchstart)がboxZoomMode中は起動しない', () => {
    const idx = html.indexOf('_faultTtMouseHandler = function(ev) {');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    const mouseGuardIdx = block.indexOf('if (boxZoomMode) return;');
    expect(mouseGuardIdx).toBeGreaterThan(-1);
    const touchHandlerIdx = block.indexOf('_faultTtTouchHandler = function(ev) {');
    expect(touchHandlerIdx).toBeGreaterThan(-1);
    expect(block.indexOf('if (boxZoomMode) return;', touchHandlerIdx)).toBeGreaterThan(touchHandlerIdx);
  });

  it('火山ツールチップのドラッグ開始処理(mousedown/touchstart)もboxZoomMode中は起動しない', () => {
    const idx = html.indexOf('_volTtMouseHandler = function(e) {');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 600);
    const mouseGuardIdx = block.indexOf('if (boxZoomMode) return;');
    expect(mouseGuardIdx).toBeGreaterThan(-1);
    const touchHandlerIdx = block.indexOf('_volTtTouchHandler = function(e) {');
    expect(touchHandlerIdx).toBeGreaterThan(-1);
    expect(block.indexOf('if (boxZoomMode) return;', touchHandlerIdx)).toBeGreaterThan(touchHandlerIdx);
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

describe('活断層ページ: エリア巡回完了後にズームが勝手に解除されないこと', () => {
  const html = getWebGLFaultsPage('tester');

  it('stopAreaTour(completed)分岐に zoomTarget = 3.2 のリセットが残っていない', () => {
    const idx = html.indexOf('function stopAreaTour(completed) {');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\n  function applyBoxZoom', idx);
    const block = html.slice(idx, endIdx);
    expect(block).not.toContain('zoomTarget = 3.2;');
  });

  it('completed分岐の他のクリーンアップ処理(エリアメニューを閉じる等)は維持されている', () => {
    const idx = html.indexOf('function stopAreaTour(completed) {');
    const endIdx = html.indexOf('\n  function applyBoxZoom', idx);
    const block = html.slice(idx, endIdx);
    expect(block).toContain('lastBoxBounds = null;');
    expect(block).toContain("boxZoomMode = false;");
    expect(block).toContain("areaTourDrawer.classList.remove('open');");
  });
});

describe('活断層ページ: エリア巡回完了後に地球儀の中心(自転)が勝手に動き出さないこと', () => {
  const html = getWebGLFaultsPage('tester');

  it('flyToLatLon は巡回の各ステップで必ず autoRot を false にする(巡回中は自動回転と競合させない)', () => {
    const idx = html.indexOf('function flyToLatLon(lat, lon, dur, cb) {');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\n  function ', idx + 10);
    const block = html.slice(idx, endIdx);
    expect(block).toContain('autoRot = false;');
  });

  it('stopAreaTour(completed)分岐に autoRot を true へ戻す処理が残っていない(巡回完了直後にflyToLatLonでfalseにされているため、この処理は常に発火してしまい、ユーザーが巡回前に自転を止めていても勝手に自転が再開してしまっていた)', () => {
    const idx = html.indexOf('function stopAreaTour(completed) {');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\n  function applyBoxZoom', idx);
    const block = html.slice(idx, endIdx);
    expect(block).not.toContain('autoRot = true;');
    expect(block).not.toContain("if (!autoRot) {");
  });

  it('autoRot を true にする代入は初期宣言(既定値)以外に存在しない(巡回完了以外の経路でも勝手に自転が再開しない)', () => {
    const matches = html.match(/autoRot\s*=\s*true/g) || [];
    // 唯一の許容箇所: `var axisLocked = false, autoRot = true;` という初期宣言
    expect(matches.length).toBe(1);
    expect(html).toContain('var axisLocked = false, autoRot = true;');
  });
});

describe('活断層ページ: computeLonRange (経度の円環範囲計算)', () => {
  function loadComputeLonRange(html: string) {
    const src = extractFunctionSource(html, 'computeLonRange');
    expect(src, 'computeLonRange が生成HTMLから見つからない').toBeTruthy();
    const fn = new Function(`${src}\nreturn computeLonRange;`);
    return fn();
  }

  const html = getWebGLFaultsPage('tester');
  const computeLonRange = loadComputeLonRange(html);

  it('空配列はnullを返す', () => {
    expect(computeLonRange([])).toBeNull();
  });

  it('通常のクラスタ(日付変更線をまたがない)は単純なmin/maxになる', () => {
    const r = computeLonRange([130, 135, 132, 140, 131]);
    expect(r.lonMin).toBe(130);
    expect(r.lonMax).toBe(140);
    expect(r.lonCross).toBe(false);
  });

  it('日付変更線(±180度)をまたぐクラスタはlonCross=trueで正しい範囲を返す', () => {
    // 実際の値は175〜-175度付近に集中している(180度線をまたぐ)
    const r = computeLonRange([178, 179, -179, -178, 175]);
    expect(r.lonCross).toBe(true);
    expect(r.lonMin).toBe(175);
    expect(r.lonMax).toBe(-178);
  });

  it('単一点は最小=最大でlonCross=falseになる', () => {
    const r = computeLonRange([140]);
    expect(r.lonMin).toBe(140);
    expect(r.lonMax).toBe(140);
    expect(r.lonCross).toBe(false);
  });

  it('世界中に散らばった点(隙間が小さい)でも例外を投げず何らかの範囲を返す', () => {
    const r = computeLonRange([-170, -90, -10, 60, 150]);
    expect(r).not.toBeNull();
    expect(typeof r.lonMin).toBe('number');
    expect(typeof r.lonMax).toBe('number');
  });
});

describe('活断層ページ: applyBoxZoomが矩形の辺上を複数サンプリングして緯度経度範囲を求める', () => {
  const html = getWebGLFaultsPage('tester');

  it('対角2点(c0/c1)のみに依存する旧ロジックが残っていない', () => {
    const idx = html.indexOf('function applyBoxZoom(ex, ey) {');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('\n  function ', idx + 10);
    const block = html.slice(idx, endIdx);
    expect(block).not.toContain('var c0 = screenToLatLon(Math.min(bx0, ex)');
    expect(block).not.toContain('var c1 = screenToLatLon(Math.max(bx0, ex)');
  });

  it('矩形の辺(上下左右)を複数点サンプリングし、screenToLatLonを複数回呼んでいる', () => {
    const idx = html.indexOf('function applyBoxZoom(ex, ey) {');
    const endIdx = html.indexOf('\n  function ', idx + 10);
    const block = html.slice(idx, endIdx);
    expect(block).toContain('EDGE_STEPS');
    expect(block).toContain('[[fx, minY], [fx, maxY], [minX, fy], [maxX, fy]]');
    expect(block).toContain('computeLonRange(lons)');
  });

  it('サンプリング結果が空の場合(latMin>latMaxのまま)はlastBoxBoundsを更新しないガードがある', () => {
    const idx = html.indexOf('function applyBoxZoom(ex, ey) {');
    const endIdx = html.indexOf('\n  function ', idx + 10);
    const block = html.slice(idx, endIdx);
    expect(block).toMatch(/if \(latMin <= latMax && lonRange\)/);
  });
});
