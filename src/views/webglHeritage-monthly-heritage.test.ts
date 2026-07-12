import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

describe('getWebGLHeritagePage 「📅今月の世界遺産」機能（左サイドパネル）', () => {
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

  it('📅今月の世界遺産ボタンと左サイドパネルの要素が存在する', () => {
    expect(html).toContain('id="btnMonthlyHeritage"');
    expect(html).toContain('📅今月の世界遺産');
    expect(html).toContain('id="monthly-heritage-side"');
    expect(html).toContain('class="f1-side"');
    expect(html).toContain('id="monthly-heritage-side-body"');
    expect(html).toContain('id="monthly-heritage-side-close"');
    expect(html).toContain('<span class="f1-side-title">📅 今月の世界遺産</span>');
    expect(html).not.toContain('btnWeeklyHeritage');
    expect(html).not.toContain('weekly-heritage-side');
  });

  it('左サイドパネル最上部にカレンダーの要素があり、下段にリストがある', () => {
    expect(html).toContain('id="monthly-heritage-cal"');
    const headIdx = html.indexOf('id="monthly-heritage-side"');
    const calIdx = html.indexOf('id="monthly-heritage-cal"');
    const bodyIdx = html.indexOf('id="monthly-heritage-side-body"');
    expect(calIdx).toBeGreaterThan(headIdx);
    expect(calIdx).toBeLessThan(bodyIdx);
  });

  it('renderMonthlyHeritageCalendar はアクセス日を含む月のカレンダーを描画し、当日の日付枠を3回点滅させた後、黄色の枠で固定する', () => {
    expect(html).toContain('function renderMonthlyHeritageCalendar(year, month, day)');
    const idx = html.indexOf('function renderMonthlyHeritageCalendar');
    const block = html.slice(idx, idx + 1400);
    expect(block).toContain("cell.classList.add('f1-cal-flash')");
    expect(block).toMatch(/setTimeout\(function\(\) \{[\s\S]*?cell\.classList\.remove\('f1-cal-flash'\);[\s\S]*?cell\.classList\.add\('mh-cal-today'\);[\s\S]*?\}, 1500\);/);
  });

  it('.mh-cal-today は黄色い枠が永続的に固定されるスタイルである', () => {
    expect(html).toMatch(/\.f1-cal-cell\.mh-cal-today\s*\{\s*outline:2px solid #ffd700;\s*\}/);
  });

  it('function daysUntilNextMd はmd(MM-DD)から基準日までの最短の今後の日数を返す純粋関数である', () => {
    expect(html).toContain('function daysUntilNextMd(mmdd, baseDate)');
  });

  function extractFindFn(): (baseDate: Date) => any[] {
    const startIdx = html.indexOf('function pad2(');
    const endMarker = 'function renderMonthlyHeritageList()';
    const endIdx = html.indexOf(endMarker);
    const src = html.slice(startIdx, endIdx);
    const varHeritageMatch = html.match(/var HERITAGE = (\[.*?\]);/);
    if (!varHeritageMatch) throw new Error('HERITAGE not found');
    const fn = new Function(`
      var HERITAGE = ${varHeritageMatch[1]};
      ${src}
      return findMonthlyHeritageMatches;
    `);
    return fn();
  }

  it('今日以降30日以内が制定日(md)の世界遺産があれば、それらだけを近い順に返す', () => {
    const findMonthlyHeritageMatches = extractFindFn();
    // 基準日: 2026-07-05 → 7日後の 07-12 (ドムス・デ・ジャナス) は30日以内なので該当する
    const matches = findMonthlyHeritageMatches(new Date(2026, 6, 5));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((h: any) => h.md)).toBe(true);
    const names = matches.map((h: any) => h.n);
    expect(names).toContain('サルデーニャ先史時代の葬送伝統－ドムス・デ・ジャナス');
    // 30日超のものは含まれない
    expect(names).not.toContain('北アペニン山脈の石膏カルストと洞窟群'); // md:09-19、07-05から30日以内ではない
  });

  it('30日以内に該当する世界遺産が無い場合、md判別済みの全世界遺産をアクセス日から一番近いMM-DD順に返す', () => {
    const findMonthlyHeritageMatches = extractFindFn();
    // 基準日: 08-01を基準にすると次のmdは09-05(ローマ歴史地区、35日後)で30日を超えるため、
    // フォールバックでmd判別済み全件が返るはず。
    const base = new Date(2026, 7, 1); // 2026-08-01
    const matches = findMonthlyHeritageMatches(base);
    expect(matches.length).toBeGreaterThanOrEqual(27);
    // 近い順にソートされている: 09-05(ローマ歴史地区)が先頭に来るはず
    expect(matches[0].md).toBe('09-05');
  });

  it('renderMonthlyHeritageList は国名・制定日とともに表示し、行タップでflyTo→ツールチップの順で実行する', () => {
    expect(html).toContain('function renderMonthlyHeritageList()');
    const idx = html.indexOf('function renderMonthlyHeritageList');
    const block = html.slice(idx, idx + 1600);
    expect(block).toContain('f1-side-item');
    expect(block).toContain('data-idx');
    expect(block).toContain('flyTo(');
    expect(block).toMatch(/setTimeout\(function\(\) \{\s*showMarkerTooltip\(/);
    expect(block).toContain('FLY_DUR + 100');
  });

  it('📅今月の世界遺産ボタン押下時、パネルを開いてアクセス日のカレンダーと一覧を表示する', () => {
    const idx = html.indexOf("document.getElementById('btnMonthlyHeritage')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 700);
    expect(block).toContain("monthlyHeritageSide.classList.add('open')");
    expect(block).toMatch(/renderMonthlyHeritageCalendar\(today\.getFullYear\(\), today\.getMonth\(\) \+ 1, today\.getDate\(\)\)/);
    expect(block).toContain('renderMonthlyHeritageList()');
  });

  it('再度ボタンを押すとパネルが閉じる', () => {
    const idx = html.indexOf("document.getElementById('btnMonthlyHeritage')");
    const block = html.slice(idx, idx + 700);
    expect(block).toMatch(/if \(monthlyHeritageSide\.classList\.contains\('open'\)\) \{\s*monthlyHeritageSide\.classList\.remove\('open'\);\s*return;\s*\}/);
  });

  it('✕ボタンでも閉じる', () => {
    const idx = html.indexOf("document.getElementById('monthly-heritage-side-close')");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 200);
    expect(block).toContain("monthlyHeritageSide.classList.remove('open')");
  });
});
