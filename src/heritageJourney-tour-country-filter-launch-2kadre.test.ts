// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🎬巡回ルートを再現する🌏」ボタン(#replay-tour-btn)と
// 国フィルタドロップダウン(#route-country-filter)。
// ドロップダウンを「ルート順序」見出しの隣から「🎬巡回ルートを再現する🌏」ボタンの右側へ
// 移動し、ボタン押下時に渡すデータ(sessionStorage 'heritageJourneyTour')から
// ドロップダウンでグレーアウトされた国に属する地点(世界遺産/空港/駅)を除外する。
// この処理は設定ページ「世界遺産の巡回ルート処理時に国別フィルタを適用する」がONの
// 場合のみ有効(デフォルトON)。OFFの場合は除外せず、薄ピンク色のトーストで
// 設定変更を促す。
//
// 故障シナリオ:
//   (1) ドロップダウンが移動先ではなく元の位置に残る
//   (2) ボタンの表記に🌏が付かない
//   (3) 設定ON・国選択ありでも実際にはフィルタされず全地点が渡る
//   (4) 設定OFFなのにフィルタが適用されてしまう(設定ページの優先度が守られない)
//   (5) 設定OFFでフィルタ適用しようとした際にトーストが出ない、または出続けて消えない
//   (6) 「すべて(デフォルト)」選択時に誤ってフィルタが適用され地点が減ってしまう

