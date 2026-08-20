// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🌐 巡回テスト」モーダル。
// 最下段の「次の目的地」左側にある現在地ラベル(#tour-current-label)を
// 「国旗/宿泊推奨地」表記に変更し、モーダル最上部の「◯泊△日」
// (#tour-plan-summary)の真下に中央寄せで「◯日目」(#tour-day-label)を
// 表示する。また#tour-plan-summaryから「世界遺産」「件選択中」の表記を撤去した。
//
// 故障シナリオ:
//   (1) #tour-day-label要素がマークアップに存在しない、または
//       #tour-plan-summaryの真下に配置されていない
//   (2) 現在地ラベルが「国旗/宿泊推奨地」形式で表示されない
//   (3) 「◯日目」の日数が現在地に対応していない
//   (4) #tour-plan-summaryに「世界遺産」「件選択中」の表記が残ってしまう

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

describe('heritage-journeyページ: 巡回テストモーダルの「◯日目」表示のマークアップ', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('#tour-day-labelが#tour-plan-summaryの直後(真下)に配置される', () => {
    setupPage();
    const summaryHead = document.getElementById('tour-plan-summary')!.closest('.tour-modal-head')!;
    const dayLabel = document.getElementById('tour-day-label');
    expect(dayLabel).not.toBeNull();
    expect(summaryHead.nextElementSibling).toBe(dayLabel);
  });
});

describe('heritage-journeyページ: #tour-plan-summaryから世界遺産件数の表記が撤去されている', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('「世界遺産」「件選択中」の文言を含まない', () => {
    setupPage();
    const summary = document.getElementById('tour-plan-summary')!.textContent || '';
    expect(summary).not.toMatch(/世界遺産/);
    expect(summary).not.toMatch(/件選択中/);
    expect(summary).toMatch(/^\d+泊\d+日$/);
  });
});

describe('heritage-journeyページ: 現在地ラベルは「国旗/宿泊推奨地」形式で表示される', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('巡回テストを開くと#tour-current-labelが「flag / city」の形式で表示される', () => {
    setupPage();
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
    const label = document.getElementById('tour-current-label')!;
    expect(label.textContent).toMatch(/^\S+ \/ \S+/);
  });

  it('#tour-day-labelに「◯日目」が表示される', () => {
    setupPage();
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
    const dayLabel = document.getElementById('tour-day-label')!;
    expect(dayLabel.textContent).toMatch(/^\d+日目$/);
  });
});
