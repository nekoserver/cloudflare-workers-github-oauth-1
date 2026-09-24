// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';
import { HERITAGE_LIST } from './data/heritageList';

const HERITAGE_NAMES = new Set(HERITAGE_LIST.map((h) => h.n));

/** ルート順序表示板の行のうち、出発/到着都市ではなく実際の世界遺産である最初の行を探す。 */
function findHeritageRow(): HTMLElement {
  const rows = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]')) as HTMLElement[];
  const row = rows.find((r) => HERITAGE_NAMES.has(r.getAttribute('data-side-name') || ''));
  if (!row) throw new Error('世界遺産の経由地が巡回ルートに1件も含まれていない(テストの前提が崩れている)');
  return row;
}

// 対象: /heritage-journeyページの「🌐 巡回テスト」モーダルの地球儀タップ
// ツールチップ(#tour-tap-label)。地点名タップ時に、その世界遺産に
// 「見どころ」AI回答キャッシュ(src/utils/heritageMitokoroModal.tsで共通化した
// fetchHeritageMitokoroShareIds / openHeritageMitokoroModal)が存在すれば
// アイコンをツールチップ内に表示し、タップするとgetNextZ()相当のレイヤーで
// モーダルを開いて見どころ本文を表示する。
//
// 本来の実装元である src/views/webglHeritage.ts (3D地球儀ページ) の
// ツールチップでは、gemma回答(👀)とllama回答(👁️)は互いに排他ではなく、
// 同じ世界遺産に両方のキャッシュが存在する場合は両方のアイコンが独立して
// 表示され、それぞれ別のモーダル(別のshareId・別のモデル名)を開く。
// 「過去ログ」的な複数件の履歴一覧は存在せず、各アイコンは常にその
// モデル1件分の最新キャッシュ回答を表示するだけ(単一回答モーダル)。
// このテストは、その実装をheritage-journeyページのタップツールチップへ
// 忠実に移植できていることを検証する。
//
// 故障シナリオ:
//   (1) gemma回答のみ存在する場合に👀だけが出て👁️は出ない
//   (2) llama回答のみ存在する場合に👁️だけが出て👀は出ない
//   (3) 両方存在する場合に👀・👁️の両方が同時に(片方が握りつぶされずに)出る
//   (4) どちらも存在しない場合はアイコンが一切出ない
//   (5) 👀タップでgemmaのshareId・👁️タップでllamaのshareIdを使ってモーダルが開く
//       (取り違えていないか)
//   (6) モーダルの✕ボタンで閉じられる

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) });
}

/**
 * gemma/llamaバッチ確認APIのレスポンスをそれぞれ指定して組み立てる
 * fetchモック。/api/aichat/shares/{shareId}はshareIdごとに異なる本文を
 * 返せるようにし、アイコンとshareIdの取り違えを検出できるようにする。
 */
function buildFetchMock(opts: {
  gemmaShareId?: string | null;
  llamaShareId?: string | null;
  answers?: Record<string, string>;
} = {}) {
  const answers = opts.answers ?? {
    'share-gemma': '## gemmaの見どころ\ngemma回答本文です。',
    'share-llama': '## llamaの見どころ\nllama回答本文です。',
  };
  const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
    const u = String(url);
    if (u.includes('check-heritage-mitokoro-gemma-batch')) {
      const body = init && init.body ? JSON.parse(init.body) : { heritages: [] };
      const names: string[] = body.heritages || [];
      const map: Record<string, string> = {};
      if (opts.gemmaShareId) names.forEach((n) => { map[n] = opts.gemmaShareId as string; });
      return jsonResponse({ cached: map });
    }
    if (u.includes('check-heritage-mitokoro-llama-batch')) {
      const body = init && init.body ? JSON.parse(init.body) : { heritages: [] };
      const names: string[] = body.heritages || [];
      const map: Record<string, string> = {};
      if (opts.llamaShareId) names.forEach((n) => { map[n] = opts.llamaShareId as string; });
      return jsonResponse({ cached: map });
    }
    const sharesMatch = u.match(/\/api\/aichat\/shares\/([^/?]+)/);
    if (sharesMatch) {
      const shareId = decodeURIComponent(sharesMatch[1]);
      return jsonResponse({ answer: answers[shareId] ?? ('本文(' + shareId + ')') });
    }
    if (u.includes('heritage-mitokoro-keyword-hits')) {
      return jsonResponse({ hitCount: 0, keywords: [] });
    }
    return jsonResponse({});
  });
  return { fetchMock };
}

