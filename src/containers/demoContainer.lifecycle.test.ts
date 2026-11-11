import { beforeEach, describe, expect, it, vi } from 'vitest';

// SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md の2章・3章。
// Durable Object Container API: https://developers.cloudflare.com/containers/api/durable-object-container/
vi.mock('cloudflare:workers', () => ({
  DurableObject: class { ctx: unknown; env: unknown; constructor(ctx: unknown, env: unknown) { this.ctx = ctx; this.env = env; } },
}));
const record = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../utils/cfContainerOperationLog', () => ({ recordContainerOperation: record }));

import { CONTAINER_PORT, DemoContainer, INACTIVITY_TIMEOUT_MS, KEEPALIVE_INTERVAL_MS } from './demoContainer';
import { createFakeCtx } from './demoContainerFakeCtx';

const ENV = {
  NEKOROOT_HOSTNAME: 'h', NEKOROOT_TUNNEL_TOKEN: 't', TAILSCALE_AUTHKEY: 'ts', TAILSCALE_LOGIN_SERVER: 'ls',
  SSH_HOST_ED25519_KEY_B64: 'k', SSH_AUTHORIZED_KEYS: 'a', CF_CONTAINER_API_TOKEN: 'cf', CLOUDFLARE_ACCOUNT_ID: 'acc',
  CONTAINER_GH_TOKEN: 'gh', DB: {},
};

function setup(opts: { running?: boolean; ready?: boolean } = {}) {
  const fake = createFakeCtx(opts);
  const instance = new DemoContainer(fake.ctx as never, ENV as never);
  (instance as unknown as { sleep: (ms: number) => Promise<void> }).sleep = async () => {};
  return { ...fake, instance };
}
const flush = async (calls: { waitUntil: Promise<unknown>[] }) => { await Promise.allSettled(calls.waitUntil); };

beforeEach(() => { record.mockClear(); });

describe('起動', () => {
  it('今と同じ10個の環境変数とインターネット接続で起動し、ポートの準備完了を待つ', async () => {
    const { instance, calls, state } = setup();
    state.pingFailures = 2;
    await instance.start();
    expect(calls.start).toEqual([{ enableInternet: true, env: {
      NEKOROOT_HOSTNAME: 'h', NEKOROOT_TUNNEL_TOKEN: 't', TAILSCALE_AUTHKEY: 'ts', TAILSCALE_LOGIN_SERVER: 'ls',
      SSH_HOST_ED25519_KEY_B64: 'k', SSH_AUTHORIZED_KEYS: 'a', CF_CONTAINER_API_TOKEN: 'cf', CLOUDFLARE_ACCOUNT_ID: 'acc', GH_TOKEN: 'gh',
    } }]);
    expect(calls.fetch).toEqual([`${CONTAINER_PORT} http://ping`]);
    expect((await instance.getState()).status).toBe('healthy');
  });

  it('未設定の値は空文字で渡す', async () => {
    const fake = createFakeCtx();
    const instance = new DemoContainer(fake.ctx as never, { DB: {} } as never);
    (instance as unknown as { sleep: () => Promise<void> }).sleep = async () => {};
    await instance.start();
    expect(Object.values(fake.calls.start[0].env ?? {})).toEqual(Array(9).fill(''));
  });

  it('起動後に無活動タイムアウト(6時間)と、それより短い間隔のアラームを設定する', async () => {
    const { instance, state } = setup();
    const before = Date.now();
    await instance.start();
    expect(INACTIVITY_TIMEOUT_MS).toBe(6 * 60 * 60 * 1000);
    expect(KEEPALIVE_INTERVAL_MS).toBeLessThan(INACTIVITY_TIMEOUT_MS);
    expect(state.timeoutMs).toBe(INACTIVITY_TIMEOUT_MS);
    expect(state.alarm).toBeGreaterThanOrEqual(before + KEEPALIVE_INTERVAL_MS);
  });

  it('動いていれば start() を呼ばない(公式: 動いている間の start() は例外)', async () => {
    const { instance, calls } = setup({ running: true });
    await instance.start();
    expect(calls.start).toHaveLength(0);
  });

  it('起動直後に落ちたら理由付きで失敗し、ロックを放す', async () => {
    const { instance, state } = setup();
    state.crashOnStart = true;
    await expect(instance.start()).rejects.toThrow('止まりました');
    state.crashOnStart = false;
    await expect(instance.start()).resolves.toBeUndefined();
  });

  it('準備完了しなければ理由付きで失敗する', async () => {
    const { instance, state } = setup();
    state.pingFailures = 10_000;
    await expect(instance.start()).rejects.toThrow(`${CONTAINER_PORT}`);
  });
});

