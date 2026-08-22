import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const baseUser = {
  username: 'octocat',
  issuedAt: '2026-01-01 00:00',
  expiresAt: '2026-01-01 01:00',
  expiresAtTimestamp: 1234567890,
};

// 対象: 設定ページの「世界遺産の巡回ルート処理時に国別フィルタを適用する」トグル。
// heritage-journeyページの「ルート順序」国別フィルタが「🎬巡回ルートを再現する🌏」実行時の
// データにも反映されるかどうかを制御する。デフォルトで有効(する=ON)であることを確認する。
describe('設定ページ: 世界遺産の巡回ルート国別フィルタトグル', () => {
  it('heritageTourCountryFilterを指定しない場合はデフォルトでON(する/チェック済み)表示になる', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('id="heritageTourCountryFilterCheckbox"');
    expect(html).toMatch(/id="heritageTourCountryFilterCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="heritageTourCountryFilterLabel">ON<');
  });

  it("heritageTourCountryFilter='off'の場合はOFF(しない/未チェック)表示になる", () => {
    const html = getSettingsPage({ ...baseUser, heritageTourCountryFilter: 'off' });
    expect(html).not.toMatch(/id="heritageTourCountryFilterCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="heritageTourCountryFilterLabel">OFF<');
  });

  it("heritageTourCountryFilter='on'の場合はON(する/チェック済み)表示になる", () => {
    const html = getSettingsPage({ ...baseUser, heritageTourCountryFilter: 'on' });
    expect(html).toMatch(/id="heritageTourCountryFilterCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="heritageTourCountryFilterLabel">ON<');
  });

  it('変更はonHeritageTourCountryFilterChangeで/api/settings/heritage-tour-country-filterへPOSTする', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('onchange="onHeritageTourCountryFilterChange()"');
    const fnIdx = html.indexOf('async function onHeritageTourCountryFilterChange');
    expect(fnIdx).toBeGreaterThan(-1);
    const fn = html.slice(fnIdx, html.indexOf('\n    }', fnIdx));
    expect(fn).toContain("fetch('/api/settings/heritage-tour-country-filter'");
    expect(fn).toContain('method: \'POST\'');
  });
});
