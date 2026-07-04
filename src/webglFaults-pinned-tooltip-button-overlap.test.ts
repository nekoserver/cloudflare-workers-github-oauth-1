import { describe, it, expect } from 'vitest';
import { getWebGLFaultsPage } from './views/webglFaults';

describe('活断層ページ ピン留めツールチップがキャンバス操作ボタンを覆って押せなくなる問題の修正', () => {
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

  it('getPinnedTooltipMinTop は.canvas-ctrl-btnsの下端を最小Yとして返す', () => {
    expect(html).toContain('function getPinnedTooltipMinTop()');
    const fnMatch = html.match(/function getPinnedTooltipMinTop\(\) \{[\s\S]*?\n  \}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain("document.querySelector('.canvas-ctrl-btns')");
    expect(fn).toContain('getBoundingClientRect().bottom');
  });

  it('pinFaultTooltipは座標をそのまま代入せず、画面内・ボタン列の下にクランプする', () => {
    const fnMatch = html.match(/function pinFaultTooltip\(f, x, y\) \{[\s\S]*?\n  \}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    // 修正前は `faultTooltipEl.style.left = x + 'px';` のように生座標を直接代入していた
    expect(fn).not.toMatch(/faultTooltipEl\.style\.left = x \+ 'px';/);
    expect(fn).not.toMatch(/faultTooltipEl\.style\.top = y \+ 'px';/);
    expect(fn).toContain('var r = faultTooltipEl.getBoundingClientRect();');
    expect(fn).toContain("Math.max(8, Math.min(x - r.width / 2, window.innerWidth - r.width - 8));");
    expect(fn).toContain('Math.max(getPinnedTooltipMinTop(), y - r.height - 10);');
  });

  it('pinVolTooltipも同じくボタン列の下にクランプする（既存の画面端クランプに加えて）', () => {
    const fnMatch = html.match(/function pinVolTooltip\(v, x, y\) \{[\s\S]*?\n  \}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('Math.max(getPinnedTooltipMinTop(), y - r.height - 10);');
  });
});
