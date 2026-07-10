import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getWebGLHeritagePage } from './views/webglHeritage';

// 対象: 世界遺産ページのエリアメニューから「巡回」を選んだ際に左サイドパネル
// (area-tour-side)に表示される各項目。タップ(クリック)したら、その項目の
// 座標へ地球儀の中心をスクロール(flyTo)し、到着後にツールチップ内へ
// 必要なデータを表示する(kind.showTooltip)ようにした。
//
// 実際に生成されたHTMLから renderAreaTourSide / focusAreaTourItem /
// areaTourItemIcon を抽出し、実DOM(jsdom)上でクリックイベントを発火させて
// 挙動を検証する。DOM操作に関わらない周辺関数(flashAreaTourSideItem等)は
// スタブに置き換える。

function extractFunction(html: string, signature: string): string {
  const idx = html.indexOf(signature);
  if (idx < 0) throw new Error(`function not found: ${signature}`);
  let depth = 0;
  let started = false;
  let end = idx;
  for (let i = idx; i < html.length; i++) {
    const ch = html[i];
    if (ch === '{') { depth++; started = true; }
    else if (ch === '}') { depth--; if (started && depth === 0) { end = i + 1; break; } }
  }
  return html.slice(idx, end);
}

type Kind = {
  key: string;
  locate: (d: { lat: number; lon: number }) => [number, number];
  itemLabel: (d: { n: string }) => string;
  itemIcon: (d: { e: string }) => string;
  showTooltip: (d: unknown) => void;
};

describe('世界遺産ページ 巡回サイドパネルの項目タップでflyTo+ツールチップ表示', () => {
  const html = getWebGLHeritagePage('tester');

  function createSandbox(calls: { flyTo: Array<[number, number]>; showTooltip: unknown[] }) {
    const dom = new JSDOM('<!doctype html><body><div id="area-tour-side"><div id="area-tour-side-body"></div></div></body>');
    const document = dom.window.document;
    const areaTourSide = document.getElementById('area-tour-side')!;
    const areaTourSideBody = document.getElementById('area-tour-side-body')!;
    const areaTourSideTitle = { textContent: '' };

    const areaTourItemIconSrc = extractFunction(html, 'function areaTourItemIcon(kind, item)');
    const renderAreaTourSideSrc = extractFunction(html, 'function renderAreaTourSide(kind, items)');
    const focusAreaTourItemSrc = extractFunction(html, 'function focusAreaTourItem(kind, items, idx)');

    const sandbox = new Function(
      'areaTourSide', 'areaTourSideBody', 'areaTourSideTitle',
      'updateAreaTourCollapseButton', 'fitAreaTourSideWidth', 'flashAreaTourSideItem',
      'renderAreaMenu', 'flyTo', 'FLY_DUR',
      `
      var areaTourTimer = null, areaTourRunning = true, areaTourIdx = 0;
      ${areaTourItemIconSrc}
      ${renderAreaTourSideSrc}
      ${focusAreaTourItemSrc}
      return {
        renderAreaTourSide: renderAreaTourSide,
        focusAreaTourItem: focusAreaTourItem,
        getState: function() { return { areaTourTimer: areaTourTimer, areaTourRunning: areaTourRunning, areaTourIdx: areaTourIdx }; }
      };
      `
    )(
      areaTourSide, areaTourSideBody, areaTourSideTitle,
      () => {}, () => {},
      () => {},
      () => {},
      (lat: number, lon: number) => { calls.flyTo.push([lat, lon]); },
      300
    );

    return { dom, areaTourSideBody, sandbox };
  }

  function buildKindStub(calls: { showTooltip: unknown[] }): Kind {
    return {
      key: 'heritage',
      itemLabel: (d) => d.n,
      itemIcon: (d) => d.e,
      locate: (d) => [d.lat, d.lon],
      showTooltip: (d) => { calls.showTooltip.push(d); },
    };
  }

  it('renderAreaTourSideは各項目にクリックイベントを付与する', () => {
    const calls = { flyTo: [] as Array<[number, number]>, showTooltip: [] as unknown[] };
    const { areaTourSideBody, sandbox } = createSandbox(calls);
    const items = [{ n: '姫路城', e: '🇯🇵', lat: 10, lon: 20 }, { n: '大阪城', e: '🇯🇵', lat: 30, lon: 40 }];
    sandbox.renderAreaTourSide(buildKindStub(calls), items);
    const rows = areaTourSideBody.querySelectorAll('.f1-side-item');
    expect(rows.length).toBe(2);
  });

  it('項目をクリックするとその座標へflyToし、到着後にshowTooltipが呼ばれる', async () => {
    vi.useFakeTimers();
    try {
      const calls = { flyTo: [] as Array<[number, number]>, showTooltip: [] as unknown[] };
      const { dom, areaTourSideBody, sandbox } = createSandbox(calls);
      const items = [{ n: '姫路城', e: '🇯🇵', lat: 10, lon: 20 }, { n: '大阪城', e: '🇯🇵', lat: 30, lon: 40 }];
      sandbox.renderAreaTourSide(buildKindStub(calls), items);

      const row = areaTourSideBody.querySelector('.f1-side-item[data-idx="1"]');
      expect(row).not.toBeNull();
      row!.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

      expect(calls.flyTo).toEqual([[30, 40]]);
      expect(calls.showTooltip).toEqual([]);

      await vi.advanceTimersByTimeAsync(400);
      expect(calls.showTooltip).toEqual([items[1]]);
      expect(sandbox.getState().areaTourIdx).toBe(1);
      expect(sandbox.getState().areaTourRunning).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
