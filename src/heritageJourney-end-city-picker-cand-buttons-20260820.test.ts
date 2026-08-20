// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「到着地を選択」モーダル(#end-city-picker-modal-overlay)の
// ヘッダに追加した経由地候補の一括操作ボタン(#select-all-btn-modal / #select-none-btn-modal /
// #select-near-btn-modal)。既存の「経由地候補」セクションのボタン(#select-all-btn等)と
// 同じ抽出済み共有関数を呼び出し、state.selected / #cand-count / 巡回ルートスコープへの
// 反映が既存ボタンと完全に一致することを検証する。
//
// 故障シナリオ:
//   (1) モーダルヘッダにボタン・ラベルが正しい順序で配置されていない
//   (2) モーダル内ボタンをクリックしても既存ボタンと異なる結果になる(ロジックの重複・乖離)
//   (3) モーダル内ボタンのクリックでモーダルが誤って閉じてしまう

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

describe('heritage-journeyページ: 到着地選択モーダルのヘッダに経由地候補の一括操作ボタンが存在する', () => {
  it('モーダルヘッダ内に「経由地 : 」ラベル→すべて選択→すべて解除→近接のみ選択の順で右寄せ配置されている', () => {
    setupPage();
    const head = document.getElementById('end-city-picker-modal-head')!;
    const toolbar = head.querySelector('.end-city-picker-cand-toolbar')!;
    expect(toolbar).not.toBeNull();

    const children = Array.from(toolbar.children) as HTMLElement[];
    expect(children.length).toBe(4);
    expect(children[0].textContent).toBe('経由地 : ');
    expect(children[1].id).toBe('select-all-btn-modal');
    expect(children[1].textContent).toBe('すべて選択');
    expect(children[2].id).toBe('select-none-btn-modal');
    expect(children[2].textContent).toBe('すべて解除');
    expect(children[3].id).toBe('select-near-btn-modal');
    expect(children[3].textContent).toBe('近接のみ選択(20km以内)');
  });

  it('ヘッダの閉じるボタンと重ならず、モーダルの close ボタンより前に存在する', () => {
    setupPage();
    const head = document.getElementById('end-city-picker-modal-head')!;
    const toolbar = head.querySelector('.end-city-picker-cand-toolbar')!;
    const closeBtn = document.getElementById('end-city-picker-modal-close')!;
    const headChildren = Array.from(head.children);
    expect(headChildren.indexOf(toolbar)).toBeLessThan(headChildren.indexOf(closeBtn));
  });
});

describe('heritage-journeyページ: モーダル内ボタンは経由地候補セクションの元ボタンと同じ結果になる', () => {
  it('#select-all-btn-modal クリックで、#select-all-btn と同じく全候補が選択される', () => {
    setupPage();
    document.getElementById('select-all-btn-modal')!.click();
    const count = document.getElementById('cand-count')!.textContent || '';
    const match = count.match(/(\d+) 件中 (\d+) 件選択中/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(match![2]);
  });

  it('#select-none-btn-modal クリックで、#select-none-btn と同じく全候補が解除される', () => {
    setupPage();
    document.getElementById('select-all-btn-modal')!.click();
    document.getElementById('select-none-btn-modal')!.click();
    const count = document.getElementById('cand-count')!.textContent || '';
    const match = count.match(/(\d+) 件中 (\d+) 件選択中/);
    expect(match).not.toBeNull();
    expect(match![2]).toBe('0');
  });

  it('#select-near-btn-modal と #select-near-btn は同一の選択結果(state.selectedの反映)になる', () => {
    setupPage();
    document.getElementById('select-near-btn-modal')!.click();
    const countAfterModal = document.getElementById('cand-count')!.textContent;

    document.getElementById('select-all-btn')!.click();
    document.getElementById('select-near-btn')!.click();
    const countAfterOriginal = document.getElementById('cand-count')!.textContent;

    expect(countAfterModal).toBe(countAfterOriginal);
  });

  it('モーダル内ボタンのクリックはルート順序(#route-line)にも既存ボタンと同じく反映される(巡回ルートスコープへの反映)', () => {
    setupPage();
    document.getElementById('select-all-btn')!.click();
    const routeLineAfterOriginal = document.getElementById('route-line')!.innerHTML;

    document.getElementById('select-none-btn')!.click();
    document.getElementById('select-all-btn-modal')!.click();
    const routeLineAfterModal = document.getElementById('route-line')!.innerHTML;

    expect(routeLineAfterModal).toBe(routeLineAfterOriginal);
  });
});

describe('heritage-journeyページ: モーダル内ボタンをクリックしてもモーダルは閉じない', () => {
  it('モーダルを開いた状態で各ボタンをクリックしても overlay.open は維持される', () => {
    setupPage();
    const btn = document.getElementById('end-city-picker-btn') as HTMLButtonElement;
    const overlay = document.getElementById('end-city-picker-modal-overlay')!;
    btn.click();
    expect(overlay.classList.contains('open')).toBe(true);

    document.getElementById('select-all-btn-modal')!.click();
    expect(overlay.classList.contains('open')).toBe(true);

    document.getElementById('select-none-btn-modal')!.click();
    expect(overlay.classList.contains('open')).toBe(true);

    document.getElementById('select-near-btn-modal')!.click();
    expect(overlay.classList.contains('open')).toBe(true);
  });
});
