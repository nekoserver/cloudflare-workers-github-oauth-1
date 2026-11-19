import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from './index';
import { createJWT } from './utils/jwt';
import { loadConversationStreamRoutes } from './utils/conversationStreamRegistry';
import { resolveConversationStreamRoutes } from './utils/conversationStreamRoutes';

// 対象: D1 conversation_stream_hosts(マイグレーション0194)を、台帳への上書きとして読む経路と、管理APIの
// /api/aichat/conversation-stream/hosts。D1は実際のマイグレーションを流したSQLiteで代用する。

const secret = 'stream-hosts-api-test-secret';
const ADMIN = 85157166;
const URL_BASE = 'http://localhost';

function sqliteD1(sql: DatabaseSync) {
  return {
    prepare(query: string) {
      const make = (args: (string | number | null)[]) => ({
        first: async () => (query.includes('user_sessions') ? { revoked_at: null } : sql.prepare(query).get(...args) ?? null),
        all: async () => ({ results: sql.prepare(query).all(...args) }),
        run: async () => ({ meta: { changes: Number(sql.prepare(query).run(...args).changes) } }),
      });
      return { ...make([]), bind: (...args: (string | number | null)[]) => make(args) };
    },
  };
}

async function environment(githubId = ADMIN) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('migrations/0194_create_conversation_stream_hosts.sql', 'utf8'));
  const token = await createJWT({ sub: 'admin', github_id: githubId }, secret);
  return {
    sql,
    env: { JWT_SECRET: secret, DB: sqliteD1(sql), CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN), AICHAT_EXTERNAL_SECRET: 'ext' },
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
}

