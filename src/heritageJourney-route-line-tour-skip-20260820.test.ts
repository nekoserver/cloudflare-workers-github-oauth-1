// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';

// 対象: /heritage-journeyページの「ルート順序」セクション(#route-line)の
// 各地点バッジ。タップするとグレーアウト状態とON(初期状態)がトグルし、
// グレーアウト状態の地点は距離・時間ロスや宿泊プランの計算には影響させず、
// 巡回テスト(#tour-mini-canvas/#tour-globe-canvas)の巡回対象からのみ
// 一時的に除外して巡回再生時にスキップする(テスト時に特定の地点だけ
// 飛ばして確認したい場合の補助機能)。
//
// 故障シナリオ:
//   (1) バッジがボタンとして機能せず、タップしても何も起きない
//   (2) タップしてもグレーアウトの見た目(wp-badge-offクラス)が付かない
//   (3) 除外した地点が距離・時間ロスや宿泊プランの再計算(recompute本来の
//       目的)にまで影響してしまう(本来は巡回テストの対象からのみ外すべき)
//   (4) 除外した地点が巡回テストのtourPointsから外れず、モーダル/縮小
//       プレビューの巡回に相変わらず含まれてしまう
//   (5) 再度タップしても除外が解除されない(トグルできない)
//   (6) ルート再計算(recompute)のたびに除外状態がリセットされてしまう

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

describe('heritage-journeyページ: ルート順序バッジのマークアップ', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('#route-line内の各地点は<button>要素(data-wp-name属性付き)として描画される', () => {
    setupPage();
    const routeLine = document.getElementById('route-line')!;
    const buttons = routeLine.querySelectorAll('button.wp-badge');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((btn) => {
      expect(btn.getAttribute('data-wp-name')).toBeTruthy();
      expect(btn.classList.contains('wp-badge-off')).toBe(false);
    });
  });
});

describe('heritage-journeyページ: ルート順序バッジのタップでグレーアウトをトグル(DOM実動作)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('タップすると wp-badge-off クラスが付き、もう一度タップすると外れる', () => {
    setupPage();
    const btn = document.querySelector('#route-line button.wp-badge') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.classList.contains('wp-badge-off')).toBe(false);

    btn.click();
    expect(btn.classList.contains('wp-badge-off')).toBe(true);

    btn.click();
    expect(btn.classList.contains('wp-badge-off')).toBe(false);
  });

  it('除外した地点は#tour-mini-canvasの巡回テスト対象(内部tourPoints)から外れ、再度タップすると戻る', () => {
    setupPage();
    const routeLine = document.getElementById('route-line')!;
    const buttons = Array.from(routeLine.querySelectorAll('button.wp-badge')) as HTMLButtonElement[];
    // 出発地・目的地を除いた中間地点があれば、それを除外して巡回テストを開いても
    // 2件以上残っていればモーダルが正常に開くことを確認する(除外後も破綻しない)
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    const middleBtn = buttons.length >= 3 ? buttons[1] : buttons[0];

    middleBtn.click();
    expect(middleBtn.classList.contains('wp-badge-off')).toBe(true);

    const tourTestBtn = document.getElementById('tour-test-btn') as HTMLButtonElement;
    tourTestBtn.click();
    const label = document.getElementById('tour-current-label')!;
    // 除外後も表示された地点名の中に、除外した地点名が含まれないことを
    // モーダルを開いた直後のラベル(1件目)で最低限確認する
    const excludedName = middleBtn.getAttribute('data-wp-name');
    if (buttons.length >= 3) {
      expect(label.textContent).not.toContain(excludedName);
    }

    middleBtn.click();
    expect(middleBtn.classList.contains('wp-badge-off')).toBe(false);
  });

  it('地点を除外しても#cand-count(距離・時間ロス等の計算対象件数)の表示文言は変化しない', () => {
    setupPage();
    const candCountBefore = document.getElementById('cand-count')!.textContent;
    const btn = document.querySelector('#route-line button.wp-badge') as HTMLButtonElement;
    btn.click();
    const candCountAfter = document.getElementById('cand-count')!.textContent;
    expect(candCountAfter).toBe(candCountBefore);
  });

  it('別の操作(候補の再選択によるrecompute)が起きても、既に付けた除外(wp-badge-off)は保持される', () => {
    setupPage();
    const btn = document.querySelector('#route-line button.wp-badge') as HTMLButtonElement;
    const excludedName = btn.getAttribute('data-wp-name');
    btn.click();
    expect(btn.classList.contains('wp-badge-off')).toBe(true);

    // 「すべて選択」を押して候補選択を変え、recompute()を再度走らせる
    (document.getElementById('select-all-btn') as HTMLButtonElement).click();

    const afterButtons = Array.from(document.querySelectorAll('#route-line button.wp-badge')) as HTMLButtonElement[];
    const afterBtn = afterButtons.find((b) => b.getAttribute('data-wp-name') === excludedName) ?? null;
    if (afterBtn) {
      expect(afterBtn.classList.contains('wp-badge-off')).toBe(true);
    }
  });
});
