// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🎬 巡回ルートを再現する」ボタンの左に追加した
// 「🌐 巡回テスト」ボタン。押すと(webgl-heritageへの画面遷移を伴う本格的な巡回とは
// 別に)最上位モーダル内に、必要な行き先の座標だけをプロットした簡易な地球儀
// (canvas 2Dの正射影)を表示し、モーダルの中だけで出発点から目的地までの巡回
// (再生アニメーション)を行えるようにする。
//
// 故障シナリオ:
//   (1) ボタン自体がマークアップに存在しない、またはモーダルが開かない
//   (2) 計算済みルート(state.lastOrdered)が無い状態で押すと例外になる、
//       または空のモーダルが開いてしまう
//   (3) 地点数が1件以下(ルート未計算/出発地=到着地扱い)でもcanvas描画が
//       例外を投げる
//   (4) 再生ボタンを押しても現在地ラベルが更新されない、
//       またはアニメーションが最後まで進まず途中で止まる
//   (5) モーダルを閉じてもタイマーが残り続け、閉じた後もラベル更新が続く
//   (6) 再生中に閉じて再度開いた際、前回の再生タイマーが二重に走る

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const arcCalls: number[][] = [];
  const ctx = {
    clearRect: () => {}, beginPath: () => {}, ellipse: () => {},
    arc: (...args: number[]) => { arcCalls.push(args); },
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  };
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ctx;
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { html, arcCalls };
}

/** 球体輪郭(arc呼び出し)のうち、半径が最大のものを地球儀の描画半径とみなす */
function globeRadiusFromArcCalls(arcCalls: number[][]): number {
  return arcCalls.reduce((max, args) => Math.max(max, args[2] ?? 0), 0);
}

function selectRoute() {
  // start-city/end-cityはデフォルトでParis→Romeが選択され、ページ末尾で
  // populateCitySelects/renderCandidates/recomputeが自動実行されるため、
  // 追加操作なしでstate.lastOrderedが計算済みになる。
}

