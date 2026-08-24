// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象1: /heritage-journeyページの出発地(#start-city)・到着地(#end-city)選択を
// Cookie(heritage_journey_start_city / heritage_journey_end_city)に保存し、
// ページ読み込み時に再現する機能。
//
// 対象2: 経由地候補の初期値(すべて解除+駅OFF+空港ON+城ON)。
//
// 対象3: 出発地・到着地の中間地点を中心に、選択中の経由地候補の中で最も離れている
// 座標までの距離を「スコープの半径」として、経由地候補のON/OFFが切り替わるたびに
// 巡回ルートスコープ(ミニ地球儀)のズーム(=描画上の半径)を再計算する機能。
//
// 故障シナリオ:
//   (1) Cookie未設定時に既定(Paris/Rome)にならない
//   (2) 出発地・到着地を変更してもCookieに保存されない
//   (3) 保存済みCookie値がCITIES上に存在しない(不正・削除済み)場合にクラッシュする、
//       またはフォールバックせず空の状態になる
//   (4) 入替ボタン(swap-btn)でCookieが更新されない
//   (5) 経由地候補の初期値が「すべて解除+駅OFF+空港ON+城ON」になっていない
//   (6) 経由地候補のON/OFF切り替え(駅/空港/城トグル)で巡回ルートスコープの
//       ズーム(半径)が再計算されない(出発地・到着地が変わらない限りキャッシュされたまま)

function setupPage() {
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

function clearCityCookies() {
  document.cookie = 'heritage_journey_start_city=; Path=/; Max-Age=0';
  document.cookie = 'heritage_journey_end_city=; Path=/; Max-Age=0';
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  clearCityCookies();
});

