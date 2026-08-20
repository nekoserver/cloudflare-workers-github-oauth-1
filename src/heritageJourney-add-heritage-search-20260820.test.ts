// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「宿泊地の推奨プラン」セクション見出し右端の
// 検索窓(#heritage-add-search)。インクリメンタルサーチで世界遺産名を検索し、
// 結果を最上位モーダル(#heritage-add-modal-overlay)内の表(#heritage-add-results-body)に
// 積み上げて表示、行末の「追加する」/「解除する」ボタンでルートへの追加・除外を
// トグルできるようにする機能。結果は巡回テストモーダルの中心座標から出発点までの
// 距離の範囲内にある世界遺産だけに絞り込まれる。
//
// 故障シナリオ:
//   (1) 検索窓にフォーカス/入力してもモーダルが開かない
//   (2) 検索文字列で結果が絞り込まれない(常に全件 or 常に空)
//   (3) 「追加する」を押しても manuallyAddedPoints / state.selected に反映されない
//   (4) 追加しても世界遺産名の背景色が薄緑色にならず、ボタンも「解除する」に
//       変わらない(既に巡回テストコース内にある場合も同様)
//   (5) 「解除する」を押しても除外されず、背景色・ボタン文言も元に戻らない
//   (6) 追加/解除してもルート順序(#route-line)や候補件数(#cand-count)などの
//       関連セクションが再計算されない
//   (7) 追加してもbuildCandidates()のdetour範囲外だと候補から漏れてしまう
//   (8) 巡回テストモーダルの中心-出発点間の距離を超える世界遺産まで
//       検索結果に列挙されてしまう
//   (9) モーダルの閉じるボタン/背景クリック/Escapeキーで閉じられない

function setupPage() {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, ellipse: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
  });
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
}

describe('heritage-journeyページ: 世界遺産追加検索窓のマークアップ', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('#heritage-add-search入力欄と#heritage-add-modal-overlayモーダルが描画される', () => {
    setupPage();
    expect(document.getElementById('heritage-add-search')).not.toBeNull();
    expect(document.getElementById('heritage-add-modal-overlay')).not.toBeNull();
    expect(document.getElementById('heritage-add-results-body')).not.toBeNull();
    expect(document.getElementById('heritage-add-modal-overlay')!.classList.contains('open')).toBe(false);
  });
});

