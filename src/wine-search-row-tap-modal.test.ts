// @vitest-environment jsdom
/**
 * 対象: /wine-search の検索結果行タップ→個別詳細モーダル。
 * 行のどのセルをタップしてもid・銘柄名を抽出してGET /api/wine/:idを呼び、
 * モーダルが他の要素より必ず前面(最上位レイヤー)に出るようz-indexを
 * 動的に計算(getNextZ)しているかを確認する。
 *
 * 故障シナリオ:
 *   (1) ワイン名セル以外をタップしても反応しない(行全体がタップ対象になっていない)
 *   (2) モーダルのz-indexが固定値のままで、他の重なる要素の裏に隠れる
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWineSearchPage } from './views/wineSearch';

describe('/wine-search 検索結果行タップ→個別詳細モーダル', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  async function setup() {
    const html = getWineSearchPage('tester');
    const bodyIdx = html.indexOf('<body>') + 6;
    const scriptIdx = html.indexOf('<script>', bodyIdx);
    document.body.innerHTML = html.slice(bodyIdx, scriptIdx);
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 42, wineName: 'テストワイン', model: 'm', dim: 2048, details: null, metadata: null }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const scriptSrc = html.slice(scriptIdx + 8, html.indexOf('</script>', scriptIdx));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    const tableBody = document.getElementById('wineTableBody')!;
    tableBody.innerHTML = '<tr class="wine-row" data-id="42" data-wine-name="テストワイン"><td class="sim">0.9</td><td class="wine-name">テストワイン</td><td class="fat">0.1</td></tr>';
    return { fetchMock, tableBody };
  }

  it('ワイン名以外のセル(特性列)をタップしてもGET /api/wine/:idが呼ばれモーダルが開く', async () => {
    const { fetchMock, tableBody } = await setup();
    const fatCell = tableBody.querySelector('.fat') as HTMLElement;
    fatCell.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledWith('/api/wine/42', expect.anything());
    const overlay = document.getElementById('detailModalOverlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
  });

  it('モーダルのz-indexは固定値ではなくgetNextZ()相当の動的な値になる(既存のfixed要素より大きい)', async () => {
    const { tableBody } = await setup();
    var fixedEl = document.createElement('div');
    fixedEl.style.cssText = 'position:fixed;z-index:5000;';
    document.body.appendChild(fixedEl);
    const simCell = tableBody.querySelector('.sim') as HTMLElement;
    simCell.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const overlay = document.getElementById('detailModalOverlay')!;
    expect(parseInt(overlay.style.zIndex, 10)).toBeGreaterThan(5000);
  });
});

// 対象: 個別詳細モーダルの表示内容。出典URL列は常に表示しない。
// 埋め込みモデル名の行はPWA(display-mode: standalone)でのみ非表示にする。
//
// 故障シナリオ:
//   (1) wine_metadataにsource_urlsの値があると出典URL列が表示されてしまう
//   (2) 通常のブラウザ表示でもモデル名の行が消えてしまう(PWA判定漏れ)
//   (3) PWA(standalone)表示なのにモデル名の行が残ってしまう
describe('/wine-search 個別詳細モーダルの表示項目(出典URL非表示・PWAでのモデル名非表示)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function setupWithStandalone(isStandalone: boolean) {
    const html = getWineSearchPage('tester');
    const bodyIdx = html.indexOf('<body>') + 6;
    const scriptIdx = html.indexOf('<script>', bodyIdx);
    document.body.innerHTML = html.slice(bodyIdx, scriptIdx);
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.indexOf('standalone') !== -1 ? isStandalone : false,
      media: query,
      addListener: () => {},
      removeListener: () => {},
    })));
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: 42,
        wineName: 'テストワイン',
        model: 'plamo-embedding-1b',
        dim: 2048,
        details: null,
        metadata: { source_urls: 'https://example.com/should-not-be-shown', country: '日本' },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const scriptSrc = html.slice(scriptIdx + 8, html.indexOf('</script>', scriptIdx));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    const tableBody = document.getElementById('wineTableBody')!;
    tableBody.innerHTML = '<tr class="wine-row" data-id="42" data-wine-name="テストワイン"><td class="wine-name">テストワイン</td></tr>';
    return tableBody;
  }

  it('通常のブラウザ表示ではモデル名を表示し、出典URL列は表示しない', async () => {
    const tableBody = setupWithStandalone(false);
    (tableBody.querySelector('.wine-name') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById('detailModalMeta')!.textContent).toContain('モデル');
    expect(document.getElementById('detailModalTable')!.textContent).not.toContain('出典');
    expect(document.getElementById('detailModalTable')!.textContent).not.toContain('should-not-be-shown');
  });

  it('PWA(standalone)表示ではモデル名を表示せず、出典URL列も表示しない', async () => {
    const tableBody = setupWithStandalone(true);
    (tableBody.querySelector('.wine-name') as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById('detailModalMeta')!.textContent).not.toContain('モデル');
    expect(document.getElementById('detailModalTable')!.textContent).not.toContain('出典');
    expect(document.getElementById('detailModalTable')!.textContent).not.toContain('should-not-be-shown');
  });
});

// 対象: 検索結果の「合う料理」バッジをタップすると、検索キーワードと
// タップした料理の両方に一致する銘柄一覧を最上位レイヤーのモーダルに表示し、
// その中の各行をタップすると個別詳細モーダルがさらに前面(より上のレイヤー)
// に表示される、という2段階のモーダル遷移。
//
// 故障シナリオ:
//   (1) バッジをタップしても何も起きない(data-food属性やイベント委譲の不備)
//   (2) 一覧モーダルの行をタップしても個別詳細モーダルが開かない
//   (3) 個別詳細モーダルが一覧モーダルより背面に表示されてしまう(z-index逆転)
describe('/wine-search 合う料理バッジ→一覧モーダル→個別詳細モーダル', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  async function setupWithBadge() {
    const html = getWineSearchPage('tester');
    const bodyIdx = html.indexOf('<body>') + 6;
    const scriptIdx = html.indexOf('<script>', bodyIdx);
    document.body.innerHTML = html.slice(bodyIdx, scriptIdx);
    const fetchMock = vi.fn((url: string) => {
      if (String(url).indexOf('/api/wine/by-food') !== -1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [{ id: 7, wineName: '一致した銘柄', pairingFoods: '魚介', country: '日本', wineType: '白', characteristics: null }],
            total: 1,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 7, wineName: '一致した銘柄', model: 'm', dim: 2048, details: null, metadata: null }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const scriptSrc = html.slice(scriptIdx + 8, html.indexOf('</script>', scriptIdx));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    const foodBadgeRow = document.getElementById('foodBadgeRow')!;
    foodBadgeRow.innerHTML = '<span class="food-badge" data-food="魚介">🦐 魚介<span class="food-badge-count">(3)</span></span>';
    return { fetchMock, foodBadgeRow };
  }

  it('バッジをタップすると検索キーワード+料理で絞り込んだ一覧が最上位レイヤーのモーダルに表示される', async () => {
    const { fetchMock, foodBadgeRow } = await setupWithBadge();
    (document.getElementById('freeword') as HTMLInputElement).value = 'シャルドネ';
    var fixedEl = document.createElement('div');
    fixedEl.style.cssText = 'position:fixed;z-index:5000;';
    document.body.appendChild(fixedEl);

    const badge = foodBadgeRow.querySelector('.food-badge') as HTMLElement;
    badge.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/wine/by-food?food=%E9%AD%9A%E4%BB%8B&q=%E3%82%B7%E3%83%A3%E3%83%AB%E3%83%89%E3%83%8D'),
      expect.anything(),
    );
    const foodResultsOverlay = document.getElementById('foodResultsModalOverlay')!;
    expect(foodResultsOverlay.classList.contains('open')).toBe(true);
    expect(parseInt(foodResultsOverlay.style.zIndex, 10)).toBeGreaterThan(5000);
    expect(document.getElementById('foodResultsModalList')!.textContent).toContain('一致した銘柄');
  });

  it('一覧モーダルの行をタップすると個別詳細モーダルが一覧モーダルより前面(より上のレイヤー)に開く', async () => {
    const { foodBadgeRow } = await setupWithBadge();
    const badge = foodBadgeRow.querySelector('.food-badge') as HTMLElement;
    badge.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const row = document.querySelector('.food-results-row') as HTMLElement;
    expect(row).not.toBeNull();
    row.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const detailOverlay = document.getElementById('detailModalOverlay')!;
    const foodResultsOverlay = document.getElementById('foodResultsModalOverlay')!;
    expect(detailOverlay.classList.contains('open')).toBe(true);
    expect(parseInt(detailOverlay.style.zIndex, 10)).toBeGreaterThan(parseInt(foodResultsOverlay.style.zIndex, 10));
  });
});
