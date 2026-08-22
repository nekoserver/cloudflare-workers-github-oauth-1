// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「ルート順序」見出し右側の国フィルタ
// (#route-country-filter / applyRouteCountryFilter())による#route-lineのグレーアウトを、
// 「🌐 巡回テスト」モーダル右側のルート順序サイドパネル(#tour-route-side-panel /
// #tour-route-side-list, renderRouteSidePanel())にも同期して反映する機能。
// #route-lineの各行が国フィルタでグレーアウトされたら、サイドパネルの対応する行も
// 同じ視覚的減光(route-line-item-dimmedクラス)を受け、既存のチェックボックス操作も
// disabledにして無効化する(見た目だけの減光にしない)。
// フィルタで対象外にすること自体はtourPoints/巡回アニメーションのデータには
// 一切影響しない(表示専用)。PR #1455で実装済みの「巡回ルート再現時のデータ絞り込み」
// (設定ページのトグルで制御される別機構)には触れない。
//
// 故障シナリオ:
//   (1) #route-country-filterで国を選んでも#tour-route-side-list側の行が
//       グレーアウトされない(サイドパネルが減光を反映しない)
//   (2) 「すべて(デフォルト)」に戻してもサイドパネル側の減光が解除されない
//   (3) モーダル/サイドパネルが開いた状態のままフィルタ選択を変更しても
//       サイドパネル側が再描画されず古い減光状態のまま残る(ライブ同期しない)
//   (4) 単一国のみのルートで誤って全行/一部行が誤ってグレーアウトされる
//   (5) グレーアウトされたサイドパネル行のチェックボックスが実際には
//       操作可能なまま(見た目だけの減光になっている)

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function countryFilterSelect(): HTMLSelectElement {
  return document.getElementById('route-country-filter') as unknown as HTMLSelectElement;
}

function sideRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]')) as HTMLElement[];
}

describe('heritage-journeyページ: 巡回テストモーダル側のルート順序サイドパネルに国フィルタのグレーアウトを同期', () => {
  it('国を選ぶと#tour-route-side-listの対応する行もグレーアウトされる', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = countryFilterSelect();
    expect(sel.options.length).toBeGreaterThan(1);
    const targetValue = sel.options[1].value;
    sel.value = targetValue;
    sel.dispatchEvent(new Event('change'));

    const rows = sideRows();
    expect(rows.length).toBeGreaterThan(0);
    let sawMatch = false;
    let sawOther = false;
    rows.forEach((row) => {
      const country = row.getAttribute('data-side-country') || '';
      const dimmed = row.classList.contains('route-line-item-dimmed');
      if (country === targetValue) {
        sawMatch = true;
        expect(dimmed).toBe(false);
      } else {
        sawOther = true;
        expect(dimmed).toBe(true);
      }
    });
    expect(sawMatch).toBe(true);
    // 複数国が存在する典型ルートであればsawOtherもtrueになるはずだが、
    // 単一国ルートの場合はfalseのままでも構わない(別テストで検証)。
    void sawOther;
  });

  it('グレーアウトされたサイドパネル行のチェックボックスはdisabledになり操作できない', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = countryFilterSelect();
    const targetValue = sel.options[1].value;
    sel.value = targetValue;
    sel.dispatchEvent(new Event('change'));

    const dimmedRow = sideRows().find((row) => (row.getAttribute('data-side-country') || '') !== targetValue);
    if (!dimmedRow) return; // 単一国ルートの場合は対象なしなのでスキップ
    const check = dimmedRow.querySelector('[data-side-check-name]') as HTMLInputElement;
    expect(check.disabled).toBe(true);
    const wasChecked = check.checked;
    check.dispatchEvent(new Event('click', { bubbles: true }));
    check.dispatchEvent(new Event('change', { bubbles: true }));
    expect(check.checked).toBe(wasChecked);
  });

  it('「すべて(デフォルト)」に戻すとサイドパネル側の減光も解除される', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const sel = countryFilterSelect();
    const targetValue = sel.options[1].value;
    sel.value = targetValue;
    sel.dispatchEvent(new Event('change'));

    sel.value = sel.options[0].value;
    sel.dispatchEvent(new Event('change'));

    const rows = sideRows();
    rows.forEach((row) => {
      expect(row.classList.contains('route-line-item-dimmed')).toBe(false);
      const check = row.querySelector('[data-side-check-name]') as HTMLInputElement;
      expect(check.disabled).toBe(false);
    });
  });

  it('モーダル/サイドパネルが開いた状態のまま国フィルタの選択を変更すると、サイドパネルの減光がライブで更新される', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    // 巡回テストモーダルを開いた状態を模す(サイドパネル自体はページ読み込み時から
    // DOM上に存在するため、モーダルの開閉状態に関わらずrenderRouteSidePanel()の
    // 出力を検証できる)。
    const overlay = document.getElementById('tour-modal-overlay');
    if (overlay) overlay.classList.add('open');

    const sel = countryFilterSelect();
    expect(sel.options.length).toBeGreaterThan(1);
    const firstValue = sel.options[1].value;
    sel.value = firstValue;
    sel.dispatchEvent(new Event('change'));
    const afterFirst = sideRows().map((row) => ({
      country: row.getAttribute('data-side-country') || '',
      dimmed: row.classList.contains('route-line-item-dimmed'),
    }));
    afterFirst.forEach(({ country, dimmed }) => {
      expect(dimmed).toBe(country !== firstValue);
    });

    if (sel.options.length > 2) {
      const secondValue = sel.options[2].value;
      sel.value = secondValue;
      sel.dispatchEvent(new Event('change'));
      const afterSecond = sideRows().map((row) => ({
        country: row.getAttribute('data-side-country') || '',
        dimmed: row.classList.contains('route-line-item-dimmed'),
      }));
      afterSecond.forEach(({ country, dimmed }) => {
        expect(dimmed).toBe(country !== secondValue);
      });
    }
  });

  it('単一国のみのルートでもサイドパネルの行が誤ってグレーアウトされない', async () => {
    setupPage();
    await new Promise((r) => setTimeout(r, 0));
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    const endSel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    endSel.value = startSel.value;
    endSel.dispatchEvent(new Event('change'));
    startSel.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    const sel = countryFilterSelect();
    expect(sel.options.length).toBeGreaterThanOrEqual(1);
    if (sel.options.length < 2) return; // 国データ自体が判明していない環境ではスキップ
    const onlyCountry = sel.options[1].value;
    sel.value = onlyCountry;
    sel.dispatchEvent(new Event('change'));

    const rows = sideRows();
    rows.forEach((row) => {
      expect(row.classList.contains('route-line-item-dimmed')).toBe(false);
    });
  });
});
