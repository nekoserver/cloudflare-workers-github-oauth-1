// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🌐 巡回テスト」モーダル。モーダルヘッダーの
// 真上中央に「宿泊地の推奨プラン」の「◯泊△日」表記を表示する
// (#tour-plan-summary)。選択中の世界遺産数の表記は撤去済みで、「◯泊△日」
// のみを表示する。この数値はルート再計算(recompute)のたびに常に最新の
// 値へ更新される。
//
// 故障シナリオ:
//   (1) #tour-plan-summary要素がマークアップに存在しない
//   (2) 初期表示時に泊数・日数が反映されていない、または不要な
//       「世界遺産」「件選択中」等の表記が残ってしまう
//   (3) 候補の選択/解除で再計算しても表示が更新されない(古い値のまま)
//   (4) 「◯泊△日」の日数がsummary(#day-plan-duration)の値と食い違う

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

describe('heritage-journeyページ: 巡回テストモーダルの泊数表示のマークアップ', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('#tour-plan-summary要素がモーダルヘッダー内に存在する', () => {
    setupPage();
    const el = document.getElementById('tour-plan-summary');
    expect(el).not.toBeNull();
    expect(el!.closest('.tour-modal-head')).not.toBeNull();
  });

  it('初期表示時に「◯泊△日」のみが表示され、#day-plan-durationの泊数と一致する(選択件数の表記は無い)', () => {
    setupPage();
    const summary = document.getElementById('tour-plan-summary')!.textContent || '';
    const durationText = document.getElementById('day-plan-duration')!.textContent || '';
    const nightsMatch = durationText.match(/(\d+)泊(\d+)日/);
    expect(nightsMatch).not.toBeNull();
    expect(summary).toBe(nightsMatch![1] + '泊' + nightsMatch![2] + '日');
    expect(summary).not.toMatch(/世界遺産/);
    expect(summary).not.toMatch(/件選択中/);
  });
});

describe('heritage-journeyページ: 候補の選択変更に連動して巡回テストモーダルの泊数表示が更新される', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('「すべて選択」を押すと#tour-plan-summaryが新しい#day-plan-durationの泊数と一致する', () => {
    setupPage();
    (document.getElementById('select-all-btn') as HTMLButtonElement).click();
    const summary = document.getElementById('tour-plan-summary')!.textContent || '';
    const durationText = document.getElementById('day-plan-duration')!.textContent || '';
    const nightsMatch = durationText.match(/(\d+)泊(\d+)日/);
    expect(nightsMatch).not.toBeNull();
    expect(summary).toBe(nightsMatch![1] + '泊' + nightsMatch![2] + '日');
  });
});
