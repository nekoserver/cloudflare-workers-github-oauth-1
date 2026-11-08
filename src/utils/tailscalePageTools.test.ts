import { expect, it, vi } from 'vitest';
import { TailscalePageTools } from './tailscalePageTools';
function fixture(status = 'running') {
  const container = { getState: vi.fn(async () => ({ status })), fetch: vi.fn(async (_request: Request) => Response.json({ state: 'ready', reasons: [], server: { httpStatus: 200 }, proxy: { httpStatus: 200 }, codex: { loggedIn: true } })) };
  const ask = vi.fn(async (_prompt: string) => ({ reply: 'レビュー結果', llmModel: 'test-model' }));
  return { container, ask, tools: new TailscalePageTools(async () => container as never, ask) };
}
it('stopped/stopping/unknown states never fetch or call agents', async () => {
  for (const state of ['stopped', 'stopping', 'unknown']) {
    const f = fixture(state);
    expect(await f.tools.status()).toMatchObject({ running: false });
    expect((await f.tools.t3()).status).toBe(409);
    expect((await f.tools.t3Pairing()).status).toBe(409);
    expect((await f.tools.agent({ engine: 'codex', prompt: '質問', review: true })).status).toBe(409);
    expect(f.container.fetch).not.toHaveBeenCalled(); expect(f.ask).not.toHaveBeenCalled();
  }
});
it('T3 login handoff reuses the shared single-use pairing function and never starts a stopped container', async () => {
  const f = fixture();
  f.container.fetch.mockResolvedValueOnce(Response.json({ ok: true, pairUrl: 'https://t3.nekomaneki.work/pair#token=one-time', expiresAt: 'soon' }));
  expect(await (await f.tools.t3Pairing()).json()).toMatchObject({ ok: true, pairUrl: 'https://t3.nekomaneki.work/pair#token=one-time' });
  expect(new URL(f.container.fetch.mock.calls[0][0].url).pathname).toBe('/t3/pairing');
  expect(f.container.getState).toHaveBeenCalled();
});
it('T3 tests fixed read-only endpoint and validates the actual health body', async () => {
  const f = fixture(); expect(await (await f.tools.t3()).json()).toMatchObject({ ok: true, state: 'ready' });
  expect(f.container.fetch).toHaveBeenCalledOnce();
  expect(new URL(f.container.fetch.mock.calls[0][0].url).pathname).toBe('/health/t3');
  f.container.fetch.mockResolvedValue(Response.json({ state: 'server-down' }));
  expect((await f.tools.t3()).status).toBe(503);
});
it.each(['codex', 'claude'])('uses explicit %s prefix once, preserves prompt, and checks live state immediately before send', async engine => {
  const f = fixture();
  expect(await (await f.tools.agent({ engine, prompt: '差分 “△” を確認', review: false })).json()).toMatchObject({ ok: true, reply: 'レビュー結果', engine, route: 'main' });
  expect(f.ask).toHaveBeenCalledOnce(); expect(f.ask.mock.calls[0][0]).toBe(engine + '_prompt="差分 “△” を確認"');
  expect(f.container.getState).toHaveBeenCalled(); expect(f.container.fetch).not.toHaveBeenCalled();
});
it('review mode adds a read-only review instruction, rejects invalid/oversized input and never retries failures', async () => {
  const f = fixture(); await f.tools.agent({ engine: 'codex', prompt: 'レビュー対象', review: true });
  expect(f.ask.mock.calls[0][0]).toContain('変更やコマンド実行は行わず');
  f.ask.mockClear();
  for (const data of [{ engine: 'muse', prompt: 'x' }, { engine: 'codex', prompt: 'x'.repeat(17000) }, null]) expect((await f.tools.agent(data)).status).toBe(400);
  expect(f.ask).not.toHaveBeenCalled(); f.ask.mockRejectedValue(new Error('upstream failure'));
  expect((await f.tools.agent({ engine: 'claude', prompt: '質問' })).status).toBe(502); expect(f.ask).toHaveBeenCalledOnce();
});
it('reflects saved Muse results on the next agent inquiry and only acknowledges after a valid reply', async () => {
  const f = fixture(), acknowledge = vi.fn(async () => true);
  const tools = new TailscalePageTools(async () => f.container as never, f.ask, async () => ({ context: '停止中に得られたMuseの結果', acknowledge }));
  expect(await (await tools.agent({ engine: 'codex', prompt: '今回の質問' })).json()).toMatchObject({ contextApplied: true, handoffAcknowledged: true });
  expect(f.ask.mock.calls[0][0]).toContain('停止中に得られたMuseの結果'); expect(acknowledge).toHaveBeenCalledOnce();
  acknowledge.mockClear(); f.ask.mockRejectedValue(new Error('failed'));
  await tools.agent({ engine: 'claude', prompt: '質問' }); expect(acknowledge).not.toHaveBeenCalled();
});
