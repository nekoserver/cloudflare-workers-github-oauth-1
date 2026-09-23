/**
 * 対象: /api/aichat/keyword-boundary/sync, /unknown, /toggle エンドポイント
 * (src/index.ts、実体はsrc/utils/jevKeywordBoundary.ts)。
 *
 * 「ある問いから得られた回答に自分の知らないキーワードが含まれていたら
 * 次回の探索時はその境界線を意識しながら問い進める」機能のHTTP層。
 * jevKeywordBoundary.test.tsが純粋関数レベルの単体テストなのに対し、
 * こちらはHono appを通した統合テスト(認証・DB結線・JSONレスポンス形状)
 * を保証する。
 *
 * 故障シナリオ:
 *   (1) syncがaichat_answer_keyword_vectorsではなく別テーブルを見てしまい、
 *       ベクタ化済みのはずのキーワードが0件になる
 *   (2) toggleでknownを省略・非booleanで送っても200を返してしまう
 *   (3) unknownの一覧に他ユーザーのキーワードが混ざる
 *   (4) DBエラー時に汎用500メッセージへ丸められ原因が追えなくなる
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

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
        async run(): Promise<{ meta: { changes: number } }> {
          const res = stmt.run(...(args as never[]));
          return { meta: { changes: Number(res.changes) } };
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
      last_activity_at TEXT,
      revoked_at TEXT,
      idle_timeout_seconds INTEGER
    );
    CREATE TABLE aichat_answer_keyword_vectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      model TEXT NOT NULL,
      dim INTEGER NOT NULL,
      vector BLOB NOT NULL,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE jev_keyword_boundary_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE jev_keyword_boundary_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      user_id TEXT NOT NULL,
      jev_keyword_boundary_label_id INTEGER NOT NULL,
      value REAL NOT NULL,
      source_share_id TEXT,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX idx_jev_keyword_boundary_evaluations_unique
      ON jev_keyword_boundary_evaluations(user_id, keyword, jev_keyword_boundary_label_id);
  `);
  db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('test-user', datetime('now'), NULL)`).run();
  db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('other-user', datetime('now'), NULL)`).run();
  db.prepare(
    `INSERT INTO jev_keyword_boundary_labels (question_text, options_json) VALUES ('このキーワードをユーザーは理解済みですか?', '["未理解","理解済み"]')`
  ).run();
  return db;
}

function insertAnswerKeyword(db: DatabaseSync, args: { shareId: string; userId: string; keyword: string }) {
  db.prepare(
    `INSERT INTO aichat_answer_keyword_vectors (share_id, user_id, keyword, model, dim, vector) VALUES (?, ?, ?, 'plamo-embedding-1b', 1, x'00')`
  ).run(args.shareId, args.userId, args.keyword);
}

async function requestApi(db: DatabaseSync, path: string, init: RequestInit, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request(
    path,
    { ...init, headers: { ...init.headers, Authorization: authHeader } },
    { JWT_SECRET, DB: wrapD1(db) }
  );
}

describe('POST /api/aichat/keyword-boundary/sync', () => {
  it('shareIdに紐づくベクタ化済みキーワードを未理解として登録し、statusを返す', async () => {
    const db = setupDb();
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'Worker' });
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'D1' });

    const res = await requestApi(db, '/api/aichat/keyword-boundary/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { shareId: string; entries: { keyword: string; status: string }[] };
    expect(body.shareId).toBe('s1');
    expect(body.entries.sort((a, b) => a.keyword.localeCompare(b.keyword))).toEqual([
      { keyword: 'D1', status: 'unknown' },
      { keyword: 'Worker', status: 'unknown' },
    ]);
  });

  it('shareId未指定は400', async () => {
    const db = setupDb();
    const res = await requestApi(db, '/api/aichat/keyword-boundary/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('既にtoggleでknownにしたキーワードはsyncで巻き戻らない', async () => {
    const db = setupDb();
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'Worker' });
    await requestApi(db, '/api/aichat/keyword-boundary/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'Worker', known: true }),
    });

    const res = await requestApi(db, '/api/aichat/keyword-boundary/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1' }),
    });
    const body = (await res.json()) as { entries: { keyword: string; status: string }[] };
    expect(body.entries).toEqual([{ keyword: 'Worker', status: 'known' }]);
  });
});

describe('POST /api/aichat/keyword-boundary/toggle', () => {
  it('known:trueで理解済みに切り替わる', async () => {
    const db = setupDb();
    const res = await requestApi(db, '/api/aichat/keyword-boundary/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'Worker', known: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: { keyword: string; status: string } };
    expect(body.entry).toEqual({ keyword: 'Worker', status: 'known' });
  });

  it('keywordが空、またはknownが非booleanなら400', async () => {
    const db = setupDb();
    const missingKeyword = await requestApi(db, '/api/aichat/keyword-boundary/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ known: true }),
    });
    expect(missingKeyword.status).toBe(400);

    const missingKnown = await requestApi(db, '/api/aichat/keyword-boundary/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'Worker' }),
    });
    expect(missingKnown.status).toBe(400);
  });
});

describe('GET /api/aichat/keyword-boundary/unknown', () => {
  it('未理解のキーワードだけを返し、他ユーザーの行は混ざらない', async () => {
    const db = setupDb();
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'Worker' });
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'D1' });
    insertAnswerKeyword(db, { shareId: 's2', userId: 'other-user', keyword: 'KV' });

    await requestApi(db, '/api/aichat/keyword-boundary/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1' }),
    });
    await requestApi(
      db,
      '/api/aichat/keyword-boundary/sync',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareId: 's2' }) },
      'other-user'
    );
    await requestApi(db, '/api/aichat/keyword-boundary/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'Worker', known: true }),
    });

    const res = await requestApi(db, '/api/aichat/keyword-boundary/unknown', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { keywords: { keyword: string }[] };
    expect(body.keywords.map((k) => k.keyword)).toEqual(['D1']);
  });
});

describe('マイグレーション未適用時のエラー透過', () => {
  it('jev_keyword_boundary_labelsが無い場合、汎用500ではなく実際の理由を含むエラーを返す', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE user_sessions (
        user_id TEXT PRIMARY KEY, last_activity_at TEXT, revoked_at TEXT, idle_timeout_seconds INTEGER
      );
      CREATE TABLE aichat_answer_keyword_vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT, share_id TEXT NOT NULL, user_id TEXT NOT NULL,
        keyword TEXT NOT NULL, model TEXT NOT NULL, dim INTEGER NOT NULL, vector BLOB NOT NULL,
        computed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('test-user', datetime('now'), NULL)`).run();
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'Worker' });

    const res = await requestApi(db, '/api/aichat/keyword-boundary/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId: 's1' }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('jev_keyword_boundary_labels');
  });
});
