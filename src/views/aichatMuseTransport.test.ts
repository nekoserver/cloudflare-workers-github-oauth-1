// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { AICHAT_MUSE_HEALTH_SCRIPT } from './aichatMuseHealth';
import { resolveMuseTransport } from '../utils/museWorkerAsk';
const script = new Function(AICHAT_MUSE_HEALTH_SCRIPT + '\nreturn {readMuseSignalSettings,openMuseSignalModal};')();
// 既定は直接(本体のコンテナから muse-vm へ)。Worker内WASMは明示的に選んだときだけ(ユーザー指定 2026-11-12)。
it('old or missing settings default to direct (container) on both browser and server', () => {
  for (const value of [null, { enabled: false, intervalSeconds: 900 }, { transport: 'broken' }]) {
    const cookie = value ? 'aichat_muse_signal=' + encodeURIComponent(JSON.stringify(value)) : '';
    expect(script.readMuseSignalSettings(cookie).transport).toBe('container');
    expect(resolveMuseTransport(cookie)).toBe('container');
  }
  const worker = 'aichat_muse_signal=' + encodeURIComponent(JSON.stringify({ transport: 'worker' }));
  expect(script.readMuseSignalSettings(worker).transport).toBe('worker');
  expect(resolveMuseTransport(worker)).toBe('worker');
});
it('checkboxes always select exactly one route; save persists legacy selection and reopen restores it', () => {
  document.body.innerHTML = '';
  const save = vi.fn();
  const open = (transport?: string) => script.openMuseSignalModal({ getSettings: () => ({ enabled: true, intervalSeconds: 600, transport }), saveSettings: save, resetSettings: vi.fn(), getNextZ: () => 1 });
  open();
  const worker = document.querySelector<HTMLInputElement>('[data-muse-transport="worker"]')!;
  const container = document.querySelector<HTMLInputElement>('[data-muse-transport="container"]')!;
  expect(container.checked).toBe(true); expect(worker.checked).toBe(false);
  expect(container.parentElement!.textContent).toContain('デフォルト');
  expect(worker.parentElement!.textContent).not.toContain('デフォルト');
  container.click(); expect(container.checked).toBe(true);
  worker.click(); expect(worker.checked).toBe(true); expect(container.checked).toBe(false);
  [...document.querySelectorAll('button')].find(b => b.textContent === '保存')!.click();
  expect(save).toHaveBeenCalledWith({ enabled: true, intervalSeconds: 600, transport: 'worker' });
  open('worker'); expect(document.querySelector<HTMLInputElement>('[data-muse-transport="worker"]')!.checked).toBe(true);
});