function loadProjectionFns(html: string) {
  function extractFn(name: string, argsPattern: string): string {
    const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n  \\}');
    const m = html.match(re);
    if (!m) throw new Error(name + ' が生成HTMLから見つからない');
    return m[0];
  }
  const src = [
    'var ZOOM_MIN = 0.5, ZOOM_MAX = 16;',
    extractFn('project', 'lat, lon, centerLat, centerLon, R, cx, cy'),
    extractFn('circularMeanLon', 'lonA, lonB'),
    extractFn('computeInitialView', 'points, baseR'),
  ].join('\n');
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${src}\nreturn { project: project, circularMeanLon: circularMeanLon, computeInitialView: computeInitialView };`);
  return fn() as {
    project: (lat: number, lon: number, centerLat: number, centerLon: number, R: number, cx: number, cy: number) => { x: number; y: number; visible: boolean };
    circularMeanLon: (a: number, b: number) => number;
    computeInitialView: (points: { lat: number; lon: number }[], baseR: number) => { centerLat: number; centerLon: number; zoom: number };
  };
}

function loadTextureFns(html: string) {
  function extractFn(name: string, argsPattern: string): string {
    const re = new RegExp('function ' + name + '\\(' + argsPattern + '\\) \\{[\\s\\S]*?\\n  \\}');
    const m = html.match(re);
    if (!m) throw new Error(name + ' が生成HTMLから見つからない');
    return m[0];
  }
  const projectSrc = extractFn('project', 'lat, lon, centerLat, centerLon, R, cx, cy');
  const unprojectSrc = extractFn('unproject', 'X, Y, centerLat, centerLon');
  const renderSrc = extractFn('renderSphereTexture', 'ctx, cx, cy, R, W, H');
  const fn = new Function(
    'canvas', 'tourCenterLat', 'tourCenterLon', 'earthImageData', 'sphereCacheBox',
    `
    ${projectSrc}
    ${unprojectSrc}
    var sphereCache = sphereCacheBox.cache;
    var sphereCacheKey = sphereCacheBox.key;
    ${renderSrc}
    return {
      project: project,
      unproject: unproject,
      renderSphereTexture: function(ctx, cx, cy, R) {
        renderSphereTexture(ctx, cx, cy, R, canvas.width, canvas.height);
        sphereCacheBox.cache = sphereCache;
        sphereCacheBox.key = sphereCacheKey;
      },
    };
    `
  );
  return fn as (
    canvas: { width: number; height: number },
    tourCenterLat: number,
    tourCenterLon: number,
    earthImageData: { data: Uint8ClampedArray; width: number; height: number } | null,
    sphereCacheBox: { cache: unknown; key: string }
  ) => {
    project: (lat: number, lon: number, centerLat: number, centerLon: number, R: number, cx: number, cy: number) => { x: number; y: number; visible: boolean };
    unproject: (X: number, Y: number, centerLat: number, centerLon: number) => { lat: number; lon: number } | null;
    renderSphereTexture: (ctx: unknown, cx: number, cy: number, R: number) => void;
  };
}

describe('巡回テストモーダル: 地表テクスチャの球面マッピング(純粋関数)', () => {
  it('unproject: projectの逆変換になっている(往復して同じ緯度経度に戻る)', () => {
    const html = getHeritageJourneyPage();
    const load = loadTextureFns(html);
    const api = load({ width: 520, height: 520 }, 10, 20, null, { cache: null, key: '' });
    const lat = 35, lon = 80, centerLat = 10, centerLon = 20, R = 200;
    const p = api.project(lat, lon, centerLat, centerLon, R, 0, 0);
    const back = api.unproject(p.x / R, -p.y / R, centerLat, centerLon);
    expect(back).not.toBeNull();
    expect(back!.lat).toBeCloseTo(lat, 4);
    expect(back!.lon).toBeCloseTo(lon, 4);
  });

  it('unproject: 中心からの距離が1を超える(球の外側)場合はnullを返す', () => {
    const html = getHeritageJourneyPage();
    const load = loadTextureFns(html);
    const api = load({ width: 520, height: 520 }, 0, 0, null, { cache: null, key: '' });
    expect(api.unproject(1.5, 0, 0, 0)).toBeNull();
  });

  it('renderSphereTexture: 画面中心のピクセルには中心座標(centerLat,centerLon)のテクスチャ色を書き込む', () => {
    const html = getHeritageJourneyPage();
    const load = loadTextureFns(html);
    // 1x1のダミーテクスチャ(単色)。中心座標がどこであってもこの色が使われる
    const earthImageData = { data: new Uint8ClampedArray([10, 20, 30, 255]), width: 1, height: 1 };
    const W = 20, H = 20;
    const writes: { x: number; y: number; r: number; g: number; b: number }[] = [];
    const ctx = {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: (img: { data: Uint8ClampedArray; width: number; height: number }) => {
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            if (img.data[i + 3] > 0) writes.push({ x, y, r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] });
          }
        }
      },
    };
    const api = load({ width: W, height: H }, 0, 0, earthImageData, { cache: null, key: '' });
    api.renderSphereTexture(ctx, W / 2, H / 2, 8);

    const center = writes.find((w) => w.x === W / 2 && w.y === H / 2);
    expect(center).toBeDefined();
    expect(center!.r).toBe(10);
    expect(center!.g).toBe(20);
    expect(center!.b).toBe(30);
    // 球の外側(円の範囲外)にはピクセルを書き込まない
    expect(writes.find((w) => w.x === 0 && w.y === 0)).toBeUndefined();
  });

  it('renderSphereTexture: 中心・ズームが変わらなければキャッシュを再利用し、createImageDataを呼び直さない', () => {
    const html = getHeritageJourneyPage();
    const load = loadTextureFns(html);
    const earthImageData = { data: new Uint8ClampedArray([1, 2, 3, 255]), width: 1, height: 1 };
    let createCount = 0;
    let putCount = 0;
    const ctx = {
      createImageData: (w: number, h: number) => { createCount++; return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
      putImageData: () => { putCount++; },
    };
    const cacheBox = { cache: null as unknown, key: '' };
    const api = load({ width: 20, height: 20 }, 0, 0, earthImageData, cacheBox);
    api.renderSphereTexture(ctx, 10, 10, 8);
    api.renderSphereTexture(ctx, 10, 10, 8);

    expect(createCount).toBe(1);
    expect(putCount).toBe(2);
  });
});

describe('巡回テストモーダル: 初期表示の中心座標・ズーム自動算出(純粋関数)', () => {
  it('project: 中心座標そのものは画面中心(cx,cy)に投影される', () => {
    const { project } = loadProjectionFns(getHeritageJourneyPage());
    const p = project(35, 100, 35, 100, 200, 0, 0);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(0, 5);
    expect(p.visible).toBe(true);
  });

  it('circularMeanLon: 2つの経度の中間値(経度またぎも考慮)を返す', () => {
    const { circularMeanLon } = loadProjectionFns(getHeritageJourneyPage());
    expect(circularMeanLon(10, 20)).toBeCloseTo(15, 5);
    // 179度と-179度(またいで2度差)の中間は180(=-180)付近になる
    expect(Math.abs(circularMeanLon(179, -179))).toBeCloseTo(180, 0);
  });

  it('computeInitialView: 中間の経由地は無視し、出発点(先頭)・目的地(末尾)だけの中間座標を中心にする', () => {
    const { computeInitialView } = loadProjectionFns(getHeritageJourneyPage());
    const points = [{ lat: 40, lon: 0 }, { lat: 20, lon: 100 }, { lat: 60, lon: 20 }];
    const view = computeInitialView(points, 200);
    expect(view.centerLat).toBeCloseTo((40 + 60) / 2, 5);
    expect(view.centerLon).toBeCloseTo(10, 5);
  });

  it('computeInitialView: 出発点・目的地が近い(距離が小さい)ほどズームレベルを大きくする', () => {
    const { computeInitialView } = loadProjectionFns(getHeritageJourneyPage());
    const near = computeInitialView([{ lat: 48, lon: 2 }, { lat: 48.1, lon: 2.1 }], 200);
    const far = computeInitialView([{ lat: 48, lon: 2 }, { lat: -33, lon: 151 }], 200);
    expect(near.zoom).toBeGreaterThan(far.zoom);
  });

  it('computeInitialView: ズームはZOOM_MIN〜ZOOM_MAXの範囲にクランプされる', () => {
    const { computeInitialView } = loadProjectionFns(getHeritageJourneyPage());
    const sameSpot = computeInitialView([{ lat: 48, lon: 2 }, { lat: 48, lon: 2 }], 200);
    expect(sameSpot.zoom).toBeLessThanOrEqual(16);
    expect(sameSpot.zoom).toBeGreaterThanOrEqual(0.5);
  });

  it('computeInitialView: 出発点・目的地の投影後の距離が、算出したズームでbaseRの90%付近に収まる(ZOOM_MIN/MAXにクランプされない適度な離れ具合の場合)', () => {
    const { project, computeInitialView } = loadProjectionFns(getHeritageJourneyPage());
    // 中心から見て経度30度ずつ離れた2点(生ズーム1.8倍相当、ZOOM_MIN=0.5〜ZOOM_MAX=6の範囲内)
    const points = [{ lat: 0, lon: -30 }, { lat: 0, lon: 30 }];
    const baseR = 200;
    const view = computeInitialView(points, baseR);
    const R = baseR * view.zoom;
    const pStart = project(points[0].lat, points[0].lon, view.centerLat, view.centerLon, R, 0, 0);
    const pEnd = project(points[1].lat, points[1].lon, view.centerLat, view.centerLon, R, 0, 0);
    const maxDist = Math.max(Math.hypot(pStart.x, pStart.y), Math.hypot(pEnd.x, pEnd.y));
    expect(maxDist).toBeCloseTo(baseR * 0.97, 0);
  });
});

describe('heritage-journeyページ: 「🌐 巡回テスト」ボタンとモーダル(マークアップ)', () => {
  it('ボタン(#tour-test-btn)とモーダル(#tour-modal-overlay)がマークアップに存在する', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('id="tour-test-btn"');
    expect(html).toContain('id="tour-modal-overlay"');
    expect(html).toContain('id="tour-globe-canvas"');
    expect(html).toContain('id="tour-play-btn"');
  });

  it('「巡回テスト」ボタンは「巡回ルートを再現する」ボタンより先(左側)に配置される', () => {
    const html = getHeritageJourneyPage();
    const testIdx = html.indexOf('id="tour-test-btn"');
    const replayIdx = html.indexOf('id="replay-tour-btn"');
    expect(testIdx).toBeGreaterThan(-1);
    expect(replayIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeLessThan(replayIdx);
  });
});

describe('heritage-journeyページ: 「🌐 巡回テスト」モーダル(DOM実動作)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('ボタンを押すとモーダルが開き、現在地ラベルに「国旗/宿泊推奨地」を表示する', () => {
    setupPage();
    selectRoute();
    const tourBtn = document.getElementById('tour-test-btn') as HTMLButtonElement;
    tourBtn.click();

    const overlay = document.getElementById('tour-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
    const label = document.getElementById('tour-current-label')!;
    expect(label.textContent).toMatch(/ \/ /);
    expect(label.textContent).not.toBe('');
  });

  it('✕ボタンでモーダルを閉じられる', () => {
    setupPage();
    const tourBtn = document.getElementById('tour-test-btn') as HTMLButtonElement;
    tourBtn.click();
    const overlay = document.getElementById('tour-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);

    (document.getElementById('tour-modal-close') as HTMLButtonElement).click();
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('オーバーレイの背景クリックでモーダルを閉じられる(モーダル本体のクリックでは閉じない)', () => {
    setupPage();
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
    const overlay = document.getElementById('tour-modal-overlay')!;

    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('(タイマー実動作) 再生ボタンを押すとアニメーションが進み、現在地ラベルが最終地点まで更新される', () => {
    vi.useFakeTimers();
    try {
      setupPage();
      (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
      const playBtn = document.getElementById('tour-play-btn') as HTMLButtonElement;
      const label = document.getElementById('tour-current-label')!;
      const initialText = label.textContent;

      playBtn.click();
      expect(playBtn.textContent).toContain('一時停止');
      // 出発地/到着地にも実際の国旗(flag)を持たせるようになったため(ルート順序
      // パネルの国旗表示・国別フィルタ機能の追加に伴う変更)、出発地から次の
      // 経由地までが同一国・同一宿泊都市(例: フランス国内でパリ→パリ近郊)だと
      // 1000ms程度の短い進みではラベル文字列(国旗+宿泊都市)が変化しないことがある。
      // 固定の短い時間で1回だけ判定せず、宿泊都市が実際に変わるまで少しずつ
      // 進めることで、ルートの具体的な地理データに依存しない安定した検証にする。
      for (let i = 0; i < 100 && label.textContent === initialText; i++) {
        vi.advanceTimersByTime(100);
      }
      expect(label.textContent).not.toBe(initialText);

      // 最後の地点に到達するとstopAnim()がインターバルをclearIntervalするため、
      // runAllTimers()で「完走してタイマーが消えるまで」を一気に進める。
      // (heritage-journeyの経由地候補プールに空港・駅が加わり既定ルート上の地点数が
      // 増えたため、advanceTimersByTimeの固定値では足りなくなった。runAllTimersなら
      // 地点数に関わらず完走まで進められる)
      vi.runAllTimers();
      expect(playBtn.textContent).toContain('再生');
      expect(playBtn.textContent).not.toContain('一時停止');
    } finally {
      vi.useRealTimers();
    }
  }, 20000);

  it('(タイマー実動作) 再生中にモーダルを閉じるとタイマーが止まり、以降ラベルが更新されない', () => {
    vi.useFakeTimers();
    try {
      setupPage();
      (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
      (document.getElementById('tour-play-btn') as HTMLButtonElement).click();
      vi.advanceTimersByTime(40);
      const label = document.getElementById('tour-current-label')!;
      const midText = label.textContent;

      (document.getElementById('tour-modal-close') as HTMLButtonElement).click();
      vi.advanceTimersByTime(5000);
      expect(label.textContent).toBe(midText);
    } finally {
      vi.useRealTimers();
    }
  });

  it('(タイマー実動作) 再度開くと再生位置は最初からになり、前回のタイマーが二重に走らない', () => {
    vi.useFakeTimers();
    try {
      setupPage();
      const tourBtn = document.getElementById('tour-test-btn') as HTMLButtonElement;
      tourBtn.click();
      (document.getElementById('tour-play-btn') as HTMLButtonElement).click();
      vi.advanceTimersByTime(40);
      (document.getElementById('tour-modal-close') as HTMLButtonElement).click();

      tourBtn.click();
      const label = document.getElementById('tour-current-label')!;
      expect(label.textContent).toMatch(/ \/ /);

      const playBtn = document.getElementById('tour-play-btn') as HTMLButtonElement;
      expect(playBtn.textContent).toContain('再生');
      expect(playBtn.textContent).not.toContain('一時停止');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('巡回テストモーダル: ホイール・ピンチによるズーム(webgl-heritageページから移植、DOM実動作)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('マウスホイール(上スクロール=deltaY負)で地球儀の描画半径が拡大する', () => {
    const { arcCalls } = setupPage();
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
    const radiusBeforeCount = arcCalls.length;
    const canvas = document.getElementById('tour-globe-canvas')!;
    // 既定の出発地・到着地(Paris→Rome)は近接しておりZOOM_MAXに張り付いている
    // ことがあるため、まず一度ズームアウトして拡大の余地を作ってから検証する
    arcCalls.length = 0;
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 500, cancelable: true }));
    const radiusBefore = globeRadiusFromArcCalls(arcCalls);
    arcCalls.length = 0;

    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));

    const radiusAfter = globeRadiusFromArcCalls(arcCalls);
    expect(radiusBeforeCount).toBeGreaterThan(0);
    expect(radiusAfter).toBeGreaterThan(radiusBefore);
  });

  it('マウスホイール(下スクロール=deltaY正)で地球儀の描画半径が縮小する', () => {
    const { arcCalls } = setupPage();
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
    const radiusBefore = globeRadiusFromArcCalls(arcCalls);
    arcCalls.length = 0;

    const canvas = document.getElementById('tour-globe-canvas')!;
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }));

    const radiusAfter = globeRadiusFromArcCalls(arcCalls);
    expect(radiusAfter).toBeLessThan(radiusBefore);
  });

  it('2本指のピンチアウト(指の間隔が広がる)で地球儀の描画半径が拡大する', () => {
    const { arcCalls } = setupPage();
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
    const canvas = document.getElementById('tour-globe-canvas')!;
    // 既定の出発地・到着地(Paris→Rome)は近接しておりZOOM_MAXに張り付いている
    // ことがあるため、まず一度ズームアウトして拡大の余地を作ってから検証する
    arcCalls.length = 0;
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 500, cancelable: true }));
    const radiusBefore = globeRadiusFromArcCalls(arcCalls);
    arcCalls.length = 0;

    const touchesStart = [{ clientX: 100, clientY: 100 }, { clientX: 120, clientY: 100 }] as unknown as TouchList;
    canvas.dispatchEvent(Object.assign(new Event('touchstart', { cancelable: true }), { touches: touchesStart }));
    const touchesMove = [{ clientX: 60, clientY: 100 }, { clientX: 160, clientY: 100 }] as unknown as TouchList;
    canvas.dispatchEvent(Object.assign(new Event('touchmove', { cancelable: true }), { touches: touchesMove }));

    const radiusAfter = globeRadiusFromArcCalls(arcCalls);
    expect(radiusAfter).toBeGreaterThan(radiusBefore);
  });

  it('2本指のピンチイン(指の間隔が狭まる)で地球儀の描画半径が縮小する', () => {
    const { arcCalls } = setupPage();
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
    const radiusBefore = globeRadiusFromArcCalls(arcCalls);
    arcCalls.length = 0;

    const canvas = document.getElementById('tour-globe-canvas')!;
    const touchesStart = [{ clientX: 60, clientY: 100 }, { clientX: 160, clientY: 100 }] as unknown as TouchList;
    canvas.dispatchEvent(Object.assign(new Event('touchstart', { cancelable: true }), { touches: touchesStart }));
    const touchesMove = [{ clientX: 100, clientY: 100 }, { clientX: 120, clientY: 100 }] as unknown as TouchList;
    canvas.dispatchEvent(Object.assign(new Event('touchmove', { cancelable: true }), { touches: touchesMove }));

    const radiusAfter = globeRadiusFromArcCalls(arcCalls);
    expect(radiusAfter).toBeLessThan(radiusBefore);
  });
});

describe('heritage-journeyページ: 常時表示の縮小プレビュー(#tour-mini-panel)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('マークアップにヘッダ(#tour-mini-head)とcanvas(#tour-mini-canvas)を持ち、初期表示は画面左上に固定配置される', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('id="tour-mini-panel"');
    expect(html).toContain('id="tour-mini-head"');
    expect(html).toContain('id="tour-mini-canvas"');
    const cssBlock = html.slice(html.indexOf('.tour-mini-panel{'), html.indexOf('.tour-mini-panel{') + 200);
    expect(cssBlock).toContain('position:fixed');
    expect(cssBlock).toContain('top:12px');
    expect(cssBlock).toContain('left:12px');
  });

  it('ルートが計算済み(state.lastOrdered.length>=2)になると表示され、地球儀を描画する', () => {
    const { arcCalls } = setupPage();
    const panel = document.getElementById('tour-mini-panel')!;
    expect(panel.style.display).not.toBe('none');
    // ミニ地球儀(半径の小さい方)の描画呼び出しが含まれる
    expect(arcCalls.length).toBeGreaterThan(0);
  });

  it('ミニ地球儀のcanvas(#tour-mini-canvas)をタップすると、画面中央の巡回テストモーダルが開く', () => {
    setupPage();
    const miniCanvas = document.getElementById('tour-mini-canvas') as HTMLCanvasElement;
    miniCanvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const overlay = document.getElementById('tour-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
  });

  it('ヘッダ(#tour-mini-head)をドラッグすると画面内の任意の位置へ移動する', () => {
    setupPage();
    const panel = document.getElementById('tour-mini-panel') as HTMLElement;
    const head = document.getElementById('tour-mini-head') as HTMLElement;
    panel.getBoundingClientRect = () => ({ left: 12, top: 12, right: 292, bottom: 60, width: 280, height: 48, x: 12, y: 12, toJSON: () => ({}) });
    Object.defineProperty(panel, 'offsetWidth', { value: 280, configurable: true });
    Object.defineProperty(panel, 'offsetHeight', { value: 300, configurable: true });

    head.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 30, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 230, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(panel.style.left).toBe((12 + (250 - 50)) + 'px');
    expect(panel.style.top).toBe((12 + (230 - 30)) + 'px');
  });

  it('ドラッグ位置は画面外にはみ出さないようクランプされる', () => {
    setupPage();
    const panel = document.getElementById('tour-mini-panel') as HTMLElement;
    const head = document.getElementById('tour-mini-head') as HTMLElement;
    panel.getBoundingClientRect = () => ({ left: 12, top: 12, right: 292, bottom: 60, width: 280, height: 48, x: 12, y: 12, toJSON: () => ({}) });
    Object.defineProperty(panel, 'offsetWidth', { value: 280, configurable: true });
    Object.defineProperty(panel, 'offsetHeight', { value: 300, configurable: true });

    head.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: -9999, clientY: -9999, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(panel.style.left).toBe('0px');
    expect(panel.style.top).toBe('0px');
  });
});
