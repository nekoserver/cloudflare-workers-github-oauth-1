import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const baseUser = {
  username: 'octocat',
  issuedAt: '2026-01-01 00:00',
  expiresAt: '2026-01-01 01:00',
  expiresAtTimestamp: 1234567890,
};

// 対象: 設定ページの「テキストプロンプトに添付画像がある場合優先的に言語モデル
// moondreamで画像を分析する」トグル。デフォルトで有効(ON)であることを確認する。
describe('設定ページ: 画像添付時にmoondreamを優先するトグル', () => {
  it('aichatPreferMoondreamを指定しない場合はデフォルトでON(チェック済み)表示になる', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('id="aichatPreferMoondreamCheckbox"');
    expect(html).toMatch(/id="aichatPreferMoondreamCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="aichatPreferMoondreamLabel">ON<');
  });

  it("aichatPreferMoondream='off'の場合はOFF(未チェック)表示になる", () => {
    const html = getSettingsPage({ ...baseUser, aichatPreferMoondream: 'off' });
    expect(html).not.toMatch(/id="aichatPreferMoondreamCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="aichatPreferMoondreamLabel">OFF<');
  });

  it("aichatPreferMoondream='on'の場合はON(チェック済み)表示になる", () => {
    const html = getSettingsPage({ ...baseUser, aichatPreferMoondream: 'on' });
    expect(html).toMatch(/id="aichatPreferMoondreamCheckbox"[\s\S]{0,80}checked/);
    expect(html).toContain('id="aichatPreferMoondreamLabel">ON<');
  });

  it('変更はonAichatPreferMoondreamChangeで/api/settings/aichat-prefer-moondreamへPOSTする', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('onchange="onAichatPreferMoondreamChange()"');
    const fnIdx = html.indexOf('async function onAichatPreferMoondreamChange');
    expect(fnIdx).toBeGreaterThan(-1);
    const fn = html.slice(fnIdx, html.indexOf('\n    }', fnIdx));
    expect(fn).toContain("fetch('/api/settings/aichat-prefer-moondream'");
    expect(fn).toContain('method: \'POST\'');
  });
});
