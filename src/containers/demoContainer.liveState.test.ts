import { expect, it, vi } from 'vitest';

// 状態は ctx.container.running(実行時の真の状態)から作る。読んでも起動しない。
// SPEC.cloudflare-workers-github-oauth-1.20261111.container-api-migration.md 3章の1。
vi.mock('cloudflare:workers', () => ({
  DurableObject: class { ctx: unknown; env: unknown; constructor(ctx: unknown, env: unknown) { this.ctx = ctx; this.env = env; } },
}));
vi.mock('../utils/cfContainerOperationLog', () => ({ recordContainerOperation: async () => {} }));
import { DemoContainer } from './demoContainer';
import { createFakeCtx } from './demoContainerFakeCtx';
import { withMuseTailscalePreflight } from '../utils/museTailscalePreflight';

const instance = (running: boolean) => {
  const fake = createFakeCtx({ running });
  return { ...fake, c: new DemoContainer(fake.ctx as never, {} as never) };
};

it('a running container passes tailnet inspection and direct submission without starting', async () => {
  const { c, calls } = instance(true); const order: string[] = [];
  const fetch = vi.fn(async () => { order.push('tailnet'); return Response.json({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] }); });
  const send = vi.fn(async (message: string) => { order.push('direct'); return message; });
  await expect(withMuseTailscalePreflight(send, async () => ({ getState: () => c.getState(), fetch }))('muse_prompt="質問"')).resolves.toBe('muse_prompt="質問"');
  expect(order).toEqual(['tailnet', 'direct']); expect(send).toHaveBeenCalledOnce(); expect(calls.start).toHaveLength(0);
});

it('a stopped runtime does not fetch or submit', async () => {
  const { c, calls } = instance(false); const fetch = vi.fn(); const send = vi.fn();
  await expect(withMuseTailscalePreflight(send, async () => ({ getState: () => c.getState(), fetch }))('muse_prompt="質問"')).rejects.toThrow('停止中');
  expect(fetch).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled(); expect(calls.start).toHaveLength(0);
});
