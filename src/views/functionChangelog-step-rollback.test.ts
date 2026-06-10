import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(path.join(__dirname, 'functionChangelog.ts'), 'utf-8');

// ===========================================================
// バグ: repoBanner のフェードアウト完了時（9秒後）に setStep(1) が
// 無条件で呼ばれるため、9秒以内にファイル選択した場合に
// ステップ表示が「ファイルを選択してください」に巻き戻される
// ===========================================================

describe('functionChangelog: ステップ巻き戻りバグの修正', () => {
  it('現在のステップを追跡する currentStep 変数が存在する', () => {
    expect(src).toContain('var currentStep = 0');
  });

  it('setStep が currentStep を更新する', () => {
    const idx = src.indexOf('function setStep(step)');
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 300);
    expect(fn).toContain('currentStep = step');
  });

  it('repoBanner フェード完了時の setStep(1) は未操作時のみ実行される', () => {
    const idx = src.indexOf('transitionend');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 300);
    expect(snippet).toMatch(/if\s*\(\s*currentStep\s*===\s*0\s*\)\s*setStep\(1\)/);
  });

  it('無条件の setStep(1) 呼び出しが transitionend ハンドラに残っていない', () => {
    const idx = src.indexOf('transitionend');
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 300);
    expect(snippet).not.toMatch(/;\s*setStep\(1\);/);
  });
});
