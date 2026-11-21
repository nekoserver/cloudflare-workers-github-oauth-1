/**
 * Worker 内 WASM の Go(Tailscale)が終了したら、次の要求で起動し直す(2026-11-13)。
 *
 * 仮説: 2026-11-12 19:29:33 UTC、Durable Object の中で Go が exit code 1 で終了し、
 * その後は終了した Go を握ったまま、直送がすべて即 503(tailscale_wasm_unavailable)になった。
 * 起動の Promise を一度作ったら作り直さないためで、Go の終了や起動の失敗を見て作り直せば、自分で復帰できる。
 */
import { describe, expect, it } from 'vitest';
import { createGoLifecycle, GoNodeUnavailableError, startGoNode } from './goLifecycle';

function fakeBoot() {
  const boots: { exit: (e?: unknown) => void; fail: (e: unknown) => void }[] = [];
  const boot = () => {
    let exit!: (e?: unknown) => void, fail!: (e: unknown) => void;
    const exited = new Promise<unknown>((res, rej) => { exit = res; fail = rej; });
    boots.push({ exit, fail });
    return { ready: Promise.resolve(), exited };
  };
  return { boot, boots };
}

describe('createGoLifecycle', () => {
  it('動いている間は同じ Go を使い回す', async () => {
    const { boot, boots } = fakeBoot();
    const go = createGoLifecycle(boot);
    await go.start(); await go.start();
    expect(boots).toHaveLength(1);
    expect(go.exited).toBe(false);
  });

  it('Go が終了したら、次の start で起動し直す', async () => {
    const { boot, boots } = fakeBoot();
    const go = createGoLifecycle(boot);
    await go.start();
    boots[0].exit(1);
    await Promise.resolve(); await Promise.resolve();
    expect(go.exited).toBe(true);
    await go.start();
    expect(boots).toHaveLength(2);
    expect(go.exited).toBe(false);
  });

  it('Go が異常終了(reject)しても、次の start で起動し直す', async () => {
    const { boot, boots } = fakeBoot();
    const go = createGoLifecycle(boot);
    await go.start();
    boots[0].fail(new Error('Go program has already exited'));
    await Promise.resolve(); await Promise.resolve();
    await go.start();
    expect(boots).toHaveLength(2);
  });

  it('起動に失敗したら、次の start で起動し直す(失敗を握ったままにしない)', async () => {
    let n = 0;
    const go = createGoLifecycle(() => ({ ready: n++ === 0 ? Promise.reject(new Error('startup failed')) : Promise.resolve(), exited: new Promise<unknown>(() => {}) }));
    await expect(go.start()).rejects.toThrow('startup failed');
    await expect(go.start()).resolves.toBeUndefined();
    expect(n).toBe(2);
  });
});

describe('startGoNode', () => {
  it('GoがnewIPN中に終了してundefinedを返したら、起動し直してからノードを作る', async () => {
    const { boot, boots } = fakeBoot();
    const go = createGoLifecycle(boot);
    const node = { run() {} };
    let calls = 0;
    const result = await startGoNode(go, () => {
      if (++calls === 1) {
        boots[0].exit(1);
        return undefined;
      }
      return node;
    });
    expect(result).toBe(node);
    expect(boots).toHaveLength(2);
  });

  it('終了 Promise が未処理でも、Go の終了フラグから再起動できる', async () => {
    let stopped = false;
    let boots = 0;
    const go = createGoLifecycle(() => {
      boots++;
      stopped = false;
      return { ready: Promise.resolve(), exited: new Promise(() => {}), isExited: () => stopped };
    });
    const node = { run() {} };
    const result = await startGoNode(go, () => {
      if (boots === 1) {
        stopped = true;
        return undefined;
      }
      return node;
    });
    expect(result).toBe(node);
    expect(boots).toBe(2);
  });

  it('Goが動作中に不正な値を返したら、runを呼ばず診断可能なエラーにする', async () => {
    const { boot, boots } = fakeBoot();
    const go = createGoLifecycle(boot);
    await expect(startGoNode(go, () => undefined)).rejects.toThrow(GoNodeUnavailableError);
    expect(boots).toHaveLength(1);
  });

  it('newIPNが返した初期化エラーを保持する', async () => {
    const { boot } = fakeBoot();
    const error = new Error('newIPN failed');
    await expect(startGoNode(createGoLifecycle(boot), () => error)).rejects.toBe(error);
  });
});
