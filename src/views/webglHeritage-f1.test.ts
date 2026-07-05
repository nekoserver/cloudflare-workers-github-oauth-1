import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

describe('getWebGLHeritagePage F1サーキット機能（左サイドパネル）', () => {
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

  it('🏎️ F1ボタンと左サイドパネルの要素が存在する（旧モーダルは廃止）', () => {
    expect(html).toContain('id="btnF1"');
    expect(html).toContain('id="f1-side"');
    expect(html).toContain('class="f1-side"');
    expect(html).toContain('id="f1-side-body"');
    expect(html).toContain('id="f1-side-close"');
    expect(html).toContain('id="f1-tour-btn"');
    expect(html).toContain('function renderF1SidePanel');
    expect(html).not.toContain('id="f1-modal-overlay"');
    expect(html).not.toContain('function renderF1ModalRows');
  });

  // F1_CIRCUITS は src/data/f1Circuits.ts から JSON.stringify で埋め込まれる
  // （コンパクトなJSON形式の1行）ため、JSON.parse でそのまま読み取る。
  const f1Match = html.match(/var F1_CIRCUITS = (\[.*?\]);/);

  it('F1_CIRCUITS がすべて座標・開催日付きで定義されている', () => {
    expect(f1Match).not.toBeNull();
    const circuits = JSON.parse(f1Match![1]);
    expect(circuits.length).toBeGreaterThanOrEqual(20);
    circuits.forEach((c: { gp: string; circuit: string; country: string; date: string; lat: number; lon: number }) => {
      expect(c.gp.length).toBeGreaterThan(0);
      expect(c.circuit.length).toBeGreaterThan(0);
      expect(c.country.length).toBeGreaterThan(0);
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(c.lat)).toBe(true);
      expect(Number.isFinite(c.lon)).toBe(true);
    });
  });

  it('日程が重複しない（同日開催がない）こと', () => {
    const circuits = JSON.parse(f1Match![1]);
    const dates = circuits.map((c: { date: string }) => c.date);
    const uniqueDates = new Set(dates);
    expect(uniqueDates.size).toBe(dates.length);
  });

  it('F1_SORTED は開催日の昇順にソートされる', () => {
    expect(html).toMatch(/var F1_SORTED = F1_CIRCUITS\.slice\(\)\.sort\(function\(a, b\) \{ return a\.date < b\.date \? -1 : \(a\.date > b\.date \? 1 : 0\); \}\);/);
  });

  it('サイドパネルの各行は国旗→サーキット名→(開催日+開催国名)の順で表示する', () => {
    const idx = html.indexOf('function renderF1SidePanel');
    const block = html.slice(idx, idx + 700);
    expect(block).toMatch(/f1-side-flag[\s\S]*?race\.flag[\s\S]*?f1-side-circuit[\s\S]*?race\.circuit[\s\S]*?f1-side-date[\s\S]*?formatF1Date\(race\.date\)[\s\S]*?race\.country/);
    expect(block).toContain("data-idx=\"' + i + '\"");
  });

  it('当日以降で最も早い開催日のサーキットを見つける findUpcomingF1Idx がある', () => {
    expect(html).toContain('function findUpcomingF1Idx()');
    expect(html).toMatch(/var todayStr = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);/);
    expect(html).toMatch(/if \(F1_SORTED\[i\]\.date >= todayStr\) return i;/);
  });

  it('focusF1Circuit は地球儀のフォーカス移動・ピン更新・サイドパネルのアクティブ切替とスクロールを行う', () => {
    const idx = html.indexOf('function focusF1Circuit');
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('flyTo(race.lat, race.lon);');
    expect(block).toContain('zoom = 1.2;');
    expect(block).toContain('f1CircuitPin3d = latLonTo3D(race.lat, race.lon);');
    expect(block).toContain('f1CircuitPinName.textContent = race.flag + \' \' + race.circuit;');
    expect(block).toContain('f1CircuitPinDate.textContent = formatF1Date(race.date);');
    expect(block).toMatch(/classList\.toggle\('active', parseInt\(el\.getAttribute\('data-idx'\), 10\) === idx\)/);
    expect(block).toContain('scrollIntoView(');
  });

  it('🏎️ボタン押下時、サイドパネルを開いて当日以降で最も早いサーキットにフォーカスする', () => {
    const idx = html.indexOf("document.getElementById('btnF1')");
    const block = html.slice(idx, idx + 500);
    expect(block).toContain("f1Side.classList.add('open');");
    expect(block).toContain('renderF1SidePanel();');
    expect(block).toContain('focusF1Circuit(findUpcomingF1Idx(), true);');
  });

  it('再度🏎️ボタンを押すとパネルが閉じ、巡回が停止する', () => {
    const idx = html.indexOf("document.getElementById('btnF1')");
    const block = html.slice(idx, idx + 500);
    expect(block).toMatch(/if \(f1Side\.classList\.contains\('open'\)\) \{\s*f1Side\.classList\.remove\('open'\);\s*stopF1Tour\(\);/);
  });

  it('サイドパネルの✕ボタンでも閉じて巡回が停止する', () => {
    const idx = html.indexOf("document.getElementById('f1-side-close')");
    const block = html.slice(idx, idx + 200);
    expect(block).toContain("f1Side.classList.remove('open');");
    expect(block).toContain('stopF1Tour();');
  });

  it('巡回ボタンで次の開催日のサーキットへ進み、次の開催地の行のみが点滅する（全行点滅はしない）', () => {
    expect(html).toContain('function f1TourStep()');
    const idx = html.indexOf('function f1TourStep()');
    const block = html.slice(idx, idx + 600);
    expect(block).toContain('var nextIdx = f1TourIdx + 1;');
    expect(block).toContain('flashF1SideItem(nextIdx);');
    expect(block).not.toContain('flashAllF1SideItems');
    expect(block).toContain('focusF1Circuit(nextIdx, true);');
    expect(block).toMatch(/f1TourTimer = setTimeout\(f1TourStep, FLY_DUR \+ 5000\);/);

    const flashIdx = html.indexOf('function flashF1SideItem(idx)');
    expect(flashIdx).toBeGreaterThan(-1);
    const flashBlock = html.slice(flashIdx, flashIdx + 400);
    expect(flashBlock).toMatch(/f1SideBody\.querySelector\('\.f1-side-item\[data-idx="' \+ idx \+ '"\]'\)/);
    expect(flashBlock).toContain("el.classList.add('f1-flash');");
    expect(flashBlock).toMatch(/setTimeout\(function\(\) \{ el\.classList\.remove\('f1-flash'\); \}, 1500\);/);
  });

  it('地球儀のフォーカスが次の開催地に到達してから5秒待機する（FLY_DUR＋5000ms）', () => {
    expect(html).toContain('var FLY_DUR = 2500;');
    const idx = html.indexOf('function f1TourStep()');
    const block = html.slice(idx, idx + 600);
    expect(block).toMatch(/f1TourTimer = setTimeout\(f1TourStep, FLY_DUR \+ 5000\);/);
  });

  it('次の開催予定がなくなると巡回は自動的に停止する', () => {
    const idx = html.indexOf('function f1TourStep()');
    const block = html.slice(idx, idx + 300);
    expect(block).toMatch(/if \(nextIdx >= F1_SORTED\.length\) \{ stopF1Tour\(\); return; \}/);
  });

  it('.f1-flash の点滅は outline のみが変化する中抜き枠アニメーションで、3回（0.5s×3回=1.5秒）続く', () => {
    expect(html).toMatch(/@keyframes f1-flash \{ 0%,100%\{outline:2px solid transparent\} 50%\{outline:2px solid #ffd700\} \}/);
    expect(html).toMatch(/\.f1-side-item\.f1-flash \{ animation:f1-flash 0\.5s ease-in-out 3; \}/);
  });

  it('左サイドパネル最上部にカレンダーの要素がある', () => {
    expect(html).toContain('id="f1-cal"');
    // f1-cal は f1-side-head の直後、f1-side-body より前に配置される
    const headIdx = html.indexOf('class="f1-side-head"');
    const calIdx = html.indexOf('id="f1-cal"');
    const bodyIdx = html.indexOf('id="f1-side-body"');
    expect(calIdx).toBeGreaterThan(headIdx);
    expect(calIdx).toBeLessThan(bodyIdx);
  });

  it('renderF1Calendar は年月のカレンダーを描画し、指定日を3回点滅させる', () => {
    expect(html).toContain('function renderF1Calendar(year, month, blinkDay)');
    const idx = html.indexOf('function renderF1Calendar');
    const block = html.slice(idx, idx + 1600);
    expect(block).toContain('f1-cal-target');
    expect(block).toContain("cell.classList.add('f1-cal-flash');");
    expect(block).toMatch(/setTimeout\(function\(\) \{ cell\.classList\.remove\('f1-cal-flash'\); \}, 1500\);/);
  });

  it('パネル最上部の見出しは「📅 F1 日程 2026 🏎️」である', () => {
    expect(html).toContain('<span class="f1-side-title">📅 F1 日程 2026 🏎️</span>');
  });

  it('カレンダーの開催日の表示枠は同月内で次の開催地に移っても消えず、複数日が同時に残る（f1CalMarkedDays）', () => {
    expect(html).toContain('var f1CalMarkedDays = [];');
    const idx = html.indexOf('function renderF1Calendar');
    const block = html.slice(idx, idx + 1600);
    // 月が変わらない限り f1CalMarkedDays をリセットせず、blinkDay を追記していく
    expect(block).toMatch(/if \(year !== f1CalYear \|\| month !== f1CalMonth\) \{\s*f1CalYear = year;\s*f1CalMonth = month;\s*f1CalMarkedDays = \[\];\s*\}/);
    expect(block).toMatch(/if \(blinkDay && f1CalMarkedDays\.indexOf\(blinkDay\) === -1\) f1CalMarkedDays\.push\(blinkDay\);/);
    // 描画時は f1CalMarkedDays に含まれる全ての日付枠を維持する（blinkDay だけでなく）
    expect(block).toMatch(/f1CalMarkedDays\.indexOf\(d\) !== -1 \? ' f1-cal-target' : ''/);
  });

  it('月が変わった場合はカレンダーの表示枠がリセットされる（前月の枠を新しい月に持ち越さない）', () => {
    const idx = html.indexOf('function renderF1Calendar');
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('f1CalYear = year;');
    expect(block).toContain('f1CalMonth = month;');
    expect(block).toContain('f1CalMarkedDays = [];');
  });

  it('🏎️ボタン押下時、アクセスした年月のカレンダーを開き当日の日付を点滅させる', () => {
    const idx = html.indexOf("document.getElementById('btnF1')");
    const block = html.slice(idx, idx + 700);
    expect(block).toMatch(/var today = new Date\(\);\s*renderF1Calendar\(today\.getFullYear\(\), today\.getMonth\(\) \+ 1, today\.getDate\(\)\);/);
  });

  it('巡回の各ステップで次の開催日のカレンダーに切り替わり、その日付も点滅する', () => {
    const idx = html.indexOf('function f1TourStep()');
    const block = html.slice(idx, idx + 600);
    expect(block).toMatch(/var raceDate = new Date\(race\.date \+ 'T00:00:00'\);/);
    expect(block).toMatch(/renderF1Calendar\(raceDate\.getFullYear\(\), raceDate\.getMonth\(\) \+ 1, raceDate\.getDate\(\)\);/);
  });

  it('サーキットタップで地球儀上に🏎️ピンとサーキット名・開催日ツールチップが表示される（既存機構を再利用）', () => {
    expect(html).toContain('id="f1-circuit-pin"');
    expect(html).toContain('id="f1-circuit-pin-label"');
    expect(html).toContain('id="f1-circuit-pin-name"');
    expect(html).toContain('id="f1-circuit-pin-date"');
    expect(html).toContain('var f1CircuitPin3d = null;');
    expect(html).toMatch(/updateWorldPin\(f1CircuitPin3d, f1CircuitPin, f1CircuitPinLabel\);/);
  });

  it('巡回ボタンはツールチップ内（ピンラベル）に配置され、その下に表示される', () => {
    const idx = html.indexOf('id="f1-circuit-pin-label"');
    const block = html.slice(idx, idx + 900);
    const nameIdx = block.indexOf('id="f1-circuit-pin-name"');
    const dateIdx = block.indexOf('id="f1-circuit-pin-date"');
    const btnIdx = block.indexOf('id="f1-tour-btn"');
    expect(nameIdx).toBeGreaterThan(-1);
    expect(dateIdx).toBeGreaterThan(nameIdx);
    expect(btnIdx).toBeGreaterThan(dateIdx);
  });
});
