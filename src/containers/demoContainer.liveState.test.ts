import { beforeEach, expect, it, vi } from 'vitest';

// @cloudflare/containers 0.3.7: getState reads stored lifecycle state;
// ctx.container.running reports the runtime separately.
// Contract: https://github.com/cloudflare/containers/blob/v0.3.7/src/lib/container.ts
const runtime = vi.hoisted(() => ({ running: true, stored: { status: 'stopped', lastChange: 1 }, start: vi.fn() }));
vi.mock('@cloudflare/containers', () => ({ Container: class {
  ctx = { container: runtime };
  async getState() { return { ...runtime.stored }; }
  async start() { runtime.start(); }
} }));
import { DemoContainer } from './demoContainer';
import { withMuseTailscalePreflight } from '../utils/museTailscalePreflight';

beforeEach(() => { runtime.running = true; runtime.stored = { status: 'stopped', lastChange: 1 }; runtime.start.mockClear(); });
const instance = () => new DemoContainer({} as never, {} as never);
it('stored stopped does not block a running container before tailnet inspection and direct submission', async () => {
  const c = instance(); const order: string[] = [];
  const fetch = vi.fn(async () => { order.push('tailnet'); return Response.json({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] }); });
  const send = vi.fn(async (message: string) => { order.push('direct'); return message; });
  await expect(withMuseTailscalePreflight(send, async () => ({ getState: () => c.getState(), fetch }))('muse_prompt="質問"')).resolves.toBe('muse_prompt="質問"');
  expect(order).toEqual(['tailnet', 'direct']); expect(send).toHaveBeenCalledOnce(); expect(runtime.start).not.toHaveBeenCalled();
});
it('stored healthy does not allow a stopped runtime to fetch or submit', async () => {
  runtime.running = false; runtime.stored.status = 'healthy';
  const c = instance(); const fetch = vi.fn(); const send = vi.fn();
  await expect(withMuseTailscalePreflight(send, async () => ({ getState: () => c.getState(), fetch }))('muse_prompt="質問"')).rejects.toThrow('停止中');
  expect(fetch).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled(); expect(runtime.start).not.toHaveBeenCalled();
});
it('preserves healthy when runtime agrees, and preserves stopping during an explicit stop', async () => {
  runtime.stored.status = 'healthy'; expect(await instance().getState()).toEqual(runtime.stored);
  runtime.stored.status = 'stopping'; expect(await instance().getState()).toEqual(runtime.stored);
});
