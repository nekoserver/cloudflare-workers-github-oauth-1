import { describe, expect, it, vi } from 'vitest';
import { fetchMuseNixPackages, fetchMuseNodes, isMuseNodeName, parseMuseNixPackages, pickMuseNodes, sendMuseSignal } from './museNodeStatus';

function container(handler: (request: Request) => Response | Promise<Response>, status = 'running') {
  return { getState: vi.fn(async () => ({ status })), fetch: vi.fn(async (request: Request) => handler(request)) };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('isMuseNodeName', () => {
  it('muse・muse-vmだけを受け付ける', () => {
    expect(isMuseNodeName('muse')).toBe(true);
    expect(isMuseNodeName('muse-vm')).toBe(true);
    for (const value of ['muse-vm/../x', 'ipad', '', undefined, 1]) expect(isMuseNodeName(value)).toBe(false);
  });
});

describe('pickMuseNodes', () => {
  it('2ノードだけを取り出し、一覧に無いノードはfound: falseで返す', () => {
    const nodes = pickMuseNodes([
      { hostName: 'ipad', online: true },
      { hostName: 'muse-vm', online: false, active: true, os: 'linux', ip: '100.1.1.1', connection: 'relay', relay: 'ord', lastSeen: 't1', lastHandshake: 't2' },
    ]);
    expect(nodes.map((node) => [node.name, node.found])).toEqual([['muse', false], ['muse-vm', true]]);
    expect(nodes[1]).toMatchObject({ online: false, active: true, os: 'linux', relay: 'ord', lastSeen: 't1' });
  });
});

describe('fetchMuseNodes', () => {
  it('停止中のコンテナへはfetchしない', async () => {
    const stub = container(() => json({}), 'stopped');
    expect(await fetchMuseNodes(stub)).toMatchObject({ containerRunning: false, error: 'container_not_running' });
    expect(stub.fetch).not.toHaveBeenCalled();
  });
  it('バインディングが無いときも停止中として返す', async () => {
    expect((await fetchMuseNodes(null)).error).toBe('container_not_running');
  });
  it('tailscaleの状態を読めない応答はエラーにする', async () => {
    const result = await fetchMuseNodes(container(() => json({ error: 'x', raw: '' })));
    expect(result).toMatchObject({ containerRunning: true, error: 'tailscale_unavailable' });
    expect(result.nodes.every((node) => !node.found)).toBe(true);
  });
  it('既存の/debug/tailscale-peersを読む', async () => {
    const stub = container(() => json({ backendState: 'Running', peers: [{ hostName: 'muse', online: true }] }));
    const result = await fetchMuseNodes(stub);
    expect(new URL(stub.fetch.mock.calls[0][0].url).pathname).toBe('/debug/tailscale-peers');
    expect(result).toMatchObject({ error: null, backendState: 'Running' });
    expect(result.nodes[0]).toMatchObject({ name: 'muse', online: true });
  });
});

describe('sendMuseSignal', () => {
  it('ノードごとの固定のパスへキーを付けて送る', async () => {
    const stub = container(() => json({ status: 'ok' }));
    const result = await sendMuseSignal(stub, 'k', 'muse');
    const request = stub.fetch.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe('/admin/muse/muse/health');
    expect(request.headers.get('authorization')).toBe('Bearer k');
    expect(result.code).toBe('ok');
    expect(typeof result.latencyMs).toBe('number');
  });
  it.each([
    [200, { status: 'starting' }, 'unhealthy'],
    [500, {}, 'unhealthy'],
    [502, {}, 'connection_failed'],
    [504, {}, 'timeout'],
  ])('応答%sは%jから%sになる', async (status, body, code) => {
    expect((await sendMuseSignal(container(() => json(body, status)), 'k', 'muse-vm')).code).toBe(code);
  });
  it('キーが無ければ送らない', async () => {
    const stub = container(() => json({ status: 'ok' }));
    expect((await sendMuseSignal(stub, undefined, 'muse')).code).toBe('not_authenticated');
    expect(stub.fetch).not.toHaveBeenCalled();
  });
  it('停止中のコンテナを起動しない', async () => {
    const stub = container(() => json({ status: 'ok' }), 'stopped');
    expect((await sendMuseSignal(stub, 'k', 'muse')).code).toBe('container_not_running');
    expect(stub.fetch).not.toHaveBeenCalled();
  });
  it('fetchの例外は接続失敗にする', async () => {
    expect((await sendMuseSignal(container(() => { throw new Error('x'); }), 'k', 'muse')).code).toBe('connection_failed');
  });
});

describe('parseMuseNixPackages', () => {
  it('名前順に並べ、不正な要素を捨てる', () => {
    const parsed = parseMuseNixPackages(JSON.stringify({
      packages: [{ name: 'zlib', version: '1.3' }, { name: 'bash', version: null }, { name: '', version: '1' }, 'x'],
      generatedAt: '2026-11-06T00:00:00Z',
    }));
    expect(parsed).toEqual({
      packages: [{ name: 'bash', version: null }, { name: 'zlib', version: '1.3' }],
      total: 2, truncated: false, generatedAt: '2026-11-06T00:00:00Z',
    });
  });
  it('上限を超えた分は切り詰めて、それを示す', () => {
    const parsed = parseMuseNixPackages(JSON.stringify({ packages: Array.from({ length: 5001 }, (_, i) => ({ name: `p${i}`, version: '1' })) }));
    expect(parsed).toMatchObject({ total: 5001, truncated: true });
    expect(parsed?.packages).toHaveLength(5000);
  });
  it('空の一覧は正常、読めない形はnull', () => {
    expect(parseMuseNixPackages('{"packages":[]}')?.total).toBe(0);
    for (const payload of ['x', '{}', '{"packages":["a"]}', 'null']) expect(parseMuseNixPackages(payload)).toBeNull();
  });
});

describe('fetchMuseNixPackages', () => {
  it('固定のパスへキーを付けて読む', async () => {
    const stub = container(() => json({ packages: [{ name: 'hello', version: '2.12' }] }));
    const result = await fetchMuseNixPackages(stub, 'k', 'muse-vm');
    const request = stub.fetch.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe('/admin/muse/muse-vm/nix');
    expect(request.headers.get('authorization')).toBe('Bearer k');
    expect(result).toMatchObject({ node: 'muse-vm', state: 'ok', total: 1 });
  });
  it.each([
    [404, 'not_provided'],
    [401, 'auth_failed'],
    [403, 'auth_failed'],
    [502, 'connection_failed'],
    [504, 'timeout'],
    [500, 'invalid_response'],
  ])('応答%sは%sになる', async (status, state) => {
    expect((await fetchMuseNixPackages(container(() => json({}, status)), 'k', 'muse')).state).toBe(state);
  });
  it('停止中のコンテナを起動しない', async () => {
    const stub = container(() => json({ packages: [] }), 'stopped');
    expect((await fetchMuseNixPackages(stub, 'k', 'muse')).state).toBe('container_not_running');
    expect(stub.fetch).not.toHaveBeenCalled();
  });
});
