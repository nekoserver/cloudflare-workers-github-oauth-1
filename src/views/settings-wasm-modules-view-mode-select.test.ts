import { describe, it, expect } from 'vitest';
import { getSettingsPage } from './settings';

const baseUser = {
  username: 'octocat',
  issuedAt: '2026-01-01 00:00',
  expiresAt: '2026-01-01 01:00',
  expiresAtTimestamp: 1234567890,
};

// 対象: 設定ページの「WASMモジュール一覧ページのデフォルト表示モード」選択。
// デフォルトはリスト表示。
describe('設定ページ: WASMモジュール一覧ページのデフォルト表示モード選択', () => {
  it('wasmModulesViewModeを指定しない場合はデフォルトでリスト表示が選択される', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('id="wasmModulesViewModeSelect"');
    expect(html).toMatch(/<option value="list" selected>/);
  });

  it("wasmModulesViewMode='panel'の場合はパネル表示が選択される", () => {
    const html = getSettingsPage({ ...baseUser, wasmModulesViewMode: 'panel' });
    expect(html).toMatch(/<option value="panel" selected>/);
  });

  it('変更はonWasmModulesViewModeChangeで/api/settings/wasm-modules-view-modeへPOSTする', () => {
    const html = getSettingsPage({ ...baseUser });
    expect(html).toContain('onchange="onWasmModulesViewModeChange()"');
    const fnIdx = html.indexOf('async function onWasmModulesViewModeChange');
    expect(fnIdx).toBeGreaterThan(-1);
    const fn = html.slice(fnIdx, html.indexOf('\n    }', fnIdx));
    expect(fn).toContain("fetch('/api/settings/wasm-modules-view-mode'");
    expect(fn).toContain('method: \'POST\'');
  });
});
