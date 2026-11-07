import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const stub = vi.hoisted(() => ({ getState: vi.fn(), fetch: vi.fn() }));
vi.mock('@cloudflare/containers', () => ({ getContainer: () => stub }));

describe('POST /api/aichat の /askmuse', () => {
  const JWT_SECRET = 'askmuse-test-secret';
  const reply = JSON.stringify({ model: 'muse', choices: [{ message: { content: '回答本文' } }] });
  let inserts: unknown[][];
  const DB = {
    prepare(sql: string) {
      return {
        first: async () => ({ revision: 1, timeoutSeconds: 120 }),
        all: async () => ({ results: [] }),
        bind(...args: unknown[]) {
          return {
            first: async () => sql.includes('user_sessions') ? { revoked_at: null } : { found: 1 },
            run: async () => { if (sql.startsWith('INSERT INTO ai_chat_shares')) inserts.push(args); return { success: true }; },
          };
        },
      };
    },
  };
  const RUST_WORKER = { fetch: vi.fn() };

  async function post(body: Record<string, unknown>, env: Record<string, unknown> = { MUSE_API_KEY: 'key' }, cookie = '') {
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
    return app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(body),
    }, { JWT_SECRET, DB, RUST_WORKER, DEMO_CONTAINER: {}, ...env });
  }

  beforeEach(() => {
    inserts = [];
    vi.clearAllMocks();
    stub.getState.mockResolvedValue({ status: 'healthy' });
    stub.fetch.mockImplementation(async () => new Response(reply));
  });

  it('tunnelsを通らずコンテナへ送り、Museの回答として質問本文で保存する', async () => {
    const response = await post({ message: '/askmuse prompt="質問本文"', source: 'textbox' });
    expect(await response.json()).toMatchObject({ response: '回答本文\n\nEngine: Muse / Model: muse', usedModel: 'muse' });
    expect(stub.fetch).toHaveBeenCalledTimes(1);
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(1);
    expect(inserts[0][3]).toBe('質問本文');
    expect(inserts[0][5]).toBe('muse');
  });

  // 故障想定: 色丸の変換が/askmuseを`/neko askgk muse_prompt="..."`へ包んでlib経路へ送ってしまう。
  it.each(['muse', 'codex', 'claude'])('色丸で%sを選んでいても/askmuseのまま扱う', async (model) => {
    const response = await post({ message: '/askmuse prompt="質問本文"', model });
    expect(await response.json()).toMatchObject({ usedModel: 'muse' });
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    const sent = await (stub.fetch.mock.calls[0][0] as Request).json() as { messages: { content: string }[] };
    expect(sent.messages[0].content).toBe('質問本文');
  });

  it('コンテナの停止中は起動せず、Museの回答として保存しない', async () => {
    stub.getState.mockResolvedValue({ status: 'stopped' });
    const response = await post({ message: '/askmuse prompt="質問本文"' });
    const body = await response.json() as { response: string; usedModel: string };
    expect(body.response).toContain('本体コンテナが停止しています');
    expect(body.usedModel).not.toBe('muse');
    expect(stub.fetch).not.toHaveBeenCalled();
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
  });

  it.each(['質問本文', '引用 "そのまま"\n次の行 “△”'])('Muse選択の通常入力はTailscale直接経路を先に選ぶ: %s', async (message) => {
    stub.fetch.mockImplementation(async (request: Request) => new URL(request.url).pathname === '/debug/tailscale-peers'
      ? new Response(JSON.stringify({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] }))
      : new Response(reply));
    const response = await post({ message, model: 'muse', source: 'textbox' });
    expect(await response.json()).toMatchObject({ usedModel: 'muse', response: '回答本文\n\nEngine: Muse / Model: muse' });
    expect(response.headers.get('X-Muse-Tailscale')).toBe('connected');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(stub.fetch.mock.calls.map(([request]) => new URL(request.url).pathname)).toEqual(['/debug/tailscale-peers', '/muse/v1/chat/completions']);
    expect(await (stub.fetch.mock.calls[1][0] as Request).json()).toMatchObject({ messages: [{ role: 'user', content: message }] });
    expect(inserts[0][3]).toBe(message);
  });

  it('通常Museの直接接続が失敗してもtunnelsへフォールバックしない', async () => {
    stub.fetch.mockImplementation(async (request: Request) => new URL(request.url).pathname === '/debug/tailscale-peers'
      ? new Response(JSON.stringify({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] }))
      : new Response('{}', { status: 502 }));
    const response = await post({ message: '質問本文', model: 'muse' });
    const data = await response.json() as { response: string };
    expect(data.response).toContain('muse_connection_failed');
    expect(data.response).not.toContain('unsupported_engine');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it.each(['muse', 'codex', 'claude'])('明示muse_promptの経路は選択中の%sに影響されない', async (model) => {
    stub.fetch.mockResolvedValue(new Response(JSON.stringify({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] })));
    RUST_WORKER.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: '明示経路の回答' }) })));
    const response = await post({ message: '/neko askgk muse_prompt="明示質問"', model });
    expect(await response.json()).toMatchObject({ usedModel: 'muse', response: '明示経路の回答' });
    expect(RUST_WORKER.fetch).toHaveBeenCalledTimes(1);
    expect(stub.fetch.mock.calls.map(([request]) => new URL(request.url).pathname)).toEqual(['/debug/tailscale-peers']);
  });

  it.each(['codex', 'claude'])('%s選択の通常入力は既存askgkへ送る', async (model) => {
    RUST_WORKER.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: '既存経路の回答' }) })));
    const response = await post({ message: '通常質問', model });
    expect(await response.json()).toMatchObject({ usedModel: model, response: '既存経路の回答' });
    expect(RUST_WORKER.fetch).toHaveBeenCalledTimes(1);
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('通常のMuse投稿でTailscale未接続なら中継へ一切送らない', async () => {
    stub.fetch.mockResolvedValue(new Response(JSON.stringify({ backendState: 'NeedsLogin', peers: [] })));
    const response = await post({ message: '質問本文', model: 'muse' });
    const data = await response.json() as { response: string };
    expect(data.response).toContain('Tailscaleが停止中または未接続');
    expect(data.response).not.toContain('unsupported_engine');
    expect(response.headers.get('X-Muse-Tailscale')).toBe('unavailable');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it.each([undefined, false, 'true'])('tunnelsフォールバックは未指定/無効値ならOFF: %s', async (museTunnelsFallback) => {
    stub.fetch.mockResolvedValue(new Response(JSON.stringify({ backendState: 'NeedsLogin', peers: [] })));
    const response = await post({ message: '通常質問', model: 'muse', museTunnelsFallback });
    expect((await response.json() as { response: string }).response).toContain('Tailscale');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
  });

  it('初期モデルMuseかつTailscale未接続かつONの場合だけtunnelsへ変換する', async () => {
    stub.fetch.mockResolvedValue(new Response(JSON.stringify({ backendState: 'NeedsLogin', peers: [] })));
    RUST_WORKER.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: 'tunnelsの回答' }) })));
    const message = '質問 "そのまま"\n次の行 “△”';
    const response = await post({ message, model: 'muse', museTunnelsFallback: true });
    expect(await response.json()).toMatchObject({ usedModel: 'muse', response: 'tunnelsの回答', fallbackUsed: true });
    expect(response.headers.get('X-Muse-Tailscale')).toBe('unavailable');
    expect(RUST_WORKER.fetch).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(RUST_WORKER.fetch.mock.calls[0][1].body));
    expect(JSON.parse(sent.body).message).toBe('muse_prompt="' + message + '"');
    expect(stub.fetch).toHaveBeenCalledTimes(1);
    expect(inserts[0][3]).toBe(message);
  });

  it('tunnelsがONでもTailscale接続中は本文を直接Museへ送る', async () => {
    stub.fetch.mockImplementation(async (request: Request) => new URL(request.url).pathname === '/debug/tailscale-peers'
      ? new Response(JSON.stringify({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] }))
      : new Response(reply));
    const response = await post({ message: '通常質問', model: 'muse', museTunnelsFallback: true });
    expect(await response.json()).toMatchObject({ usedModel: 'muse', response: '回答本文\n\nEngine: Muse / Model: muse' });
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(stub.fetch).toHaveBeenCalledTimes(2);
  });

  it('tunnelsがONでもTailscale接続中なら直接送り、Muse実行失敗で再送しない', async () => {
    stub.fetch.mockImplementation(async (request: Request) => new URL(request.url).pathname === '/debug/tailscale-peers'
      ? new Response(JSON.stringify({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] }))
      : new Response('{}', { status: 502 }));
    const response = await post({ message: '通常質問', model: 'muse', museTunnelsFallback: true });
    expect((await response.json() as { response: string }).response).toContain('muse_connection_failed');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, false])('ブラウザのON設定を参照し、APIの明示OFFは優先する: %s', async (override) => {
    stub.fetch.mockResolvedValue(new Response(JSON.stringify({ backendState: 'NeedsLogin', peers: [] })));
    RUST_WORKER.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: 'fallback' }) })));
    const response = await post({ message: '通常質問', model: 'muse', museTunnelsFallback: override }, { MUSE_API_KEY: 'key' }, 'other=1; aichat_muse_tunnels=on');
    if (override === false) {
      expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
      expect((await response.json() as { response: string }).response).toContain('Tailscale');
    } else {
      expect(RUST_WORKER.fetch).toHaveBeenCalledTimes(1);
      expect(await response.json()).toMatchObject({ fallbackUsed: true, usedModel: 'muse' });
    }
  });

  it('初期モデルがMuseでなければtunnels設定を使わない', async () => {
    const response = await post({ message: '通常質問', museTunnelsFallback: true });
    expect(response.status).toBe(503); // 通常のAI bindingが無いfixture
    expect(stub.fetch).not.toHaveBeenCalled();
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
  });

  it('明示/askmuseはtunnelsがONでも直接経路のまま', async () => {
    const response = await post({ message: '/askmuse prompt="明示質問"', model: 'muse', museTunnelsFallback: true });
    expect(await response.json()).toMatchObject({ usedModel: 'muse' });
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(stub.fetch).toHaveBeenCalledTimes(1);
  });

  it('キーが未設定ならその旨を返す', async () => {
    const response = await post({ message: '/askmuse prompt="質問本文"' }, {});
    expect((await response.json() as { response: string }).response).toContain('MUSE_API_KEY');
    expect(stub.fetch).not.toHaveBeenCalled();
  });
});