function setupPage(heritageTourCountryFilterEnabled = true) {
  const html = getHeritageJourneyPage(heritageTourCountryFilterEnabled);
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
  vi.stubGlobal('fetch', fetchMock);
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  return { html, fetchMock };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('heritage-journeyページ: 国フィルタドロップダウンの配置とボタン表記', () => {
  it('ボタン表記が「🎬巡回ルートを再現する🌏」になっている', () => {
    const { html } = setupPage();
    expect(html).toContain('🎬 巡回ルートを再現する🌏');
  });

  it('#route-country-filterは#replay-tour-btnより後(DOM順で後ろ)に配置されている', () => {
    setupPage();
    const row = document.getElementById('replay-tour-btn')?.closest('.route-title-row') as HTMLElement;
    expect(row).not.toBeNull();
    const children = Array.from(row.querySelectorAll('#replay-tour-btn, #route-country-filter'));
    expect(children.length).toBe(2);
    expect(children[0].id).toBe('replay-tour-btn');
    expect(children[1].id).toBe('route-country-filter');
  });

  it('#route-country-filterはもう「ルート順序」見出しと同じラッパーdiv内に同居していない', () => {
    setupPage();
    const row = document.getElementById('replay-tour-btn')?.closest('.route-title-row') as HTMLElement;
    const heading = row.querySelector('.section-title') as HTMLElement;
    expect(heading).not.toBeNull();
    // 移設前は見出しと同じ<div>(flexラッパー)にドロップダウンが直接の兄弟として同居していた。
    // 移設後はドロップダウンの直接の親要素が見出しの直接の親要素とは異なる
    // (ボタン群と同じラッパーdivの子になっている)。
    const select = document.getElementById('route-country-filter') as HTMLElement;
    expect(select.parentElement).not.toBe(heading.parentElement);
  });
});

describe('heritage-journeyページ: 巡回ルート再現時の国別フィルタ(設定ON=デフォルト)', () => {
  it('国を選択して起動すると、他国の地点がsessionStorageの渡しデータから除外される', async () => {
    setupPage(true);
    await new Promise((r) => setTimeout(r, 0));
    const sel = document.getElementById('route-country-filter') as unknown as HTMLSelectElement;
    expect(sel.options.length).toBeGreaterThan(1);
    const targetValue = sel.options[1].value;
    sel.value = targetValue;
    sel.dispatchEvent(new Event('change'));

    const setItemSpy = vi.spyOn(window.sessionStorage.__proto__, 'setItem');
    const btn = document.getElementById('replay-tour-btn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(setItemSpy).toHaveBeenCalled();
    const call = setItemSpy.mock.calls.find((c) => c[0] === 'heritageJourneyTour');
    expect(call).toBeTruthy();
    const payload = JSON.parse(call![1] as string);
    expect(Array.isArray(payload.points)).toBe(true);
    // 除外が働いていること: 全件よりは少ないはず(単一国ルートでない限り)
    const items = Array.from(document.querySelectorAll('#route-line .route-line-item'));
    const totalCountries = new Set(items.map((it) => it.getAttribute('data-wp-country')));
    if (totalCountries.size > 1) {
      expect(payload.points.length).toBeLessThan(items.length);
    }
    setItemSpy.mockRestore();
  });

  it('「すべて(デフォルト)」のままなら除外せず全地点を渡す', async () => {
    setupPage(true);
    await new Promise((r) => setTimeout(r, 0));
    const setItemSpy = vi.spyOn(window.sessionStorage.__proto__, 'setItem');
    const btn = document.getElementById('replay-tour-btn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const call = setItemSpy.mock.calls.find((c) => c[0] === 'heritageJourneyTour');
    expect(call).toBeTruthy();
    const payload = JSON.parse(call![1] as string);
    const items = document.querySelectorAll('#route-line .route-line-item');
    expect(payload.points.length).toBe(items.length);
    setItemSpy.mockRestore();
  });
});

describe('heritage-journeyページ: 設定OFF時は国別フィルタを適用せずトーストで通知する', () => {
  it('国を選択していても設定OFFなら除外せず全地点を渡す', async () => {
    setupPage(false);
    await new Promise((r) => setTimeout(r, 0));
    const sel = document.getElementById('route-country-filter') as unknown as HTMLSelectElement;
    expect(sel.options.length).toBeGreaterThan(1);
    sel.value = sel.options[1].value;
    sel.dispatchEvent(new Event('change'));

    const setItemSpy = vi.spyOn(window.sessionStorage.__proto__, 'setItem');
    const btn = document.getElementById('replay-tour-btn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const call = setItemSpy.mock.calls.find((c) => c[0] === 'heritageJourneyTour');
    expect(call).toBeTruthy();
    const payload = JSON.parse(call![1] as string);
    const items = document.querySelectorAll('#route-line .route-line-item');
    expect(payload.points.length).toBe(items.length);
    setItemSpy.mockRestore();
  });

  it('薄ピンク色のトースト(#route-country-filter-locked-toast)が表示される', async () => {
    setupPage(false);
    await new Promise((r) => setTimeout(r, 0));
    const sel = document.getElementById('route-country-filter') as unknown as HTMLSelectElement;
    sel.value = sel.options[1].value;
    sel.dispatchEvent(new Event('change'));

    const toast = document.getElementById('route-country-filter-locked-toast') as HTMLElement;
    expect(toast.style.display === 'block' || toast.style.display === '').toBe(true);
    const btn = document.getElementById('replay-tour-btn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(toast.style.display).toBe('block');
    expect(toast.textContent).toContain('設定ページ');
  });

  it('国を選択していなければ設定OFFでもトーストは出ない', async () => {
    setupPage(false);
    await new Promise((r) => setTimeout(r, 0));
    const toast = document.getElementById('route-country-filter-locked-toast') as HTMLElement;
    const btn = document.getElementById('replay-tour-btn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(toast.style.display).not.toBe('block');
  });
});

describe('heritage-journeyページ: トーストのCSSが薄ピンク色である', () => {
  it('#route-country-filter-locked-toastのbackgroundが薄ピンク系カラーコードである', () => {
    const html = getHeritageJourneyPage();
    const m = html.match(/#route-country-filter-locked-toast\{[^}]*background:(#[0-9a-fA-F]{6})/);
    expect(m).not.toBeNull();
    expect(m![1].toLowerCase()).toBe('#fce7f3');
  });
});
