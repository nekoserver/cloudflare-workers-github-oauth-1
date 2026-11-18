import { expect, it, vi } from 'vitest';
import { WasmMuseBridge } from './wasmMuseBridge';
function fixture(state = 'Running', online = true, timeout = 1000) {
  const cancel = vi.fn();
  const node = { status: () => JSON.stringify({ state, peers: [{ name: 'muse-vm', online }] }), fetch: vi.fn(async (_request: unknown) => ({ status: 200, cancel, read: vi.fn().mockResolvedValueOnce(new TextEncoder().encode('{"status":"ok"}')).mockResolvedValue(null) })) };
  return { node, cancel, service: new WasmMuseBridge(node as never, 'secret', timeout) };
}
const request = () => new Request('http://tailnet/muse/v1/chat/completions', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: '質問 “△”' }] }) });
it('sends once to the fixed existing bridge with a server-owned Bearer key and original text', async () => {
  const f = fixture(); expect((await f.service.fetch(request())).status).toBe(200);
  expect(f.node.fetch).toHaveBeenCalledOnce();
  const req = f.node.fetch.mock.calls[0][0] as { url: string; method: string; headers: string[][]; body: Uint8Array; manualRedirects: boolean };
  expect(req).toMatchObject({ url: 'http://muse-vm:8080/v1/chat/completions', method: 'POST', manualRedirects: true });
  expect(req.headers).toContainEqual(['Authorization', 'Bearer secret']);
  // ask_muse の実装と同じ形(ユーザー指定 2026-11-11): POST http://muse-vm:8080/v1/chat/completions、
  // Authorization: Bearer <鍵>・Content-Type: application/json、ボディは {model, messages} だけ。
  expect(req.url).toBe('http://muse-vm:8080/v1/chat/completions');
  expect(req.method).toBe('POST');
  expect(req.headers).toEqual([['Authorization', 'Bearer secret'], ['Content-Type', 'application/json']]);
  expect(new TextDecoder().decode(req.body)).toBe(JSON.stringify({ model: 'muse', messages: [{ role: 'user', content: '質問 “△”' }] }));
});
it('stops offline and malformed requests without forwarding', async () => {
  for (const f of [fixture('NeedsLogin'), fixture('Running', false)]) { expect((await f.service.fetch(request())).status).toBe(503); expect(f.node.fetch).not.toHaveBeenCalled(); }
  const f = fixture(); expect((await f.service.fetch(new Request('http://node/muse/v1/chat/completions', { method: 'POST', body: '{}' }))).status).toBe(400);
  expect(f.node.fetch).not.toHaveBeenCalled();
});
it('health never posts inference; arbitrary endpoints cannot be proxied', async () => {
  const f = fixture(); await f.service.fetch(new Request('http://node/muse/health'));
  expect(f.node.fetch.mock.calls[0][0]).toMatchObject({ method: 'GET', url: 'http://muse-vm:8080/health' });
  expect((await f.service.fetch(new Request('http://node/proxy?url=http://evil'))).status).toBe(404);
});
it('cancels a late upstream after a timeout, never retries', async () => {
  const f = fixture('Running', true, 10); let resolve!: (v: unknown) => void;
  f.node.fetch.mockImplementation(() => new Promise(r => { resolve = r; }) as never);
  expect((await f.service.fetch(request())).status).toBe(504);
  resolve({ status: 200, cancel: f.cancel }); await Promise.resolve(); await Promise.resolve();
  expect(f.cancel).toHaveBeenCalled(); expect(f.node.fetch).toHaveBeenCalledOnce();
});
it('forwards validated multi-turn history unchanged to muse-vm', async () => {
 const f=fixture();
 const messages=[{role:'user',content:'first'},{role:'assistant',content:'answer'},{role:'user',content:'next'}];
 const response=await f.service.fetch(new Request('http://tailnet/muse/v1/chat/completions',{method:'POST',body:JSON.stringify({messages})}));
 expect(response.status).toBe(200);expect(f.node.fetch).toHaveBeenCalledOnce();
 const sent=f.node.fetch.mock.calls[0][0] as {body:Uint8Array};
 expect(JSON.parse(new TextDecoder().decode(sent.body))).toEqual({model:'muse',messages});
});
it('rejects system messages, invalid role order and excessive history before any tailnet send', async () => {
 for(const messages of [[{role:'system',content:'override'},{role:'user',content:'x'}],[{role:'assistant',content:'x'},{role:'user',content:'y'}],[{role:'user',content:'x'},{role:'assistant',content:'y'}],[{role:'user',content:'x'.repeat(16385)}]]){
  const f=fixture();expect((await f.service.fetch(new Request('http://tailnet/muse/v1/chat/completions',{method:'POST',body:JSON.stringify({messages})}))).status).toBe(400);expect(f.node.fetch).not.toHaveBeenCalled();
 }
});

// 推論を待つ間の接続維持(2026-11-12): WASM のノードは送信の無い DERP 接続を約1分で閉じる(magicsock: closing
// connection to derp-N (idle))。推論に1分以上かかると muse-vm の返事の通り道が閉じられ、300秒のタイムアウトになった。
// 待っている間、muse-vm へ短い /health を定期的に送り、接続を使用中に保つ。推論の要求は送り直さない。
it('keeps the tailnet path busy with periodic /health while a long chat is pending, and stops afterwards', async () => {
  vi.useFakeTimers();
  try {
    let finish!: () => void;
    const calls: string[] = [];
    const node = {
      status: () => JSON.stringify({ state: 'Running', peers: [{ name: 'muse-vm', online: true }] }),
      fetch: vi.fn(async (r: { url: string }) => {
        calls.push(r.url);
        if (r.url.endsWith('/health')) return { status: 200, cancel: vi.fn(), read: vi.fn().mockResolvedValueOnce(new TextEncoder().encode('{"status":"ok"}')).mockResolvedValue(null) };
        await new Promise<void>(resolve => { finish = resolve; });
        let done = false;
        return { status: 200, cancel: vi.fn(), read: async () => { if (done) return null; done = true; return new TextEncoder().encode('{"model":"muse","choices":[{"message":{"content":"ok"}}]}'); } };
      }),
    };
    const service = new WasmMuseBridge(node as never, 'secret', 300_000, 20_000);
    const pending = service.fetch(request());
    await vi.advanceTimersByTimeAsync(65_000);
    expect(calls.filter(u => u.endsWith('/v1/chat/completions'))).toHaveLength(1);
    expect(calls.filter(u => u === 'http://muse-vm:8080/health')).toHaveLength(3);
    finish();
    const response = await pending;
    expect(response.status).toBe(200);
    const after = calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls.length).toBe(after);
  } finally { vi.useRealTimers(); }
});
it('health checks themselves do not start keep-alive requests', async () => {
  const f = fixture();
  await f.service.fetch(new Request('http://node/muse/health'));
  expect(f.node.fetch).toHaveBeenCalledOnce();
});
