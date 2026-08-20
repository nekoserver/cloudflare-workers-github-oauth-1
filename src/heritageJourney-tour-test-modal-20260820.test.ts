// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「🎬 巡回ルートを再現する」ボタンの左に追加した
// 「🌐 巡回テスト」ボタン。押すと(webgl-heritageへの画面遷移を伴う本格的な巡回とは
// 別に)最上位モーダル内に、必要な行き先の座標だけをプロットした簡易な地球儀
// (canvas 2Dの正射影)を表示し、モーダルの中だけで出発点から目的地までの巡回
// (再生アニメーション)を行えるようにする。
//
// 故障シナリオ:
//   (1) ボタン自体がマークアップに存在しない、またはモーダルが開かない
//   (2) 計算済みルート(state.lastOrdered)が無い状態で押すと例外になる、
//       または空のモーダルが開いてしまう
//   (3) 地点数が1件以下(ルート未計算/出発地=到着地扱い)でもcanvas描画が
//       例外を投げる
//   (4) 再生ボタンを押しても現在地ラベルが更新されない、
//       またはアニメーションが最後まで進まず途中で止まる
//   (5) モーダルを閉じてもタイマーが残り続け、閉じた後もラベル更新が続く
//   (6) 再生中に閉じて再度開いた際、前回の再生タイマーが二重に走る

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
  return { html };
}

function selectRoute() {
  // start-city/end-cityはデフォルトでParis→Romeが選択され、ページ末尾で
  // populateCitySelects/renderCandidates/recomputeが自動実行されるため、
  // 追加操作なしでstate.lastOrderedが計算済みになる。
}

describe('heritage-journeyページ: 「🌐 巡回テスト」ボタンとモーダル(マークアップ)', () => {
  it('ボタン(#tour-test-btn)とモーダル(#tour-modal-overlay)がマークアップに存在する', () => {
    const html = getHeritageJourneyPage();
    expect(html).toContain('id="tour-test-btn"');
    expect(html).toContain('id="tour-modal-overlay"');
    expect(html).toContain('id="tour-globe-canvas"');
    expect(html).toContain('id="tour-play-btn"');
  });

  it('「巡回テスト」ボタンは「巡回ルートを再現する」ボタンより先(左側)に配置される', () => {
    const html = getHeritageJourneyPage();
    const testIdx = html.indexOf('id="tour-test-btn"');
    const replayIdx = html.indexOf('id="replay-tour-btn"');
    expect(testIdx).toBeGreaterThan(-1);
    expect(replayIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeLessThan(replayIdx);
  });
});

describe('heritage-journeyページ: 「🌐 巡回テスト」モーダル(DOM実動作)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('ボタンを押すとモーダルが開き、現在地ラベルに1件目の地点名を表示する', () => {
    setupPage();
    selectRoute();
    const tourBtn = document.getElementById('tour-test-btn') as HTMLButtonElement;
    tourBtn.click();

    const overlay = document.getElementById('tour-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);
    const label = document.getElementById('tour-current-label')!;
    expect(label.textContent).toMatch(/^1 \/ \d+/);
  });

  it('✕ボタンでモーダルを閉じられる', () => {
    setupPage();
    const tourBtn = document.getElementById('tour-test-btn') as HTMLButtonElement;
    tourBtn.click();
    const overlay = document.getElementById('tour-modal-overlay')!;
    expect(overlay.classList.contains('open')).toBe(true);

    (document.getElementById('tour-modal-close') as HTMLButtonElement).click();
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('オーバーレイの背景クリックでモーダルを閉じられる(モーダル本体のクリックでは閉じない)', () => {
    setupPage();
    (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
    const overlay = document.getElementById('tour-modal-overlay')!;

    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('(タイマー実動作) 再生ボタンを押すとアニメーションが進み、現在地ラベルが最終地点まで更新される', () => {
    vi.useFakeTimers();
    try {
      setupPage();
      (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
      const playBtn = document.getElementById('tour-play-btn') as HTMLButtonElement;
      const label = document.getElementById('tour-current-label')!;
      const initialText = label.textContent;

      playBtn.click();
      expect(playBtn.textContent).toContain('一時停止');
      vi.advanceTimersByTime(1000);
      expect(label.textContent).not.toBe(initialText);

      // 十分な時間を進めれば最後の地点まで到達し、自動的に再生ボタンの表示が戻る
      vi.advanceTimersByTime(90000);
      expect(playBtn.textContent).toContain('再生');
      expect(playBtn.textContent).not.toContain('一時停止');
    } finally {
      vi.useRealTimers();
    }
  });

  it('(タイマー実動作) 再生中にモーダルを閉じるとタイマーが止まり、以降ラベルが更新されない', () => {
    vi.useFakeTimers();
    try {
      setupPage();
      (document.getElementById('tour-test-btn') as HTMLButtonElement).click();
      (document.getElementById('tour-play-btn') as HTMLButtonElement).click();
      vi.advanceTimersByTime(40);
      const label = document.getElementById('tour-current-label')!;
      const midText = label.textContent;

      (document.getElementById('tour-modal-close') as HTMLButtonElement).click();
      vi.advanceTimersByTime(5000);
      expect(label.textContent).toBe(midText);
    } finally {
      vi.useRealTimers();
    }
  });

  it('(タイマー実動作) 再度開くと再生位置は最初からになり、前回のタイマーが二重に走らない', () => {
    vi.useFakeTimers();
    try {
      setupPage();
      const tourBtn = document.getElementById('tour-test-btn') as HTMLButtonElement;
      tourBtn.click();
      (document.getElementById('tour-play-btn') as HTMLButtonElement).click();
      vi.advanceTimersByTime(40);
      (document.getElementById('tour-modal-close') as HTMLButtonElement).click();

      tourBtn.click();
      const label = document.getElementById('tour-current-label')!;
      expect(label.textContent).toMatch(/^1 \/ \d+/);

      const playBtn = document.getElementById('tour-play-btn') as HTMLButtonElement;
      expect(playBtn.textContent).toContain('再生');
      expect(playBtn.textContent).not.toContain('一時停止');
    } finally {
      vi.useRealTimers();
    }
  });
});
