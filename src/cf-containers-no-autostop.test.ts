import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('demoコンテナの自動停止', () => {
  // 振る舞いは src/containers/demoContainer.lifecycle.test.ts の「アラーム(起こし続ける)」で確かめる。
  // ここでは、無操作で止める処理(タイムアウトを短くする・アラームで止める)を書いていないことを確かめる。
  it('アラームで起こし続け、無操作で止めない', () => {
    const src = readFileSync('src/containers/demoContainer.ts', 'utf8');
    const alarm = src.slice(src.indexOf('async alarm(): Promise<void> {'), src.indexOf('// ===== Workerからの転送'));
    expect(alarm).toContain('setInactivityTimeout(INACTIVITY_TIMEOUT_MS)');
    expect(alarm).toContain('setAlarm(Date.now() + KEEPALIVE_INTERVAL_MS)');
    expect(alarm).not.toMatch(/signal\(|destroy\(/);
    expect(src).toContain('export const INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;');
    expect(src).toContain('export const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;');
  });
  it('ページに自動停止しない旨を表示する', () => {
    const view = readFileSync('src/views/cfContainers.ts', 'utf8');
    expect(view).toContain('自動停止はしません');
    expect(view).not.toContain('経過すると自動停止します');
  });
});
