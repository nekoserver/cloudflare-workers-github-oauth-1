// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページ「出発地から見た目的地別プラン分布」セクションの
// 到達国フィルタ関連フォローアップ3件。
//   (1) 到達国フィルタモーダル(#dist-country-filter-modal-overlay)の既定位置が
//       #tour-mini-panelと重ならないこと(#end-city-picker-modal-boxと同じ技法)
//   (2) 「到達国を限定する」表記がすべて「到達国を制限する」に変更されていること
//   (3) 出発地から見た目的地別プラン分布の各都市チップのうち、宿泊日数が0泊の
//       ものはグレーアウトされ、クリックしても#end-cityが変化しないこと
//
// 故障シナリオ:
//   (1) モーダルの既定位置が#tour-mini-panelの領域(left:12-292px, top:12-60px)
//       と交差する、または位置指定自体がされない(flexセンタリングのまま)
//   (2) 旧表記「到達国を限定する」がボタン・モーダルタイトルのいずれかに残る
//   (3) 0泊チップにdisabled属性が付かない、またはdisabled属性はあるが
//       クリックハンドラ側でガードされておらず実質クリック可能
//   (4) 0泊以外のチップまで巻き添えでdisabled化してしまう(リグレッション)

function setupPage(fetchImpl: (input: unknown, init?: unknown) => Promise<{ json: () => Promise<unknown> }> = () =>
  Promise.resolve({ json: () => Promise.resolve({ exists: false }) })) {
  document.cookie = 'heritage_journey_dest_country_filter=; Path=/; Max-Age=0';
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

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  document.cookie = 'heritage_journey_dest_country_filter=; Path=/; Max-Age=0';
});

describe('heritage-journeyページ: 到達国フィルタモーダルの既定位置(#tour-mini-panelと重ならない)', () => {
  it('モーダルを開くと#tour-mini-panelの既定領域(left:12px〜292px, top:12px〜60px)と重ならない位置に配置される', () => {
    setupPage();
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    const btn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    btn.click();

    const box = document.getElementById('dist-country-filter-modal-box') as HTMLElement;
    expect(box).not.toBeNull();
    const left = parseFloat(box.style.left);
    const top = parseFloat(box.style.top);
    expect(Number.isNaN(left)).toBe(false);
    expect(Number.isNaN(top)).toBe(false);

    const miniRight = 292;
    const miniBottom = 60;
    const overlapsHorizontally = left < miniRight;
    const overlapsVertically = top < miniBottom;
    expect(overlapsHorizontally && overlapsVertically).toBe(false);
  });

  it('狭いビューポートでも既定left位置は320px以上を確保する(#tour-mini-panelの右端292pxより右、#end-city-picker-modal-boxと同じ下限値)', () => {
    setupPage();
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    const btn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    btn.click();
    const box = document.getElementById('dist-country-filter-modal-box') as HTMLElement;
    const left = parseFloat(box.style.left);
    expect(left).toBeGreaterThanOrEqual(320);
  });

  it('モーダルを閉じて再度開くと既定位置にリセットされる(ドラッグ等で位置を変更しても保持しない)', () => {
    setupPage();
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    const btn = document.getElementById('dist-country-filter-btn') as HTMLButtonElement;
    const closeBtn = document.getElementById('dist-country-filter-modal-close') as HTMLButtonElement;
    const box = document.getElementById('dist-country-filter-modal-box') as HTMLElement;

    btn.click();
    const defaultLeft = box.style.left;
    const defaultTop = box.style.top;

    box.style.left = '999px';
    box.style.top = '888px';
    closeBtn.click();

    btn.click();
    expect(box.style.left).toBe(defaultLeft);
    expect(box.style.top).toBe(defaultTop);
  });
});

describe('heritage-journeyページ: 「到達国を制限する」表記への変更', () => {
  it('ボタン直前のラベル、モーダルタイトルともに新表記「到達国を制限する」が使われる', () => {
    setupPage();
    const label = document.querySelector('.dist-country-filter-label') as HTMLElement;
    expect(label.textContent).toBe('到達国を制限する : ');

    const title = document.querySelector('#dist-country-filter-modal-overlay .tour-modal-title') as HTMLElement;
    expect(title.textContent).toContain('到達国を制限する');
  });

  it('ページ全体(body innerHTML)に旧表記「到達国を限定する」が一切残っていない', () => {
    setupPage();
    expect(document.body.innerHTML).not.toContain('到達国を限定する');
  });
});

describe('heritage-journeyページ: 出発地から見た目的地別プラン分布の0泊チップは選択不可', () => {
  it('宿泊日数が0泊のチップはdisabled属性が付きグレーアウトされ、クリックしても#end-cityが変化しない', () => {
    setupPage();
    const rows = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
    // 「日帰り圏(0泊)」は先頭バケット(data-bucket="0")
    const zeroRow = rows.find((r) => r.getAttribute('data-bucket') === '0') as HTMLElement;
    expect(zeroRow).not.toBeUndefined();
    zeroRow.dispatchEvent(new Event('click', { bubbles: true }));
    const citiesEl = document.getElementById('dist-cities-0') as HTMLElement;
    const chips = Array.from(citiesEl.querySelectorAll('.dist-city-chip')) as HTMLButtonElement[];

    if (chips.length === 0) {
      // このテストデータでは0泊該当都市がないケース。空表示になっていることだけ確認して終了。
      expect(citiesEl.textContent).toContain('該当する目的地はありません');
      return;
    }

    const endCitySel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    const before = endCitySel.value;
    chips.forEach((chip) => {
      expect(chip.disabled).toBe(true);
      chip.dispatchEvent(new Event('click', { bubbles: true }));
    });
    expect(endCitySel.value).toBe(before);
  });

  it('0泊以外のチップは引き続きdisabled属性が付かず、クリックで#end-cityが更新される(リグレッション確認)', () => {
    setupPage();
    const rows = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
    let clickedNonZero = false;
    for (const row of rows) {
      if (row.getAttribute('data-bucket') === '0') continue;
      row.dispatchEvent(new Event('click', { bubbles: true }));
      const idx = row.getAttribute('data-bucket');
      const citiesEl = document.getElementById('dist-cities-' + idx) as HTMLElement;
      const chip = citiesEl.querySelector('.dist-city-chip') as HTMLButtonElement | null;
      if (!chip) continue;
      expect(chip.disabled).toBe(false);
      chip.dispatchEvent(new Event('click', { bubbles: true }));
      const endCitySel = document.getElementById('end-city') as unknown as HTMLSelectElement;
      expect(endCitySel.value).toBe(chip.getAttribute('data-city'));
      clickedNonZero = true;
      break;
    }
    expect(clickedNonZero).toBe(true);
  });
});
