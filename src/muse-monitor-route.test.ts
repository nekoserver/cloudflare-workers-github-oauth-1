import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

// 対象: GET /api/muse-monitor/:section(muse-monitorの1項目をService Binding MUSE_MONITOR経由で取得、管理者限定)。
// 故障想定: 管理者以外が使える / バインディングや鍵が無いと500で落ちる / 署名がmuse-monitorの形と違う /
// 鍵の不一致が理由の分からないエラーになる / キャッシュされる。

const secret = 'muse-monitor-route-secret';
const DB = { prepare: () => ({ bind: () => ({ first: async () => ({ revoked_at: null }) }) }) };
const ADMIN = { CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166' };
const headersFor = async (sub: string, githubId: number) => ({ Authorization: `Bearer ${await createJWT({ sub, github_id: githubId }, secret)}` });

function monitor(answer: (req: Request) => Response) {
  const seen: Request[] = [];
  return { seen, binding: { fetch: async (input: RequestInfo, init?: RequestInit) => { const req = new Request(input, init); seen.push(req); return answer(req); } } };
}

describe('/api/muse-monitor/:section', () => {
  it('ログインと管理者が必要', async () => {
    const m = monitor(() => Response.json({}));
    const env = { JWT_SECRET: secret, DB, ...ADMIN, MUSE_MONITOR: m.binding, MONITOR_HMAC_SECRET: 'k' };
    expect([302, 401]).toContain((await app.request('/api/muse-monitor/status', {}, env)).status);
    expect((await app.request('/api/muse-monitor/status', { headers: await headersFor('other', 2) }, env)).status).toBe(403);
    expect(m.seen).toEqual([]);
  });

  it('muse-monitorの/api/hmac/*を署名付きで呼び、応答を返す', async () => {
    const m = monitor(() => Response.json({ section: 'jobs', rc: 0, output: 'queue empty' }));
    const env = { JWT_SECRET: secret, DB, ...ADMIN, MUSE_MONITOR: m.binding, MONITOR_HMAC_SECRET: 'shared' };
    const res = await app.request('/api/muse-monitor/jobs', { headers: await headersFor('admin', 85157166) }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ status: 200, body: { section: 'jobs', rc: 0, output: 'queue empty' } });
    const req = m.seen[0];
    expect(new URL(req.url).pathname).toBe('/api/hmac/monitor/jobs');
    const ts = req.headers.get('X-Muse-Timestamp')!;
    expect(Math.abs(Number(ts) - Date.now() / 1000)).toBeLessThan(5);
    expect(req.headers.get('X-Muse-Signature')).toBe(createHmac('sha256', 'shared').update(`${ts}./api/hmac/monitor/jobs.jobs`).digest('hex'));
  });

  it('muse-monitorの上流のエラーは502で、状態と本文を付けて返す', async () => {
    const body = { error: 'receiver_not_found', message: 'no reachable peer named muse-vm(-*)' };
    const m = monitor(() => Response.json(body, { status: 502 }));
    const env = { JWT_SECRET: secret, DB, ...ADMIN, MUSE_MONITOR: m.binding, MONITOR_HMAC_SECRET: 'shared' };
    const res = await app.request('/api/muse-monitor/vm', { headers: await headersFor('admin', 85157166) }, env);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ status: 502, body });
  });

  it('鍵の不一致は理由付きの502、未設定は503、未知のsectionは404', async () => {
    const admin = await headersFor('admin', 85157166);
    const rejected = monitor(() => Response.json({ error: 'unauthorized' }, { status: 401 }));
    const r1 = await app.request('/api/muse-monitor/status', { headers: admin }, { JWT_SECRET: secret, DB, ...ADMIN, MUSE_MONITOR: rejected.binding, MONITOR_HMAC_SECRET: 'wrong' });
    expect(r1.status).toBe(502);
    expect(await r1.json()).toMatchObject({ errorCode: 'hmac_rejected', upstreamStatus: 401 });

    const r2 = await app.request('/api/muse-monitor/status', { headers: admin }, { JWT_SECRET: secret, DB, ...ADMIN });
    expect(r2.status).toBe(503);
    expect(await r2.json()).toMatchObject({ errorCode: 'not_configured' });

    const m = monitor(() => Response.json({}));
    const r3 = await app.request('/api/muse-monitor/exec', { headers: admin }, { JWT_SECRET: secret, DB, ...ADMIN, MUSE_MONITOR: m.binding, MONITOR_HMAC_SECRET: 'k' });
    expect(r3.status).toBe(404);
    expect(m.seen).toEqual([]);
  });
});