describe('状態', () => {
  it('読んでも起動しない。止まっていれば stopped、0以外で終われば stopped_with_code', async () => {
    const { instance, calls, exit } = setup();
    expect(await instance.getState()).toMatchObject({ status: 'stopped' });
    expect(calls.start).toHaveLength(0);
    await instance.start();
    exit(1);
    await flush(calls);
    expect(await instance.getState()).toMatchObject({ status: 'stopped_with_code', exitCode: 1 });
  });

  it('動いているが準備完了を確かめていなければ running', async () => {
    const { instance } = setup({ running: true, ready: false });
    expect((await instance.getState()).status).toBe('running');
  });

  it('SIGTERM で止まりきらなければ stopping', async () => {
    const { instance, state } = setup();
    await instance.start();
    state.stopsOnSigterm = false;
    await instance.stop();
    expect((await instance.getState()).status).toBe('stopping');
  });
});

describe('停止と記録', () => {
  it('stop は SIGTERM を送り、止まるまで待つ。停止は1回だけ記録する', async () => {
    const { instance, calls } = setup();
    await instance.start();
    await instance.stop();
    expect(calls.signal).toEqual([15]);
    expect((await instance.getState()).status).toBe('stopped');
    await flush(calls);
    await instance.alarm();
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(ENV.DB, expect.objectContaining({ action: 'stop', performedBy: 'system(onStop)', result: 'success' }), expect.any(Function));
  });

  it('止まっていれば stop は何も送らない', async () => {
    const { instance, calls } = setup();
    await instance.stop();
    expect(calls.signal).toEqual([]);
  });

  it('記録に失敗しても停止の処理は続く', async () => {
    const { instance, calls } = setup();
    record.mockRejectedValueOnce(new Error('db down'));
    await instance.start();
    await expect(instance.stop()).resolves.toBeUndefined();
    await flush(calls);
    expect((await instance.getState()).status).toBe('stopped');
  });
});

describe('アラーム(起こし続ける)', () => {
  it('動いていればタイムアウトとアラームをかけ直す', async () => {
    const { instance, state } = setup();
    await instance.start();
    state.alarm = null; state.timeoutMs = null;
    await instance.alarm();
    expect(state.timeoutMs).toBe(INACTIVITY_TIMEOUT_MS);
    expect(state.alarm).not.toBeNull();
  });

  it('止まっていれば停止を記録し(Durable Object は起こされないため)、アラームを消す', async () => {
    const { instance, state, storage } = setup();
    await instance.start();
    // monitor() が知らせずに止まった場合(Durable Object がメモリにいなかった)
    storage.set('demo:running', true);
    state.running = false;
    await instance.alarm();
    expect(record).toHaveBeenCalledTimes(1);
    expect(state.alarm).toBeNull();
    await instance.alarm();
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('旧クラスが残したアラームでも、止まっていれば何も記録せず消す', async () => {
    const { instance, state } = setup();
    state.alarm = 1;
    await instance.alarm();
    expect(record).not.toHaveBeenCalled();
    expect(state.alarm).toBeNull();
  });

  it('再起動した Durable Object は、動いているコンテナのタイムアウトを張り直す', async () => {
    const { state } = setup({ running: true });
    await Promise.resolve();
    expect(state.timeoutMs).toBe(INACTIVITY_TIMEOUT_MS);
  });
});

describe('転送', () => {
  it('止まっていれば起動して準備完了を待ち、ポート 8080 へ http で転送する', async () => {
    const { instance, calls } = setup();
    const res = await instance.fetch(new Request('https://example.com/a?b=1'));
    expect(await res.text()).toBe('ok http://example.com/a?b=1');
    expect(calls.start).toHaveLength(1);
    expect(calls.fetch).toEqual([`${CONTAINER_PORT} http://ping`, `${CONTAINER_PORT} http://example.com/a?b=1`]);
  });

  it('同時の要求は起動を1回だけ行う', async () => {
    const { instance, calls } = setup();
    await Promise.all([instance.fetch(new Request('https://x/1')), instance.fetch(new Request('https://x/2'))]);
    expect(calls.start).toHaveLength(1);
  });

  it('起動に失敗したら 500 と理由を返す', async () => {
    const { instance, state } = setup();
    state.crashOnStart = true;
    const res = await instance.fetch(new Request('https://x/'));
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('Failed to start container');
  });
});
