// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: 世界遺産地球儀(/webgl-heritage)の「💬 ツールチップ」トグルボタン。
// OFFにすると世界遺産マーカーのツールチップ(mk-tooltip)が完全に表示されなくなる。
// showMarkerTooltipはF1・活火山・断層・空港等、他の種別のツールチップ
// (showGenericAreaTooltip)とは独立した世界遺産専用の表示関数であり、
// ここを唯一の入口として全ての表示経路(ホバー・クリック・巡回・深リンク等)を
// 一括で制御する。
// 故障シナリオ:
//   (1) トグルOFFでもtooltip.innerHTMLが書き換わってしまい、
//       一瞬でも内容が見えてしまう(opacity:0だけでは不十分な場合がある)
//   (2) トグルOFFにしても、既に表示中のツールチップが残り続ける(即時非表示にならない)
//   (3) トグルOFFの間、カメラのflyTo(地球儀の移動)まで止まってしまう
//       (ツールチップを消したいだけで、地点へのナビゲーションは維持すべき)
//   (4) OFF→ON復帰後もheritageTooltipVisibleの状態がずれて表示されない
//   (5) F1・活火山等、世界遺産以外のツールチップまで巻き込んで消えてしまう

function extractFn(html: string, name: string, argsPattern: string): string {
  const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n  \\}');
  const m = html.match(re);
  if (!m) throw new Error(name + ' が生成HTMLから見つからない');
  return m[0];
}

function loadShowMarkerTooltip(html: string, heritage: any[], visible: boolean) {
  const src = extractFn(html, 'showMarkerTooltip', 'idx, vx, vy');
  document.body.innerHTML = '<div id="mk-tooltip"></div>';
  const flyToCalls: { lat: number; lon: number }[] = [];
  const positionTooltipCalls: { vx: number; vy: number }[] = [];
  const ctx = {
    HERITAGE: heritage,
    heritageTooltipVisible: visible,
    tooltip: document.getElementById('mk-tooltip')!,
    typeColor: () => '#e3a838',
    hasCityDataSet: {} as Record<string, boolean>,
    heritageMitokoroGemmaShareId: {} as Record<string, string>,
    heritageMitokoroLlamaShareId: {} as Record<string, string>,
    formatRegistrationYearLabel: () => '2020年登録',
    canvasRect: { left: 0, top: 0, width: 100, height: 100 },
    positionTooltip: (vx: number, vy: number) => positionTooltipCalls.push({ vx, vy }),
    startLanding: () => {},
    openHeritageMitokoroCacheModal: () => {},
    flyTo: (lat: number, lon: number) => flyToCalls.push({ lat, lon }),
  };
  const fn = new Function(
    'ctx',
    `
    var HERITAGE = ctx.HERITAGE, heritageTooltipVisible = ctx.heritageTooltipVisible, tooltip = ctx.tooltip,
        typeColor = ctx.typeColor, hasCityDataSet = ctx.hasCityDataSet,
        heritageMitokoroGemmaShareId = ctx.heritageMitokoroGemmaShareId, heritageMitokoroLlamaShareId = ctx.heritageMitokoroLlamaShareId,
        formatRegistrationYearLabel = ctx.formatRegistrationYearLabel, canvasRect = ctx.canvasRect,
        positionTooltip = ctx.positionTooltip, startLanding = ctx.startLanding,
        openHeritageMitokoroCacheModal = ctx.openHeritageMitokoroCacheModal, flyTo = ctx.flyTo;
    var activeIdx = -1;
    ${src}
    return { showMarkerTooltip: showMarkerTooltip, getActiveIdx: function() { return activeIdx; } };
    `
  );
  const api = fn(ctx);
  return { api, ctx, flyToCalls, positionTooltipCalls };
}

const SAMPLE_HERITAGE = [
  { e: '🏛️', f: '🇯🇵', n: '姫路城', c: '日本', t: '文化遺産', y: 1993, lat: 34.84, lon: 134.69 },
];

