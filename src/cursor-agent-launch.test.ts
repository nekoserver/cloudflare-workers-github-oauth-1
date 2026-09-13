import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

// 対象: GET /cursor-agent, POST /api/cursor-agent/launch, GET /api/cursor-agent/history。
// フォーム入力(プロンプト・対象リポジトリ)からCursor Background Agent API
// (POST https://api.cursor.com/v1/agents)を起動し、起動後の問答(プロンプト・
// レスポンス)をAIチャット(ai_chat_shares)と同様にD1へ保存、後から一覧取得できる。
//
// 故障シナリオ:
//   (1) CURSOR_API_KEY未設定でもCursor APIへリクエストしてしまう
//   (2) プロンプトが1文字以下でも実行されてしまう
//   (3) 対象リポジトリが許可リスト外でも実行されてしまう(任意リポジトリへの
//       Agent起動という権限昇格になりうる)
//   (4) 入力チェックを通過したのに、実際のAPI呼び出し結果をD1へ記録しない
//   (5) 他ユーザーの起動履歴が見えてしまう
//   (6) Cursor API呼び出し自体が失敗した場合に握りつぶし、D1に不正な記録を残す
//   (7) cursor_agent_launch_logテーブル未作成(migration未実行)等でD1書き込みが
//       失敗した場合、Cursor Agent自体は起動成功しているのに例外を握りつぶさず
//       500(app.onErrorの「サーバーエラーが発生しました」)を返してしまう
//       (起動自体は成功しているので、ログ記録の失敗だけでユーザーに失敗と
//       見せてはいけない。ルール8: 記録・通知の義務を果たしつつ処理を続行する)

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub: string) {
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
    CREATE TABLE cursor_agent_launch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      repo_full_name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      agent_id TEXT,
      cursor_response TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      revoked_at TEXT,
      last_activity_at TEXT
    );
  `);
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('other-user');
  return db;
}

const ALLOWED_REPO = 'nekoserver/cloudflare-workers-github-oauth-1';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /cursor-agent', () => {
  it('ログイン済みならページを返す', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Cursor Agent');
  });
});

describe('POST /api/cursor-agent/launch', () => {
  it('CURSOR_API_KEY未設定なら400を返し、Cursor APIを呼ばない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('CURSOR_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('プロンプトが1文字以下なら400を返し、Cursor APIを呼ばない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'A', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('対象リポジトリが許可リスト外なら400を返し、Cursor APIを呼ばない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: 'someone/unknown-repo' }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('全条件を満たせばCursor APIを呼び、成功結果をD1へ保存する', async () => {
    const cursorApiResponse = { id: 'bc_123', status: 'CREATING' };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(cursorApiResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(200);
    const data = await res.json() as { cursorResponse: unknown; historySaved: boolean };
    expect(data.cursorResponse).toEqual(cursorApiResponse);
    expect(data.historySaved).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cursor.com/v1/agents');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Basic ' + btoa('key_test:'));
    const body = JSON.parse(init.body as string);
    expect(body.repos[0].url).toBe('https://github.com/' + ALLOWED_REPO);

    const row = db.prepare('SELECT user_id, repo_full_name, prompt, agent_id, cursor_response FROM cursor_agent_launch_log WHERE user_id = ?').get('user1') as
      { user_id: string; repo_full_name: string; prompt: string; agent_id: string | null; cursor_response: string };
    expect(row.user_id).toBe('user1');
    expect(row.repo_full_name).toBe(ALLOWED_REPO);
    expect(row.prompt).toBe('READMEを直して');
    expect(row.agent_id).toBe('bc_123');
    expect(JSON.parse(row.cursor_response)).toEqual(cursorApiResponse);
  });

  it('Cursor APIがエラーを返した場合はD1に記録せずエラーを返す(握りつぶさない)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(502);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('401');

    const row = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_launch_log').get() as { c: number };
    expect(row.c).toBe(0);
  });

  it('D1への記録が失敗して(cursor_agent_launch_log未作成等)も、Agent起動自体は成功として返す(500にしない)', async () => {
    const cursorApiResponse = { id: 'bc_999', status: 'CREATING' };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(cursorApiResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    // migration未実行を模した状況: cursor_agent_launch_logテーブルを作らないDB
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE user_sessions (user_id TEXT PRIMARY KEY, revoked_at TEXT, last_activity_at TEXT);`);
    db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(200);
    const data = await res.json() as { cursorResponse: unknown; historySaved: boolean };
    expect(data.cursorResponse).toEqual(cursorApiResponse);
    expect(data.historySaved).toBe(false);
  });
});

describe('GET /api/cursor-agent/history', () => {
  it('自分の起動履歴のみを新しい順で返す(他ユーザーの履歴は含めない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '1つ目', 'bc_1', '{"id":"bc_1"}', '2026-09-13 00:00:00');
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '2つ目', 'bc_2', '{"id":"bc_2"}', '2026-09-13 01:00:00');
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('other-user', ALLOWED_REPO, '他人の起動', 'bc_3', '{"id":"bc_3"}', '2026-09-13 02:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ prompt: string }> };
    expect(data.rows.map((r) => r.prompt)).toEqual(['2つ目', '1つ目']);
  });

  it('DB未設定でも例外にならず空配列を返す', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: unknown[] };
    expect(data.rows).toEqual([]);
  });
});
