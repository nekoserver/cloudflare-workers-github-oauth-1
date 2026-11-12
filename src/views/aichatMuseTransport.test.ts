// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { AICHAT_MUSE_HEALTH_SCRIPT } from './aichatMuseHealth';
import { resolveMuseTransport } from '../utils/museWorkerAsk';
const script = new Function(AICHAT_MUSE_HEALTH_SCRIPT + '\nreturn {readMuseSignalSettings,openMuseSignalModal};')();
it('old or missing settings default to Worker on both browser and server', () => {
  for (const value of [null, { enabled: false, intervalSeconds: 900 }, { transport: 'broken' }]) {
    const cookie = value ? 'aichat_muse_signal=' + encodeURIComponent(JSON.stringify(value)) : '';
    expect(script.readMuseSignalSettings(cookie).transport).toBe('worker');
    expect(resolveMuseTransport(cookie)).toBe('worker');
  }
});
it('checkboxes always select exactly one route; save persists legacy selection and reopen restores it', () => {
  document.body.innerHTML = '';
  const save = vi.fn();
  const open = (transport?: string) => script.openMuseSignalModal({ getSettings: () => ({ enabled: true, intervalSeconds: 600, transport }), saveSettings: save, resetSettings: vi.fn(), getNextZ: () => 1 });
  open();
  const worker = document.querySelector<HTMLInputElement>('[data-muse-transport="worker"]')!;
  const container = document.querySelector<HTMLInputElement>('[data-muse-transport="container"]')!;
  expect(worker.checked).toBe(true); expect(container.checked).toBe(false);
  worker.click(); expect(worker.checked).toBe(true);
  container.click(); expect(container.checked).toBe(true); expect(worker.checked).toBe(false);
  [...document.querySelectorAll('button')].find(b => b.textContent === '保存')!.click();
  expect(save).toHaveBeenCalledWith({ enabled: true, intervalSeconds: 600, transport: 'container', tunnelsFallback: false });
  open('container'); expect(document.querySelector<HTMLInputElement>('[data-muse-transport="container"]')!.checked).toBe(true);
});
