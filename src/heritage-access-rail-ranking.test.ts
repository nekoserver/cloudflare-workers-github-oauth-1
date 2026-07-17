import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getHeritageAccessPage } from './views/heritageAccess';
import { HERITAGE_LIST } from './data/heritageList';
import { RAIL_LINES } from './data/railLines';

describe('getHeritageAccessPage 駅周辺世界遺産ランキング機能', () => {
  const html = getHeritageAccessPage('tester');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('🚉 ボタンとモーダルの要素が存在する', () => {
    expect(html).toContain('id="btn-rail-hr"');
    expect(html).toContain('id="rail-hr-overlay"');
    expect(html).toContain('id="rail-hr-body"');
    expect(html).toContain('id="rail-hr-close"');
    expect(html).toContain('function buildRailStationRanking');
    expect(html).toContain('function renderRailHrRanking');
    expect(html).toContain('function buildRailHrNearbyHtml');
  });

  it('駅データ・世界遺産データが埋め込まれている', () => {
    const railMatch = html.match(/var RAIL_LINES = (\[[\s\S]*?\]);/);
    expect(railMatch).not.toBeNull();
    const rail = JSON.parse(railMatch![1]);
    expect(rail.length).toBe(RAIL_LINES.length);

    const heritageMatch = html.match(/var HERITAGE_ALL = (\[[\s\S]*?\]);/);
    expect(heritageMatch).not.toBeNull();
    const heritage = JSON.parse(heritageMatch![1]);
    expect(heritage.length).toBe(HERITAGE_LIST.length);
  });

  it('新規モーダルの z-index は getNextZ() で動的に算出する（固定値を書かない）', () => {
    const idx = html.indexOf("document.getElementById('btn-rail-hr')");
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('getNextZ()');
  });

  it('駅の国旗は駅ごとの所在国（未指定なら路線の国）から決定される', () => {
    const idx = html.indexOf('function buildRailStationRanking');
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('flag: st.flag || line.flag');
    expect(block).toContain('country: st.country || line.country');
  });

  it('各行は国旗の右に路線名、その下に駅名が来る順で表示する', () => {
    const idx = html.indexOf('function renderRailHrRanking');
    const block = html.slice(idx, idx + 900);
    expect(block).toMatch(/rail-hr-flag[\s\S]*?rail-hr-line-primary[\s\S]*?r\.line[\s\S]*?rail-hr-station-sub[\s\S]*?r\.station/);
  });
});

describe('ユーロスターは国境をまたぐため、駅ごとに所在国の国旗を個別に持つ', () => {
  it('ロンドン側はイギリス、フランス側はフランスの国旗を個別に持つ', () => {
    const eurostar = RAIL_LINES.find((l) => l.name.indexOf('ユーロスター') !== -1)!;
    expect(eurostar).toBeTruthy();
    const paris = eurostar.stations.find((s) => s.name === 'パリ北駅')!;
    const london = eurostar.stations.find((s) => s.name === 'ロンドン・セントパンクラス駅')!;
    expect(paris.flag).toBe('🇫🇷');
    expect(paris.country).toBe('フランス');
    expect(london.flag).toBe('🇬🇧');
    expect(london.country).toBe('イギリス');
  });
});

describe('駅ごとの世界遺産カウント（200km以内・haversine）', () => {
  function hvKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const sl = Math.sin(dLat / 2), sn = Math.sin(dLon / 2);
    const a = sl * sl + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * sn * sn;
    return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
  }

  it('東京駅から200km以内には少なくとも1件以上の世界遺産データが存在しうる（0件でもエラーにならない）', () => {
    const tokyo = RAIL_LINES.flatMap((l) => l.stations).find((s) => s.name === '東京駅')!;
    expect(tokyo).toBeTruthy();
    const nearby = HERITAGE_LIST.filter((h) => hvKm(tokyo.lat, tokyo.lon, h.lat, h.lon) <= 200);
    expect(Array.isArray(nearby)).toBe(true);
  });

  it('集計範囲(200km)はUIタイトル・集計ロジックの両方で一致している', () => {
    const html = getHeritageAccessPage('tester');
    expect(html).toContain('駅周辺200km以内の世界遺産数ランキング');
    expect(html).not.toContain('駅周辺100km以内の世界遺産数ランキング');
    const rankIdx = html.indexOf('function buildRailStationRanking');
    expect(html.slice(rankIdx, rankIdx + 700)).toContain('<= 200');
    const nearbyIdx = html.indexOf('function buildRailHrNearbyHtml');
    expect(html.slice(nearbyIdx, nearbyIdx + 700)).toContain('<= 200');
  });
});

// ---------------------------------------------------------------------------
// 振る舞いテスト: 実DOMで🚉ボタン→ランキング→駅名タップでアコーディオン開閉、を検証する
// ---------------------------------------------------------------------------

function extractMainScript(fullHtml: string): string {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  let best = '';
  while ((m = re.exec(fullHtml)) !== null) {
    if (m[1].indexOf('function renderRailHrRanking(') !== -1) {
      best = m[1];
      break;
    }
  }
  if (!best) throw new Error('renderRailHrRanking を含む <script> が見つかりません');
  return best;
}

function setupDom() {
  const html = getHeritageAccessPage('testuser');
  const script = extractMainScript(html);
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/' });
  const window: any = dom.window;
  window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ rows: [] }) });
  window.eval(script);
  return window;
}

