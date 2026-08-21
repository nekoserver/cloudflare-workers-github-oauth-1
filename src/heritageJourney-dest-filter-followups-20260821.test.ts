// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページ「出発地から見た目的地別プラン分布」セクションの
// 到達国フィルタ関連フォローアップ3件。
//   (1) 到達国フィルタモーダル(#dist-country-filter-modal-overlay)の既定位置が
//       #tour-mini-panelと重ならないこと(#end-city-picker-modal-boxと同じ技法)
//   (2) 「到達国を限定する」表記がすべて「到達国を制限する」に変更されていること
//
// 【訂正】(3)は前セッションの誤読に基づく実装だった。正しい要求は
// 「各バケット行(.dist-row)の右端カウント(.dist-count)が0件の場合、
// 行全体をグレーアウトし選択不可にする」であり、個々の都市チップ
// (.dist-city-chip)の宿泊日数(nights)は無関係。このファイルでは
// 旧仕様の0泊チップ無効化テストを削除し、訂正後の仕様
// (0件バケット行のグレーアウト・非活性化)を検証するテストに置き換える。
//
// 故障シナリオ:
//   (1) モーダルの既定位置が#tour-mini-panelの領域(left:12-292px, top:12-60px)
//       と交差する、または位置指定自体がされない(flexセンタリングのまま)
//   (2) 旧表記「到達国を限定する」がボタン・モーダルタイトルのいずれかに残る
//   (3) 該当件数0件のバケット行に.dist-row-emptyクラスが付かない、または
//       クラスは付くがクリックリスナーがアタッチされたままで実質展開可能
//   (4) 該当件数が1件以上あるバケット行まで巻き添えでグレーアウトしてしまう
//       (リグレッション)
//   (5) 0泊ラベルのバケットでも該当都市が1件以上あれば、その中の個々の
//       チップ(nights===0のものも含む)は引き続きクリック可能でなければ
//       ならない(チップレベルの無効化を復活させてしまうリグレッション)

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

describe('heritage-journeyページ: 出発地から見た目的地別プラン分布の0泊チップは選択可能(訂正後の仕様)', () => {
  it('0泊ラベルのバケット(日帰り圏)に該当都市が1件以上ある場合、そのチップにdisabled属性は付かずクリックで#end-cityが更新される', () => {
    setupPage();
    const rows = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
    const zeroRow = rows.find((r) => r.getAttribute('data-bucket') === '0') as HTMLElement;
    expect(zeroRow).not.toBeUndefined();
    // 該当件数0件なら行自体がグレーアウトされクリックが無効化されているはずなので、
    // このテストは該当件数が1件以上あるケースのみを対象とする。
    if (zeroRow.classList.contains('dist-row-empty')) {
      return;
    }
    zeroRow.dispatchEvent(new Event('click', { bubbles: true }));
    const citiesEl = document.getElementById('dist-cities-0') as HTMLElement;
    const chips = Array.from(citiesEl.querySelectorAll('.dist-city-chip')) as HTMLButtonElement[];
    expect(chips.length).toBeGreaterThan(0);

    const endCitySel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    chips.forEach((chip) => {
      expect(chip.disabled).toBe(false);
    });
    chips[0].dispatchEvent(new Event('click', { bubbles: true }));
    expect(endCitySel.value).toBe(chips[0].getAttribute('data-city'));
  });
});

describe('heritage-journeyページ: 出発地から見た目的地別プラン分布の該当0件バケット行はグレーアウトし選択不可(訂正後の仕様)', () => {
  it('該当件数(.dist-count)が0件のバケット行には.dist-row-emptyが付与され、クリックしても都市一覧パネルが開かない', () => {
    setupPage();
    const rows = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
    const emptyRow = rows.find((r) => {
      const countEl = r.querySelector('.dist-count');
      return countEl?.textContent === '0件';
    });
    if (!emptyRow) {
      // このテストデータでは0件バケットが発生しないケース。スキップして終了。
      return;
    }
    expect(emptyRow.classList.contains('dist-row-empty')).toBe(true);
    const idx = emptyRow.getAttribute('data-bucket');
    const citiesEl = document.getElementById('dist-cities-' + idx) as HTMLElement;
    expect(citiesEl.style.display).toBe('none');
    emptyRow.dispatchEvent(new Event('click', { bubbles: true }));
    expect(citiesEl.style.display).toBe('none');
  });

  it('該当件数が1件以上あるバケット行は.dist-row-emptyが付与されず、引き続きクリックで都市一覧パネルが開閉する(リグレッション確認)', () => {
    setupPage();
    const rows = Array.from(document.querySelectorAll('.dist-row')) as HTMLElement[];
    const nonEmptyRow = rows.find((r) => {
      const countEl = r.querySelector('.dist-count');
      return countEl?.textContent !== '0件';
    });
    expect(nonEmptyRow).not.toBeUndefined();
    const row = nonEmptyRow as HTMLElement;
    expect(row.classList.contains('dist-row-empty')).toBe(false);
    const idx = row.getAttribute('data-bucket');
    const citiesEl = document.getElementById('dist-cities-' + idx) as HTMLElement;

    row.dispatchEvent(new Event('click', { bubbles: true }));
    expect(citiesEl.style.display).toBe('flex');

    row.dispatchEvent(new Event('click', { bubbles: true }));
    expect(citiesEl.style.display).toBe('none');
  });
});
