import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

describe('getWebGLHeritagePage 「📅今週の世界遺産」機能（左サイドパネル）', () => {
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

  it('📅今週の世界遺産ボタンと左サイドパネルの要素が存在する', () => {
    expect(html).toContain('id="btnWeeklyHeritage"');
    expect(html).toContain('📅今週の世界遺産');
    expect(html).toContain('id="weekly-heritage-side"');
    expect(html).toContain('class="f1-side"');
    expect(html).toContain('id="weekly-heritage-side-body"');
    expect(html).toContain('id="weekly-heritage-side-close"');
  });

  it('左サイドパネル最上部にカレンダーの要素があり、下段にリストがある', () => {
    expect(html).toContain('id="weekly-heritage-cal"');
    const headIdx = html.indexOf('id="weekly-heritage-side"');
    const calIdx = html.indexOf('id="weekly-heritage-cal"');
    const bodyIdx = html.indexOf('id="weekly-heritage-side-body"');
    expect(calIdx).toBeGreaterThan(headIdx);
    expect(calIdx).toBeLessThan(bodyIdx);
  });

  it('renderWeeklyHeritageCalendar はアクセス日を含む月のカレンダーを描画し、当日の日付枠を3回点滅させた後、黄色の枠で固定する', () => {
    expect(html).toContain('function renderWeeklyHeritageCalendar(year, month, day)');
    const idx = html.indexOf('function renderWeeklyHeritageCalendar');
    const block = html.slice(idx, idx + 1400);
    expect(block).toContain("cell.classList.add('f1-cal-flash')");
    expect(block).toMatch(/setTimeout\(function\(\) \{[\s\S]*?cell\.classList\.remove\('f1-cal-flash'\);[\s\S]*?cell\.classList\.add\('wh-cal-today'\);[\s\S]*?\}, 1500\);/);
  });

  it('.wh-cal-today は黄色い枠が永続的に固定されるスタイルである', () => {
    expect(html).toMatch(/\.f1-cal-cell\.wh-cal-today\s*\{\s*outline:2px solid #ffd700;\s*\}/);
  });

  it('function findWeeklyHeritageMatches はアクセス日の7日後の月日(md)が一致する世界遺産だけを返す純粋関数である', () => {
    expect(html).toContain('function findWeeklyHeritageMatches(baseDate)');
    const idx = html.indexOf('function findWeeklyHeritageMatches');
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('target.setDate(target.getDate() + 7)');
    expect(block).toContain('h.md === targetMd');
  });

  it('renderWeeklyHeritageList は国名・制定日とともに表示し、行タップでflyTo→ツールチップの順で実行する', () => {
    expect(html).toContain('function renderWeeklyHeritageList()');
    const idx = html.indexOf('function renderWeeklyHeritageList');
    const block = html.slice(idx, idx + 1600);
    expect(block).toContain('f1-side-item');
    expect(block).toContain('data-idx');
    expect(block).toContain('flyTo(');
    expect(block).toMatch(/setTimeout\(function\(\) \{\s*showMarkerTooltip\(/);
    expect(block).toContain('FLY_DUR + 100');
  });

  it('📅今週の世界遺産ボタン押下時、パネルを開いてアクセス日のカレンダーと7日後一致リストを表示する', () => {
    const idx = html.indexOf("document.getElementById('btnWeeklyHeritage')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("weeklyHeritageSide.classList.add('open')");
    expect(block).toMatch(/renderWeeklyHeritageCalendar\(today\.getFullYear\(\), today\.getMonth\(\) \+ 1, today\.getDate\(\)\)/);
    expect(block).toContain('renderWeeklyHeritageList()');
  });

  it('再度ボタンを押すとパネルが閉じる', () => {
    const idx = html.indexOf("document.getElementById('btnWeeklyHeritage')");
    const block = html.slice(idx, idx + 700);
    expect(block).toMatch(/if \(weeklyHeritageSide\.classList\.contains\('open'\)\) \{\s*weeklyHeritageSide\.classList\.remove\('open'\);\s*return;\s*\}/);
  });

  it('✕ボタンでも閉じる', () => {
    const idx = html.indexOf("document.getElementById('weekly-heritage-side-close')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 200);
    expect(block).toContain("weeklyHeritageSide.classList.remove('open')");
  });
});
