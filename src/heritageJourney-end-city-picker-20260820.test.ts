// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「出発地・到着地」行にある到着地セレクトボックス
// (#end-city)を、最上位レイヤーのモーダルテーブル(#end-city-picker-modal-overlay)に
// 差し替えた変更。#end-cityは<select>のままDOMに残し(display:none)、値/changeイベント
// の挙動は一切変更しない。見た目だけを都市名を表示するボタン(#end-city-picker-btn)に
// 差し替え、押すと出発地からの距離(km)降順で並んだ都市一覧テーブルを開く。行クリックで
// #end-cityの値をセットしchangeイベントを発火する。
//
// 故障シナリオ:
//   (1) #end-cityがDOMから消えてしまい、既存の.value読み書き/changeリスナーが壊れる
//   (2) ボタンを押してもモーダルが開かない、テーブルが描画されない
//   (3) 距離(km)の計算が誤っている、または降順ソートになっていない
//   (4) 行クリックで#end-cityの値がセットされない、またはchangeイベントが発火せず
//       recompute()等の既存の副作用が起きない
//   (5) 出発地が未確定(想定外)の場合にundefined.latで例外が発生する
//   (6) 閉じるボタン/背景クリック/Escapeキーでモーダルが閉じない

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn((_input: unknown, _init?: unknown) => Promise.resolve({ json: () => Promise.resolve({ exists: false }) }));
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PARIS = { lat: 48.8566, lon: 2.3522 };
const ROME = { lat: 41.9028, lon: 12.4964 };

describe('heritage-journeyページ: #end-cityは<select>のままDOMに残る(後方互換)', () => {
  it('#end-cityがDOM上に存在し、初期値は既存デフォルトのRomeのまま', () => {
    setupPage();
    const endSel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    expect(endSel).not.toBeNull();
    expect(endSel.tagName).toBe('SELECT');
    expect(endSel.value).toBe('Rome');
  });

  it('#end-city-picker-btnが#end-cityと同じ行(.city-row)に存在する', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn');
    const endCity = document.getElementById('end-city')!;
    expect(btn).not.toBeNull();
    expect(btn!.closest('.city-row')).toBe(endCity.closest('.city-row'));
  });

  it('既存コードのように.valueを直接書き換えてchangeイベントを発火する操作が引き続き機能する(recomputeの副作用で#summary-gridが更新される)', () => {
    setupPage();
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    const endSel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    startSel.value = 'Vienna';
    startSel.dispatchEvent(new Event('change'));
    endSel.value = 'Bratislava';
    endSel.dispatchEvent(new Event('change'));
    expect(endSel.value).toBe('Bratislava');
    const summary = document.getElementById('summary-grid')!;
    expect(summary.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('heritage-journeyページ: 到着地ボタンを押すとモーダルが開く', () => {
  it('初期状態でモーダルは閉じており、ボタンクリックで開く', () => {
    setupPage();
    const overlay = document.getElementById('end-city-picker-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(false);
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();
    expect(overlay.classList.contains('open')).toBe(true);
  });

  it('ボタンのラベルには現在の到着地(初期値: ローマ)の都市名が表示される', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    expect(btn.textContent).toBe('ローマ');
  });
});

describe('heritage-journeyページ: 到着地テーブルの距離(km)列と並び順', () => {
  it('各行に都市名と出発地(初期値パリ)からの距離(km)が表示され、降順に並んでいる', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();

    const body = document.getElementById('end-city-picker-table-body')!;
    const rows = Array.from(body.querySelectorAll('tr'));
    expect(rows.length).toBeGreaterThan(1);

    // ローマ行のkm値をスポットチェック(手計算のhaversineKmと一致すること)
    const romeRow = rows.find((r) => r.getAttribute('data-city-name') === 'Rome')!;
    expect(romeRow).toBeTruthy();
    const expectedKm = haversineKm(PARIS.lat, PARIS.lon, ROME.lat, ROME.lon);
    expect(romeRow.textContent).toContain(expectedKm.toFixed(1) + ' km');

    // 降順ソートの検証: 全行のkm値を抽出し、非増加列になっていること
    const kms = rows.map((r) => {
      const text = r.querySelectorAll('td')[1].textContent || '';
      return parseFloat(text);
    });
    for (let i = 1; i < kms.length; i++) {
      expect(kms[i - 1]).toBeGreaterThanOrEqual(kms[i]);
    }
  });

  it('現在選択中の到着地(ローマ)の行にend-city-picker-currentクラスが付く', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();
    const body = document.getElementById('end-city-picker-table-body')!;
    const romeRow = body.querySelector('[data-city-name="Rome"]')!;
    expect(romeRow.classList.contains('end-city-picker-current')).toBe(true);
    const otherRow = body.querySelector('[data-city-name="London"]')!;
    expect(otherRow.classList.contains('end-city-picker-current')).toBe(false);
  });
});

describe('heritage-journeyページ: 行クリックで到着地を選択', () => {
  it('行をクリックすると#end-cityの値がセットされchangeイベントが発火し(recomputeの副作用で再チェックfetchが呼ばれ)、モーダルが閉じる', async () => {
    const { fetchMock } = setupPage();
    await new Promise((r) => setTimeout(r, 0));
    fetchMock.mockClear();

    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    btn.click();
    const overlay = document.getElementById('end-city-picker-modal-overlay')!;
    const body = document.getElementById('end-city-picker-table-body')!;
    const londonRow = body.querySelector('[data-city-name="London"]') as HTMLElement;
    londonRow.click();

    const endSel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    expect(endSel.value).toBe('London');
    expect(overlay.classList.contains('open')).toBe(false);

    // #register-route-btnの再チェックfetch(route-exists)が発火していること = change連動の証拠
    await new Promise((r) => setTimeout(r, 0));
    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).indexOf('/api/heritage-journey/route-exists') === 0);
    expect(calls.length).toBeGreaterThanOrEqual(1);

    // ボタンラベルも新しい到着地名に更新される
    expect(btn.textContent).toBe('ロンドン');
  });
});

