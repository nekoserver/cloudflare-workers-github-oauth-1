import { describe, expect, it, vi } from 'vitest';

// SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md 3章の4。
vi.mock('cloudflare:workers', () => ({
  DurableObject: class { ctx: unknown; env: unknown; constructor(ctx: unknown, env: unknown) { this.ctx = ctx; this.env = env; } },
}));
vi.mock('../utils/cfContainerOperationLog', () => ({ recordContainerOperation: async () => {} }));
import { DemoContainer } from './demoContainer';
import { createFakeCtx } from './demoContainerFakeCtx';

function container(opts: { running?: boolean } = { running: true }) {
  const fake = createFakeCtx(opts);
  const instance = new DemoContainer(fake.ctx as never, {
    CF_CONTAINER_API_TOKEN: 'expired-token',
    CLOUDFLARE_ACCOUNT_ID: 'account',
    NEKOROOT_TUNNEL_TOKEN: 'tunnel-token',
  } as never);
  (instance as unknown as { sleep: () => Promise<void> }).sleep = async () => {};
  return { ...fake, instance };
}

describe('secret更新時の再起動', () => {
  it('旧envを持つDOでも新しい値で起動し、他の変数を維持する', async () => {
    const { instance, calls } = container();
    await instance.restart({ name: 'CF_CONTAINER_API_TOKEN', value: 'new-token' });
    expect(calls.signal).toEqual([15]);
    expect(calls.start[0].env).toEqual(expect.objectContaining({
      CF_CONTAINER_API_TOKEN: 'new-token',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      NEKOROOT_TUNNEL_TOKEN: 'tunnel-token',
    }));
    await instance.restart();
    expect(calls.start[1].env).toEqual(expect.objectContaining({ CF_CONTAINER_API_TOKEN: 'new-token' }));
  });

  it('SIGTERMで止まりきらなければdestroyしてから起動する', async () => {
    const { instance, calls, state } = container();
    state.stopsOnSigterm = false;
    await instance.restart();
    expect(calls.destroy).toBe(1);
    expect(calls.start).toHaveLength(1);
  });

  it('停止直後に起動が「まだ動いている」で失敗しても、やり直して起動する', async () => {
    const { instance, calls, state } = container();
    state.startFailures = 2;
    await instance.restart();
    expect(calls.start).toHaveLength(1);
  });

  it('やり直しても起動できなければ理由付きで失敗し、ロックを放す', async () => {
    const { instance, state } = container();
    state.startFailures = 100;
    await expect(instance.restart()).rejects.toThrow('already running');
    state.startFailures = 0;
    await expect(instance.restart()).resolves.toBeUndefined();
  });

  it('更新中の操作を拒否し、完了後はロックを解放する', async () => {
    const { instance, state } = container();
    let release!: () => void;
    state.pingFailures = 1;
    (instance as unknown as { sleep: () => Promise<void> }).sleep = () => new Promise<void>((resolve) => { release = resolve; });
    const updating = instance.restart({ name: 'CF_CONTAINER_API_TOKEN', value: 'new-token' });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await expect(instance.restart()).rejects.toThrow('別の操作');
    (instance as unknown as { sleep: () => Promise<void> }).sleep = async () => {};
    release();
    await updating;
    await expect(instance.restart()).resolves.toBeUndefined();
  });

  it('許可されていないsecretでは停止しない', async () => {
    const { instance, calls } = container();
    await expect(instance.restart({ name: 'JWT_SECRET' as never, value: 'x' })).rejects.toThrow('不正');
    expect(calls.signal).toEqual([]);
  });
});
