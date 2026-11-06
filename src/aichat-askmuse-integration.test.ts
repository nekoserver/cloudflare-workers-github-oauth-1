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

  async function post(body: Record<string, unknown>, env: Record<string, unknown> = { MUSE_API_KEY: 'key' }) {
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
    return app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  it('キーが未設定ならその旨を返す', async () => {
    const response = await post({ message: '/askmuse prompt="質問本文"' }, {});
    expect((await response.json() as { response: string }).response).toContain('MUSE_API_KEY');
    expect(stub.fetch).not.toHaveBeenCalled();
  });
});
