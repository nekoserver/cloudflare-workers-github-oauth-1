// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: 「到着地を選択」モーダル(#end-city-picker-modal-overlay)の都市一覧テーブルに
// 追加した先頭の国旗カラム(<th id="end-city-picker-flag-th">🏁</th> + 各行<td>の国旗)。
// この🏁見出しをタップすると、既存の「到達国を制限する」国一覧モーダル
// (#dist-country-filter-modal-overlay、openDistCountryFilterModal())をそのまま開く。
// 国を選ぶと、既存の到達国フィルタ(destCountryFilter / Cookie:
// heritage_journey_dest_country_filter)がそのまま更新され、
// 「出発地から見た目的地別プラン分布」など他セクションにも反映されるのに加えて、
// 到着地選択モーダル自身の都市一覧もその国のみに絞り込まれる。
//
// 集計スコープの選定: 🏁タップで開く国一覧の件数(降順ソート)は、到着地選択モーダルで
// 現在絞り込み表示中の行だけでなく、候補都市の全体(CITIES全件、既存の
// computeDestCountryCounts()と同じ集計対象)を対象にする。フィルタを選ぶための一覧では、
// 現在の絞り込み状態に関わらず全選択肢とその内訳が見えるほうが選びやすいため。
//
// UI再利用の判断: 新しいドロップダウンコンポーネントは作らず、既存の
// openDistCountryFilterModal()をそのまま呼び出す。到着地選択モーダルの上に
// 国一覧モーダルが重なる形になるが、openDistCountryFilterModal内部で
// 毎回getNextZ()により最新の最大z-index+100が設定されるため、常に手前に表示される
// (getNextZ()のstaticZDefaultsに両モーダルとも既に登録済み)。
//
// 故障シナリオ:
//   (1) 🏁列が先頭(都市名より前)に描画されない、またはth内のラベルが🏁以外になる
//   (2) 各行の<td>に、その都市が属する国の国旗が正しく表示されない
//   (3) 🏁タップで国一覧モーダルが開かない、または到着地選択モーダルより
//       手前(高いz-index)に表示されない
//   (4) 国一覧モーダルの件数集計が、到着地選択モーダルの見た目上の絞り込み結果に
//       引きずられて全候補ベースにならない
//   (5) 🏁経由で国を選んでも、既存の到達国フィルタ(Cookie/destCountryFilter)や
//       分布セクションに反映されない(別々のフィルタ状態になってしまう)
//   (6) 🏁経由で国を選んでも、到着地選択モーダル自身の都市一覧が絞り込まれない
//   (7) 既に到達国フィルタが有効な状態でモーダルを新規に開いた場合に反映されない

function setupPage(cookie?: string) {
  document.cookie = 'heritage_journey_dest_country_filter=; Path=/; Max-Age=0';
  if (cookie) document.cookie = cookie;
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ exists: false }) }));
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  document.cookie = 'heritage_journey_dest_country_filter=; Path=/; Max-Age=0';
});

describe('heritage-journeyページ: 到着地選択モーダルの🏁国旗カラム', () => {
  it('先頭カラムにth🏁が表示され、各行のtdにその都市の国旗が入る', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();

    const headerCells = Array.from(document.querySelectorAll('.end-city-picker-table thead th'));
    expect(headerCells.length).toBe(3);
    expect(headerCells[0].id).toBe('end-city-picker-flag-th');
    expect(headerCells[0].textContent).toBe('🏁');
    expect(headerCells[1].textContent).toBe('都市名');

    const body = document.getElementById('end-city-picker-table-body')!;
    const romeRow = body.querySelector('[data-city-name="Rome"]')!;
    const tds = Array.from(romeRow.querySelectorAll('td'));
    expect(tds.length).toBe(3);
    expect(tds[0].textContent).toBe('🇮🇹');
    expect(tds[1].textContent).toBe('ローマ');

    const londonRow = body.querySelector('[data-city-name="London"]')!;
    expect(londonRow.querySelectorAll('td')[0].textContent).toBe('🇬🇧');
  });
});

