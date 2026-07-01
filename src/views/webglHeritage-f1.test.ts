import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

describe('getWebGLHeritagePage F1サーキット機能', () => {
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

  it('🏎️ F1ボタンとモーダルの要素が存在する', () => {
    expect(html).toContain('id="btnF1"');
    expect(html).toContain('id="f1-modal-overlay"');
    expect(html).toContain('id="f1-modal-body"');
    expect(html).toContain('id="f1-modal-close"');
    expect(html).toContain('function renderF1ModalRows');
  });

  const f1BlockMatch = html.match(/var F1_CIRCUITS = (\[[\s\S]*?\]);\s*\n\s*function typeColor/);

  it('F1_CIRCUITS がすべて座標・開催日付きで定義されている', () => {
    expect(f1BlockMatch).not.toBeNull();
    const block = f1BlockMatch![1];
    const entries = Array.from(block.matchAll(/\{ gp:'([^']+)', circuit:'([^']+)', flag:'[^']+', country:'([^']+)', date:'(\d{4}-\d{2}-\d{2})', lat:(-?[\d.]+), lon:(-?[\d.]+) \}/g));
    expect(entries.length).toBeGreaterThanOrEqual(20);
    entries.forEach((e) => {
      expect(e[1].length).toBeGreaterThan(0);
      expect(e[2].length).toBeGreaterThan(0);
      expect(e[3].length).toBeGreaterThan(0);
      expect(Number.isFinite(parseFloat(e[5]))).toBe(true);
      expect(Number.isFinite(parseFloat(e[6]))).toBe(true);
    });
  });

  it('日程が重複しない（同日開催がない）こと', () => {
    const block = f1BlockMatch![1];
    const dates = Array.from(block.matchAll(/date:'(\d{4}-\d{2}-\d{2})'/g)).map((m) => m[1]);
    const uniqueDates = new Set(dates);
    expect(uniqueDates.size).toBe(dates.length);
  });

  it('モーダルは開催日の昇順にソートして表示する', () => {
    const idx = html.indexOf('function renderF1ModalRows');
    const block = html.slice(idx, idx + 700);
    expect(block).toMatch(/\.sort\(function\(a, b\) \{ return a\.date < b\.date \? -1 : \(a\.date > b\.date \? 1 : 0\); \}\)/);
  });

  it('各行に開催国名・開催日が表示される', () => {
    const idx = html.indexOf('function renderF1ModalRows');
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('race.country');
    expect(block).toContain('formatF1Date(race.date)');
  });

  it('駅タップと同様に、行タップで地球儀を最大ズームで中心移動させる', () => {
    expect(html).toContain('f1-circuit-row');
    expect(html).toMatch(/f1ModalBody\.querySelectorAll\('\.f1-circuit-row'\)/);
    expect(html).toMatch(/f1ModalOverlay\.classList\.remove\('open'\);\s*flyTo\(lat, lon\);\s*zoom = 1\.2;/);
  });
});
