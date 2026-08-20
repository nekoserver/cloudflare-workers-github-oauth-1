// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「ルート順序」セクション最下段中央にある
// 「適用する」ボタン(#route-apply-btn)。#route-line内のON/OFF(グレーアウト)を
// 1つでも切り替えるとアクティブになり、押すとグレーアウト中の世界遺産が
// state.selectedから外れて「宿泊地の推奨プラン」の計算対象から排除され、
// 「◯泊△日」(#day-plan-duration)も再計算される。
//
// 故障シナリオ:
//   (1) ボタンがマークアップに存在しない、または初期状態でアクティブに
//       なってしまっている
//   (2) #route-lineのON/OFFを切り替えてもボタンがアクティブにならない
//   (3) ボタンを押してもグレーアウト中の地点が候補選択(state.selected)から
//       外れない、または#route-lineから排除されない
//   (4) ボタンを押しても「◯泊△日」が再計算されない
//   (5) 適用後もボタンがアクティブなままになってしまう(再度ON/OFFする
//       までは非アクティブに戻るべき)

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

describe('heritage-journeyページ: 「適用する」ボタンのマークアップ・初期状態', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('#route-apply-btnが#route-lineと同じカード内に存在し、初期状態は非アクティブ(disabled)', () => {
    setupPage();
    const btn = document.getElementById('route-apply-btn') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
    const routeLine = document.getElementById('route-line')!;
    expect(btn.closest('.card')).toBe(routeLine.closest('.card'));
  });
});

describe('heritage-journeyページ: ON/OFF切り替えで「適用する」ボタンがアクティブになる', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('#route-lineのバッジを1回タップするとボタンがアクティブになる', () => {
    setupPage();
    const applyBtn = document.getElementById('route-apply-btn') as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);

    const badge = document.querySelector('#route-line button.wp-badge') as HTMLButtonElement;
    badge.click();

    expect(applyBtn.disabled).toBe(false);
  });
});

describe('heritage-journeyページ: 「適用する」を押すとグレーアウト中の地点が排除され日程が再計算される', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('グレーアウトした地点が#route-lineから消え、候補選択(チェックボックス)も外れる', () => {
    setupPage();
    const badges = Array.from(document.querySelectorAll('#route-line button.wp-badge')) as HTMLButtonElement[];
    expect(badges.length).toBeGreaterThanOrEqual(3);
    const middleBadge = badges[1];
    const excludedName = middleBadge.getAttribute('data-wp-name')!;

    middleBadge.click(); // グレーアウト
    expect(middleBadge.classList.contains('wp-badge-off')).toBe(true);

    const applyBtn = document.getElementById('route-apply-btn') as HTMLButtonElement;
    applyBtn.click();

    const afterNames = Array.from(document.querySelectorAll('#route-line [data-wp-name]')).map((el) => el.getAttribute('data-wp-name'));
    expect(afterNames).not.toContain(excludedName);

    const checkbox = Array.from(document.querySelectorAll('#cand-list input[data-cand]'))
      .find((el) => el.getAttribute('data-cand') === excludedName) as HTMLInputElement | undefined;
    if (checkbox) expect(checkbox.checked).toBe(false);
  });

  it('適用すると「◯泊△日」(#day-plan-duration)が再計算される', () => {
    // 経由地チェックボックスの追加でルート順序表示板の再描画が重くなったため、
    // 全候補選択後に多数のバッジを連続クリックするこのテストはデフォルトの
    // 5000msを超える場合がある。タイムアウトを緩和する。
    setupPage();
    (document.getElementById('select-all-btn') as HTMLButtonElement).click();
    const durationBefore = document.getElementById('day-plan-duration')!.textContent;

    // 出発地・目的地を除いた全ての経由地をグレーアウトし、直行ルートに近づけることで
    // 泊数が確実に変化する状況を作る
    const badges = Array.from(document.querySelectorAll('#route-line button.wp-badge')) as HTMLButtonElement[];
    badges.slice(1, -1).forEach((b) => b.click());

    const applyBtn = document.getElementById('route-apply-btn') as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);
    applyBtn.click();

    const durationAfter = document.getElementById('day-plan-duration')!.textContent;
    expect(durationAfter).not.toBe(durationBefore);
  }, 20000);

  it('適用後、ボタンは再び非アクティブに戻る', () => {
    setupPage();
    const badge = document.querySelector('#route-line button.wp-badge') as HTMLButtonElement;
    badge.click();
    const applyBtn = document.getElementById('route-apply-btn') as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);

    applyBtn.click();
    expect(applyBtn.disabled).toBe(true);
  });

  it('適用後に再度ON/OFFを切り替えると、ボタンは再びアクティブになる', () => {
    setupPage();
    const badges = Array.from(document.querySelectorAll('#route-line button.wp-badge')) as HTMLButtonElement[];
    badges[0].click();
    const applyBtn = document.getElementById('route-apply-btn') as HTMLButtonElement;
    applyBtn.click();
    expect(applyBtn.disabled).toBe(true);

    const badgesAfter = Array.from(document.querySelectorAll('#route-line button.wp-badge')) as HTMLButtonElement[];
    badgesAfter[0].click();
    expect(applyBtn.disabled).toBe(false);
  });
});