describe('heritage-journeyページ: 検索窓フォーカス・入力でモーダルが開き結果が絞り込まれる', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('検索窓にフォーカスするとモーダルが開き、結果が1件以上表示される', () => {
    setupPage();
    const input = document.getElementById('heritage-add-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const overlay = document.getElementById('heritage-add-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
    const rows = document.querySelectorAll('#heritage-add-results-body tr');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('検索文字列を入力すると結果が絞り込まれる', () => {
    setupPage();
    const input = document.getElementById('heritage-add-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const allCount = document.querySelectorAll('#heritage-add-results-body tr').length;

    const firstBtn = document.querySelector('#heritage-add-results-body [data-add-name]') as HTMLButtonElement;
    const firstName = firstBtn.getAttribute('data-add-name')!;
    const partial = firstName.slice(0, Math.max(2, Math.min(4, firstName.length)));

    input.value = partial;
    input.dispatchEvent(new Event('input'));
    const filteredRows = Array.from(document.querySelectorAll('#heritage-add-results-body tr'));
    expect(filteredRows.length).toBeGreaterThan(0);
    filteredRows.forEach((row) => {
      expect(row.textContent!.toLowerCase()).toContain(partial.toLowerCase());
    });
    expect(filteredRows.length).toBeLessThanOrEqual(allCount);
  });
});

describe('heritage-journeyページ: 「追加する」/「解除する」ボタンでルートへの追加・除外がトグルされる', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('追加すると世界遺産名の背景色が薄緑色になり、ボタンが「解除する」に変わる', () => {
    setupPage();
    const input = document.getElementById('heritage-add-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const row = document.querySelector('#heritage-add-results-body tr') as HTMLTableRowElement;
    const nameCell = row.querySelector('td') as HTMLElement;
    const btn = row.querySelector('[data-add-name]') as HTMLButtonElement;
    expect(nameCell.classList.contains('in-course')).toBe(false);
    expect(btn.textContent).toBe('追加する');
    const name = btn.getAttribute('data-add-name');

    btn.click();

    const rowAfter = Array.from(document.querySelectorAll('#heritage-add-results-body tr'))
      .find((tr) => (tr.querySelector('[data-add-name]') as HTMLButtonElement).getAttribute('data-add-name') === name)!;
    const nameCellAfter = rowAfter.querySelector('td') as HTMLElement;
    const btnAfter = rowAfter.querySelector('[data-add-name]') as HTMLButtonElement;
    expect(nameCellAfter.classList.contains('in-course')).toBe(true);
    expect(btnAfter.textContent).toBe('解除する');
  });

  it('「解除する」を押すと世界遺産名の背景色・ボタン文言が元に戻る', () => {
    setupPage();
    const input = document.getElementById('heritage-add-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const btn = document.querySelector('#heritage-add-results-body [data-add-name]') as HTMLButtonElement;
    const name = btn.getAttribute('data-add-name');
    btn.click(); // 追加する

    const findRow = () => Array.from(document.querySelectorAll('#heritage-add-results-body tr'))
      .find((tr) => (tr.querySelector('[data-add-name]') as HTMLButtonElement).getAttribute('data-add-name') === name)!;

    const releaseBtn = findRow().querySelector('[data-add-name]') as HTMLButtonElement;
    expect(releaseBtn.textContent).toBe('解除する');
    releaseBtn.click(); // 解除する

    const rowAfter = findRow();
    const nameCellAfter = rowAfter.querySelector('td') as HTMLElement;
    const btnAfter = rowAfter.querySelector('[data-add-name]') as HTMLButtonElement;
    expect(nameCellAfter.classList.contains('in-course')).toBe(false);
    expect(btnAfter.textContent).toBe('追加する');
  });

  it('追加すると候補件数表示(#cand-count)が更新される(関連セクションの再計算)', () => {
    setupPage();
    const candCountBefore = document.getElementById('cand-count')!.textContent;

    const input = document.getElementById('heritage-add-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));

    // まだ選択されていない(候補一覧のチェックが外れている)地点を探して追加する
    const rows = Array.from(document.querySelectorAll('#heritage-add-results-body [data-add-name]')) as HTMLButtonElement[];
    const checkedNames = new Set(
      Array.from(document.querySelectorAll('#cand-list input[data-cand]:checked')).map((el) => el.getAttribute('data-cand'))
    );
    const target = rows.find((b) => !checkedNames.has(b.getAttribute('data-add-name'))) || rows[0];
    target.click();

    const candCountAfter = document.getElementById('cand-count')!.textContent;
    expect(candCountAfter).not.toBe(candCountBefore);
  });
});

describe('heritage-journeyページ: 検索結果は巡回テストモーダルの中心-出発点間の距離の範囲内に絞り込まれる', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('出発地・目的地が近い経路では、遠い経路より検索結果の件数が少ない(範囲が狭くなる)', () => {
    setupPage();
    const input = document.getElementById('heritage-add-search') as HTMLInputElement;

    // 遠距離(パリ→ローマ、初期値)での検索結果件数
    input.dispatchEvent(new Event('focus'));
    const farCount = document.querySelectorAll('#heritage-add-results-body tr').length;

    document.body.innerHTML = '';
    setupPage();
    // 近距離(ウィーン→ブラチスラヴァ、約55km)に変更
    const startSel = document.getElementById('start-city') as unknown as HTMLSelectElement;
    const endSel = document.getElementById('end-city') as unknown as HTMLSelectElement;
    startSel.value = 'Vienna';
    startSel.dispatchEvent(new Event('change'));
    endSel.value = 'Bratislava';
    endSel.dispatchEvent(new Event('change'));

    const input2 = document.getElementById('heritage-add-search') as HTMLInputElement;
    input2.dispatchEvent(new Event('focus'));
    const nearCount = document.querySelectorAll('#heritage-add-results-body tr').length;

    expect(nearCount).toBeLessThan(farCount);
  });
});

describe('heritage-journeyページ: 検索モーダルの閉じ方', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('閉じるボタンでモーダルが閉じる', () => {
    setupPage();
    const input = document.getElementById('heritage-add-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const overlay = document.getElementById('heritage-add-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
    (document.getElementById('heritage-add-modal-close') as HTMLButtonElement).click();
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('Escapeキーでモーダルが閉じる', () => {
    setupPage();
    const input = document.getElementById('heritage-add-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const overlay = document.getElementById('heritage-add-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('背景(オーバーレイ自身)クリックでモーダルが閉じる', () => {
    setupPage();
    const input = document.getElementById('heritage-add-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const overlay = document.getElementById('heritage-add-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('open')).toBe(false);
  });
});
