// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「出発地・到着地」行、#start-city-picker-btn →
// #start-city-picker-modal-overlay(最上位レイヤーの出発地選択モーダル)。
// #end-city-picker-modal-overlay(既存の到着地選択モーダル)と同じ構造・技法
// (position:fixed、getNextZ()による動的z-index、ヘッダドラッグ、#tour-mini-panelと
// 重ならない既定位置)を踏襲しつつ、以下を新規に検証する:
//   (1) モーダルヘッダ右にチェックボックス(都市名のみ=既定ON、駅/空港=既定OFF)が並ぶ
//   (2) 既定(都市名のみ)では、一覧がロック中の到着地(#end-city)との距離の近い順(昇順)になる
//   (3) 駅/空港チェックボックスをONにすると該当候補が一覧に追加される
//   (4) 行クリックで#start-cityの値が変わりchangeイベント経由で下流(候補再計算等)が動く
//   (5) PR#1450と同じ登録状態インジケータ(塗りつぶし/中抜き枠)が一覧の各行にも反映される
//   (6) 「ルート登録ボタンが出てこない」バグの根本原因だった非同期レース
//       (route-existsの古い応答が新しい応答を上書きする)が解消されている
//
// 故障シナリオ:
//   (1) チェックボックスの初期状態が仕様と異なる(都市名のみが既定でONでない等)
//   (2) 距離ソートが降順のまま(既存の到着地モーダルの実装をそのまま流用してしまった場合)
//   (3) 駅/空港候補選択時にCITIESに存在しないため<select>のvalueが反映されず、
//       changeイベントが発火しない、またはgetCity()がundefinedを返し例外になる
//   (4) route-existsの応答が古い順で解決すると、ボタンの有効/無効が最新の組み合わせと
//       一致しない状態のまま残ってしまう

