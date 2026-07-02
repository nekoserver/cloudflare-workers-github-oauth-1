import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

describe('getWebGLHeritagePage エリアズーム機能（活断層ページ同等）', () => {
  const html = getWebGLHeritagePage('tester');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('areaTourStep がフライ完了後にツールチップを表示するネスト構造を持つ', () => {
    // 活断層ページ同等: flyTo → setTimeout(FLY_DUR+100) → tooltip → setTimeout(5000) → hideTooltip → next
    // 旧実装: flyTo後すぐに showMarkerTooltip して 4200ms 待機するだけ
    expect(html).toContain('FLY_DUR + 100');
    // hideTooltip が areaTourStep のコールバック内で呼ばれる
    expect(html).toMatch(/areaTourStep[\s\S]{0,3000}hideTooltip/);
  });

  it('stopAreaTour が完了時以外でも hideTooltip を呼ぶ', () => {
    // stopAreaTour 関数内で completed の if ブロックより前に hideTooltip が現れること
    const stopMatch = html.match(/function stopAreaTour[\s\S]*?(?=function startAreaTour)/);
    expect(stopMatch).not.toBeNull();
    const stopFn = stopMatch![0];
    const hidePos = stopFn.indexOf('hideTooltip');
    const completedPos = stopFn.indexOf('if (completed)');
    expect(hidePos).toBeGreaterThan(-1);
    expect(completedPos).toBeGreaterThan(-1);
    expect(hidePos).toBeLessThan(completedPos);
  });

  it('stopAreaTour が完了時に autoRot を再開する', () => {
    const stopMatch = html.match(/function stopAreaTour[\s\S]*?(?=function startAreaTour)/);
    expect(stopMatch).not.toBeNull();
    const stopFn = stopMatch![0];
    expect(stopFn).toContain('autoRot = true');
  });

  it('stopAreaTour が areaTourBtn のテキストを巡回にリセットする', () => {
    const stopMatch = html.match(/function stopAreaTour[\s\S]*?(?=function startAreaTour)/);
    expect(stopMatch).not.toBeNull();
    const stopFn = stopMatch![0];
    expect(stopFn).toContain('巡回');
  });

  it('areaTourStep 内でズームを強制変更しない（巡回中のズーム解除防止）', () => {
    // applyBoxZoom が設定したズームを巡回中も維持するため、areaTourStep 内で zoom を上書きしない
    const stepMatch = html.match(/function areaTourStep[\s\S]*?(?=function applyBoxZoom)/);
    expect(stepMatch).not.toBeNull();
    const fn = stepMatch![0];
    // areaTourStep 内に zoom = の直接代入がないこと
    expect(fn).not.toMatch(/zoom\s*=\s*Math\.(min|max)/);
  });

  it('applyBoxZoom がフライ後に setTimeout でズームとメニューを適用する', () => {
    const applyMatch = html.match(/function applyBoxZoom[\s\S]*?(?=\n  canvas\.addEventListener)/);
    expect(applyMatch).not.toBeNull();
    const fn = applyMatch![0];
    // flyTo の後に setTimeout でズームを設定する（即時設定ではない）
    const flyPos = fn.indexOf('flyTo(');
    const setTimeoutPos = fn.indexOf('setTimeout', flyPos);
    expect(flyPos).toBeGreaterThan(-1);
    expect(setTimeoutPos).toBeGreaterThan(flyPos);
    // showAreaMenu が setTimeout コールバック内にある
    const showMenuPos = fn.indexOf('showAreaMenu', setTimeoutPos);
    expect(showMenuPos).toBeGreaterThan(setTimeoutPos);
  });
});
