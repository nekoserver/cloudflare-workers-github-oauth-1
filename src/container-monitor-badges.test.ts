import { describe, it, expect } from 'vitest';
import { statusLevel } from '../public/container-monitor.mjs';
import { getContainerMonitorPage } from './views/containerMonitor';

// /container-monitor は、本体コンテナに頼らずCloudflareのAPIから状態を読む。本体コンテナが落ちていても見られる。
// 状態の欄を、意味ごとに色分けしたバッジで出す(ユーザー指定 2026-10-31)。
describe('/container-monitor の状態のバッジ', () => {
  it('状態を、ok(緑)・warn(黄)・ng(赤)・info(灰)に分ける', () => {
    expect(['running', 'online'].map(statusLevel)).toEqual(['ok', 'ok']);
    expect(['provisioning', 'starting', 'stopping'].map(statusLevel)).toEqual(['warn', 'warn', 'warn']);
    expect(['failed', 'unhealthy', 'offline'].map(statusLevel)).toEqual(['ng', 'ng', 'ng']);
    expect(['stopped', 'inactive', 'unknown', 'no-instances', 'other'].map(statusLevel)).toEqual(['info', 'info', 'info', 'info', 'info']);
  });
  it('ページに、色分けのバッジのCSSがある', () => {
    const html = getContainerMonitorPage();
    for (const level of ['ok', 'warn', 'ng', 'info']) expect(html).toContain(`.badge[data-level="${level}"]`);
  });
});
