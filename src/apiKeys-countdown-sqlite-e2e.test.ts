import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { JSDOM } from 'jsdom';
import app from './index';
import { createJWT } from './utils/jwt';
import { getApiKeysPage } from './views/apiKeys';

// 対象: POST /api/api-keys → 本物の SQLite(countdown_events) → GET /api/countdown。
// ログイン時の cf-auth 期限と同じく、発行リクエスト内の INSERT が
// /countdown の一覧APIから読めることを、モックSQLではなく実テーブルで保証する。
//
// 故障シナリオ:
//   (1) INSERT したつもりでも GET /api/countdown に PK期限 が出ない
//   (2) 予約日時が api_keys.expires_at と食い違う
//   (3) 他ユーザーの GET /api/countdown に漏れる
//   (4) 無期限キーなのに countdown_events へ行が入る
//   (5) 発行モーダルが countdownNotice を出さず、登録成否に気づけない
//   (6) group_id カラム付きの本番スキーマで INSERT が落ちる

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const makeChain = (args: unknown[]) => ({
        async first<T>(): Promise<T | null> {
          const row = stmt.get(...(args as never[]));
          return (row ?? null) as T | null;
        },
        async all<T>(): Promise<{ results?: T[] }> {
          const rows = stmt.all(...(args as never[])) as unknown[];
          return { results: rows as T[] };
        },
        async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
          const res = stmt.run(...(args as never[]));
          return { meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) } };
        },
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      revoked_at TEXT,
      last_activity_at TEXT,
      idle_timeout_seconds INTEGER
    );
    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      revoked_at TEXT,
      last_used_at TEXT
    );
    CREATE TABLE countdown_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      target_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      group_id TEXT
    );
  `);
  db.prepare('INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, ?)').run('test-user', null);
  return db;
}

function envFor(db: DatabaseSync) {
  return { JWT_SECRET, DB: wrapD1(db) };
}

async function issueKey(
  db: DatabaseSync,
  body: { label: string; expiresInDays: number | null },
  sub = 'test-user'
) {
  return app.request(
    '/api/api-keys',
    {
      method: 'POST',
      headers: {
        Authorization: await makeAuthHeader(sub),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    envFor(db)
  );
}

async function listCountdown(db: DatabaseSync, sub = 'test-user') {
  return app.request(
    '/api/countdown',
    { headers: { Authorization: await makeAuthHeader(sub) } },
    envFor(db)
  );
}

let liveDom: JSDOM | undefined;

afterEach(() => {
  if (liveDom) {
    liveDom.window.close();
    liveDom = undefined;
  }
});

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('waitFor timeout'));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('SQLite実テーブル: APIキー発行が /countdown 一覧に PK期限 として見える', () => {
  it('30日キー発行後、GET /api/countdown に予定名 PK期限 と同一 expires_at が載る', async () => {
    const db = setupDb();
    const issueRes = await issueKey(db, { label: '監視用', expiresInDays: 30 });
    expect(issueRes.status).toBe(201);
    const issued = await issueRes.json() as {
      key: { expiresAt: string };
      countdown: { ok: boolean; registered?: boolean };
      countdownNotice: string;
    };
    expect(issued.countdown).toEqual({ ok: true, registered: true });
    expect(issued.countdownNotice).toContain('PK期限');

    const stored = db.prepare('SELECT user_id, label, target_at FROM countdown_events').all() as Array<{
      user_id: string;
      label: string;
      target_at: string;
    }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe('PK期限');
    expect(stored[0].user_id).toBe('test-user');
    expect(stored[0].target_at).toBe(issued.key.expiresAt);

    const keyRow = db.prepare('SELECT expires_at FROM api_keys').get() as { expires_at: string };
    expect(stored[0].target_at).toBe(keyRow.expires_at);

    const listRes = await listCountdown(db);
    expect(listRes.status).toBe(200);
    const list = await listRes.json() as { events: Array<{ label: string; target_at: string }> };
    expect(list.events).toHaveLength(1);
    expect(list.events[0].label).toBe('PK期限');
    expect(list.events[0].target_at).toBe(issued.key.expiresAt);

    const nextRes = await app.request(
      '/api/countdown/next',
      { headers: { Authorization: await makeAuthHeader() } },
      envFor(db)
    );
    const next = await nextRes.json() as { event: { label: string; targetAt: string } | null };
    expect(next.event?.label).toBe('PK期限');
    expect(next.event?.targetAt).toBe(issued.key.expiresAt);
  });

  it('無期限キーは GET /api/countdown に行を増やさない', async () => {
    const db = setupDb();
    const issueRes = await issueKey(db, { label: '永久', expiresInDays: null });
    expect(issueRes.status).toBe(201);
    const list = await (await listCountdown(db)).json() as { events: unknown[] };
    expect(list.events).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM countdown_events').get() as { n: number }).toEqual({ n: 0 });
  });

  it('他ユーザーの GET /api/countdown には出ない', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, ?)').run('other-user', null);
    const issueRes = await issueKey(db, { label: '監視用', expiresInDays: 30 });
    expect(issueRes.status).toBe(201);

    const otherList = await (await listCountdown(db, 'other-user')).json() as { events: unknown[] };
    expect(otherList.events).toEqual([]);

    const ownList = await (await listCountdown(db, 'test-user')).json() as { events: Array<{ label: string }> };
    expect(ownList.events.map((e) => e.label)).toEqual(['PK期限']);
  });

  it('2回発行したら GET /api/countdown に PK期限 が2件載る', async () => {
    const db = setupDb();
    expect((await issueKey(db, { label: 'A', expiresInDays: 30 })).status).toBe(201);
    expect((await issueKey(db, { label: 'B', expiresInDays: 90 })).status).toBe(201);
    const list = await (await listCountdown(db)).json() as { events: Array<{ label: string; target_at: string }> };
    expect(list.events).toHaveLength(2);
    expect(list.events.every((e) => e.label === 'PK期限')).toBe(true);
    expect(list.events[0].target_at).not.toBe(list.events[1].target_at);
  });
});

describe('🔑キー管理ページ: 発行操作のあとモーダル表示と /countdown 一覧が一致する', () => {
  it('新規発行ボタンを押すとモーダルに PK期限 と出し、GET /api/countdown からも同じ行が読める', async () => {
    const db = setupDb();
    const authHeader = await makeAuthHeader();
    const html = getApiKeysPage({ name: 'テストユーザー', username: 'test-user' });
    liveDom = new JSDOM(html, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      url: 'https://example.test/api-keys',
      beforeParse(window) {
        window.alert = () => {};
        window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
          const headers = new Headers(init?.headers);
          headers.set('Authorization', authHeader);
          return app.request(
            url,
            {
              method: init?.method || 'GET',
              headers,
              body: init?.body as string | undefined,
            },
            envFor(db)
          );
        }) as typeof fetch;
      },
    });

    const doc = liveDom.window.document;
    await waitFor(() => {
      const body = doc.getElementById('apiKeyTableBody');
      return !!body && !body.innerHTML.includes('読み込み中');
    });

    (doc.getElementById('newKeyLabel') as HTMLInputElement).value = '監視用';
    (doc.getElementById('newKeyExpiry') as HTMLSelectElement).value = '30';
    (doc.querySelector('.create-form .btn-primary') as HTMLButtonElement).click();

    await waitFor(() => doc.getElementById('rawKeyModal')?.classList.contains('show') === true);
    const notice = doc.getElementById('countdownNotice')?.textContent || '';
    expect(notice).toContain('PK期限');
    expect(notice).toContain('登録');

    const list = await (await listCountdown(db)).json() as { events: Array<{ label: string }> };
    expect(list.events.map((e) => e.label)).toEqual(['PK期限']);
  });
});
