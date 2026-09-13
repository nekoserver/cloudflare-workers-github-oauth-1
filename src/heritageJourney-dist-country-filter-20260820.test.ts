// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「出発地から見た目的地別プラン分布」セクション
// タイトル行右端に追加した「到達国を制限する : 」ラベル+ボタン(#dist-country-filter-btn)
// と、押下時に開く到達国選択モーダル(#dist-country-filter-modal-overlay)。
// 選択した国はCookie(heritage_journey_dest_country_filter)に保存し、
// ページ読み込み時にも復元・適用する。
//
// 故障シナリオ:
//   (1) Cookie未設定時にボタンラベルが「しない(デフォルト)」にならない
//   (2) モーダルの並び順が「しない」を先頭に固定できていない、または
//       国別件数の降順ソートが崩れている
//   (3) 選択後にCookieへ保存されない、または保存値の属性(Secure/SameSite等)が
//       既存の慣例と異なる
//   (4) 不正な(ROUTE_CITIESに存在しない国名の)Cookie値を読み込んだ際に
//       クラッシュする、またはフィルタが無効化されずに空表示になる
//   (5) 「しない」に戻したときにフィルタが解除されない

function setupPage(cookie?: string) {
  document.cookie = 'heritage_journey_dest_country_filter=; Path=/; Max-Age=0';
  if (cookie) document.cookie = cookie;
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

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  document.cookie = 'heritage_journey_dest_country_filter=; Path=/; Max-Age=0';
});

describe('heritage-journeyページ: 出発地別プラン分布の到達国フィルタ', () => {
  it('Cookie未設定時、ラベルとボタンがタイトル行末に右寄せで表示され初期表示は「しない(デフォルト)」', () => {
    setupPage();
    const label = document.querySelector('.dist-country-filter-label') as HTMLElement;
    const btn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('到達国を制限する : ');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('しない(デフォルト)');
  });

  it('ボタンを押すとモーダルが開き、先頭に「しない」、続けて国別件数の降順で国が並ぶ', () => {
    setupPage();
    const btn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true }));

    const overlay = document.getElementById('dist-country-filter-modal-overlay') as HTMLElement;
    expect(overlay.classList.contains('open')).toBe(true);

    const rows = Array.from(document.querySelectorAll('#dist-country-filter-list [data-country]')) as HTMLElement[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].getAttribute('data-country')).toBe('__ALL__');
    expect(rows[0].textContent).toContain('しない');

    // 先頭の実国は件数最多。都市データが増減してもソート契約だけを固定する
    expect(rows[1].getAttribute('data-country')).not.toBe('__ALL__');
    expect(Number(rows[1].getAttribute('data-count'))).toBeGreaterThan(0);
    expect(rows[1].textContent).toContain(rows[1].getAttribute('data-country') || '');

    // 件数が単調非増加になっていることを確認
    const counts = rows.slice(1).map((r) => Number(r.getAttribute('data-count')));
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('国を選択するとボタンラベルが更新され、モーダルが閉じ、分布が選択国の都市のみにフィルタされ、Cookieが保存される', () => {
    setupPage();
    const btn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true }));

    const row = document.querySelector('#dist-country-filter-list [data-country="イタリア"]') as HTMLElement;
    expect(row).not.toBeNull();
    row.dispatchEvent(new Event('click', { bubbles: true }));

    expect(btn.textContent).toBe('🇮🇹 イタリア');
    const overlay = document.getElementById('dist-country-filter-modal-overlay') as HTMLElement;
    expect(overlay.classList.contains('open')).toBe(false);

    // 分布セクションの全チップを開いてイタリア以外が出ないことを確認
    const rows2 = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
    const cityLabels: string[] = [];
    rows2.forEach((r) => {
      r.dispatchEvent(new Event('click', { bubbles: true }));
      const idx = r.getAttribute('data-bucket');
      const citiesEl = document.getElementById('dist-cities-' + idx) as HTMLElement;
      citiesEl.querySelectorAll('[data-city]').forEach((chip) => cityLabels.push(chip.textContent || ''));
    });
    expect(cityLabels.length).toBeGreaterThan(0);
    cityLabels.forEach((t) => expect(t).toContain('🇮🇹'));

    expect(document.cookie).toContain('heritage_journey_dest_country_filter=' + encodeURIComponent('イタリア'));
  });

  it('「しない」を選び直すとフィルタが解除され、Cookieが__ALL__に戻る', () => {
    setupPage('heritage_journey_dest_country_filter=' + encodeURIComponent('イタリア'));
    const btn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    expect(btn.textContent).toBe('🇮🇹 イタリア');

    btn.dispatchEvent(new Event('click', { bubbles: true }));
    const noneRow = document.querySelector('#dist-country-filter-list [data-country="__ALL__"]') as HTMLElement;
    noneRow.dispatchEvent(new Event('click', { bubbles: true }));

    expect(btn.textContent).toBe('しない(デフォルト)');
    expect(document.cookie).toContain('heritage_journey_dest_country_filter=' + encodeURIComponent('__ALL__'));
  });

  it('ページ読み込み時に有効なCookie(イタリア)があれば初期表示から反映される', () => {
    setupPage('heritage_journey_dest_country_filter=' + encodeURIComponent('イタリア'));
    const btn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    expect(btn.textContent).toBe('🇮🇹 イタリア');

    const rows2 = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
    const cityLabels: string[] = [];
    rows2.forEach((r) => {
      r.dispatchEvent(new Event('click', { bubbles: true }));
      const idx = r.getAttribute('data-bucket');
      const citiesEl = document.getElementById('dist-cities-' + idx) as HTMLElement;
      citiesEl.querySelectorAll('[data-city]').forEach((chip) => cityLabels.push(chip.textContent || ''));
    });
    expect(cityLabels.length).toBeGreaterThan(0);
    cityLabels.forEach((t) => expect(t).toContain('🇮🇹'));
  });

  it('ROUTE_CITIESに存在しない不正な国名のCookieはフォールバックし「しない(デフォルト)」表示になる(クラッシュしない)', () => {
    expect(() => setupPage('heritage_journey_dest_country_filter=' + encodeURIComponent('存在しない国'))).not.toThrow();
    const btn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    expect(btn.textContent).toBe('しない(デフォルト)');
  });
});
