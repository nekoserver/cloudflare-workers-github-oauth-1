import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';

// 対象: 活断層ページ(/webgl-faults)の (1) 断層ツールチップの「×」閉じるボタンの
// タップ有効エリア、(2) 地球儀のズーム最大レベル(最も寄れる距離)。
//
// 背景(1): #faultTtClose の当たり判定はCSSのpadding分がそのままクリック可能領域になる
// (負のmarginはレイアウト上の見た目のサイズを縮めるだけで、要素自身のクリック判定は
// padding込みのボーダーボックスがそのまま有効)。実ブラウザ(Playwright)で検証した結果、
// 変更前は 31.7×34px（padding:10px相当）で、モバイルのタップ目安とされる44×44pxを
// 下回っていた。padding を 15px に広げることで 14px(フォント)+15px×2 ≒ 44px の
// タップ領域を確保した。
//
// 背景(2): zoomTarget(カメラ距離。小さいほど寄っている)の下限が Math.max(1.4, ...) で
// 固定されており、ホイール・ピンチ・エリアズームのいずれでもこれ以上は寄れなかった。
// 依頼により下限を1.2まで引き下げ(=最大ズームレベルを引き上げ)た。
//
// 故障シナリオ:
//   (1) padding だけ広げてmarginを調整し忘れ、ヘッダーの見た目が大きく崩れる
//   (2) ホイール・ピンチ・エリアズームの3箇所のうち一部だけ1.2に変更し、
//       操作方法によって最大ズームレベルが不一致になる
//   (3) 下限を下げすぎて/上げすぎて、初期ズーム(3.2)や最大ズームアウト(20)側の
//       挙動に影響してしまう

describe('活断層ページ: 断層ツールチップ「×」ボタンのタップ有効エリア拡大', () => {
  const html = getWebGLFaultsPage('tester');

  it('.fault-tt-close の padding が15pxに拡大されている', () => {
    const idx = html.indexOf('.fault-tt-close {');
    expect(idx).toBeGreaterThan(-1);
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    expect(rule).toContain('padding:15px');
  });

  it('負のmarginを併用して見た目のヘッダー高さの増加を抑えている', () => {
    const idx = html.indexOf('.fault-tt-close {');
    const rule = html.slice(idx, html.indexOf('}', idx) + 1);
    expect(rule).toMatch(/margin:-6px -8px -6px 0/);
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

describe('活断層ページ: 最大ズームレベルの引き上げ(1.4 → 1.2)', () => {
  const html = getWebGLFaultsPage('tester');

  it('ホイール・ピンチ・エリアズームの3箇所すべてで下限が1.2になっている', () => {
    expect(html).toContain('Math.max(1.2, zoom * fraction)');
    expect(html).toContain('zoomTarget=Math.max(1.2,Math.min(20,zoomTarget+e.deltaY*0.006))');
    expect(html).toContain('zoomTarget=Math.max(1.2,Math.min(20,zoomTarget-(d-pinch0)*0.008))');
  });

  it('旧の下限値1.4がズームクランプとして残っていない', () => {
    expect(html).not.toContain('Math.max(1.4,');
    expect(html).not.toContain('Math.max(1.4, ');
  });

  it('最大ズームアウト側の上限(20)や初期ズーム(3.2)は変更されていない', () => {
    expect(html).toContain('rotXv = 0.3, rotYv = 0.6, zoom = 3.2, zoomTarget = 3.2');
    expect(html).toContain('Math.min(20,zoomTarget+e.deltaY*0.006)');
    expect(html).toContain('Math.min(20,zoomTarget-(d-pinch0)*0.008)');
  });
});
