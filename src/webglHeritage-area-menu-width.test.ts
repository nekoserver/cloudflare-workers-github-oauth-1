import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産ページ エリアズーム選択後のエリアメニューの幅', () => {
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

  it('エリアメニューは固定width（190px）で生成され、min-widthのみのauto幅指定ではない', () => {
    // 修正前は `min-width:150px` のみで幅がauto指定されており、
    // ボタンのラベル(件数)が大きい(例:世界遺産719件)場合に子要素の
    // width:100%がshrink-to-fit計算では無視されるため、ボタンテキストの
    // 折り返されない自然幅にコンテナ全体が引きずられて肥大化していた
    // (実測: 459px。Playwrightで再現・修正後190pxに収まることを確認済み)。
    const idx = html.indexOf('function showAreaMenu()');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 500);
    expect(fn).toContain('width:190px;');
    expect(fn).not.toContain('min-width:150px');
  });

  it('エリアメニューのボタンは幅100%で固定幅コンテナに収まる（内容量に応じてコンテナ自体が伸縮しない）', () => {
    const idx = html.indexOf("class=\"area-kind-btn\"");
    expect(idx).toBeGreaterThan(-1);
  });
});