function setupPage(fetchImpl: (url: string, init?: { body?: string }) => Promise<unknown>) {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const ctx: Record<string, unknown> = {
    clearRect: () => {}, beginPath: () => {}, ellipse: () => {}, arc: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '',
  };
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ctx;
  (globalThis as unknown as { fetch: unknown }).fetch = fetchImpl;
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('heritage-journeyページ: タップツールチップの見どころアイコン(gemma👀/llama👁️)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
  });

  it('ラベル全体が地球儀の操作を妨げないまま、見どころアイコンだけはタップ操作を受け付ける', () => {
    const html = getHeritageJourneyPage();
    expect(html).toMatch(/\.tour-tap-label\{[^}]*pointer-events:none/);
    expect(html).toMatch(/#tour-tap-mitokoro-gemma-btn,#tour-tap-mitokoro-llama-btn\{[^}]*pointer-events:auto[^}]*touch-action:manipulation/);
  });

  it('gemma回答のみキャッシュされている場合、👀だけが表示され👁️は表示されない', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    const name = row.getAttribute('data-side-name');
    row.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(name + ' 👀');
    expect(document.getElementById('tour-tap-mitokoro-gemma-btn')).not.toBeNull();
    expect(document.getElementById('tour-tap-mitokoro-llama-btn')).toBeNull();
  });

  it('llama回答のみキャッシュされている場合、👁️だけが表示され👀は表示されない', async () => {
    const { fetchMock } = buildFetchMock({ llamaShareId: 'share-llama' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    const name = row.getAttribute('data-side-name');
    row.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(name + ' 👁️');
    expect(document.getElementById('tour-tap-mitokoro-gemma-btn')).toBeNull();
    expect(document.getElementById('tour-tap-mitokoro-llama-btn')).not.toBeNull();
  });

  it('gemma・llama両方のキャッシュが存在する場合、👀と👁️の両方が同時に表示される(片方が握りつぶされない)', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma', llamaShareId: 'share-llama' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    const name = row.getAttribute('data-side-name');
    row.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(name + ' 👀 👁️');
    expect(document.getElementById('tour-tap-mitokoro-gemma-btn')).not.toBeNull();
    expect(document.getElementById('tour-tap-mitokoro-llama-btn')).not.toBeNull();
  });

  it('どちらの回答もキャッシュされていない場合、アイコンは一切表示されない', async () => {
    const { fetchMock } = buildFetchMock({});
    setupPage(fetchMock);
    await flushMicrotasks();

    const firstRow = document.querySelector('#tour-route-side-list [data-side-name]') as HTMLElement;
    firstRow.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(firstRow.getAttribute('data-side-name'));
    expect(document.getElementById('tour-tap-mitokoro-gemma-btn')).toBeNull();
    expect(document.getElementById('tour-tap-mitokoro-llama-btn')).toBeNull();
  });

  it('👀をタップするとgemmaのshareIdで見どころモーダルが開き、本文が表示される', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma', llamaShareId: 'share-llama' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    row.click();

    const gemmaBtn = document.getElementById('tour-tap-mitokoro-gemma-btn')!;
    gemmaBtn.click();
    await flushMicrotasks();

    const overlay = document.querySelector('[data-overlay]');
    expect(overlay).not.toBeNull();
    const body = overlay!.querySelector('.mitokoro-md');
    expect(body).not.toBeNull();
    expect(body!.innerHTML).toContain('gemmaの見どころ');
    expect(body!.innerHTML).toContain('gemma回答本文です');
    expect(body!.innerHTML).not.toContain('llama回答本文です');
  });

  it('👁️をタップするとllamaのshareIdで見どころモーダルが開き、本文が表示される(gemmaと取り違えない)', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma', llamaShareId: 'share-llama' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    row.click();

    const llamaBtn = document.getElementById('tour-tap-mitokoro-llama-btn')!;
    llamaBtn.click();
    await flushMicrotasks();

    const overlay = document.querySelector('[data-overlay]');
    expect(overlay).not.toBeNull();
    const body = overlay!.querySelector('.mitokoro-md');
    expect(body).not.toBeNull();
    expect(body!.innerHTML).toContain('llamaの見どころ');
    expect(body!.innerHTML).toContain('llama回答本文です');
    expect(body!.innerHTML).not.toContain('gemma回答本文です');
  });

  it('見どころモーダルは✕ボタンで閉じられる', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    row.click();
    const gemmaBtn = document.getElementById('tour-tap-mitokoro-gemma-btn')!;
    gemmaBtn.click();
    await flushMicrotasks();

    expect(document.querySelectorAll('[data-overlay]').length).toBe(1);
    const closeBtn = document.querySelector('[data-overlay] button[aria-label="閉じる"]') as HTMLElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(document.querySelectorAll('[data-overlay]').length).toBe(0);
  });
});