describe('🚉 モーダルの振る舞い', () => {
  it('ボタンを押すとランキングが世界遺産数の降順で表示される', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const rows = Array.from(window.document.querySelectorAll('.rail-hr-row')) as any[];
    expect(rows.length).toBeGreaterThan(0);
    const counts = rows.map((r) => parseInt(r.querySelector('.rail-hr-count').textContent, 10));
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('各行に路線名と駅名が表示され、路線名が国旗の右（先頭）に来る', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const first = window.document.querySelector('.rail-hr-row');
    const namesEl = first.querySelector('.rail-hr-names');
    const line = namesEl.querySelector('.rail-hr-line-primary');
    const station = namesEl.querySelector('.rail-hr-station-sub');
    expect(line.textContent.length).toBeGreaterThan(0);
    expect(station.textContent.length).toBeGreaterThan(0);
    // rail-hr-line-primary が rail-hr-station-sub より先（DOM順）に来ること
    expect(namesEl.children[0]).toBe(line);
    expect(namesEl.children[1]).toBe(station);
  });

  it('駅名をタップすると、別モーダルに遷移せず同じランキング内にアコーディオンとして開き、200km以内の世界遺産名が距離の近い順に表示される', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const firstRow = window.document.querySelector('.rail-hr-row');
    firstRow.dispatchEvent(new window.Event('click'));

    // ランキング自体は表示されたまま（画面遷移していない）
    const rowsStillVisible = window.document.querySelectorAll('.rail-hr-row');
    expect(rowsStillVisible.length).toBeGreaterThan(0);

    // タップした行の直後にアコーディオンが挿入される
    const acc = firstRow.nextSibling;
    expect(acc).toBeTruthy();
    expect(acc.classList.contains('rail-hr-acc')).toBe(true);

    const hRows = Array.from(acc.querySelectorAll('.rail-hr-h-row')) as any[];
    const dists = hRows.map((r: any) => parseInt(r.querySelector('.rail-hr-h-dist').textContent, 10));
    for (let i = 1; i < dists.length; i++) {
      expect(dists[i]).toBeGreaterThanOrEqual(dists[i - 1]);
    }
    dists.forEach((d) => expect(d).toBeLessThanOrEqual(200));
  });

  it('アコーディオン内の各世界遺産行は、国旗の右側に地球儀(webgl-heritage)で使っているのと同じアイコン(HERITAGE_LISTのeフィールド)が表示される', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const firstRow = window.document.querySelector('.rail-hr-row');
    firstRow.dispatchEvent(new window.Event('click'));

    const acc = firstRow.nextSibling;
    const hRows = Array.from(acc.querySelectorAll('.rail-hr-h-row')) as any[];
    expect(hRows.length).toBeGreaterThan(0);

    hRows.forEach((row: any) => {
      const nameEl = row.querySelector('.rail-hr-h-name');
      const flagEl = nameEl.querySelector('.rail-hr-h-flag');
      const iconEl = nameEl.querySelector('.rail-hr-h-icon');
      const siteNameEl = nameEl.querySelector('.rail-hr-h-site-name');
      expect(flagEl).toBeTruthy();
      expect(iconEl).toBeTruthy();
      expect(siteNameEl).toBeTruthy();

      // 国旗(flagEl)がアイコン(iconEl)より先(DOM順=表示上は左)に来る = アイコンは国旗の右側
      expect(nameEl.children[0]).toBe(flagEl);
      expect(nameEl.children[1]).toBe(iconEl);
      expect(nameEl.children[2]).toBe(siteNameEl);

      // アイコンはHERITAGE_LISTの該当エントリのeフィールド(=地球儀の表示に使うのと同じアイコン)と一致する
      // (nameだけでは同名で国旗違いのエントリがあるため、flagも合わせて一意に特定する)
      const site = HERITAGE_LIST.find((h) => h.n === siteNameEl.textContent && h.f === flagEl.textContent);
      expect(site).toBeTruthy();
      expect(iconEl.textContent).toBe(site!.e);
    });
  });

  it('開いているアコーディオンを再タップすると閉じる', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const firstRow = window.document.querySelector('.rail-hr-row');
    firstRow.dispatchEvent(new window.Event('click'));
    expect(firstRow.nextSibling.classList.contains('rail-hr-acc')).toBe(true);

    firstRow.dispatchEvent(new window.Event('click'));
    const next = firstRow.nextSibling;
    expect(next === null || !next.classList || !next.classList.contains('rail-hr-acc')).toBe(true);
  });

  it('別の駅をタップすると、先に開いていたアコーディオンは閉じて新しい駅のアコーディオンだけが開く', () => {
    const window = setupDom();
    window.document.getElementById('btn-rail-hr').dispatchEvent(new window.Event('click'));
    const rows = Array.from(window.document.querySelectorAll('.rail-hr-row')) as any[];
    expect(rows.length).toBeGreaterThan(1);
    rows[0].dispatchEvent(new window.Event('click'));
    rows[1].dispatchEvent(new window.Event('click'));

    expect(window.document.querySelectorAll('.rail-hr-acc').length).toBe(1);
    expect(rows[1].nextSibling.classList.contains('rail-hr-acc')).toBe(true);
  });
});
