// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { getHeritageJourneyPage, buildEmbeddedHeritagePoints } from './views/heritageJourney';
import { heritageIndexToMasterId, buildHeritageMasterRows, type HeritageSeedSourceItem } from './utils/heritage-master-seed';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: /heritage-journeyページの「ルート順序」セクション(#route-line)でON/OFFした
// 世界遺産名から、heritage_masterと同じ4桁IDを引いた配列(currentTourActiveHeritageIds)を
// 維持する処理、およびそれを使って新規保存する「この経由データを保存」ボタン
// (#save-waypoint-set-btn)、保存成功時に画面中央に出る薄緑色のトースト
// (#waypoint-set-save-toast)。
//
// 故障シナリオ:
//   (1) buildEmbeddedHeritagePoints()のid採番がheritage_masterのID採番(buildHeritageMasterRows)
//       とずれる(inEuropeフィルタ後のindexで採番してしまう等)
//   (2) ルート順序のON/OFFを切り替えてもcurrentTourActiveHeritageIdsが更新されない、
//       または除外中の地点のIDが混入する
//   (3) 保存済みの組み合わせ(exists:true)でもボタンが表示されてしまう
//   (4) 保存POSTのwaypoint_heritage_ids文字列の形式が「1 0123, 2 0456」の形式と異なる
//   (5) 保存成功後もボタンが残る、またはトーストが出ない/消えない
//   (6) 保存失敗時にもボタンが消える、またはトーストが出てしまう

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

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function defaultFetchImpl(existsRouteExists: boolean, existsWaypointSet: boolean, postResult: unknown) {
  return (input: unknown) => {
    const url = String(input);
    if (url.indexOf('/api/heritage-journey/route-exists') === 0) {
      return Promise.resolve({ json: () => Promise.resolve({ exists: existsRouteExists }) });
    }
    if (url.indexOf('/api/heritage-journey/waypoint-set-exists') === 0) {
      return Promise.resolve({ json: () => Promise.resolve({ exists: existsWaypointSet }) });
    }
    if (url === '/api/heritage-journey/save-waypoint-set') {
      return Promise.resolve({ json: () => Promise.resolve(postResult) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('heritageIndexToMasterId / buildEmbeddedHeritagePoints のID一致(ドリフト検知)', () => {
  const EUROPE_LAT_MIN = 36, EUROPE_LAT_MAX = 61, EUROPE_LON_MIN = -12, EUROPE_LON_MAX = 35;
  function inEuropeForTest(lat: number, lon: number): boolean {
    return lat >= EUROPE_LAT_MIN && lat <= EUROPE_LAT_MAX && lon >= EUROPE_LON_MIN && lon <= EUROPE_LON_MAX;
  }

  it('buildEmbeddedHeritagePoints()の各idが、HERITAGE_LISTの全件配列でのindex(フィルタ前)から算出したheritage_masterのIDと一致する', () => {
    const sourceItems: HeritageSeedSourceItem[] = HERITAGE_LIST.map((h) => ({
      e: h.e, f: h.f, n: h.n, c: h.c, t: h.t, y: h.y, lat: h.lat, lon: h.lon,
    }));
    const masterRows = buildHeritageMasterRows(sourceItems);
    // HERITAGE_LISTのフィルタ前・全件配列でのindexのまま(inEuropeでフィルタするだけ)
    // 期待されるidを組み立て、buildEmbeddedHeritagePoints()の返り値と配列として
    // 完全一致することを確認する(name/lat/lonの重複があっても順序を保つため崩れない)。
    const expected = HERITAGE_LIST
      .map((h, index) => ({ n: h.n, e: h.e, f: h.f, c: h.c, lat: h.lat, lon: h.lon, id: masterRows[index].id }))
      .filter((h) => inEuropeForTest(h.lat, h.lon));

    const embedded = buildEmbeddedHeritagePoints();
    expect(embedded.length).toBeGreaterThan(0);
    expect(embedded).toEqual(expected);
  });

  it('heritageIndexToMasterIdは0始まりindexから1始まりの4桁ゼロパディングIDを返す', () => {
    expect(heritageIndexToMasterId(0)).toBe('0001');
    expect(heritageIndexToMasterId(41)).toBe('0042');
  });
});

describe('heritage-journeyページ: currentTourActiveHeritageIdsのルート順序ON/OFF連動', () => {
  it('#route-lineでバッジをOFFにすると、そのバッジのIDが保存ボタンの再チェックリクエストから除外される', async () => {
    const { fetchMock } = setupPage(defaultFetchImpl(false, false, { ok: true, id: 1 }));
    await flush();

    const routeLine = document.getElementById('route-line')!;
    const badges = routeLine.querySelectorAll('[data-wp-name]');
    expect(badges.length).toBeGreaterThan(2);

    fetchMock.mockClear();
    const target = badges[1] as HTMLButtonElement;
    const targetName = target.getAttribute('data-wp-name')!;
    target.click();
    await flush();

    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/waypoint-set-exists') === 0);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const lastUrl = String(calls[calls.length - 1][0]);
    const decoded = decodeURIComponent(lastUrl);
    expect(target.classList.contains('wp-badge-off')).toBe(true);
    expect(decoded.indexOf(targetName)).toBe(-1);
  });
});

describe('heritageJourneyページ: 「この経由データを保存」ボタンの表示/非表示', () => {
  it('未保存(exists:false)なら初期表示時にボタンが表示される', async () => {
    setupPage(defaultFetchImpl(false, false, { ok: true, id: 1 }));
    await flush();
    const btn = document.getElementById('save-waypoint-set-btn') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.style.display).not.toBe('none');
  });

  it('既に保存済み(exists:true)ならボタンは非表示のまま', async () => {
    setupPage(defaultFetchImpl(false, true, { ok: true, id: 1 }));
    await flush();
    const btn = document.getElementById('save-waypoint-set-btn') as HTMLButtonElement;
    expect(btn.style.display).toBe('none');
  });

  it('出発地・到着地を入替(swap-btn)すると再度waypoint-set-existsへfetchする(選択中の経由地が残る組み合わせ)', async () => {
    const { fetchMock } = setupPage(defaultFetchImpl(false, false, { ok: true, id: 1 }));
    await flush();
    // 初期表示(Paris→Rome)で保存ボタンが出ている = currentTourActiveHeritageIdsが空でないことの前提確認
    const btnBefore = document.getElementById('save-waypoint-set-btn') as HTMLButtonElement;
    expect(btnBefore.style.display).not.toBe('none');
    fetchMock.mockClear();

    const swapBtn = document.getElementById('swap-btn') as HTMLButtonElement;
    swapBtn.click();
    await flush();

    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/waypoint-set-exists') === 0);
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('heritageJourneyページ: 保存ボタン押下時のPOSTペイロード形式と成功時の挙動', () => {
  it('waypoint_heritage_idsが「1 XXXX, 2 YYYY, ...」形式でPOSTされ、成功時にボタンが消えてトーストが表示される', async () => {
    const { fetchMock } = setupPage(defaultFetchImpl(false, false, { ok: true, id: 42 }));
    await flush();

    const btn = document.getElementById('save-waypoint-set-btn') as HTMLButtonElement;
    expect(btn.style.display).not.toBe('none');
    btn.click();
    await flush();

    const postCall = fetchMock.mock.calls.find((c) => String(c[0]) === '/api/heritage-journey/save-waypoint-set');
    expect(postCall).toBeDefined();
    const init = postCall![1] as { method: string; body: string };
    expect(init.method).toBe('POST');
    const payload = JSON.parse(init.body);
    expect(typeof payload.waypointHeritageIds).toBe('string');
    expect(payload.waypointHeritageIds.length).toBeGreaterThan(0);
    expect(/^\d+ \d{4}(, \d+ \d{4})*$/.test(payload.waypointHeritageIds)).toBe(true);
    expect(payload.waypointCount).toBeGreaterThan(0);
    expect(typeof payload.totalDistanceKm).toBe('number');
    expect(payload.totalDistanceKm).not.toBeNull();

    expect(document.getElementById('save-waypoint-set-btn')!.style.display).toBe('none');

    const toast = document.getElementById('waypoint-set-save-toast')!;
    expect(toast.style.display).toBe('block');
    expect(toast.textContent).toBe('レコード42にこの経由地が保存されました');

    await vi.advanceTimersByTimeAsync(6999);
    expect(toast.style.display).toBe('block');
    await vi.advanceTimersByTimeAsync(2);
    expect(toast.style.display).toBe('none');
    expect(toast.textContent).toBe('');
  });

  it('POSTが失敗(ok:false)した場合、ボタンは残り再クリック可能でトーストも出ない', async () => {
    setupPage(defaultFetchImpl(false, false, { ok: false, error: '重複しています' }));
    await flush();

    const btn = document.getElementById('save-waypoint-set-btn') as HTMLButtonElement;
    btn.click();
    await flush();

    const btnAfter = document.getElementById('save-waypoint-set-btn') as HTMLButtonElement;
    expect(btnAfter).not.toBeNull();
    expect(btnAfter.disabled).toBe(false);
    const toast = document.getElementById('waypoint-set-save-toast')!;
    expect(toast.style.display).not.toBe('block');
    const errEl = document.getElementById('save-waypoint-set-error')!;
    expect(errEl.style.display).not.toBe('none');
  });
});
