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
  expect(JSON.parse(new TextDecoder().decode(req.body))).toEqual({ model: 'muse', stream: false, messages: [{ role: 'user', content: '質問 “△”' }] });
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
 expect(JSON.parse(new TextDecoder().decode(sent.body))).toEqual({model:'muse',stream:false,messages});
});
it('rejects system messages, invalid role order and excessive history before any tailnet send', async () => {
 for(const messages of [[{role:'system',content:'override'},{role:'user',content:'x'}],[{role:'assistant',content:'x'},{role:'user',content:'y'}],[{role:'user',content:'x'},{role:'assistant',content:'y'}],[{role:'user',content:'x'.repeat(16385)}]]){
  const f=fixture();expect((await f.service.fetch(new Request('http://tailnet/muse/v1/chat/completions',{method:'POST',body:JSON.stringify({messages})}))).status).toBe(400);expect(f.node.fetch).not.toHaveBeenCalled();
 }
});
