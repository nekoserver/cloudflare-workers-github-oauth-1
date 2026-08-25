// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: 「到着地を選択」モーダル(#end-city-picker-modal-overlay)の一覧テーブルに追加した
// ✈︎カラム(#end-city-picker-table thead末尾)。出発地選択モーダル(#start-city-picker-modal-overlay)
// 内で空港を選び、なおかつこの到着地選択モーダル内の「空港」チェックボックス
// (#end-city-picker-airports-cb)がONの間だけ、表内の空港候補すべてに対して出発地の空港との
// 発着航路の有無(AIRLINE_NETWORK由来のairportRoutes)を調べ、航路があれば✈︎セルの背景色を
// 薄緑色(.end-city-picker-airport-connected)に塗りつぶす。
//
// 実データ(src/data/airlineNetwork.ts)ではチューリッヒ空港(ZRH, SWISS)からロンドン・
// ヒースロー空港(LHR)への直行便が記録されている一方、チューリッヒ空港とイスタンブール空港
// (IST, Turkish Airlines)を直接結ぶ記録は無い。この既知の実データの差を使って
// 「航路あり→薄緑」「航路なし→通常色」を区別する。
//
// 故障シナリオ:
//   (1) ✈︎列自体が描画されない、または空港以外の行にも✈︎アイコンが出てしまう
//   (2) 出発地が空港でない(都市選択のまま)場合でも誤って塗りつぶしてしまう
//   (3) 「空港」チェックボックスがOFFの間も判定処理が走ってしまう(そもそも空港行が
//       出ないので実害は無いが、無条件塗りつぶしのような取り違えがないか確認する)
//   (4) 航路が存在しない組み合わせなのに誤って薄緑になる(逆偽陽性)

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ exists: false, starts: [] }) }));
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

/** 出発地選択モーダルを開き、指定ラベルの行(駅/空港/城の仮想エントリ)をクリックして#start-cityへ反映する。 */
function selectStartByLabel(label: string) {
  (document.getElementById('start-city-picker-btn') as HTMLButtonElement).click();
  const airportsCb = document.getElementById('start-city-picker-airports-cb') as HTMLInputElement;
  airportsCb.checked = true;
  airportsCb.dispatchEvent(new Event('change'));
  const body = document.getElementById('start-city-picker-table-body')!;
  const row = Array.from(body.querySelectorAll('tr.start-city-picker-row')).find((r) => (r.textContent || '').indexOf(label) !== -1) as HTMLElement;
  expect(row).toBeTruthy();
  row.click();
  (document.getElementById('start-city-picker-modal-close') as HTMLButtonElement).click();
}

function openEndPickerWithAirportsOn() {
  (document.getElementById('end-city-picker-btn') as HTMLButtonElement).click();
  const airportsCb = document.getElementById('end-city-picker-airports-cb') as HTMLInputElement;
  airportsCb.checked = true;
  airportsCb.dispatchEvent(new Event('change'));
}

function findEndPickerAirportRow(label: string): HTMLElement {
  const body = document.getElementById('end-city-picker-table-body')!;
  const row = Array.from(body.querySelectorAll('tr.end-city-picker-row')).find((r) => (r.textContent || '').indexOf(label) !== -1) as HTMLElement;
  expect(row).toBeTruthy();
  return row;
}

describe('heritage-journeyページ: 到着地選択モーダルの✈︎発着航路カラム', () => {
  it('✈︎列がヘッダ末尾に追加され、空港以外の行には✈︎アイコンが表示されない', async () => {
    setupPage();
    await flush();
    openEndPickerWithAirportsOn();

    const headerCells = Array.from(document.querySelectorAll('.end-city-picker-table thead th'));
    expect(headerCells[headerCells.length - 1].textContent).toBe('✈︎');

    const body = document.getElementById('end-city-picker-table-body')!;
    const romeRow = body.querySelector('[data-city-name="Rome"]') as HTMLElement;
    const romeAirportTd = romeRow.querySelectorAll('td')[3];
    expect(romeAirportTd.textContent).toBe('');
    expect(romeAirportTd.classList.contains('end-city-picker-airport-connected')).toBe(false);

    const lhrRow = findEndPickerAirportRow('ロンドン・ヒースロー空港');
    const lhrAirportTd = lhrRow.querySelectorAll('td')[3];
    expect(lhrAirportTd.textContent).not.toBe('');
  });

  it('出発地選択モーダルで空港(チューリッヒ空港)を選び、到着地選択モーダルの空港チェックがONの時、実際に発着航路があるロンドン・ヒースロー空港の✈︎セルが薄緑色になる', async () => {
    setupPage();
    await flush();
    selectStartByLabel('チューリッヒ空港');
    await flush();
    openEndPickerWithAirportsOn();

    const lhrRow = findEndPickerAirportRow('ロンドン・ヒースロー空港');
    const lhrAirportTd = lhrRow.querySelectorAll('td')[3];
    expect(lhrAirportTd.classList.contains('end-city-picker-airport-connected')).toBe(true);
  });

  it('出発地(チューリッヒ空港)と発着航路が実データ上つながっていないイスタンブール空港は薄緑にならない', async () => {
    setupPage();
    await flush();
    selectStartByLabel('チューリッヒ空港');
    await flush();
    openEndPickerWithAirportsOn();

    const istRow = findEndPickerAirportRow('イスタンブール空港');
    const istAirportTd = istRow.querySelectorAll('td')[3];
    expect(istAirportTd.classList.contains('end-city-picker-airport-connected')).toBe(false);
  });

  it('出発地が空港でない(都市のまま)場合は、空港チェックがONでも✈︎セルを薄緑に塗りつぶさない', async () => {
    setupPage();
    await flush();
    // 出発地は既定のパリ(都市)のまま変更しない
    openEndPickerWithAirportsOn();

    const lhrRow = findEndPickerAirportRow('ロンドン・ヒースロー空港');
    const lhrAirportTd = lhrRow.querySelectorAll('td')[3];
    expect(lhrAirportTd.classList.contains('end-city-picker-airport-connected')).toBe(false);
  });
});
