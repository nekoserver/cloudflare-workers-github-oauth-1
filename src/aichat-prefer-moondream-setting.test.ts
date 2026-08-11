import { describe, it, expect } from 'vitest';
import { resolveAichatPreferMoondream, AICHAT_PREFER_MOONDREAM_COOKIE } from './index';

// 対象: AIチャットでテキストプロンプトに画像が添付されている場合、選択中の
// モデルより優先してmoondream(内部的にはMOONDREAM_MODEL、AIチャット本体と
// 同じ実績のあるvisionモデル)へ問い合わせるかどうかの設定。/settingsページの
// トグルで変更でき、デフォルトは有効(優先する)。
//
// 故障シナリオ:
//   (1) Cookie未設定時にデフォルトが無効になってしまう(要件は「デフォルトでON」)
//   (2) 'off'判定が緩く、'off'以外の値(空文字・誤字)でも無効扱いになる

describe('resolveAichatPreferMoondream: 画像添付時にmoondreamを優先する設定のCookie解決', () => {
  it('Cookie未設定時はデフォルトで有効(true)', () => {
    expect(resolveAichatPreferMoondream(undefined)).toBe(true);
  });

  it(AICHAT_PREFER_MOONDREAM_COOKIE + '=off の場合は無効(false)', () => {
    expect(resolveAichatPreferMoondream(AICHAT_PREFER_MOONDREAM_COOKIE + '=off')).toBe(false);
  });

  it(AICHAT_PREFER_MOONDREAM_COOKIE + '=on の場合は有効(true)', () => {
    expect(resolveAichatPreferMoondream(AICHAT_PREFER_MOONDREAM_COOKIE + '=on')).toBe(true);
  });

  it('不正な値(off以外の文字列)が入っていてもデフォルトの有効(true)のまま', () => {
    expect(resolveAichatPreferMoondream(AICHAT_PREFER_MOONDREAM_COOKIE + '=xyz')).toBe(true);
  });
});