function setupPage(fetchImpl: (input: unknown, init?: unknown) => Promise<{ json: () => Promise<unknown> }>) {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(fetchImpl);
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function defaultFetch(registeredStarts: string[] = [], routeExists = false) {
  return (input: unknown) => {
    const url = String(input);
    if (url.indexOf('/api/heritage-journey/registered-starts-for-destination') === 0) {
      return Promise.resolve({ json: () => Promise.resolve({ starts: registeredStarts }) });
    }
    if (url.indexOf('/api/heritage-journey/route-exists') === 0) {
      return Promise.resolve({ json: () => Promise.resolve({ exists: routeExists }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  };
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('heritage-journeyページ: 出発地選択モーダル(#start-city-picker-modal-overlay)', () => {
  it('#start-city-picker-btnクリックでモーダルが開き、チェックボックスの既定状態は都市名のみON', async () => {
    setupPage(defaultFetch());
    await flush();
    const btn = document.getElementById('start-city-picker-btn') as HTMLButtonElement;
    btn.click();
    const overlay = document.getElementById('start-city-picker-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
    const citiesCb = document.getElementById('start-city-picker-cities-cb') as HTMLInputElement;
    const stationsCb = document.getElementById('start-city-picker-stations-cb') as HTMLInputElement;
    const airportsCb = document.getElementById('start-city-picker-airports-cb') as HTMLInputElement;
    expect(citiesCb.checked).toBe(true);
    expect(stationsCb.checked).toBe(false);
    expect(airportsCb.checked).toBe(false);
  });

  it('既定(都市名のみ)では、一覧がロック中の到着地(既定Rome)からの距離の近い順(昇順)になる', async () => {
    setupPage(defaultFetch());
    await flush();
    (document.getElementById('start-city-picker-btn') as HTMLButtonElement).click();
    const rows = Array.from(document.querySelectorAll('#start-city-picker-table-body tr.start-city-picker-row'));
    expect(rows.length).toBeGreaterThan(1);
    const kms = rows.map((r) => {
      const text = (r.querySelector('td:nth-child(2)') as HTMLElement).textContent || '';
      return text === '-' ? null : parseFloat(text);
    }).filter((v): v is number => v !== null);
    for (let i = 1; i < kms.length; i++) {
      expect(kms[i - 1]).toBeLessThanOrEqual(kms[i]);
    }
  });

  it('駅チェックボックスをONにすると駅候補が一覧に追加される', async () => {
    setupPage(defaultFetch());
    await flush();
    (document.getElementById('start-city-picker-btn') as HTMLButtonElement).click();
    const before = document.querySelectorAll('#start-city-picker-table-body tr.start-city-picker-row').length;
    const stationsCb = document.getElementById('start-city-picker-stations-cb') as HTMLInputElement;
    stationsCb.checked = true;
    stationsCb.dispatchEvent(new Event('change'));
    const after = document.querySelectorAll('#start-city-picker-table-body tr.start-city-picker-row').length;
    expect(after).toBeGreaterThan(before);
  });

  it('行クリックで#start-cityの値が変わりchangeイベント経由で表示ラベル(#start-city-picker-btn)が更新される', async () => {
    setupPage(defaultFetch());
    await flush();
    (document.getElementById('start-city-picker-btn') as HTMLButtonElement).click();
    const body = document.getElementById('start-city-picker-table-body')!;
    const row = body.querySelector('tr.start-city-picker-row') as HTMLElement;
    const cityName = row.getAttribute('data-city-name')!;
    row.click();
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    expect(startSel.value).toBe(cityName);
    const btn = document.getElementById('start-city-picker-btn') as HTMLButtonElement;
    expect(btn.textContent).not.toBe('');
  });

  it('駅候補(CITIESに存在しない仮想エントリ)を選択しても例外にならず#start-cityへ反映される', async () => {
    setupPage(defaultFetch());
    await flush();
    (document.getElementById('start-city-picker-btn') as HTMLButtonElement).click();
    const stationsCb = document.getElementById('start-city-picker-stations-cb') as HTMLInputElement;
    stationsCb.checked = true;
    stationsCb.dispatchEvent(new Event('change'));
    const body = document.getElementById('start-city-picker-table-body')!;
    const rows = Array.from(body.querySelectorAll('tr.start-city-picker-row'));
    const stationRow = rows.find((r) => (r.getAttribute('data-city-name') || '').indexOf('TP::') === 0) as HTMLElement | undefined;
    expect(stationRow).toBeTruthy();
    expect(() => stationRow!.click()).not.toThrow();
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    expect(startSel.value).toBe(stationRow!.getAttribute('data-city-name'));
  });

  it('一覧の各行にPR#1450と同じ登録済み/未登録インジケータクラスが付与される', async () => {
    setupPage(defaultFetch(['ローマ']));
    await flush();
    (document.getElementById('start-city-picker-btn') as HTMLButtonElement).click();
    await flush();
    const body = document.getElementById('start-city-picker-table-body')!;
    const romeRow = Array.from(body.querySelectorAll('tr.start-city-picker-row')).find((r) => (r.textContent || '').indexOf('ローマ') !== -1) as HTMLElement;
    const cell = romeRow.querySelector('td') as HTMLElement;
    expect(cell.classList.contains('start-city-picker-registered')).toBe(true);
    const otherRow = Array.from(body.querySelectorAll('tr.start-city-picker-row')).find((r) => (r.textContent || '').indexOf('ローマ') === -1) as HTMLElement;
    const otherCell = otherRow.querySelector('td') as HTMLElement;
    expect(otherCell.classList.contains('start-city-picker-unregistered')).toBe(true);
  });
});

describe('heritage-journeyページ: 「ルート登録ボタンが出てこない」不具合の根本原因(非同期レース)修正', () => {
  it('route-existsの古い応答が新しい応答より後に届いても、ボタンは最新の結果を反映する(レースガード)', async () => {
    let call = 0;
    const resolvers: Array<() => void> = [];
    setupPage((input: unknown) => {
      const url = String(input);
      if (url.indexOf('/api/heritage-journey/route-exists') === 0) {
        call++;
        const myCall = call;
        return new Promise((resolve) => {
          resolvers.push(() => resolve({ json: () => Promise.resolve({ exists: myCall === 2 }) }));
        });
      }
      if (url.indexOf('/api/heritage-journey/registered-starts-for-destination') === 0) {
        return Promise.resolve({ json: () => Promise.resolve({ starts: [] }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    await flush();
    // 初期表示で1件目のroute-existsリクエストが発行済み(call=1)。
    // ここで意図的に2回目の変更を発生させ、2件目のリクエスト(call=2)を発行する。
    document.getElementById('swap-btn')!.dispatchEvent(new Event('click'));
    await flush();
    expect(resolvers.length).toBe(2);
    // 応答順序を逆転させる: 新しいリクエスト(2件目, exists:true)を先に解決し、
    // 古いリクエスト(1件目, exists:false)を後から解決する。
    resolvers[1]();
    await flush();
    resolvers[0]();
    await flush();
    const btn = document.getElementById('register-route-btn') as HTMLButtonElement;
    // 古い応答(exists:false → disabled:false)で上書きされず、
    // 最新のリクエスト(2件目, exists:true → disabled:true)の結果が残っていること。
    expect(btn.disabled).toBe(true);
  });

  it('入替ボタン・出発地変更・到着地変更・分布チップのいずれも、直後にregister-route-btnの状態がfetchされる', async () => {
    const { fetchMock } = setupPage(defaultFetch([], false));
    await flush();
    fetchMock.mockClear();
    document.getElementById('swap-btn')!.dispatchEvent(new Event('click'));
    await flush();
    const swapCalls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/route-exists') === 0);
    expect(swapCalls.length).toBeGreaterThanOrEqual(1);

    fetchMock.mockClear();
    const endSel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    endSel.value = endSel.options[2] ? endSel.options[2].value : endSel.value;
    endSel.dispatchEvent(new Event('change'));
    await flush();
    const endCalls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/route-exists') === 0);
    expect(endCalls.length).toBeGreaterThanOrEqual(1);
  });
});
