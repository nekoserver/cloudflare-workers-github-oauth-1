import { beforeEach, expect, it, vi } from 'vitest';

// SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md 3章の2・3。
vi.mock('cloudflare:workers', () => ({
  DurableObject: class { ctx: unknown; env: unknown; constructor(ctx: unknown, env: unknown) { this.ctx = ctx; this.env = env; } },
}));
vi.mock('../utils/cfContainerOperationLog', () => ({ recordContainerOperation: async () => {} }));
import { DemoContainer } from './demoContainer';
import { createFakeCtx } from './demoContainerFakeCtx';

let fake: ReturnType<typeof createFakeCtx>;
let instance: DemoContainer;
beforeEach(() => {
  fake = createFakeCtx();
  instance = new DemoContainer(fake.ctx as never, {} as never);
  (instance as unknown as { sleep: () => Promise<void> }).sleep = async () => {};
});

it('start/stop round trip and repeated desired states are idempotent', async () => {
  expect(await instance.setRunning(true)).toMatchObject({ changed: true, state: { status: 'healthy' } });
  expect(await instance.setRunning(true)).toMatchObject({ changed: false });
  expect(fake.calls.start).toHaveLength(1);
  expect(await instance.setRunning(false)).toMatchObject({ changed: true, state: { status: 'stopped' } });
  expect(await instance.setRunning(false)).toMatchObject({ changed: false });
  expect(fake.calls.signal).toHaveLength(1);
});

it('shares the lock with management-page start/stop/restart and releases after failure', async () => {
  let release!: () => void;
  fake.state.pingFailures = 1;
  (instance as unknown as { sleep: () => Promise<void> }).sleep = () => new Promise<void>((resolve) => { release = resolve; });
  const pending = instance.setRunning(true);
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  await expect(instance.stop()).rejects.toThrow('別の操作');
  await expect(instance.restart()).rejects.toThrow('別の操作');
  await expect(instance.setRunning(false)).rejects.toThrow('別の操作');
  (instance as unknown as { sleep: () => Promise<void> }).sleep = async () => {};
  release();
  await pending;
  await instance.setRunning(false);
  fake.state.crashOnStart = true;
  await expect(instance.setRunning(true)).rejects.toThrow('止まりました');
  fake.state.crashOnStart = false;
  await expect(instance.setRunning(true)).resolves.toMatchObject({ changed: true });
});

it('does not start while stopping, and rejects a non-boolean', async () => {
  await instance.setRunning(true);
  fake.state.stopsOnSigterm = false;
  await instance.stop();
  await expect(instance.setRunning(true)).rejects.toThrow('停止処理中');
  expect(await instance.setRunning(false)).toMatchObject({ changed: false, state: { status: 'stopping' } });
  await expect(instance.setRunning('yes' as never)).rejects.toThrow('不正');
  expect(fake.calls.start).toHaveLength(1);
});
