import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ stop: vi.fn(), start: vi.fn() }));
vi.mock('@cloudflare/containers', () => ({
  Container: class {
    envVars: Record<string, string> = {};
    async stop() { await calls.stop(); }
    async start() { await calls.start({ ...this.envVars }); }
  },
}));
import { DemoContainer } from './demoContainer';

beforeEach(() => {
  calls.stop.mockReset();
  calls.start.mockReset();
});

function container() {
  return new DemoContainer({} as never, {
    CF_CONTAINER_API_TOKEN: 'expired-token',
    CLOUDFLARE_ACCOUNT_ID: 'account',
    NEKOROOT_TUNNEL_TOKEN: 'tunnel-token',
  } as never);
}

describe('secret更新時の再起動', () => {
  it('旧envを持つDOでも新しい値で起動し、他の変数を維持する', async () => {
    const instance = container();
    await instance.restart({ name: 'CF_CONTAINER_API_TOKEN', value: 'new-token' });
    expect(calls.stop).toHaveBeenCalledOnce();
    expect(calls.start).toHaveBeenCalledWith(expect.objectContaining({
      CF_CONTAINER_API_TOKEN: 'new-token',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      NEKOROOT_TUNNEL_TOKEN: 'tunnel-token',
    }));
    await instance.restart();
    expect(calls.start).toHaveBeenLastCalledWith(expect.objectContaining({ CF_CONTAINER_API_TOKEN: 'new-token' }));
  });

  it('更新中の操作を拒否し、完了後はロックを解放する', async () => {
    let release!: () => void;
    calls.stop.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    const instance = container();
    const updating = instance.restart({ name: 'CF_CONTAINER_API_TOKEN', value: 'new-token' });
    await expect(instance.restart()).rejects.toThrow('別の操作');
    release();
    await updating;
    await expect(instance.restart()).resolves.toBeUndefined();
  });

  it('許可されていないsecretでは停止しない', async () => {
    await expect(container().restart({ name: 'JWT_SECRET' as never, value: 'x' })).rejects.toThrow('不正');
    expect(calls.stop).not.toHaveBeenCalled();
  });
});
