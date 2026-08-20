// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「宿泊地の推奨プラン」セクション見出し右端の
// 検索窓(#heritage-add-search)。インクリメンタルサーチで世界遺産名を検索し、
// 結果を最上位モーダル(#heritage-add-modal-overlay)内の表(#heritage-add-results-body)に
// 積み上げて表示、行末の「追加する」ボタンでルートへ手動追加できるようにする機能。
//
// 故障シナリオ:
//   (1) 検索窓にフォーカス/入力してもモーダルが開かない
//   (2) 検索文字列で結果が絞り込まれない(常に全件 or 常に空)
//   (3) 「追加する」を押しても manuallyAddedPoints / state.selected に反映されない
//   (4) 追加してもボタンが「追加済み」に変わらず、連打で重複追加できてしまう
//   (5) 追加してもルート順序(#route-line)や候補件数(#cand-count)などの
//       関連セクションが再計算されない
//   (6) 追加してもbuildCandidates()のdetour範囲外だと候補から漏れてしまう
//   (7) モーダルの閉じるボタン/背景クリック/Escapeキーで閉じられない

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

describe('heritage-journeyページ: 「追加する」ボタンでルートへ追加され関連セクションが再計算される', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('追加するとボタンが「追加済み」になり、二重追加できない', () => {
    setupPage();
    const input = document.getElementById('heritage-add-search') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const btn = document.querySelector('#heritage-add-results-body [data-add-name]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    const name = btn.getAttribute('data-add-name');

    btn.click();
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('追加済み');

    // 再描画されても既に追加済みの地点は「追加済み」のまま
    input.dispatchEvent(new Event('input'));
    const btnAfter = Array.from(document.querySelectorAll('#heritage-add-results-body [data-add-name]'))
      .find((b) => b.getAttribute('data-add-name') === name) as HTMLButtonElement | undefined;
    if (btnAfter) {
      expect(btnAfter.disabled).toBe(true);
    }
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
