import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

// 対象: /muse-wasm-test(Tailscale WASMでmuse-vmへの到達を確かめ、要望をbridge_jobsへ積むテスト用ページ)と、そのAPI。
// 故障想定: 管理者以外が開ける / WASMがCSPで止まる / 他のサイトから要望を積める / 積んだ要望が一覧に出ない /
// INQUIRY_DBが無いときに500で落ちる。

const secret = 'muse-wasm-test-secret';
const DB = { prepare: () => ({ bind: () => ({ first: async () => ({ revoked_at: null }) }) }) };
const databases: DatabaseSync[] = [];
afterEach(() => { databases.splice(0).forEach((db) => db.close()); });

function inquiryDb() {
  const sql = new DatabaseSync(':memory:');
  databases.push(sql);
  sql.exec(readFileSync('migrations-agent-inquiries/0009_create_bridge_jobs.sql', 'utf8'));
  const bind = (query: string, args: unknown[]) => ({
    query, args,
    all: async () => ({ results: sql.prepare(query).all(...(args as never[])) }),
    first: async () => sql.prepare(query).get(...(args as never[])) ?? null,
    run: async () => ({ meta: { changes: Number(sql.prepare(query).run(...(args as never[])).changes) } }),
  });
  const db = {
    prepare: (query: string) => ({ ...bind(query, []), bind: (...args: unknown[]) => bind(query, args) }),
    batch: async (statements: { query: string; args: unknown[] }[]) => {
      sql.exec('BEGIN');
      try { const r = statements.map(({ query, args }) => sql.prepare(query).run(...(args as never[]))); sql.exec('COMMIT'); return r; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  return { sql, db };
}

async function headersFor(sub: string, githubId: number, extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${await createJWT({ sub, github_id: githubId }, secret)}`, ...extra };
}
const ORIGIN = 'http://localhost';

describe('/muse-wasm-testの認可', () => {
  it('ページと2つのAPIは、ログインと管理者が必要', async () => {
    const { db } = inquiryDb();
    const env = { JWT_SECRET: secret, DB, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166', INQUIRY_DB: db };
    const other = await headersFor('other', 2, { Origin: ORIGIN, 'Content-Type': 'application/json' });
    for (const [path, method] of [['/muse-wasm-test', 'GET'], ['/api/muse-wasm-test/jobs', 'GET'], ['/api/muse-wasm-test/jobs', 'POST']]) {
      const body = method === 'POST' ? JSON.stringify({ request: 'x' }) : undefined;
      expect([302, 401]).toContain((await app.request(path, { method, body }, env)).status);
      expect((await app.request(path, { method, body, headers: other }, env)).status).toBe(403);
    }
  });
});

describe('/muse-wasm-testのページ', () => {
  it('Tailscale WASMの読み込みと接続をCSPで許可する', async () => {
    const env = { JWT_SECRET: secret, DB, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166' };
    const page = await app.request('/muse-wasm-test', { headers: await headersFor('admin', 85157166) }, env);
    expect(page.status).toBe(200);
    expect(page.headers.get('Cache-Control')).toBe('no-store');
    const csp = page.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).toContain('wss://*.tailscale.com');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(await page.text()).toContain("import('/tailscale-wasm-client.mjs')");
  });
});

describe('/api/muse-wasm-test/jobs', () => {
  it('要望をbridge_jobsへ積み、ログイン名を依頼者にして一覧で返す', async () => {
    const { sql, db } = inquiryDb();
    const env = { JWT_SECRET: secret, DB, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166', INQUIRY_DB: db };
    const headers = await headersFor('admin', 85157166, { Origin: ORIGIN, 'Content-Type': 'application/json' });
    const created = await app.request('/api/muse-wasm-test/jobs', { method: 'POST', headers, body: JSON.stringify({ request: '  READMEを読んで要約して  ', external: false }) }, env);
    expect(created.status).toBe(200);
    const { jobId } = await created.json() as { jobId: string };
    expect(jobId).toMatch(/^[0-9a-f]{32}$/);
    expect(sql.prepare('SELECT origin, created_by, request_text FROM bridge_jobs').get()).toEqual({ origin: 'muse-wasm-test', created_by: 'admin', request_text: 'READMEを読んで要約して' });

    const list = await app.request('/api/muse-wasm-test/jobs', { headers }, env);
    expect(list.headers.get('Cache-Control')).toBe('no-store');
    const { jobs } = await list.json() as { jobs: { jobId: string; status: string }[] };
    expect(jobs).toEqual([expect.objectContaining({ jobId, status: 'queued' })]);
  });

  it('externalがtrueのときだけ外部へ書き込む要望として積む', async () => {
    const { sql, db } = inquiryDb();
    const env = { JWT_SECRET: secret, DB, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166', INQUIRY_DB: db };
    const headers = await headersFor('admin', 85157166, { Origin: ORIGIN, 'Content-Type': 'application/json' });
    await app.request('/api/muse-wasm-test/jobs', { method: 'POST', headers, body: JSON.stringify({ request: 'a', external: 'true' }) }, env);
    await app.request('/api/muse-wasm-test/jobs', { method: 'POST', headers, body: JSON.stringify({ request: 'b', external: true }) }, env);
    expect(sql.prepare('SELECT request_text, external_write FROM bridge_jobs ORDER BY request_text').all()).toEqual([
      { request_text: 'a', external_write: 0 }, { request_text: 'b', external_write: 1 },
    ]);
  });

  it('他のサイトからの送信は積まない', async () => {
    const { sql, db } = inquiryDb();
    const env = { JWT_SECRET: secret, DB, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166', INQUIRY_DB: db };
    for (const origin of ['https://evil.example', undefined]) {
      const headers = await headersFor('admin', 85157166, { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) });
      expect((await app.request('/api/muse-wasm-test/jobs', { method: 'POST', headers, body: JSON.stringify({ request: 'x' }) }, env)).status).toBe(403);
    }
    expect(sql.prepare('SELECT COUNT(*) AS n FROM bridge_jobs').get()).toEqual({ n: 0 });
  });

  it('空の要望は400で理由を返す', async () => {
    const { db } = inquiryDb();
    const env = { JWT_SECRET: secret, DB, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166', INQUIRY_DB: db };
    const headers = await headersFor('admin', 85157166, { Origin: ORIGIN, 'Content-Type': 'application/json' });
    const response = await app.request('/api/muse-wasm-test/jobs', { method: 'POST', headers, body: JSON.stringify({ request: '   ' }) }, env);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'empty_request' });
  });

  it('INQUIRY_DBが無ければ503で理由を返す', async () => {
    const env = { JWT_SECRET: secret, DB, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166' };
    const headers = await headersFor('admin', 85157166, { Origin: ORIGIN, 'Content-Type': 'application/json' });
    const posted = await app.request('/api/muse-wasm-test/jobs', { method: 'POST', headers, body: JSON.stringify({ request: 'x' }) }, env);
    expect(posted.status).toBe(503);
    expect((await posted.json() as { error: string }).error).toContain('INQUIRY_DB');
    expect((await app.request('/api/muse-wasm-test/jobs', { headers }, env)).status).toBe(503);
  });
});