describe('heritage-journeyページ: 出発地未確定など異常系での距離列の扱い', () => {
  it('#start-cityの値が不正な都市名でも例外を投げず距離列は"-"になる', () => {
    setupPage();
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    // CITIESに存在しない値を強制的にセット(想定外の異常系)
    const opt = document.createElement('option');
    opt.value = '__unknown__';
    opt.textContent = '__unknown__';
    startSel.appendChild(opt);
    startSel.value = '__unknown__';

    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    expect(() => btn.click()).not.toThrow();

    const body = document.getElementById('end-city-picker-table-body')!;
    const rows = Array.from(body.querySelectorAll('tr'));
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => {
      const tds = Array.from(r.querySelectorAll('td'));
      expect(tds[1].textContent).toBe('-');
    });
  });
});

describe('heritage-journeyページ: モーダルを閉じる操作', () => {
  it('閉じるボタン・背景クリック・Escapeキーでそれぞれモーダルが閉じる', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    const overlay = document.getElementById('end-city-picker-modal-overlay') as HTMLElement;
    const closeBtn = document.getElementById('end-city-picker-modal-close') as HTMLButtonElement;

    btn.click();
    expect(overlay.classList.contains('open')).toBe(true);
    closeBtn.click();
    expect(overlay.classList.contains('open')).toBe(false);

    btn.click();
    expect(overlay.classList.contains('open')).toBe(true);
    Object.defineProperty(overlay, 'target', {});
    overlay.click();
    expect(overlay.classList.contains('open')).toBe(false);

    btn.click();
    expect(overlay.classList.contains('open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.classList.contains('open')).toBe(false);
  });
});

describe('heritage-journeyページ: 入替ボタンでも到着地ボタンのラベルが更新される', () => {
  it('⇄入替ボタンを押すと#end-cityの値が入れ替わり、ボタンラベルも追従する', () => {
    setupPage();
    const swapBtn = document.getElementById('swap-btn') as HTMLButtonElement;
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    const endSel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    expect(startSel.value).toBe('Paris');
    expect(endSel.value).toBe('Rome');

    swapBtn.click();

    expect(startSel.value).toBe('Rome');
    expect(endSel.value).toBe('Paris');
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    expect(btn.textContent).toBe('パリ');
  });
});
