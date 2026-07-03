import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';

describe('活断層ページ エリアズームからの活火山巡回ツールチップ位置ズレ修正', () => {
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

  it('areaTourStep は固定の画面比率(rect.height*0.38等)の代入でツールチップ位置を決めない', () => {
    const stepMatch = html.match(/function areaTourStep\(vols\) \{[\s\S]*?\n  \}/);
    expect(stepMatch).not.toBeNull();
    const fn = stepMatch![0];
    expect(fn).not.toMatch(/var cy = rect\.top \+ rect\.height \* 0\.38;/);
    expect(fn).not.toContain('var cx = rect.left + rect.width / 2;');
  });

  it('areaTourStep は実際の火山マーカー(volDivMap)の座標を基準にpinVolTooltipを呼ぶ（クリック時と同じ基準）', () => {
    const stepMatch = html.match(/function areaTourStep\(vols\) \{[\s\S]*?\n  \}/);
    expect(stepMatch).not.toBeNull();
    const fn = stepMatch![0];
    expect(fn).toContain('var el = volDivMap[v.id];');
    expect(fn).toContain('var r = el.getBoundingClientRect();');
    expect(fn).toContain('pinVolTooltip(v, r.left + r.width / 2, r.top - 8);');
  });

  it('areaTourStep はフライ完了直後ではなく1フレーム後にマーカー座標を読む（前フレームの古い位置を使わないため）', () => {
    const stepMatch = html.match(/function areaTourStep\(vols\) \{[\s\S]*?\n  \}/);
    expect(stepMatch).not.toBeNull();
    const fn = stepMatch![0];
    const flyPos = fn.indexOf('flyToLatLon(');
    const rafPos = fn.indexOf('requestAnimationFrame(function()', flyPos);
    const pinPos = fn.indexOf('pinVolTooltip(', rafPos);
    expect(flyPos).toBeGreaterThan(-1);
    expect(rafPos).toBeGreaterThan(flyPos);
    expect(pinPos).toBeGreaterThan(rafPos);
  });

  it('pinVolTooltip の呼び出し方は通常のクリック操作(マーカークリック時)と一致する', () => {
    const clickCallIdx = html.indexOf("pinVolTooltip(v, r.left + r.width / 2, r.top - 8);");
    const occurrences = (html.match(/pinVolTooltip\(v, r\.left \+ r\.width \/ 2, r\.top - 8\);/g) || []).length;
    expect(clickCallIdx).toBeGreaterThan(-1);
    // クリックハンドラとareaTourStepの両方で同一の呼び出し形式が使われている
    expect(occurrences).toBe(2);
  });
});