describe('heritage-journeyページ: 出発地・到着地のCookie保存/復元', () => {
  it('Cookie未設定時は既定(出発地Paris/到着地Rome)になる', () => {
    clearCityCookies();
    setupPage();
    expect((document.getElementById('start-city') as HTMLSelectElement).value).toBe('Paris');
    expect((document.getElementById('end-city') as HTMLSelectElement).value).toBe('Rome');
  });

  it('出発地を変更するとCookie(heritage_journey_start_city)に保存される', () => {
    clearCityCookies();
    setupPage();
    const startSel = document.getElementById('start-city') as HTMLSelectElement;
    startSel.value = 'London';
    startSel.dispatchEvent(new Event('change'));
    expect(document.cookie).toContain('heritage_journey_start_city=' + encodeURIComponent('London'));
  });

  it('到着地を変更するとCookie(heritage_journey_end_city)に保存される', () => {
    clearCityCookies();
    setupPage();
    const endSel = document.getElementById('end-city') as HTMLSelectElement;
    endSel.value = 'London';
    endSel.dispatchEvent(new Event('change'));
    expect(document.cookie).toContain('heritage_journey_end_city=' + encodeURIComponent('London'));
  });

  it('保存済みのCookie値がある場合、ページ読み込み時にその出発地・到着地が復元される', () => {
    clearCityCookies();
    document.cookie = 'heritage_journey_start_city=' + encodeURIComponent('Vienna') + '; Path=/';
    document.cookie = 'heritage_journey_end_city=' + encodeURIComponent('London') + '; Path=/';
    setupPage();
    expect((document.getElementById('start-city') as HTMLSelectElement).value).toBe('Vienna');
    expect((document.getElementById('end-city') as HTMLSelectElement).value).toBe('London');
  });

  it('Cookie値がCITIES上に存在しない不正値の場合、クラッシュせず既定(Paris/Rome)にフォールバックする', () => {
    clearCityCookies();
    document.cookie = 'heritage_journey_start_city=' + encodeURIComponent('存在しない都市XYZ') + '; Path=/';
    document.cookie = 'heritage_journey_end_city=' + encodeURIComponent('存在しない都市ABC') + '; Path=/';
    expect(() => setupPage()).not.toThrow();
    expect((document.getElementById('start-city') as HTMLSelectElement).value).toBe('Paris');
    expect((document.getElementById('end-city') as HTMLSelectElement).value).toBe('Rome');
  });

  it('入替ボタン(swap-btn)を押すと入替後の値でCookieが更新される', () => {
    clearCityCookies();
    setupPage();
    document.getElementById('swap-btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.cookie).toContain('heritage_journey_start_city=' + encodeURIComponent('Rome'));
    expect(document.cookie).toContain('heritage_journey_end_city=' + encodeURIComponent('Paris'));
  });
});

describe('heritage-journeyページ: 経由地候補の初期値(すべて解除+駅OFF+空港ON+城ON)', () => {
  it('トグルボタンの既定状態がaria-pressedで駅=false/空港=true/城=trueになる', () => {
    clearCityCookies();
    setupPage();
    expect(document.getElementById('toggle-stations-btn')!.getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('toggle-airports-btn')!.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('toggle-castles-btn')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('個々の経由地候補チェックボックスも、空港・城のみ既定でチェック済み(駅・世界遺産(城以外)はOFF)', () => {
    clearCityCookies();
    setupPage();
    const rows = Array.from(document.querySelectorAll('#cand-list .cand-row'));
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      const label = row.querySelector('.cname')!.textContent || '';
      const cb = row.querySelector('input[type=checkbox]') as HTMLInputElement;
      const isAirport = !!row.querySelector('.airport-network-btn');
      const isCastle = label.indexOf('🏰') === 0;
      if (isAirport || isCastle) {
        expect(cb.checked).toBe(true);
      } else {
        expect(cb.checked).toBe(false);
      }
    });
  });
});

describe('heritage-journeyページ: 出発地・到着地の中間地点から最も離れた座標をスコープの半径とする(computeInitialViewの計算式)', () => {
  // src/views/heritageJourney.tsのcomputeInitialView()と同じ計算式を再現する
  // (heritageJourney-tour-mitokoro-tooltip-20260820.test.tsと同じ移植パターン)。
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
    return { centerLat, centerLon, zoom, maxDist };
  }

  const PARIS = { lat: 48.8566, lon: 2.3522 };
  const ROME = { lat: 41.9028, lon: 12.4964 };
  const baseR = 236;

  it('出発地・到着地の2点だけの場合と比べ、より遠い経由地候補を含めるとズームが小さくなる(半径が広がる)', () => {
    const twoPointView = computeInitialView([PARIS, ROME], baseR);
    // パリ・ローマの中点から見て、両都市よりも明らかに遠い地点(スオメンリンナ、フィンランド)。
    const farCandidate = { lat: 60.1436, lon: 24.9844 };
    const withFarCandidateView = computeInitialView([PARIS, farCandidate, ROME], baseR);

    expect(withFarCandidateView.maxDist).toBeGreaterThan(twoPointView.maxDist);
    expect(withFarCandidateView.zoom).toBeLessThan(twoPointView.zoom);
  });

  it('中心(centerLat/centerLon)は常に出発地・到着地の中間地点になり、経由地候補の有無で変わらない', () => {
    const twoPointView = computeInitialView([PARIS, ROME], baseR);
    const farCandidate = { lat: 60.1436, lon: 24.9844 };
    const withFarCandidateView = computeInitialView([PARIS, farCandidate, ROME], baseR);

    expect(withFarCandidateView.centerLat).toBeCloseTo(twoPointView.centerLat, 10);
    expect(withFarCandidateView.centerLon).toBeCloseTo(twoPointView.centerLon, 10);
  });
});

describe('heritage-journeyページ: 経由地候補のON/OFF切り替えのたびに巡回ルートスコープが再描画される', () => {
  it('「駅ON/OFF」をクリックするたびに#tour-globe-canvas/#tour-mini-canvasへ再描画が走る(出発地・到着地は変えていない)', () => {
    clearCityCookies();
    const html = getHeritageJourneyPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    let clearCount = 0;
    HTMLCanvasElement.prototype.getContext = (() => ({
      clearRect: () => { clearCount++; }, beginPath: () => {}, arc: () => {}, ellipse: () => {},
      fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ exists: false }) }));
    vi.stubGlobal('fetch', fetchMock);
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    clearCount = 0;
    document.getElementById('toggle-stations-btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clearCount).toBeGreaterThan(0);
  });
});
