import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const stub = vi.hoisted(() => ({ getState: vi.fn(), fetch: vi.fn() }));
vi.mock('./containers/demoContainerStub', () => ({ getDemoContainer: () => stub }));

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
    }, { JWT_SECRET, DB, RUST_WORKER, DEMO_CONTAINER: {}, ...env });
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
    const connected = (url: string) => url.endsWith('/debug/tailscale-peers')
      ? new Response(JSON.stringify({ backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] }))
      : new Response(usage);
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
    const answering = (body: string, status = 200) => async (request: Request) => request.url.endsWith('/debug/tailscale-peers') ? connected(request.url) : new Response(body, { status });

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
    it('コマンド実行の失敗(503)は内容を伝え、保存せず別の経路へも送らない', async () => {
      stub.fetch.mockImplementation(answering(JSON.stringify({ error: { type: 'usage_unavailable' } }), 503));
      const response = await post({ message: '/usage', model: 'muse', source: 'textbox' });
      expect((await response.json() as { response: string }).response).toContain('muse-vmでコマンドを実行できませんでした');
      expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
      expect(inserts).toEqual([]);
    });

    // 故障想定: 文頭が/でも、ブリッジがコマンドとして実行していなければ回答として保存する。
    it('bridge_commandの無い応答は通常の回答として保存する', async () => {
      stub.fetch.mockImplementation(async (request: Request) => request.url.endsWith('/debug/tailscale-peers') ? connected(request.url) : new Response(reply));
      const response = await post({ message: '/usage', model: 'muse', source: 'textbox' });
      expect(await response.json()).toMatchObject({ usedModel: 'muse', response: '回答本文\n\nEngine: Muse / Model: muse' });
      expect(inserts).toHaveLength(1);
    });

    // 故障想定: Tailscaleが切れているときに、tunnels経由へ切り替えて届けてしまう。
    it.each([
      ['Tailscaleが停止中', { backendState: 'Stopped', peers: [{ hostName: 'muse-vm', online: true }] }, 'Tailscaleが停止中'],
      ['muse-vmがオフライン', { backendState: 'Running', peers: [{ hostName: 'muse-vm', online: false }] }, 'muse-vm'],
    ])('%sなら送らず、別の経路へも切り替えない', async (_name, peers, text) => {
      stub.fetch.mockImplementation(async () => new Response(JSON.stringify(peers)));
      const response = await post({ message: '/usage', model: 'muse', source: 'textbox' });
      const body = await response.json() as { response: string };
      expect(body.response).toContain(text);
      expect(body.response).toContain('送信していません');
      expect(response.headers.get('X-Muse-Tailscale')).toBe('unavailable');
      expect(sentPrompts()).toHaveLength(0);
      expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
      expect(inserts).toEqual([]);
    });
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
    expect(data.response).toContain('Museへの接続を確認できません');
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

  // 2026-11-07 ユーザー指定: スイッチがMuseのときの接頭語なし投稿は、tunnels方向ではなく直接muse-vmへ送る。
  // AGENTS.md「互いの代替として扱わない」に合わせ、Tailscaleを確かめられなくてもtunnelsへは切り替えない。
  it.each([
    [undefined, ''], [false, ''], [true, ''], ['true', ''],
    [undefined, 'other=1; aichat_muse_tunnels=on'], [true, 'aichat_muse_tunnels=on'],
  ])('Tailscale未接続ならtunnelsの指定(%s)やCookie(%s)に関係なく止め、tunnelsへ送らない', async (museTunnelsFallback, cookie) => {
    stub.fetch.mockResolvedValue(new Response(JSON.stringify({ backendState: 'NeedsLogin', peers: [] })));
    RUST_WORKER.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply: 'tunnelsの回答' }) })));
    const response = await post({ message: '質問 "そのまま"', model: 'muse', museTunnelsFallback }, { MUSE_API_KEY: 'key' }, cookie);
    const data = await response.json() as { response: string; fallbackUsed?: boolean };
    expect(data.response).toContain('Tailscale');
    expect(data.response).not.toContain('tunnelsの回答');
    expect(data.fallbackUsed).toBeUndefined();
    expect(response.headers.get('X-Muse-Tailscale')).toBe('unavailable');
    expect(RUST_WORKER.fetch).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
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

  async function get(env: Record<string, unknown> = { MUSE_API_KEY: 'key', DEMO_CONTAINER: {} }, authorized = true) {
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
    return app.request('/api/aichat/muse-health', { headers: authorized ? { Authorization: `Bearer ${token}`, Cookie: 'aichat_muse_signal=%7B%22transport%22%3A%22container%22%7D' } : {} }, { JWT_SECRET, DB, ...env });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    stub.getState.mockResolvedValue({ status: 'healthy' });
    stub.fetch.mockImplementation(async (req: Request) => new Response(JSON.stringify(new URL(req.url).pathname === '/debug/tailscale-peers' ? { backendState: 'Running', peers: [{ hostName: 'muse-vm', online: true }] } : { status: 'ok' })));
  });

  it('稼働中ならhealthy: trueを返し、応答を保存させない', async () => {
    const response = await get();
    expect(await response.json()).toEqual({ healthy: true, transport: 'container' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('コンテナの停止中は起動せず、healthy: falseを返す', async () => {
    stub.getState.mockResolvedValue({ status: 'stopped' });
    expect(await (await get()).json()).toEqual({ healthy: false, transport: 'container' });
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('DEMO_CONTAINERが無ければhealthy: falseを返す', async () => {
    expect(await (await get({ MUSE_API_KEY: 'key' })).json()).toEqual({ healthy: false, transport: 'container' });
  });

  it('未認証では確認しない', async () => {
    const response = await get(undefined, false);
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(stub.getState).not.toHaveBeenCalled();
  });
});