describe('showMarkerTooltip: 💬トグルOFF時はツールチップを完全に表示しない', () => {
  it('OFFの場合、tooltip.innerHTMLを一切書き換えずopacityを0のままにする', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, ctx } = loadShowMarkerTooltip(html, SAMPLE_HERITAGE, false);
    api.showMarkerTooltip(0, 0, 0);

    expect(ctx.tooltip.innerHTML).toBe('');
    expect(ctx.tooltip.style.opacity).toBe('0');
  });

  it('OFFの場合でもflyTo(カメラ移動)は実行される(消したいのはツールチップだけ)', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, flyToCalls } = loadShowMarkerTooltip(html, SAMPLE_HERITAGE, false);
    api.showMarkerTooltip(0, 0, 0);

    expect(flyToCalls).toEqual([{ lat: 34.84, lon: 134.69 }]);
  });

  it('OFFの場合でもactiveIdxは更新される(選択状態自体は保持する)', () => {
    const html = getWebGLHeritagePage('tester');
    const { api } = loadShowMarkerTooltip(html, SAMPLE_HERITAGE, false);
    api.showMarkerTooltip(0, 0, 0);

    expect(api.getActiveIdx()).toBe(0);
  });

  it('OFFの場合、positionTooltip(座標計算)は呼ばれない(表示処理そのものをスキップする)', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, positionTooltipCalls } = loadShowMarkerTooltip(html, SAMPLE_HERITAGE, false);
    api.showMarkerTooltip(0, 0, 0);

    expect(positionTooltipCalls.length).toBe(0);
  });

  it('ONの場合は従来どおりツールチップ内容が表示される(トグル追加による既存挙動への影響が無い)', () => {
    const html = getWebGLHeritagePage('tester');
    const { api, ctx } = loadShowMarkerTooltip(html, SAMPLE_HERITAGE, true);
    api.showMarkerTooltip(0, 0, 0);

    expect(ctx.tooltip.innerHTML).toContain('姫路城');
    expect(ctx.tooltip.style.opacity).toBe('1');
  });
});

describe('/webgl-heritage ページ: 💬ツールチップトグルボタンのUI組み込み', () => {
  const html = getWebGLHeritagePage('tester');

  it('script タグ内のJSに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('💬ツールチップボタンが存在し、既定でON(activeクラス付き)になっている', () => {
    expect(html).toContain('id="btnHeritageTooltip"');
    const idx = html.indexOf('id="btnHeritageTooltip"');
    const tagStart = html.lastIndexOf('<button', idx);
    const tag = html.slice(tagStart, idx + 40);
    expect(tag).toContain('canvas-ctrl-btn active');
  });

  it('クリックでheritageTooltipVisibleを反転し、activeクラスをその状態に同期する', () => {
    const idx = html.indexOf("btnHeritageTooltip.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('heritageTooltipVisible = !heritageTooltipVisible');
    expect(block).toContain("btnHeritageTooltip.classList.toggle('active', heritageTooltipVisible)");
  });

  it('OFFに切り替えた瞬間、既に表示中のツールチップがあれば即座に非表示にする', () => {
    const idx = html.indexOf("btnHeritageTooltip.addEventListener('click'");
    const block = html.slice(idx, idx + 300);
    expect(block).toMatch(/if \(!heritageTooltipVisible && activeIdx !== -1\) \{ tooltip\.style\.opacity = '0'; \}/);
  });

  it('showMarkerTooltip内でheritageTooltipVisibleを判定するガード節が、コンテンツ組み立てより前に存在する', () => {
    const fnIdx = html.indexOf('function showMarkerTooltip(idx, vx, vy)');
    expect(fnIdx).toBeGreaterThan(-1);
    const guardIdx = html.indexOf('if (!heritageTooltipVisible)', fnIdx);
    const contentIdx = html.indexOf("tooltip.innerHTML = '<div class=\"tt-name\">'", fnIdx);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(contentIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(contentIdx);
  });

  it('毎フレームのマーカー描画ループが、OFF中はactiveIdxのツールチップをopacity 1に戻さない(showMarkerTooltipのガードだけでは次フレームで上書きされてしまうため)', () => {
    const idx = html.indexOf('if (mi === activeIdx) {\n            if (heritageTooltipVisible) {');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 260);
    expect(block).toContain("positionTooltip(canvasRect.left + px, canvasRect.top + py);");
    expect(block).toContain("tooltip.style.opacity = '1';");
    expect(block).toContain("} else {\n              tooltip.style.opacity = '0';\n            }");
  });

  it('自動回転中のマーカー巡回(オートツアー)によるツールチップ自動表示が、OFF中は発動しない', () => {
    const idx = html.indexOf('if (autoRot && isListMode && flyTarget === null');
    expect(idx).toBeGreaterThan(-1);
    const line = html.slice(idx, html.indexOf('\n', idx));
    expect(line).toContain('heritageTooltipVisible');
  });
});
