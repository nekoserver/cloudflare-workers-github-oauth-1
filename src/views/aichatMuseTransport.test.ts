// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { AICHAT_MUSE_HEALTH_SCRIPT } from './aichatMuseHealth';
const script = new Function(AICHAT_MUSE_HEALTH_SCRIPT + '\nreturn {readMuseSignalSettings,openMuseSignalModal};')();
// AIチャットからのMuse送信は(接頭語を付けない限り)常に直送(ユーザー指定 2026-11-12)。経路の選択は無い。
it('settings carry no route, and an old saved route is ignored', () => {
  const old = 'aichat_muse_signal=' + encodeURIComponent(JSON.stringify({ transport: 'worker', enabled: false, intervalSeconds: 900 }));
  expect(script.readMuseSignalSettings(old)).toEqual({ enabled: false, intervalSeconds: 900 });
});
it('the settings modal has no route selector', () => {
  document.body.innerHTML = '';
  script.openMuseSignalModal({ getSettings: () => ({ enabled: true, intervalSeconds: 600 }), saveSettings: () => {}, resetSettings: () => {}, getNextZ: () => 1 });
  expect(document.querySelector('[data-muse-transport]')).toBeNull();
  expect(document.body.textContent).not.toContain('Worker内WASM');
});
