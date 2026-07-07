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

  it('エリア内判定は全カテゴリで世界遺産と同じ inAreaPointBounds を使う', () => {
    expect(html).toContain('function inAreaPointBounds(lat, lon, b)');
    const filterMatch = html.match(new RegExp('function filterInBounds\\(list, getLatLon\\)[\\s\\S]*?\\n  \\}'));
    expect(filterMatch).not.toBeNull();
    expect(filterMatch![0]).toContain('return inAreaPointBounds(p[0], p[1], b)');
    const stationMatch = html.match(new RegExp('function getStationsInBounds\\(\\)[\\s\\S]*?\\n  \\}'));
    expect(stationMatch).not.toBeNull();
    expect(stationMatch![0]).toContain('if (inAreaPointBounds(st.lat, st.lon, b))');
  });

  it('エリア選択時の画面矩形を保存し、巡回中の再投影ずれを避ける', () => {
    const applyMatch = html.match(new RegExp('function applyBoxZoom[\\s\\S]*?(?=\\n  canvas\\.addEventListener)'));
    expect(applyMatch).not.toBeNull();
    expect(applyMatch![0]).toContain('screenRect: {');
    const rectMatch = html.match(new RegExp('function getAreaScreenRect\\(b\\)[\\s\\S]*?\\n  \\}'));
    expect(rectMatch).not.toBeNull();
    expect(rectMatch![0]).toContain('if (b.screenRect) return b.screenRect');
  });

  it('世界遺産のエリア巡回サイドパネルは固定の🏛️ではなく各遺産のアイコンを使う', () => {
    const kindsMatch = html.match(/var AREA_KINDS = \[[\s\S]*?\n  \];/);
    expect(kindsMatch).not.toBeNull();
    const heritageKindMatch = kindsMatch![0].match(/key: 'heritage'[\s\S]*?(?=\n    \{\s*\n      key: 'station')/);
    expect(heritageKindMatch).not.toBeNull();
    expect(heritageKindMatch![0]).toContain('itemIcon: function(d) { return d.e; }');
    expect(html).toContain('function getAreaItemIcon(kind, item)');
    expect(html).toContain("getAreaItemIcon(kind, item) + '</span>");
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
    const stepMatch = html.match(/function areaTourStep\(kind, items\)[\s\S]*?(?=function applyBoxZoom)/);
    expect(stepMatch).not.toBeNull();
    expect(stepMatch![0]).toContain('flashAreaTourSideItem(areaTourIdx)');
  });

  it('エリア巡回専用の点滅アニメーション(area-tour-flash)を持ち、F1側パネルのf1-flashとは独立して間隔・回数を調整できる', () => {
    // F1側パネル(f1-side-item.f1-flash / f1-cal-cell.f1-cal-flash)には影響を与えない専用キーフレームを使う
    expect(html).toMatch(/@keyframes area-tour-flash \{[^}]*outline:2px solid transparent[\s\S]*?\}/);
    expect(html).toMatch(/\.f1-side-item\.area-tour-flash \{ animation:area-tour-flash [\d.]+s ease-in-out \d+; \}/);
    expect(html).toContain('function flashAreaTourSideItem(idx)');
    const flashMatch = html.match(/function flashAreaTourSideItem\(idx\) \{[\s\S]*?\n  \}/);
    expect(flashMatch).not.toBeNull();
    expect(flashMatch![0]).toContain("classList.add('area-tour-flash')");
    expect(flashMatch![0]).not.toContain("classList.add('f1-flash')");
  });

  it('area-tour-flash の合計点滅時間(周期×回数)と、クラスを外すsetTimeoutの時間が一致する', () => {
    const cssMatch = html.match(/\.f1-side-item\.area-tour-flash \{ animation:area-tour-flash ([\d.]+)s ease-in-out (\d+); \}/);
    expect(cssMatch).not.toBeNull();
    const cycleSeconds = parseFloat(cssMatch![1]);
    const iterations = parseInt(cssMatch![2], 10);
    const totalMs = Math.round(cycleSeconds * iterations * 1000);
    expect(html).toContain('var AREA_TOUR_FLASH_MS = ' + totalMs + ';');
    const flashMatch = html.match(/function flashAreaTourSideItem\(idx\) \{[\s\S]*?\n  \}/);
    expect(flashMatch).not.toBeNull();
    expect(flashMatch![0]).toContain('}, AREA_TOUR_FLASH_MS)');
  });

  it('getStationsInBounds は同名の駅（複数路線に存在する場合）を重複させず1件にまとめる', () => {
    const fnMatch = html.match(/function getStationsInBounds\(\)[\s\S]*?\n  \}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('seenNames');
    expect(fn).toMatch(/if \(seenNames\[st\.name\]\) return;/);
  });

  it('renderAreaTourSide は描画のたびに巡回先一覧の内容に応じてパネル幅を調整する', () => {
    expect(html).toContain('function fitAreaTourSideWidth(kind, items)');
    const renderMatch = html.match(/function renderAreaTourSide\(kind, items\) \{[\s\S]*?\n  \}/);
    expect(renderMatch).not.toBeNull();
    expect(renderMatch![0]).toContain('fitAreaTourSideWidth(kind, items)');
  });

  it('fitAreaTourSideWidth は一番長い項目のラベル幅を基準にパネル幅を決め、行の左右パディングが均等になるようにする', () => {
    const fitMatch = html.match(/function fitAreaTourSideWidth\(kind, items\) \{[\s\S]*?\n  \}/);
    expect(fitMatch).not.toBeNull();
    const fn = fitMatch![0];
    // f1-side-item をそのまま計測に使うことで、実際の行と同じ左右パディング(padding:8px 14px)を前提にできる
    expect(fn).toContain("row.className = 'f1-side-item'");
    expect(fn).toContain('getBoundingClientRect().width');
    expect(fn).toContain("areaTourSide.style.width = width + 'px'");
  });

  it('flashAreaTourSideItem は点滅対象の行をパネル内でスクロールして表示する（巡回先が多い場合に見えなくなる不具合の防止）', () => {
    const flashMatch = html.match(/function flashAreaTourSideItem\(idx\) \{[\s\S]*?\n  \}/);
    expect(flashMatch).not.toBeNull();
    const fn = flashMatch![0];
    const scrollPos = fn.indexOf('scrollAreaTourItemToCursor');
    const flashPos = fn.indexOf("classList.add('area-tour-flash')");
    expect(scrollPos).toBeGreaterThan(-1);
    expect(flashPos).toBeGreaterThan(-1);
    expect(scrollPos).toBeLessThan(flashPos);
  });

  it('駅(station)種別の巡回では地球儀上に🚉ピンを表示する（既存の showRailStationPin を利用する）', () => {
    const kindsMatch = html.match(/var AREA_KINDS = \[[\s\S]*?\n  \];/);
    expect(kindsMatch).not.toBeNull();
    const stationKindMatch = kindsMatch![0].match(/key: 'station'[\s\S]*?(?=\n    \{\s*\n      key: 'f1')/);
    expect(stationKindMatch).not.toBeNull();
    const block = stationKindMatch![0];
    expect(block).toContain("railStationPin.style.display = 'block'");
    expect(block).toContain("railStationPinLabel.style.display = 'block'");
    expect(block).toContain('showRailStationPin(item.line, item.st, item.line.stations.indexOf(item.st))');
  });

  it('駅(station)種別は hideExtra でピンを非表示に戻す', () => {
    const kindsMatch = html.match(/var AREA_KINDS = \[[\s\S]*?\n  \];/);
    expect(kindsMatch).not.toBeNull();
    const stationKindMatch = kindsMatch![0].match(/key: 'station'[\s\S]*?(?=\n    \{\s*\n      key: 'f1')/);
    expect(stationKindMatch).not.toBeNull();
    const block = stationKindMatch![0];
    expect(block).toContain('hideExtra: function()');
    expect(block).toContain("railStationPin.style.display = 'none'");
    expect(block).toContain("railStationPinLabel.style.display = 'none'");
  });

  it('areaTourStep はツールチップを隠すタイミングで種別固有の hideExtra も呼ぶ', () => {
    const stepMatch = html.match(/function areaTourStep\(kind, items\)[\s\S]*?(?=function applyBoxZoom)/);
    expect(stepMatch).not.toBeNull();
    const fn = stepMatch![0];
    const hidePos = fn.indexOf('hideTooltip()');
    const hideExtraPos = fn.indexOf('if (kind.hideExtra) kind.hideExtra()');
    expect(hidePos).toBeGreaterThan(-1);
    expect(hideExtraPos).toBeGreaterThan(hidePos);
  });

  it('stopAreaTour も現在の巡回種別の hideExtra を呼んでからリセットする', () => {
    const stopMatch = html.match(/function stopAreaTour\(completed\) \{[\s\S]*?\n  \}/);
    expect(stopMatch).not.toBeNull();
    const stopFn = stopMatch![0];
    const hideExtraPos = stopFn.indexOf('if (areaTourKind && areaTourKind.hideExtra) areaTourKind.hideExtra()');
    const resetKindPos = stopFn.indexOf('areaTourKind = null');
    expect(hideExtraPos).toBeGreaterThan(-1);
    expect(resetKindPos).toBeGreaterThan(hideExtraPos);
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

  it('applyBoxZoom は選択範囲の中心・左上・右下座標を lastBoxBounds に保存する', () => {
    const applyMatch = html.match(/function applyBoxZoom[\s\S]*?(?=\n  canvas\.addEventListener)/);
    expect(applyMatch).not.toBeNull();
    const fn = applyMatch![0];
    expect(fn).toContain('center: { lat: ctr.lat, lon: ctr.lon }');
    expect(fn).toContain('corner0: { lat: c0.lat, lon: c0.lon }');
    expect(fn).toContain('corner1: { lat: c1.lat, lon: c1.lon }');
  });

  it('areaTourStep は巡回が自然に終わっても completed=false でstopAreaTourを呼び、エリア選択枠を消さない', () => {
    const stepMatch = html.match(/function areaTourStep\(kind, items\)[\s\S]*?(?=function applyBoxZoom)/);
    expect(stepMatch).not.toBeNull();
    expect(stepMatch![0]).toContain('stopAreaTour(false)');
    expect(stepMatch![0]).not.toContain('stopAreaTour(true)');
  });

  it('毎フレーム、選択済みのエリア枠を保存済みの座標から再投影してズームや回転の変化に追従させる（updateBoxOverlayFromBounds）', () => {
    expect(html).toContain('function updateBoxOverlayFromBounds()');
    const fnMatch = html.match(/function updateBoxOverlayFromBounds\(\) \{[\s\S]*?\n    \}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    // ドラッグ中は生の画面座標(updateBoxOverlay)を優先し、再投影で上書きしない
    expect(fn).toContain('if (boxDragging ||');
    expect(fn).toContain('lastBoxBounds.corner0');
    expect(fn).toContain('lastBoxBounds.corner1');
    expect(fn).toContain('projectLatLonToScreen(lastBoxBounds.corner0.lat, lastBoxBounds.corner0.lon)');
    expect(fn).toContain('projectLatLonToScreen(lastBoxBounds.corner1.lat, lastBoxBounds.corner1.lon)');
    // 毎フレーム呼び出される(frame内で即時実行)
    expect(html).toContain('updateBoxOverlayFromBounds();\n\n    if (cityFlyPos3d)');
  });

  it('projectLatLonToScreen は地球の裏側にある座標に対してはnullを返す（枠が誤った位置に描画されるのを防止）', () => {
    const fnMatch = html.match(/function projectLatLonToScreen\(lat, lon\) \{[\s\S]*?\n    \}/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('if (mz <= 0.05) return null;');
    expect(fn).toContain('if (cw <= 0) return null;');
  });

  it('flashAreaTourSideItem はF1側パネル(focusF1Circuit)と同じ .active クラスを現在の巡回先の行にだけ付け、薄緑の背景と緑のアクセント枠を表示する', () => {
    // .f1-side-item.active は F1側パネルと共通のCSSルールを再利用する(背景色・左アクセントとも同一)
    expect(html).toMatch(/\.f1-side-item\.active \{ background:#0c2d1a; border-left-color:#3fb950; \}/);
    const flashMatch = html.match(/function flashAreaTourSideItem\(idx\) \{[\s\S]*?\n  \}/);
    expect(flashMatch).not.toBeNull();
    const fn = flashMatch![0];
    expect(fn).toContain("row.classList.toggle('active', parseInt(row.getAttribute('data-idx'), 10) === idx)");
    // F1側の focusF1Circuit と同じく、全行をクエリしてから対象行だけ active を付与する(他の行からは外れる)
    expect(fn).toContain("areaTourSideBody.querySelectorAll('.f1-side-item').forEach(function(row)");
  });
});
