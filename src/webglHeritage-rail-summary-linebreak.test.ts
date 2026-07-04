import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産ページ 鉄道路線サイドパネルの路線名表示', () => {
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

  it('renderRailSideBody は路線名の「(」の前に改行(<br>)を挿入して表示する', () => {
    const idx = html.indexOf('function renderRailSideBody');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain("line.name.replace('(', '<br>(')");
    expect(fn).toContain('rail-line-summary');
  });

  it('data-line 属性には改行タグを含まない生の line.name をそのまま使う（駅ピン表示用データが壊れないように）', () => {
    const idx = html.indexOf('function renderRailSideBody');
    const fn = html.slice(idx, idx + 1600);
    expect(fn).toMatch(/data-line="\s*'\s*\+\s*line\.flag\s*\+\s*' '\s*\+\s*line\.name\s*\+\s*'"/);
  });
});
