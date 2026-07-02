import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

describe('getWebGLHeritagePage エリアズーム機能（種別ごとの巡回に汎用化）', () => {
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

  it('AREA_KINDS に世界遺産・駅・F1会場・活火山・活断層の5種別が定義されている', () => {
    const kindsMatch = html.match(/var AREA_KINDS = \[[\s\S]*?\n  \];/);
    expect(kindsMatch).not.toBeNull();
    const block = kindsMatch![0];
    expect(block).toContain("key: 'heritage'");
    expect(block).toContain("key: 'station'");
    expect(block).toContain("key: 'f1'");
    expect(block).toContain("key: 'volcano'");
    expect(block).toContain("key: 'fault'");
    expect(block).toContain("label: '世界遺産'");
    expect(block).toContain("label: '駅'");
    expect(block).toContain("label: 'F1会場'");
    expect(block).toContain("label: '活火山'");
    expect(block).toContain("label: '活断層'");
  });

  it('種別ごとのエリア内絞り込み関数がすべて存在する', () => {
    expect(html).toContain('function getHeritagesInBounds()');
    expect(html).toContain('function getStationsInBounds()');
    expect(html).toContain('function getF1InBounds()');
    expect(html).toContain('function getVolcanoesInBounds()');
    expect(html).toContain('function getFaultsInBounds()');
  });

  it('巡回ロジック（areaTourStep/startAreaTour/stopAreaTour）は種別ごとに複製されず、共通関数として1つだけ定義されている（外部関数化・汎用化）', () => {
    const occurrences = (re: RegExp) => (html.match(re) || []).length;
    expect(occurrences(/function areaTourStep\(/g)).toBe(1);
    expect(occurrences(/function startAreaTour\(/g)).toBe(1);
    expect(occurrences(/function stopAreaTour\(/g)).toBe(1);
    // areaTourStep / startAreaTour は種別設定(kind)を引数として受け取る汎用関数である
    expect(html).toContain('function startAreaTour(kind)');
    expect(html).toContain('function areaTourStep(kind, items)');
  });

  it('VOLCANOES・FAULTS のデータが埋め込まれている', () => {
    expect(html).toMatch(/var VOLCANOES = \[/);
    expect(html).toContain('"id":"fujisan"');
    expect(html).toMatch(/var FAULTS = \[/);
    expect(html).toContain('"id":"san_andreas"');
  });

  it('エリアメニューのボタンはエリア内が2件未満の種別を表示しない', () => {
    const renderMatch = html.match(/function renderAreaMenu\(\)[\s\S]*?\n  \}/);
    expect(renderMatch).not.toBeNull();
    expect(renderMatch![0]).toContain('if (e.items.length < 2) return');
  });

  it('エリアメニューのボタンは「アイコン 種別名(件数)」の形式で表示される', () => {
    const renderMatch = html.match(/function renderAreaMenu\(\)[\s\S]*?\n  \}/);
    expect(renderMatch).not.toBeNull();
    expect(renderMatch![0]).toContain("e.kind.icon + ' ' + e.kind.label + '(' + e.items.length + ')'");
  });

  it('種別ボタンを押した直後にその種別だけを対象とした巡回が始まる', () => {
    const renderMatch = html.match(/function renderAreaMenu\(\)[\s\S]*?\n  \}/);
    expect(renderMatch).not.toBeNull();
    // ボタンクリック時、他の種別を経由せず直接 startAreaTour(kind) が呼ばれる
    expect(renderMatch![0]).toMatch(/startAreaTour\(kind\)/);
  });

  it('areaTourStep がフライ完了後にツールチップを表示するネスト構造を持つ', () => {
    // flyTo → setTimeout(FLY_DUR+100) → tooltip 表示 → setTimeout(5000) → hideTooltip → next
    expect(html).toContain('FLY_DUR + 100');
    expect(html).toMatch(/function areaTourStep\(kind, items\)[\s\S]{0,3000}hideTooltip/);
  });

  it('stopAreaTour が完了時以外でも hideTooltip を呼ぶ', () => {
    const stopMatch = html.match(/function stopAreaTour\(completed\) \{[\s\S]*?\n  \}/);
    expect(stopMatch).not.toBeNull();
    const stopFn = stopMatch![0];
    const hidePos = stopFn.indexOf('hideTooltip');
    const completedPos = stopFn.indexOf('if (completed)');
    expect(hidePos).toBeGreaterThan(-1);
    expect(completedPos).toBeGreaterThan(-1);
    expect(hidePos).toBeLessThan(completedPos);
  });

  it('stopAreaTour は巡回終了後も自転モードを勝手に再開しない', () => {
    const stopMatch = html.match(/function stopAreaTour\(completed\) \{[\s\S]*?\n  \}/);
    expect(stopMatch).not.toBeNull();
    expect(stopMatch![0]).not.toContain('autoRot = true');
  });

  it('stopAreaTour は完了時にエリア選択枠(box-select-overlay)とエリア巡回サイドパネルを非表示にする', () => {
    const stopMatch = html.match(/function stopAreaTour\(completed\) \{[\s\S]*?\n  \}/);
    expect(stopMatch).not.toBeNull();
    const stopFn = stopMatch![0];
    expect(stopFn).toContain("boxZoomOverlay.style.display = 'none'");
    expect(stopFn).toContain("areaTourSide.classList.remove('open')");
  });

  it('stopAreaTour は巡回状態を解除してエリアメニューを再描画する', () => {
    const stopMatch = html.match(/function stopAreaTour\(completed\) \{[\s\S]*?\n  \}/);
    expect(stopMatch).not.toBeNull();
    const stopFn = stopMatch![0];
    expect(stopFn).toContain('areaTourRunning = false');
    expect(stopFn).toContain('areaTourKind = null');
    expect(stopFn).toContain('renderAreaMenu()');
  });

  it('areaTourStep 内でズームを強制変更しない（巡回中のズーム解除防止）', () => {
    const stepMatch = html.match(/function areaTourStep\(kind, items\)[\s\S]*?(?=function applyBoxZoom)/);
    expect(stepMatch).not.toBeNull();
    const fn = stepMatch![0];
    expect(fn).not.toMatch(/zoom\s*=\s*Math\.(min|max)/);
  });

  it('applyBoxZoom は有効な選択範囲に対してエリア選択枠(box-select-overlay)を消さずに残す', () => {
    const applyMatch = html.match(/function applyBoxZoom[\s\S]*?(?=\n  canvas\.addEventListener)/);
    expect(applyMatch).not.toBeNull();
    const fn = applyMatch![0];
    // 早期returnのガード節でのみ非表示にし、有効な選択が完了した後の本体では非表示にしない
    const guardHideCount = (fn.match(/\{ boxZoomOverlay\.style\.display = 'none'; return; \}/g) || []).length;
    expect(guardHideCount).toBe(2);
    expect(fn).toContain('updateBoxOverlay()');
  });

  it('area-tour-side パネルのDOM要素が存在する', () => {
    expect(html).toContain('id="area-tour-side"');
    expect(html).toContain('id="area-tour-side-title"');
    expect(html).toContain('id="area-tour-side-body"');
    expect(html).toContain('id="area-tour-side-close"');
  });

  it('AREA_KINDS の各種別に左サイドパネル表示用の itemLabel が定義されている', () => {
    const kindsMatch = html.match(/var AREA_KINDS = \[[\s\S]*?\n  \];/);
    expect(kindsMatch).not.toBeNull();
    const occurrences = (kindsMatch![0].match(/itemLabel:/g) || []).length;
    expect(occurrences).toBe(5);
  });

  it('startAreaTour は巡回開始時に左サイドパネルへ巡回先一覧を描画する', () => {
    expect(html).toContain('function renderAreaTourSide(kind, items)');
    const startMatch = html.match(/function startAreaTour\(kind\) \{[\s\S]*?\n  \}/);
    expect(startMatch).not.toBeNull();
    expect(startMatch![0]).toContain('renderAreaTourSide(kind, items)');
  });

  it('areaTourStep は巡回先へ移動するたびに左サイドパネルの該当行を点滅させる', () => {
    expect(html).toContain('function flashAreaTourSideItem(idx)');
    // f1-flash と同じキーフレーム(黄色い中抜き枠を3回点滅)を再利用する
    expect(html).toMatch(/@keyframes f1-flash \{ 0%,100%\{outline:2px solid transparent\} 50%\{outline:2px solid #ffd700\} \}/);
    expect(html).toMatch(/\.f1-side-item\.f1-flash \{ animation:f1-flash 0\.5s ease-in-out 3; \}/);
    const stepMatch = html.match(/function areaTourStep\(kind, items\)[\s\S]*?(?=function applyBoxZoom)/);
    expect(stepMatch).not.toBeNull();
    expect(stepMatch![0]).toContain('flashAreaTourSideItem(areaTourIdx)');
  });

  it('applyBoxZoom がフライ後に setTimeout でズームとメニューを適用する', () => {
    const applyMatch = html.match(/function applyBoxZoom[\s\S]*?(?=\n  canvas\.addEventListener)/);
    expect(applyMatch).not.toBeNull();
    const fn = applyMatch![0];
    const flyPos = fn.indexOf('flyTo(');
    const setTimeoutPos = fn.indexOf('setTimeout', flyPos);
    expect(flyPos).toBeGreaterThan(-1);
    expect(setTimeoutPos).toBeGreaterThan(flyPos);
    const showMenuPos = fn.indexOf('showAreaMenu', setTimeoutPos);
    expect(showMenuPos).toBeGreaterThan(setTimeoutPos);
  });
});
