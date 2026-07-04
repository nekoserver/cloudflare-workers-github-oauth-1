import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

describe('世界遺産ページ 着陸/途中下車終了後の自転状態の復元', () => {
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

  it('startLanding は flyTo で自転が強制停止される前に現在の自転状態を保存する', () => {
    const idx = html.indexOf('function startLanding(hidx)');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    const saveIdx = fn.indexOf('preLandingAutoRot = autoRot;');
    const flyIdx = fn.indexOf('flyTo(ld.lat, ld.lon);');
    expect(saveIdx).toBeGreaterThan(-1);
    expect(flyIdx).toBeGreaterThan(-1);
    expect(saveIdx).toBeLessThan(flyIdx);
  });

  it('startStationLanding も flyTo の前に現在の自転状態を保存する', () => {
    const idx = html.indexOf('function startStationLanding(');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    const saveIdx = fn.indexOf('preLandingAutoRot = autoRot;');
    const flyIdx = fn.indexOf('flyTo(lat, lon);');
    expect(saveIdx).toBeGreaterThan(-1);
    expect(flyIdx).toBeGreaterThan(-1);
    expect(saveIdx).toBeLessThan(flyIdx);
  });

  it('stopLanding は演出終了後に自転を無条件でONにせず、着陸前の状態(preLandingAutoRot)に復元する', () => {
    const idx = html.indexOf('function stopLanding()');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('autoRot = preLandingAutoRot;');
    expect(fn).not.toContain('autoRot = true;');
  });

  it('着陸/途中下車終了ボタンは共通の stopLanding を呼び出す（両機能に同じ復元ロジックが適用される）', () => {
    expect(html).toMatch(/landingExitBtn\.addEventListener\('click', stopLanding\);/);
  });
});
