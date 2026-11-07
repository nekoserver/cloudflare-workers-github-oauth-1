import { describe, expect, it, vi } from 'vitest';
import { AICHAT_MUSE_HEALTH_SCRIPT } from './aichatMuseHealth';
const create = new Function(AICHAT_MUSE_HEALTH_SCRIPT + ';return createMuseHealthWatch;')();
function setup(fetchHealth: () => Promise<boolean>) {
  const border = vi.fn(), popup = vi.fn();
  const watch = create({ fetchHealth, setBorderColor: border, notifyUnavailable: popup, getColor: () => 'blue', isHidden: () => false, getSettings: () => ({ enabled: true, intervalSeconds: 600 }) });
  return { watch, border, popup };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
describe('Muse投稿・枠色・接続警告の順序', () => {
  it('切断では枠を解除してポップアップを一度表示する', async () => {
    vi.useFakeTimers();
    try {
      const f = setup(async () => false); f.watch.setModel('muse'); await flush();
      expect(f.border).toHaveBeenLastCalledWith('');
      expect(f.popup).toHaveBeenCalledExactlyOnceWith('Tailscaleの接続状況を確認してください');
      await vi.advanceTimersByTimeAsync(600000);
      expect(f.popup).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it('投稿開始前の古い接続成功で枠が戻らない', async () => {
    vi.useFakeTimers();
    try {
      let resolve!: (value: boolean) => void;
      const f = setup(() => new Promise(r => { resolve = r; }));
      f.watch.setModel('muse'); f.watch.beginSubmission(); f.watch.finishSubmission(false);
      resolve(true); await flush();
      expect(f.border).toHaveBeenLastCalledWith(''); expect(f.popup).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it('投稿中は定期確認の成功が枠色を変更しない', async () => {
    vi.useFakeTimers();
    try {
      const health = vi.fn(async () => true); const f = setup(health);
      f.watch.setModel('muse'); await flush(); f.watch.beginSubmission();
      await vi.advanceTimersByTimeAsync(600000);
      expect(health).toHaveBeenCalledTimes(1); expect(f.border).toHaveBeenLastCalledWith('');
      f.watch.finishSubmission(true); await flush(); expect(f.border).toHaveBeenLastCalledWith('blue');
    } finally { vi.useRealTimers(); }
  });
  it('モデル切替・設定OFFでは接続警告を出さない', async () => {
    vi.useFakeTimers();
    try { const f = setup(async () => true); f.watch.setModel('claude'); expect(f.popup).not.toHaveBeenCalled(); }
    finally { vi.useRealTimers(); }
  });
});