function insert(sql: DatabaseSync, id: string, origin: string, priority = 100, enabled = 1, label = id) {
  sql.prepare('INSERT INTO conversation_stream_hosts (id,label,origin,priority,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, label, origin, priority, enabled, '2026-11-18T00:00:00Z', '2026-11-18T00:00:00Z');
}

afterEach(() => vi.unstubAllGlobals());

describe('loadConversationStreamRoutes', () => {
  it('D1が無ければ台帳だけで解決し、出どころをledgerと返す', async () => {
    const { config, registry } = await loadConversationStreamRoutes(undefined);
    expect(config).toEqual(resolveConversationStreamRoutes());
    expect(registry).toEqual({ source: 'ledger', overrides: 0, skipped: [] });
  });

  it('表が無い(0194未適用)・D1が読めないときは台帳で動き、理由をregistryに残す(空やnullにしない)', async () => {
    const db = { prepare: () => ({ all: async () => { throw new Error('D1_ERROR: no such table: conversation_stream_hosts'); } }) };
    const { config, registry } = await loadConversationStreamRoutes(db as unknown as D1Database);
    expect(config).toEqual(resolveConversationStreamRoutes());
    expect(registry).toEqual({ source: 'ledger', overrides: 0, skipped: [], error: 'registry_unavailable', detail: 'D1_ERROR: no such table: conversation_stream_hosts' });
  });

  it('D1の行があれば台帳に重ね、出どころをledger+d1と返す', async () => {
    const { sql, env } = await environment();
    try {
      insert(sql, 'mygw', 'https://other.nekomaneki.work', 10);
      const { config, registry } = await loadConversationStreamRoutes(env.DB as unknown as D1Database);
      expect(config.routes.find(route => route.id === 'mygw')?.origin).toBe('https://other.nekomaneki.work');
      expect(registry).toEqual({ source: 'ledger+d1', overrides: 1, skipped: [] });
    } finally { sql.close(); }
  });

  it('D1で接続先がすべて外れたときは台帳で動き、理由をregistryに残す', async () => {
    const { sql, env } = await environment();
    try {
      for (const id of ['mygw', 'mynw', 'testcfc', 'redmine']) insert(sql, id, `https://${id}-off.nekomaneki.work`, 10, 0);
      const { config, registry } = await loadConversationStreamRoutes(env.DB as unknown as D1Database);
      expect(config).toEqual(resolveConversationStreamRoutes());
      expect(registry).toMatchObject({ source: 'ledger', overrides: 0, error: 'no_enabled_routes' });
    } finally { sql.close(); }
  });
});

describe('台帳とD1を合わせた接続先が、各経路で同じに使われる', () => {
  it('ヘルスチェックはD1で上書きしたoriginを確かめ、registryを返す', async () => {
    const { sql, env, headers } = await environment();
    try {
      insert(sql, 'mygw', 'https://other.nekomaneki.work', 10);
      const probe = vi.fn(async (_url: string) => new Response(null, { status: 530 }));
      vi.stubGlobal('fetch', probe);
      const response = await app.request('/api/aichat/conversation-stream/health', { headers }, env);
      expect(response.status).toBe(200);
      expect(probe.mock.calls.map(call => call[0])).toEqual(['https://other.nekomaneki.work/lib/conversation-embed.html?via=health']);
      expect(await response.json()).toEqual({ healthy: false, availableHosts: [], registry: { source: 'ledger+d1', overrides: 1, skipped: [] } });
    } finally { sql.close(); }
  });

  it('AIチャットのCSPのframe-srcに、D1で加えた接続先が入る', async () => {
    const { sql, env, headers } = await environment();
    try {
      insert(sql, 'next', 'https://next.nekomaneki.work', 30);
      const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
      const response = await app.request('/aichat', { headers }, env, executionCtx);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Security-Policy') ?? '').toContain('https://next.nekomaneki.work');
    } finally { sql.close(); }
  });

  it('tree-viewへ渡す接続先にも、D1で加えた接続先が入る', async () => {
    const { sql, env } = await environment();
    try {
      insert(sql, 'next', 'https://next.nekomaneki.work', 30, 1, '次');
      const response = await app.request('/api/tree-view/conversation-stream-routes-external', { headers: { Authorization: 'Bearer ext' } }, env);
      const body = await response.json() as { routes: { id: string; origin: string; label: string }[]; autoPriority: string[] };
      expect(body.routes).toContainEqual({ id: 'next', origin: 'https://next.nekomaneki.work', label: '次' });
      expect(body.autoPriority).toEqual(['mygw', 'next']);
    } finally { sql.close(); }
  });
});

describe('/api/aichat/conversation-stream/hosts', () => {
  const path = '/api/aichat/conversation-stream/hosts';
  const body = { id: 'next', label: '次', origin: 'https://next.nekomaneki.work', priority: 30 };

  it('一覧はログインが要り、D1の行と合わせた結果とregistryを返す', async () => {
    const { sql, env, headers } = await environment(2);
    try {
      expect((await app.request(path, {}, env)).status).toBe(401);
      insert(sql, 'next', 'https://next.nekomaneki.work', 30);
      const response = await app.request(path, { headers }, env);
      expect(response.status).toBe(200);
      const json = await response.json() as { hosts: { id: string; enabled: boolean }[]; routes: { id: string }[]; autoPriority: string[]; registry: unknown };
      expect(json.hosts).toEqual([{ id: 'next', label: 'next', origin: 'https://next.nekomaneki.work', priority: 30, enabled: true }]);
      expect(json.routes.map(route => route.id)).toContain('next');
      expect(json.autoPriority).toEqual(['mygw', 'next']);
      expect(json.registry).toEqual({ source: 'ledger+d1', overrides: 1, skipped: [] });
    } finally { sql.close(); }
  });

  it('変更は管理者だけ、同じOriginからだけ受け付ける', async () => {
    const user = await environment(2);
    const admin = await environment();
    try {
      const post = (env: object, headers: Record<string, string>) => app.request(path, { method: 'POST', headers, body: JSON.stringify(body) }, env);
      expect((await post(user.env, user.headers)).status).toBe(403);
      expect((await app.request(`${path}/mygw`, { method: 'DELETE', headers: user.headers }, user.env)).status).toBe(403);
      expect((await post(admin.env, { ...admin.headers, Origin: 'https://evil.example' })).status).toBe(403);
      expect(admin.sql.prepare('SELECT COUNT(*) AS n FROM conversation_stream_hosts').get()).toEqual({ n: 0 });
    } finally { user.sql.close(); admin.sql.close(); }
  });

  it('追加・重複の拒否・更新(enabledを省けば保つ)・削除(台帳の値に戻る)ができる', async () => {
    const { sql, env, headers } = await environment();
    try {
      const send = (method: string, url: string, payload?: object) => app.request(url, { method, headers: { ...headers, Origin: URL_BASE }, body: payload ? JSON.stringify(payload) : undefined }, env);
      const bad = await send('POST', path, { ...body, origin: 'https://evil.example.com' });
      expect(bad.status).toBe(400);
      expect(await bad.json()).toMatchObject({ errorCode: 'origin_not_allowed' });
      expect((await send('POST', path, body)).status).toBe(201);
      expect((await send('POST', path, body)).status).toBe(409);
      expect((await send('POST', path, { ...body, id: 'other' })).status).toBe(409);
      expect((await send('PUT', `${path}/next`, { label: '次2', origin: 'https://next.nekomaneki.work', priority: 31, enabled: false })).status).toBe(200);
      expect((await send('PUT', `${path}/next`, { label: '次3', origin: 'https://next.nekomaneki.work', priority: 32 })).status).toBe(200);
      expect(sql.prepare('SELECT label, priority, enabled FROM conversation_stream_hosts WHERE id = ?').get('next')).toEqual({ label: '次3', priority: 32, enabled: 0 });
      expect((await send('PUT', `${path}/missing`, { ...body, origin: 'https://missing.nekomaneki.work' })).status).toBe(404);
      expect((await send('PUT', `${path}/missing`, body)).status).toBe(409);
      expect((await send('DELETE', `${path}/next`)).status).toBe(200);
      expect((await send('DELETE', `${path}/next`)).status).toBe(404);
    } finally { sql.close(); }
  });
});