describe('heritage-journeyページ: 🏁タップで到達国モーダルを開く(既存モーダルの再利用)', () => {
  it('🏁見出しをタップすると既存の#dist-country-filter-modal-overlayが開き、件数降順で国が並ぶ(全候補集計)', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();

    const flagTh = document.getElementById('end-city-picker-flag-th') as HTMLElement;
    flagTh.click();

    const countryOverlay = document.getElementById('dist-country-filter-modal-overlay') as HTMLElement;
    expect(countryOverlay.classList.contains('open')).toBe(true);

    const rows = Array.from(document.querySelectorAll('#dist-country-filter-list [data-country]')) as HTMLElement[];
    expect(rows[0].getAttribute('data-country')).toBe('__ALL__');
    expect(rows[1].getAttribute('data-country')).toBe('ドイツ');
    const counts = rows.slice(1).map((r) => Number(r.getAttribute('data-count')));
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('🏁経由で開いた国一覧モーダルは到着地選択モーダルより手前(高いz-index)に表示される', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();
    const pickerOverlay = document.getElementById('end-city-picker-modal-overlay') as HTMLElement;
    const pickerZ = Number(pickerOverlay.style.zIndex);

    const flagTh = document.getElementById('end-city-picker-flag-th') as HTMLElement;
    flagTh.click();
    const countryOverlay = document.getElementById('dist-country-filter-modal-overlay') as HTMLElement;
    const countryZ = Number(countryOverlay.style.zIndex);

    expect(Number.isNaN(pickerZ)).toBe(false);
    expect(Number.isNaN(countryZ)).toBe(false);
    expect(countryZ).toBeGreaterThan(pickerZ);
  });
});

describe('heritage-journeyページ: 🏁経由の選択は既存の到達国フィルタと同一の状態を共有する', () => {
  it('🏁から国を選ぶと、既存フィルタのCookie/ボタンラベル/分布セクションにも反映される(共有状態の証明)', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();
    const flagTh = document.getElementById('end-city-picker-flag-th') as HTMLElement;
    flagTh.click();

    const row = document.querySelector('#dist-country-filter-list [data-country="イタリア"]') as HTMLElement;
    row.dispatchEvent(new Event('click', { bubbles: true }));

    // 既存の「到達国を制限する」ボタン・Cookieが更新される(同一の下層フィルタ機構であることの証明)
    const distBtn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    expect(distBtn.textContent).toBe('🇮🇹 イタリア');
    expect(document.cookie).toContain('heritage_journey_dest_country_filter=' + encodeURIComponent('イタリア'));

    // 分布セクションにも反映される
    const rows2 = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
    const cityLabels: string[] = [];
    rows2.forEach((r) => {
      r.dispatchEvent(new Event('click', { bubbles: true }));
      const idx = r.getAttribute('data-bucket');
      const citiesEl = document.getElementById('dist-cities-' + idx) as HTMLElement;
      citiesEl.querySelectorAll('[data-city]').forEach((chip) => cityLabels.push(chip.textContent || ''));
    });
    expect(cityLabels.length).toBeGreaterThan(0);
    cityLabels.forEach((t) => expect(t).toContain('🇮🇹'));
  });

  it('🏁から国を選ぶと、到着地選択モーダル自身の都市一覧もその国のみに絞り込まれる', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();
    const flagTh = document.getElementById('end-city-picker-flag-th') as HTMLElement;
    flagTh.click();

    const row = document.querySelector('#dist-country-filter-list [data-country="イタリア"]') as HTMLElement;
    row.dispatchEvent(new Event('click', { bubbles: true }));

    const pickerBody = document.getElementById('end-city-picker-table-body')!;
    const pickerRows = Array.from(pickerBody.querySelectorAll('tr'));
    expect(pickerRows.length).toBeGreaterThan(0);
    pickerRows.forEach((r) => {
      const flagTd = r.querySelectorAll('td')[0];
      expect(flagTd.textContent).toBe('🇮🇹');
    });
  });

  it('既に到達国フィルタ(イタリア)が有効な状態でモーダルを新規に開くと、都市一覧が既にその国だけに絞られている', () => {
    setupPage('heritage_journey_dest_country_filter=' + encodeURIComponent('イタリア'));
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();

    const pickerBody = document.getElementById('end-city-picker-table-body')!;
    const pickerRows = Array.from(pickerBody.querySelectorAll('tr'));
    expect(pickerRows.length).toBeGreaterThan(0);
    pickerRows.forEach((r) => {
      const flagTd = r.querySelectorAll('td')[0];
      expect(flagTd.textContent).toBe('🇮🇹');
    });
  });

  it('「しない」に戻すと到着地選択モーダルの都市一覧も全都市表示に戻る', () => {
    setupPage('heritage_journey_dest_country_filter=' + encodeURIComponent('イタリア'));
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();
    const flagTh = document.getElementById('end-city-picker-flag-th') as HTMLElement;
    flagTh.click();

    const noneRow = document.querySelector('#dist-country-filter-list [data-country="__ALL__"]') as HTMLElement;
    noneRow.dispatchEvent(new Event('click', { bubbles: true }));

    const pickerBody = document.getElementById('end-city-picker-table-body')!;
    const pickerRows = Array.from(pickerBody.querySelectorAll('tr'));
    const flags = new Set(pickerRows.map((r) => r.querySelectorAll('td')[0].textContent));
    expect(flags.size).toBeGreaterThan(1);
  });
});