// 対象: #tour-globe-canvasのclickハンドラ。「城ON/OFF」(#toggle-castles-btn)で
// 重ねて描画される城(ルートの経由地として選択されていない世界遺産)は、
// 従来はtourPoints(ルートの経由地一覧)だけを対象にヒット判定していたため、
// タップしてもツールチップ以降の処理(見どころアイコン→見どころモーダル)が
// 一切発火しない不具合があった(#tour-tap-labelそのものが表示されない)。
// このdescribeは、その修正がルート未選択の城のタップでも機能することを
// project()/computeInitialView()と同じ計算式で実際のクリック座標を求め、
// 実際にcanvasへclickイベントを飛ばして検証する。
describe('heritage-journeyページ: 「城ON/OFF」で表示した、ルート未選択の城のタップ', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  // 既定の出発地(Paris)・到着地(Rome)から遠く離れた城(スオメンリンナの要塞群、
  // フィンランド)を選ぶ。detourが既定のmaxDetour(150km)を大幅に超えるため、
  // buildCandidates()の候補にすら入らず、tourPointsには絶対に含まれない
  // (「たまたまルートの経由地としても選択されていた」ことによる偽陽性を排除するため)。
  const FAR_CASTLE_NAME = 'スオメンリンナの要塞群';
  const PARIS = { lat: 48.8566, lon: 2.3522 };
  const ROME = { lat: 41.9028, lon: 12.4964 };

  function circularMeanLon(lonA: number, lonB: number) {
    const a = (lonA * Math.PI) / 180, b = (lonB * Math.PI) / 180;
    return (Math.atan2((Math.sin(a) + Math.sin(b)) / 2, (Math.cos(a) + Math.cos(b)) / 2) * 180) / Math.PI;
  }
  function project(lat: number, lon: number, centerLat: number, centerLon: number, R: number, cx: number, cy: number) {
    const latR = (lat * Math.PI) / 180;
    const lonR = ((lon - centerLon) * Math.PI) / 180;
    const lat0 = (centerLat * Math.PI) / 180;
    const x = R * Math.cos(latR) * Math.sin(lonR);
    const y = -R * (Math.cos(lat0) * Math.sin(latR) - Math.sin(lat0) * Math.cos(latR) * Math.cos(lonR));
    return { x: cx + x, y: cy + y };
  }
  /** src/views/heritageJourney.tsのcomputeInitialView(points, baseR)と同じ計算式。 */
  function computeInitialView(points: { lat: number; lon: number }[], baseR: number) {
    const start = points[0], end = points[points.length - 1];
    const centerLat = (start.lat + end.lat) / 2;
    const centerLon = circularMeanLon(start.lon, end.lon);
    let maxDist = 0;
    points.forEach((p) => {
      const pp = project(p.lat, p.lon, centerLat, centerLon, baseR, 0, 0);
      const d = Math.hypot(pp.x, pp.y);
      if (d > maxDist) maxDist = d;
    });
    const MARGIN = 0.97;
    let zoom = maxDist > 0.01 ? (baseR * MARGIN) / maxDist : 1;
    zoom = Math.max(0.5, Math.min(16, zoom));
    return { centerLat, centerLon, zoom };
  }

  function readTourPointsFromDom(): { lat: number; lon: number }[] {
    const rows = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]')) as HTMLElement[];
    const points = rows.map((row) => ({
      lat: Number(row.getAttribute('data-side-lat')),
      lon: Number(row.getAttribute('data-side-lon')),
    })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    return points.length >= 2 ? points : [PARIS, ROME];
  }

  /** 現在の巡回ルート(tourPoints)と同じ視点で、城のクリック座標を求める。 */
  function computeCastleClickPoint(castleLat: number, castleLon: number) {
    const canvas = document.getElementById('tour-globe-canvas') as HTMLCanvasElement;
    const W = canvas.width || 520;
    const H = canvas.height || 520;
    const margin = Math.min(W, H) <= 300 ? 12 : 24;
    const baseR = Math.min(W, H) / 2 - margin;
    const { centerLat, centerLon, zoom } = computeInitialView(readTourPointsFromDom(), baseR);
    const R = baseR * zoom;
    return project(castleLat, castleLon, centerLat, centerLon, R, W / 2, H / 2);
  }

  it('修正前は城をタップしてもツールチップ(#tour-tap-label)が一切表示されなかった(城はtourPointsに含まれないため)', async () => {
    const { fetchMock } = buildFetchMock({});
    setupPage(fetchMock);
    await flushMicrotasks();

    // 「城ON/OFF」は既定でON。クリック座標は現在のtourPointsから再計算する。
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();

    const canvas = document.getElementById('tour-globe-canvas')!;
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 520, bottom: 520, width: 520, height: 520, x: 0, y: 0, toJSON: () => ({}),
    });

    const castle = HERITAGE_LIST.find((h) => h.n === FAR_CASTLE_NAME);
    expect(castle).not.toBeUndefined();
    const { x, y } = computeCastleClickPoint(castle!.lat, castle!.lon);

    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));

    const tapLabel = document.getElementById('tour-tap-label')!;
    // 修正済みの現在の実装では、城のタップでツールチップに城名が表示される
    // (実装が退行し、この座標で再びタップが効かなくなっていないことを保証する)。
    expect(tapLabel.style.display).toBe('block');
    expect(tapLabel.textContent).toBe(FAR_CASTLE_NAME);
  });

  it('見どころキャッシュがあれば、城のタップでも👀/👁️アイコンが出てモーダルが開く', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma' });
    setupPage(fetchMock);
    await flushMicrotasks();

    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();

    const canvas = document.getElementById('tour-globe-canvas')!;
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 520, bottom: 520, width: 520, height: 520, x: 0, y: 0, toJSON: () => ({}),
    });

    const castle = HERITAGE_LIST.find((h) => h.n === FAR_CASTLE_NAME)!;
    const { x, y } = computeCastleClickPoint(castle.lat, castle.lon);
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));

    const gemmaBtn = document.getElementById('tour-tap-mitokoro-gemma-btn');
    expect(gemmaBtn).not.toBeNull();
    gemmaBtn!.click();
    await flushMicrotasks();

    const overlay = document.querySelector('[data-overlay]');
    expect(overlay).not.toBeNull();
    const body = overlay!.querySelector('.mitokoro-md');
    expect(body!.innerHTML).toContain('gemma回答本文です');
  });
});
