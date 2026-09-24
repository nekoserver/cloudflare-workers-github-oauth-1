/**
 * 対象: GET /api/aichat/keyword-boundary/unknown エンドポイント
 * (src/index.ts、実体はlistUnclassifiedAnswerKeywords)。
 *
 * 「ある問いから得られた回答に自分の知らないキーワードが含まれていたら
 * 次回の探索時はその境界線を意識しながら問い進める」機能。当初は
 * ユーザーの自己申告(「理解済みですか?」)を根拠にしていたが、根拠が
 * 曖昧という指摘を受け、既存のキーワード分類(aichat_keyword_category_map。
 * /answer-graphで実際に分類したかどうか)を根拠にする方式へ置き換えた。
 *
 * 故障シナリオ:
 *   (1) 分類済み(aichat_keyword_category_mapに行がある)キーワードまで
 *       「まだ理解していない」扱いにしてしまう
 *   (2) 他ユーザーの分類状況やキーワードが混ざる
 *   (3) ベクタ化されていない(aichat_answer_keyword_vectorsに無い)
 *       キーワードまで一覧に出てしまう
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
    CREATE TABLE aichat_keyword_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE aichat_keyword_category_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      category_id INTEGER NOT NULL
    );
  `);
  db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('test-user', datetime('now'), NULL)`).run();
  db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('other-user', datetime('now'), NULL)`).run();
  return db;
}

function insertAnswerKeyword(db: DatabaseSync, args: { shareId: string; userId: string; keyword: string; computedAt?: string }) {
  db.prepare(
    `INSERT INTO aichat_answer_keyword_vectors (share_id, user_id, keyword, model, dim, vector, computed_at) VALUES (?, ?, ?, 'plamo-embedding-1b', 1, x'00', ?)`
  ).run(args.shareId, args.userId, args.keyword, args.computedAt ?? new Date().toISOString());
}

function classifyKeyword(db: DatabaseSync, args: { userId: string; keyword: string }) {
  db.prepare(`INSERT INTO aichat_keyword_categories (user_id, name) VALUES (?, 'cat')`).run(args.userId);
  const categoryId = (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
  db.prepare(`INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id) VALUES (?, ?, ?)`).run(args.userId, args.keyword, categoryId);
}

async function requestApi(db: DatabaseSync, path: string, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request(path, { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: wrapD1(db) });
}

describe('GET /api/aichat/keyword-boundary/unknown', () => {
  it('分類済みのキーワードは除外し、未分類のキーワードだけを返す', async () => {
    const db = setupDb();
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'Worker' });
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'D1' });
    classifyKeyword(db, { userId: 'test-user', keyword: 'Worker' });

    const res = await requestApi(db, '/api/aichat/keyword-boundary/unknown');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { keywords: { keyword: string }[] };
    expect(body.keywords.map((k) => k.keyword)).toEqual(['D1']);
  });

  it('他ユーザーの分類状況・キーワードは混ざらない', async () => {
    const db = setupDb();
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'Worker' });
    insertAnswerKeyword(db, { shareId: 's2', userId: 'other-user', keyword: 'KV' });
    // 他ユーザーが同じキーワードを分類済みでも、自分側は未分類のまま扱う。
    insertAnswerKeyword(db, { shareId: 's3', userId: 'other-user', keyword: 'Worker' });
    classifyKeyword(db, { userId: 'other-user', keyword: 'Worker' });

    const res = await requestApi(db, '/api/aichat/keyword-boundary/unknown');
    const body = (await res.json()) as { keywords: { keyword: string }[] };
    expect(body.keywords.map((k) => k.keyword)).toEqual(['Worker']);
  });

  it('抽出(computed_at)が新しい順に並ぶ', async () => {
    const db = setupDb();
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'A', computedAt: '2026-01-01T00:00:00.000Z' });
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'B', computedAt: '2026-01-03T00:00:00.000Z' });
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'C', computedAt: '2026-01-02T00:00:00.000Z' });

    const res = await requestApi(db, '/api/aichat/keyword-boundary/unknown');
    const body = (await res.json()) as { keywords: { keyword: string }[] };
    expect(body.keywords.map((k) => k.keyword)).toEqual(['B', 'C', 'A']);
  });

  it('limitクエリで件数を絞れる(既定50、最大200)', async () => {
    const db = setupDb();
    for (let i = 0; i < 5; i++) {
      insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'kw' + i });
    }
    const res = await requestApi(db, '/api/aichat/keyword-boundary/unknown?limit=2');
    const body = (await res.json()) as { keywords: { keyword: string }[] };
    expect(body.keywords).toHaveLength(2);
  });

  it('DBエラー時は汎用500ではなく実際のエラーメッセージを返す', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE user_sessions (user_id TEXT PRIMARY KEY, last_activity_at TEXT, revoked_at TEXT, idle_timeout_seconds INTEGER);`);
    db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('test-user', datetime('now'), NULL)`).run();

    const res = await requestApi(db, '/api/aichat/keyword-boundary/unknown');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
    expect(body.error).not.toBe('サーバーエラーが発生しました');
  });
});

describe('GET /api/aichat/keyword-boundary/stats', () => {
  it('分類済み・未分類のキーワード数(重複除去)を返す', async () => {
    const db = setupDb();
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'Worker' });
    insertAnswerKeyword(db, { shareId: 's2', userId: 'test-user', keyword: 'Worker' }); // 別share・同キーワードは重複カウントしない
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'D1' });
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'KV' });
    classifyKeyword(db, { userId: 'test-user', keyword: 'Worker' });

    const res = await requestApi(db, '/api/aichat/keyword-boundary/stats');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { classifiedCount: number; unclassifiedCount: number };
    expect(body).toEqual({ classifiedCount: 1, unclassifiedCount: 2 });
  });

  it('キーワードが1件も無ければ両方0', async () => {
    const db = setupDb();
    const res = await requestApi(db, '/api/aichat/keyword-boundary/stats');
    const body = (await res.json()) as { classifiedCount: number; unclassifiedCount: number };
    expect(body).toEqual({ classifiedCount: 0, unclassifiedCount: 0 });
  });

  it('他ユーザーのキーワード・分類状況は集計に混ざらない', async () => {
    const db = setupDb();
    insertAnswerKeyword(db, { shareId: 's1', userId: 'test-user', keyword: 'Worker' });
    insertAnswerKeyword(db, { shareId: 's2', userId: 'other-user', keyword: 'KV' });
    classifyKeyword(db, { userId: 'other-user', keyword: 'KV' });

    const res = await requestApi(db, '/api/aichat/keyword-boundary/stats');
    const body = (await res.json()) as { classifiedCount: number; unclassifiedCount: number };
    expect(body).toEqual({ classifiedCount: 0, unclassifiedCount: 1 });
  });
});
