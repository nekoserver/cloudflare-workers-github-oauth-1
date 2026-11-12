import { describe, expect, it, vi } from 'vitest';
import { readMuseNodeSnapshot, waitForMuseNode, type MuseNodeSnapshot } from './museNodeReady';

function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
}
function sequence(...states: MuseNodeSnapshot[]) {
  let i = 0;
  return () => states[Math.min(i++, states.length - 1)];
}

describe('readMuseNodeSnapshot', () => {
  it('muse-vmがオンラインのpeerにいればmuseOnline', () => {
    expect(readMuseNodeSnapshot(JSON.stringify({ state: 'Running', peers: [{ name: 'muse-vm.tail.ts.net', online: true }] }))).toEqual({ state: 'Running', museOnline: true });
    expect(readMuseNodeSnapshot(JSON.stringify({ state: 'Running', peers: [{ name: 'muse-vm', online: false }] }))).toEqual({ state: 'Running', museOnline: false });
  });
  it('Errorや壊れたJSONは未接続', () => {
    expect(readMuseNodeSnapshot(new Error('x'))).toEqual({ state: '', museOnline: false });
    expect(readMuseNodeSnapshot('{')).toEqual({ state: '', museOnline: false });
  });
});

describe('waitForMuseNode', () => {
  const running = { state: 'Running', museOnline: true };
  it('Runningになった後もmuse-vmが見えるまで待つ(6秒を超えても)', async () => {
    const c = clock();
    const notYet = Array.from({ length: 80 }, () => ({ state: 'Running', museOnline: false }));
    const result = await waitForMuseNode({ snapshot: sequence({ state: 'Starting', museOnline: false }, ...notYet, running), canLogin: true, ...c });
    expect(result).toEqual(running);
    expect(c.now()).toBeGreaterThan(6000);
  });
  it('NeedsLoginなら1回だけログインする', async () => {
    const login = vi.fn();
    const needs = { state: 'NeedsLogin', museOnline: false };
    await waitForMuseNode({ snapshot: sequence(needs, needs, needs, running), canLogin: true, login, ...clock() });
    expect(login).toHaveBeenCalledOnce();
  });
  it('上限で打ち切る', async () => {
    const c = clock();
    const result = await waitForMuseNode({ snapshot: () => ({ state: 'Running', museOnline: false }), canLogin: true, timeoutMs: 1000, ...c });
    expect(result.museOnline).toBe(false);
    expect(c.now()).toBeLessThanOrEqual(1100);
  });
  it('ログインできない(鍵なし・自動ログイン停止)ときはRunningでないまま待たない', async () => {
    const c = clock();
    await waitForMuseNode({ snapshot: () => ({ state: 'NeedsLogin', museOnline: false }), canLogin: false, ...c });
    expect(c.now()).toBe(0);
  });
});
