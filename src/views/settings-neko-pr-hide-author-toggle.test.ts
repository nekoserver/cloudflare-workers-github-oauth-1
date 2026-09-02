import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const baseUser = {
  username: 'octocat',
  issuedAt: '2026-01-01 00:00',
  expiresAt: '2026-01-01 01:00',
  expiresAtTimestamp: 1234567890,
};

// 対象: 設定ページの「スラッシュコマンドからのプルリク応答で作成者を伏せる
// （/neko gh pr list）」トグル。D1ではなくCookie(容量不足時はlocalStorage
// フォールバック)で管理する(他のCookie管理トグル、er_tilt_enabled等と同じ
// パターン)。ラベルの初期値は常に"ON"で、実際のON/OFF判定はクライアント側
// JS(document.cookie読み取り)で行うため、サーバー側HTMLに動的な
// checked/uncheckedは出力しない。
//
// 故障シナリオ:
//   (1) チェックボックス・ラベルのHTML自体が無い
//   (2) Cookie書き込み前の容量チェック(hasCookieCapacityFor)が実装されておらず
//       容量超過時にそのまま書き込みを試みてしまう
//   (3) Cookie書き込みに失敗した場合にlocalStorageへフォールバックしない
//   (4) script タグ内のJSに構文エラーがある(CLAUDE.mdルール29)
describe('設定ページ: スラッシュコマンドのプルリク応答で作成者を伏せるトグル', () => {
  const html = getSettingsPage({ ...baseUser });

  it('チェックボックス・ラベルが存在し、ラベル初期表示は"ON"', () => {
    expect(html).toContain('id="nekoPrHideAuthorCheckbox"');
    expect(html).toContain('id="nekoPrHideAuthorLabel">ON<');
    expect(html).toContain('onchange="onNekoPrHideAuthorChange()"');
  });

  it('Cookie書き込み前に容量チェックを行う関数(hasCookieCapacityFor)が定義されている', () => {
    expect(html).toContain('function hasCookieCapacityFor(');
  });

  it('容量不足・書き込み失敗時にlocalStorageへフォールバックする関数が定義されている', () => {
    expect(html).toContain('function writeSettingCookieWithFallback(');
    expect(html).toContain('window.localStorage.setItem(');
  });

  it('onNekoPrHideAuthorChangeはwriteSettingCookieWithFallback経由でCookie名neko_pr_hide_authorへ書き込む', () => {
    const fnIdx = html.indexOf('function onNekoPrHideAuthorChange');
    expect(fnIdx).toBeGreaterThan(-1);
    const fn = html.slice(fnIdx, html.indexOf('\n    }', fnIdx));
    expect(fn).toContain("writeSettingCookieWithFallback('neko_pr_hide_author'");
  });

  it('初期化時はreadSettingCookieOrLocalStorageでCookie/localStorageから読み、デフォルトは"on"', () => {
    expect(html).toContain("readSettingCookieOrLocalStorage('neko_pr_hide_author', 'on')");
  });

  it('script タグ内のJSに構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});
