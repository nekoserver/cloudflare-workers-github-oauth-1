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
