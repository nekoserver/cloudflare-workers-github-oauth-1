// @vitest-environment jsdom
// ユーザー指定(2026-11-12): Muse の返事が来ないとき、毎回5分待たされないよう、送信中にキャンセルできるようにする。
// 仮説: キャンセルできるなら、(1) 返事を待っている途中でもジョブはすぐ「キャンセルしました」で終わり、
// (2) 後から返事が来ても結果を上書きせず、(3) 送信者以外は止められず、(4) 画面の「考え中」にボタンがあって押すと止める要求を送る。
import { describe, expect, it, vi } from 'vitest';
import { AichatJobRunner, type AichatJobStorage } from './utils/aichatJob';
import { AICHAT_JOB_CLIENT_SCRIPT } from './views/aichatJobClient';

class FakeStorage implements AichatJobStorage {
  data = new Map<string, unknown>();
  async get<T>(key: string) { return this.data.get(key) as T | undefined; }
  async put(key: string, value: unknown) { this.data.set(key, structuredClone(value)); }
  async deleteAll() { this.data.clear(); }
  async setAlarm() {}
}
const OWNER = 'user-1';
const START = { owner: OWNER, request: { url: 'https://example.com/api/aichat', headers: { 'content-type': 'application/json' }, body: '{"message":"hi"}' } };
const post = (runner: AichatJobRunner, path: string, body?: unknown) => runner.fetch(new Request('https://aichat-job' + path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }));
const status = async (runner: AichatJobRunner, owner = OWNER) => (await runner.fetch(new Request('https://aichat-job/status?owner=' + owner))).json() as Promise<Record<string, unknown>>;

describe('ジョブのキャンセル', () => {
  it('返事を待っている途中でも、すぐ「キャンセルしました」で終わり、後から来た返事で上書きしない', async () => {
    const storage = new FakeStorage();
    let respond!: (r: Response) => void;
    const runner = new AichatJobRunner(storage, () => new Promise<Response>(resolve => { respond = resolve; }));
    await post(runner, '/start', START);
    const running = runner.alarm();
    await vi.waitFor(() => expect(respond).toBeTypeOf('function'));
    const res = await post(runner, '/cancel?owner=' + OWNER);
    expect(res.status).toBe(200);
    await running;
    expect(await status(runner)).toMatchObject({ status: 'failed', error: 'キャンセルしました' });
    respond(Response.json({ response: '遅れて来た返事' }));
    await new Promise(r => setTimeout(r, 0));
    expect(await status(runner)).toMatchObject({ status: 'failed', error: 'キャンセルしました', result: null });
  });
  it('送信者以外は止められない', async () => {
    const runner = new AichatJobRunner(new FakeStorage(), () => new Promise(() => {}));
    await post(runner, '/start', START);
    expect((await post(runner, '/cancel?owner=someone-else')).status).toBe(404);
    expect(await status(runner)).toMatchObject({ status: 'pending' });
  });
  it('終わったジョブは止めない(結果を消さない)', async () => {
    const runner = new AichatJobRunner(new FakeStorage(), async () => Response.json({ response: '答え' }));
    await post(runner, '/start', START);
    await runner.alarm();
    expect((await post(runner, '/cancel?owner=' + OWNER)).status).toBe(409);
    expect(await status(runner)).toMatchObject({ status: 'done', result: { response: '答え' } });
  });
});

describe('画面のキャンセルボタン', () => {
  const client = new Function(AICHAT_JOB_CLIENT_SCRIPT + '\nreturn { cancelAichatJob, addAichatCancelButton };')() as {
    cancelAichatJob(deps: { fetch: typeof fetch }, jobId: string): Promise<void>;
    addAichatCancelButton(deps: { fetch: typeof fetch }, bubble: HTMLElement, jobId: string): HTMLButtonElement;
  };
  it('「考え中」の吹き出しにボタンを置き、押すとそのジョブを止める要求を1回送る', async () => {
    const fetch = vi.fn(async () => Response.json({ status: 'failed' }));
    const bubble = document.createElement('div');
    const button = client.addAichatCancelButton({ fetch } as never, bubble, 'job-123');
    expect(bubble.contains(button)).toBe(true);
    expect(button.textContent).toBe('キャンセル');
    button.click(); button.click();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/aichat/jobs/job-123/cancel', expect.objectContaining({ method: 'POST', credentials: 'same-origin' }));
    expect(button.disabled).toBe(true);
  });
});

describe('本体の受け口 /api/aichat/jobs/:jobId/cancel', () => {
  const JOB_ID = '123e4567-e89b-42d3-a456-426614174000';
  async function cancelRequest(origin: string | null) {
    const { default: app } = await import('./index');
    const { createJWT } = await import('./utils/jwt');
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, 'cancel-test');
    const calls: string[] = [];
    const ns = { idFromName: (n: string) => n, get: () => ({ fetch: async (url: string, init?: RequestInit) => { calls.push((init?.method ?? 'GET') + ' ' + url); return Response.json({ status: 'failed', error: 'キャンセルしました' }); } }) };
    const DB = { prepare: (sql: string) => ({ first: async () => null, all: async () => ({ results: [] }), bind: () => ({ first: async () => sql.includes('user_sessions') ? { revoked_at: null } : null, run: async () => ({ success: true }), all: async () => ({ results: [] }) }) }) };
    const headers: Record<string, string> = { Authorization: 'Bearer ' + token };
    if (origin) headers.Origin = origin;
    const res = await app.request('http://localhost/api/aichat/jobs/' + JOB_ID + '/cancel', { method: 'POST', headers }, { JWT_SECRET: 'cancel-test', DB, AICHAT_JOB: ns } as never);
    return { res, calls };
  }
  it('送信者(user.sub)をジョブへ渡して止める', async () => {
    const { res, calls } = await cancelRequest('http://localhost');
    expect(res.status).toBe(200);
    expect(calls).toEqual(['POST https://aichat-job/cancel?owner=test-user']);
  });
  it('別のオリジンからは止めない', async () => {
    const { res, calls } = await cancelRequest('https://evil.example');
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });
});

describe('ページの配線', () => {
  it('送信と、開き直したときの続きの両方で、「考え中」にキャンセルボタンを置く', async () => {
    const { getAiChatPage } = await import('./views/aichat');
    const page = getAiChatPage({ username: 'u', aiChatModel: 'm' });
    expect(page).toContain('if (thinking) addAichatCancelButton(aichatJobDeps, thinking, jobId);');
    expect(page).toContain('addAichatCancelButton(aichatJobDeps, thinking, job.jobId);');
    expect(page).toContain('}, thinking)');
  });
});
