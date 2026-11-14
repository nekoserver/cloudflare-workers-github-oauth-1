import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

// 接頭語なしのMuse・/askmuse は常に直送(Worker内WASM)。stub は TAILSCALE_WASM の中継として受ける(2026-11-12 旧コンテナ直通を廃止)。
const stub = vi.hoisted(() => ({ getState: vi.fn(), fetch: vi.fn() }));
const container = vi.hoisted(() => ({ getState: vi.fn(), fetch: vi.fn() }));
vi.mock('./containers/demoContainerStub', () => ({ getDemoContainer: () => container }));
const TAILSCALE_WASM = { idFromName: () => 'muse', get: () => ({ fetch: (request: Request) => stub.fetch(request) }) };

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
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Cookie: cookie || 'aichat_muse_signal=%7B%22transport%22%3A%22container%22%7D' },
      body: JSON.stringify(body),
    }, { JWT_SECRET, DB, RUST_WORKER, DEMO_CONTAINER: {}, TAILSCALE_WASM, ...env });
  }

  beforeEach(() => {
    inserts = [];
    vi.clearAllMocks();
    stub.getState.mockResolvedValue({ status: 'healthy' });
    stub.fetch.mockImplementation(async () => new Response(reply));
  });

  describe('言語モデルがMuseのときのスラッシュコマンド', () => {
    // 契約: muse-vmのapi-bridge(server.py)は/で始まる入力を推論せずに実行し、応答へbridge_commandを付ける。
    const usage = JSON.stringify({ model: 'muse', bridge_command: '/usage', choices: [{ message: { content: 'Usage: 1% of free weekly limit.' } }] });
    const connected = (_url: string) => new Response(usage);
    const sentPrompts = () => stub.fetch.mock.calls.map(([request]) => request as Request).filter((request) => request.url.endsWith('/muse/v1/chat/completions'));

    it.each(['/usage', '  /usage  '])('%j はmuse-vmへ直接送り、結果を返すが通常のAI回答として保存しない', async (message) => {
      stub.fetch.mockImplementation(async (request: Request) => connected(request.url));
      const response = await post({ message, model: 'muse', source: 'textbox' });
      expect(await response.json()).toMatchObject({ response: 'Usage: 1% of free weekly limit.', usedModel: 'local/neko' });
      expect(response.headers.get('X-Muse-Tailscale')).toBe('connected');
      expect(sentPrompts()).toHaveLength(1);
      expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
      expect(inserts).toEqual([]);
    });

    it('./usageは既存の別名どおり/usageとしてmuse-vmへ送る', async () => {
      stub.fetch.mockImplementation(async (request: Request) => connected(request.url));
      await post({ message: './usage', model: 'muse', source: 'textbox' });
      const [request] = sentPrompts();
      expect((await request.json() as { messages: { content: string }[] }).messages[0].content).toBe('/usage');
      expect(inserts).toEqual([]);
    });

    const commandReply = (command: string, content: string) => JSON.stringify({ model: 'muse', bridge_command: command, choices: [{ message: { content } }] });
    const answering = (body: string, status = 200) => async () => new Response(body, { status });

    it.each(['/help', '/usage', '/status', '/ping', '/models', '/nope'])('%s はmuse-vmへ送り、D1へ記録しない', async (command) => {
      stub.fetch.mockImplementation(answering(commandReply(command, '実行結果')));
      const response = await post({ message: command, model: 'muse', source: 'textbox' });
      const body = await response.json() as { response: string; usedModel: string; shareId?: string; usage?: unknown };
      expect(body.response).toContain('実行結果');
      expect(body.response).not.toContain('Engine:');
      expect(body).toMatchObject({ usedModel: 'local/neko' });
      expect(body.shareId).toBeUndefined();
      expect(body.usage).toBeUndefined();
      const [request] = sentPrompts();
      expect((await request.json() as { messages: { content: string }[] }).messages[0].content).toBe(command);
      expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
      expect(inserts).toEqual([]);
    });

    // 故障想定: 端末の自動大文字化で/Usageになると、ブリッジが未対応として断る。
    it.each([['/Usage', '/usage'], ['/PING', '/ping'], ['./Usage', '/usage']])('%s は %s として送る', async (message, sent) => {
      stub.fetch.mockImplementation(answering(commandReply(sent, '実行結果')));
      await post({ message, model: 'muse', source: 'textbox' });
      const [request] = sentPrompts();
      expect((await request.json() as { messages: { content: string }[] }).messages[0].content).toBe(sent);
    });

    it('未知のコマンドと引数付きは書き換えない', async () => {
      stub.fetch.mockImplementation(answering(commandReply('/Usage daily', '未対応')));
      await post({ message: '/Usage daily', model: 'muse', source: 'textbox' });
      const [request] = sentPrompts();
      expect((await request.json() as { messages: { content: string }[] }).messages[0].content).toBe('/Usage daily');
    });

    it('/pingはmuse-vmの応答に本体Workerからの往復時間を添える', async () => {
      stub.fetch.mockImplementation(answering(commandReply('/ping', 'pong: muse-vm')));
      const response = await post({ message: '/ping', model: 'muse', source: 'textbox' });
      expect((await response.json() as { response: string }).response).toMatch(/^pong: muse-vm\n往復: \d+ ms（本体Worker → muse-vm）$/);
    });

    // 故障想定: コマンドの失敗を推論の失敗と取り違え、保存または別経路への再送をする。
    it('コマンド実行の失敗(503)は失敗として伝え、保存せず別の経路へも送らない', async () => {
      stub.fetch.mockImplementation(answering(JSON.stringify({ error: { type: 'usage_unavailable' } }), 503));
      const response = await post({ message: '/usage', model: 'muse', source: 'textbox' });
      expect((await response.json() as { response: string }).response).toContain('❌');
      expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
      expect(inserts).toEqual([]);
    });

    // 故障想定: 文頭が/でも、ブリッジがコマンドとして実行していなければ回答として保存する。
    it('bridge_commandの無い応答は通常の回答として保存する', async () => {
      stub.fetch.mockImplementation(async () => new Response(reply));
      const response = await post({ message: '/usage', model: 'muse', source: 'textbox' });
      expect(await response.json()).toMatchObject({ usedModel: 'muse', response: '回答本文\n\nEngine: Muse / Model: muse' });
      expect(inserts).toHaveLength(1);
    });

  });

  it('tunnelsもコンテナも通らず直送し、Museの回答として質問本文で保存する', async () => {
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

  it.each(['質問本文', '引用 "そのまま"\n次の行 “△”'])('Muse選択の通常入力は直送(Worker内WASM)で送る: %s', async (message) => {
    stub.fetch.mockImplementation(async () => new Response(reply));
    const response = await post({ message, model: 'muse', source: 'textbox' });
    expect(await response.json()).toMatchObject({ usedModel: 'muse', response: '回答本文\n\nEngine: Muse / Model: muse' });
    expect(response.headers.get('X-Muse-Tailscale')).toBe('connected');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(stub.fetch.mock.calls.map(([request]) => new URL(request.url).pathname)).toEqual(['/muse/v1/chat/completions']);
    expect(container.fetch).not.toHaveBeenCalled();
    expect(await (stub.fetch.mock.calls[0][0] as Request).json()).toMatchObject({ messages: [{ role: 'user', content: message }] });
    expect(inserts[0][3]).toBe(message);
  });

  it('通常Museの直接接続が失敗してもtunnelsへフォールバックしない', async () => {
    stub.fetch.mockImplementation(async () => new Response('{}', { status: 502 }));
    const response = await post({ message: '質問本文', model: 'muse' });
    const data = await response.json() as { response: string };
    expect(data.response).toContain('Museへの接続を確認できません');
    expect(data.response).not.toContain('unsupported_engine');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it.each(['muse', 'codex', 'claude'])('明示muse_promptの経路は選択中の%sに影響されない', async (model) => {
    // 明示の muse_prompt= は tunnels.rb の経路(コンテナのTailscaleを確かめてから送る)。直送の変更とは別。
    container.getState.mockResolvedValue({ status: 'healthy' });
    container.fetch.mockResolvedValue(new Response(JSON.stringify({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] })));
    RUST_WORKER.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: '明示経路の回答' }) })));
    const response = await post({ message: '/neko askgk muse_prompt="明示質問"', model });
    expect(await response.json()).toMatchObject({ usedModel: 'muse', response: '明示経路の回答' });
    expect(RUST_WORKER.fetch).toHaveBeenCalledTimes(1);
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it.each(['codex', 'claude'])('%s選択の通常入力は既存askgkへ送る', async (model) => {
    RUST_WORKER.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: '既存経路の回答' }) })));
    const response = await post({ message: '通常質問', model });
    expect(await response.json()).toMatchObject({ usedModel: model, response: '既存経路の回答' });
    expect(RUST_WORKER.fetch).toHaveBeenCalledTimes(1);
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  // 2026-11-07 ユーザー指定: スイッチがMuseのときの接頭語なし投稿は、tunnels方向ではなく直接muse-vmへ送る。
  // AGENTS.md「互いの代替として扱わない」に合わせ、Tailscaleを確かめられなくてもtunnelsへは切り替えない。
  it.each([
    [undefined, ''], [false, ''], [true, ''], ['true', ''],
    [undefined, 'other=1; aichat_muse_tunnels=on'], [true, 'aichat_muse_tunnels=on'],
  ])('直送が届かなければtunnelsの指定(%s)やCookie(%s)に関係なく止め、tunnelsへ送らない', async (museTunnelsFallback, cookie) => {
    stub.fetch.mockResolvedValue(Response.json({ error: 'tailscale_not_connected' }, { status: 503 }));
    RUST_WORKER.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: 'tunnelsの回答' }) })));
    const response = await post({ message: '質問 "そのまま"', model: 'muse', museTunnelsFallback }, { MUSE_API_KEY: 'key' }, cookie);
    const data = await response.json() as { response: string; fallbackUsed?: boolean };
    expect(data.response).toContain('Museへの接続を確認できません');
    expect(data.response).not.toContain('tunnelsの回答');
    expect(data.fallbackUsed).toBeUndefined();
    expect(response.headers.get('X-Muse-Tailscale')).toBe('unavailable');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it('tunnelsがONでも本文を直送でMuseへ送る', async () => {
    stub.fetch.mockImplementation(async () => new Response(reply));
    const response = await post({ message: '通常質問', model: 'muse', museTunnelsFallback: true });
    expect(await response.json()).toMatchObject({ usedModel: 'muse', response: '回答本文\n\nEngine: Muse / Model: muse' });
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(stub.fetch).toHaveBeenCalledTimes(1);
  });

  it('tunnelsがONでも直送し、Muse実行失敗で再送しない', async () => {
    stub.fetch.mockImplementation(async () => new Response('{}', { status: 502 }));
    const response = await post({ message: '通常質問', model: 'muse', museTunnelsFallback: true });
    expect((await response.json() as { response: string }).response).toContain('Museへの接続を確認できません');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
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

  // 保存済みの旧コンテナ直通の選択(Cookie)が残っていても、死活確認は直送で行い、コンテナに触れない。
  async function get(env: Record<string, unknown> = { MUSE_API_KEY: 'key', DEMO_CONTAINER: {}, TAILSCALE_WASM }, authorized = true) {
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
    return app.request('/api/aichat/muse-health', { headers: authorized ? { Authorization: `Bearer ${token}`, Cookie: 'aichat_muse_signal=%7B%22transport%22%3A%22container%22%7D' } : {} }, { JWT_SECRET, DB, ...env });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    stub.fetch.mockImplementation(async () => Response.json({ status: 'ok' }));
  });

  it('muse-vmの/healthが応えればhealthy: trueを返し、応答を保存させない', async () => {
    const response = await get();
    expect(await response.json()).toEqual({ healthy: true, transport: 'worker' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(new URL((stub.fetch.mock.calls[0][0] as Request).url).pathname).toBe('/muse/health');
    expect(container.getState).not.toHaveBeenCalled(); expect(container.fetch).not.toHaveBeenCalled();
  });

  it('Worker内WASMが無ければhealthy: falseを返す', async () => {
    expect(await (await get({ MUSE_API_KEY: 'key', DEMO_CONTAINER: {} })).json()).toEqual({ healthy: false, transport: 'worker' });
  });

  it('未認証では確認しない', async () => {
    const response = await get(undefined, false);
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(stub.fetch).not.toHaveBeenCalled();
  });
});
