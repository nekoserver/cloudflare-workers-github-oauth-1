import { describe, it, expect } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

// ---------------------------------------------------------------------------
// バグ: 大陸巡回モード(ヨーロッパ/アメリカ/アフリカ/日本巡回)でツールチップが
// 表示されない
//
// 原因: nextXxxSite() が showMarkerTooltip() を flyTo() 開始直後（＝地球儀の
// 回転が完了する前）に呼んでいた。マーカーが回転完了前は画面奥（オクルージョン
// 判定 mz<=0.12）にあるため、直後の描画フレームで hideTooltip() が呼ばれ
// activeIdx が -1 にリセットされる。回転が完了してマーカーが正面を向いても
// activeIdx はもう -1 のままなので、ツールチップが二度と表示されない。
//
// 修正: 既存の「エリア巡回」(areaTourStep) と同じパターンに合わせ、
// flyTo() を呼んだ後 FLY_DUR+100ms 待ってから showMarkerTooltip() を呼ぶ。
// ---------------------------------------------------------------------------

const html = getWebGLHeritagePage('tester');

function extractFn(name: string, len = 700): string {
  const idx = html.indexOf('function ' + name);
  expect(idx).toBeGreaterThan(-1);
  return html.slice(idx, idx + len);
}

describe('大陸巡回(next*Site)は回転完了後にツールチップを表示する', () => {
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

  it.each([
    ['nextEuropeSite', 'europeTourActive', 'europeTourTimer', 'TOUR_INTERVAL'],
    ['nextAmericaSite', 'americaTourActive', 'americaTourTimer', 'AMERICAS_INTERVAL'],
    ['nextAfricaSite', 'africaTourActive', 'africaTourTimer', 'TOUR_INTERVAL'],
    ['nextJapanSite', 'japanTourActive', 'japanTourTimer', 'TOUR_INTERVAL'],
  ])('%s は flyTo() の直後に showMarkerTooltip() を呼ばず、FLY_DUR+100ms 待ってから呼ぶ', (fnName, activeFlag, timerVar, intervalVar) => {
    const block = extractFn(fnName, 800);

    // flyTo は次の巡回先が決まった直後、待機なしで呼ばれる（回転をすぐ開始するため）
    const flyIdx = block.indexOf('flyTo(d.lat, d.lon);');
    expect(flyIdx).toBeGreaterThan(-1);

    // showMarkerTooltip はその後、FLY_DUR + 100 の setTimeout コールバック内で呼ばれる
    const setTimeoutIdx = block.indexOf('setTimeout(function() {', flyIdx);
    expect(setTimeoutIdx).toBeGreaterThan(flyIdx);

    const tooltipIdx = block.indexOf('showMarkerTooltip(idx, 0, 0);', setTimeoutIdx);
    expect(tooltipIdx).toBeGreaterThan(setTimeoutIdx);

    // flyTo と showMarkerTooltip の間に FLY_DUR + 100 の待機がある
    expect(block).toContain('}, FLY_DUR + 100);');

    // 待機コールバック内は巡回が停止していたら何もしない（stop 後の呼び出し防止）
    const guardIdx = block.indexOf('if (!' + activeFlag + ') return;', setTimeoutIdx);
    expect(guardIdx).toBeGreaterThan(setTimeoutIdx);
    expect(guardIdx).toBeLessThan(tooltipIdx);

    // showMarkerTooltip の後、次のサイトへの setTimeout がスケジュールされる
    const nextTimerIdx = block.indexOf(timerVar + ' = setTimeout(' + fnName + ', ' + intervalVar + ');', tooltipIdx);
    expect(nextTimerIdx).toBeGreaterThan(tooltipIdx);
  });

  it('showMarkerTooltip() が flyTo() の直後（回転前）に呼ばれる旧パターンが残っていない', () => {
    ['nextEuropeSite', 'nextAmericaSite', 'nextAfricaSite', 'nextJapanSite'].forEach((fnName) => {
      const block = extractFn(fnName, 800);
      // 旧実装: "flyTo(...)" のような呼び出しがないまま showMarkerTooltip が
      // すぐ呼ばれるパターン（idx 決定直後、次の行で showMarkerTooltip）がないこと
      expect(block).not.toMatch(/var idx = \w+\[\w+Pos % \w+\.length\];\s*\w+Pos\+\+;\s*showMarkerTooltip\(idx, 0, 0\);/);
    });
  });
});
