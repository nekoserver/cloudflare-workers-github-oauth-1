import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from './index';
import { createJWT } from './utils/jwt';

const secret = 'askgk-timeout-test-secret';
async function environment(githubId = 85157166) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('migrations/0189_create_askgk_timeout_settings.sql', 'utf8'));
  const db = { prepare: (query: string) => {
    const bind = (...args: (string | number)[]) => ({
      first: async () => query.includes('user_sessions') ? { revoked_at: null } : sql.prepare(query).get(...args) ?? null,
      run: async () => ({ meta: { changes: Number(sql.prepare(query).run(...args).changes) } }),
    }); return { ...bind(), bind };
  } };
  const token = await createJWT({ sub: 'admin', github_id: githubId }, secret);
  return { sql, env: { JWT_SECRET: secret, DB: db, CF_DASHBOARD_ADMIN_GITHUB_IDS: '85157166' }, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } };
}

describe('askgk settings API', () => {
  it('requires authentication and administrator authorization', async () => {
    const { sql, env, headers } = await environment(2);
    try {
      expect((await app.request('/api/settings/askgk-timeout', {}, env)).status).toBe(401);
      expect((await app.request('/api/settings/askgk-timeout', { headers }, env)).status).toBe(403);
      expect((await app.request('/api/settings/askgk-timeout', { method: 'POST', headers, body: JSON.stringify({ timeoutSeconds: 300, revision: 1 }) }, env)).status).toBe(403);
    } finally { sql.close(); }
  });
  it('persists 300, rejects out-of-range values and stale updates, and reads the winning value', async () => {
    const { sql, env, headers } = await environment();
    try {
      const initial = await app.request('/api/settings/askgk-timeout', { headers }, env);
      expect(await initial.json()).toEqual({ revision: 1, timeoutSeconds: 120 });
      const save = (timeoutSeconds: number, revision = 1) => app.request('/api/settings/askgk-timeout', { method: 'POST', headers, body: JSON.stringify({ timeoutSeconds, revision }) }, env);
      expect((await save(301)).status).toBe(400);
      expect((await save(300)).status).toBe(200);
      expect((await save(60)).status).toBe(409);
      expect(await (await app.request('/api/settings/askgk-timeout', { headers }, env)).json()).toEqual({ revision: 2, timeoutSeconds: 300 });
    } finally { sql.close(); }
  });
});
