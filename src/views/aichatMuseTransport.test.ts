// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { AICHAT_MUSE_HEALTH_SCRIPT } from './aichatMuseHealth';
import { resolveMuseTransport } from '../utils/museWorkerAsk';
const script = new Function(AICHAT_MUSE_HEALTH_SCRIPT + '\nreturn {readMuseSignalSettings,openMuseSignalModal};')();
// 接頭語なしのMuseは常に直送(ユーザー指定 2026-11-12)。保存済みの旧コンテナ直通の選択も直送として読む。
it('settings always resolve to Worker on both browser and server, including a saved legacy container choice', () => {
  for (const value of [null, { enabled: false, intervalSeconds: 900 }, { transport: 'broken' }, { transport: 'container' }]) {
    const cookie = value ? 'aichat_muse_signal=' + encodeURIComponent(JSON.stringify(value)) : '';
    expect(script.readMuseSignalSettings(cookie).transport).toBe('worker');
    expect(resolveMuseTransport(cookie)).toBe('worker');
  }
});
it('the settings modal offers no legacy container route and saves Worker', () => {
  document.body.innerHTML = '';
  const save = vi.fn();
  script.openMuseSignalModal({ getSettings: () => ({ enabled: true, intervalSeconds: 600, transport: 'container' }), saveSettings: save, resetSettings: vi.fn(), getNextZ: () => 1 });
  expect(document.querySelector('[data-muse-transport]')).toBeNull();
  expect(document.body.textContent).not.toContain('旧コンテナ直通');
  [...document.querySelectorAll('button')].find(b => b.textContent === '保存')!.click();
  expect(save).toHaveBeenCalledWith({ enabled: true, intervalSeconds: 600, transport: 'worker', tunnelsFallback: false });
});