describe('GET /api/aichat/muse-health', () => {
  const JWT_SECRET = 'askmuse-test-secret';
  const DB = {
    prepare(sql: string) {
      return {
        first: async () => null,
        all: async () => ({ results: [] }),
        bind() { return { first: async () => sql.includes('user_sessions') ? { revoked_at: null } : null, run: async () => ({ success: true }) }; },
      };
    },
  };

  async function get(env: Record<string, unknown> = { MUSE_API_KEY: 'key', DEMO_CONTAINER: {} }, authorized = true) {
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
    return app.request('/api/aichat/muse-health', { headers: authorized ? { Authorization: `Bearer ${token}` } : {} }, { JWT_SECRET, DB, ...env });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    stub.getState.mockResolvedValue({ status: 'healthy' });
    stub.fetch.mockImplementation(async (req: Request) => new Response(JSON.stringify(new URL(req.url).pathname === '/debug/tailscale-peers' ? { backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] } : { status: 'ok' })));
  });

  it('稼働中ならhealthy: trueを返し、応答を保存させない', async () => {
    const response = await get();
    expect(await response.json()).toEqual({ healthy: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('コンテナの停止中は起動せず、healthy: falseを返す', async () => {
    stub.getState.mockResolvedValue({ status: 'stopped' });
    expect(await (await get()).json()).toEqual({ healthy: false });
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('DEMO_CONTAINERが無ければhealthy: falseを返す', async () => {
    expect(await (await get({ MUSE_API_KEY: 'key' })).json()).toEqual({ healthy: false });
  });

  it('未認証では確認しない', async () => {
    const response = await get(undefined, false);
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(stub.getState).not.toHaveBeenCalled();
  });
});
