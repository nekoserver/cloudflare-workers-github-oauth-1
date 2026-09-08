import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const baseUser = {
  username: 'octocat',
  issuedAt: '2026-01-01 00:00',
  expiresAt: '2026-01-01 01:00',
  expiresAtTimestamp: 1234567890,
};

// 対象: 設定ページの「MLBページ「本日の先発投手」モーダルでリーグ/地区を選んだ時、
// 対象外の試合を非表示にせずグレーアウト表示にする」トグル。
// D1ではなくCookie(容量不足時はlocalStorageフォールバック)で管理する
// (neko_pr_hide_author等、既存の設定トグルと同じパターン)。既定はON
// (グレーアウト)で、OFFにすると/mlbページ側は従来通り対象外の試合を
// 一覧から取り除く('hide')。
//
// 故障シナリオ:
//   (1) チェックボックス・ラベルのHTML自体が無い
//   (2) 初期化時にreadSettingCookieOrLocalStorageを使わず、Cookie/localStorageの
//       既存設定を無視してしまう
//   (3) デフォルト値が'gray'(ON)になっておらず、未設定ユーザーの挙動が
//       変わってしまう
//   (4) onMlbPitcherFilterGrayoutChangeがCookie名'mlb_pitcher_filter_mode'
//       以外に書き込んでしまい、/mlbページ側のgetCookieValueClient('mlb_pitcher_filter_mode')と
//       食い違う
//   (5) script タグ内のJSに構文エラーがある(CLAUDE.mdルール29)
describe('設定ページ: MLB先発投手モーダルのグレーアウト表示トグル', () => {
  const html = getSettingsPage({ ...baseUser });

  it('チェックボックス・ラベルが存在し、ラベル初期表示は"ON"(既定はグレーアウト)', () => {
    expect(html).toContain('id="mlbPitcherFilterGrayoutCheckbox"');
    expect(html).toContain('id="mlbPitcherFilterGrayoutLabel">ON<');
    expect(html).toContain('onchange="onMlbPitcherFilterGrayoutChange()"');
  });

  it('初期化時はreadSettingCookieOrLocalStorageでCookie/localStorageから読み、デフォルトは"gray"', () => {
    expect(html).toContain("readSettingCookieOrLocalStorage('mlb_pitcher_filter_mode', 'gray')");
  });

  it("チェックOFF時は'hide'として保存され、ON時は'gray'として保存される", () => {
    const fnIdx = html.indexOf('function onMlbPitcherFilterGrayoutChange');
    expect(fnIdx).toBeGreaterThan(-1);
    const fn = html.slice(fnIdx, html.indexOf('\n    }', fnIdx));
    expect(fn).toContain("writeSettingCookieWithFallback('mlb_pitcher_filter_mode', enabled ? 'gray' : 'hide'");
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
