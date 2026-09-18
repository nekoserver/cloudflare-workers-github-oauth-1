/**
 * POST /api/aichat/jev-score-keyword のテスト
 *
 * 対象: jev_country_keyword_labels/jev_country_keyword_evaluations
 * (migrations/0145、keyword文字列で引く国名専用のJev評価結果)への
 * 書き込みエンドポイント。/neko jの0件表示からは自動で呼ばれない、
 * 明示的に叩いたときだけキーワードをJevへ評価させてDBへ書き込む。
 *
 * 故障シナリオ:
 *   (1) 未認証で叩けてしまう
 *   (2) keyword未指定で500になる(400を返すべき)
 *   (3) 他ユーザーのjev_country_keyword_evaluationsが混ざる
 *   (4) 既に評価済みのラベルもJevへ再送してしまう
 *   (5) JEV_API_KEY未設定時にフェイルオープンする
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';
const JEV_KEY = 'test-jev-key';

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
    CREATE TABLE jev_country_keyword_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL
    );
    CREATE TABLE jev_country_keyword_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      user_id TEXT NOT NULL,
      jev_country_keyword_label_id INTEGER NOT NULL,
      value REAL NOT NULL,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('test-user', datetime('now'), NULL)`).run();
  return db;
}

function insertLabels(db: DatabaseSync, labels: { id: number; text: string }[]): void {
  for (const label of labels) {
    db.prepare(`INSERT INTO jev_country_keyword_labels (id, question_text, options_json) VALUES (?, ?, ?)`).run(
      label.id,
      label.text,
      JSON.stringify(['悪い状態', '良い状態'])
    );
  }
}

async function postJevScoreKeyword(db: DatabaseSync, body: Record<string, unknown>, envOverrides: Record<string, unknown> = {}, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request(
    '/api/aichat/jev-score-keyword',
    { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { JWT_SECRET, JEV_API_KEY: JEV_KEY, DB: wrapD1(db), ...envOverrides }
  );
}

describe('POST /api/aichat/jev-score-keyword', () => {
  it('未認証では401になる', async () => {
    const db = setupDb();
    const res = await app.request(
      '/api/aichat/jev-score-keyword',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: 'フランス' }) },
      { JWT_SECRET, JEV_API_KEY: JEV_KEY, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('keyword未指定は400になる', async () => {
    const db = setupDb();
    const res = await postJevScoreKeyword(db, {});
    expect(res.status).toBe(400);
  });

  it('JEV_API_KEY未設定時は503を返す(フェイルオープンしない)', async () => {
    const db = setupDb();
    const res = await postJevScoreKeyword(db, { keyword: 'フランス' }, { JEV_API_KEY: undefined });
    expect(res.status).toBe(503);
  });

  it('未評価ラベルだけJevへ送り、書き込み後ベリファイして成功を返す', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ビザが必要か' }, { id: 2, text: '英語が通じるか' }]);
    db.prepare(
      `INSERT INTO jev_country_keyword_evaluations (keyword, user_id, jev_country_keyword_label_id, value) VALUES ('フランス', 'test-user', 1, 0.9)`
    ).run();

    let requestedLabelIds: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body));
      requestedLabelIds = Object.keys(parsed.questions);
      return new Response(JSON.stringify({ answers: { '2': 0.7 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const res = await postJevScoreKeyword(db, { keyword: 'フランス' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { verified: boolean; results: { labelId: number; value: number | null }[] };
      expect(body.verified).toBe(true);
      expect(requestedLabelIds).toEqual(['2']);
      expect(body.results.find((r) => r.labelId === 1)?.value).toBeCloseTo(0.9);
      expect(body.results.find((r) => r.labelId === 2)?.value).toBeCloseTo(0.7);

      const saved = db.prepare('SELECT value FROM jev_country_keyword_evaluations WHERE keyword = ? AND jev_country_keyword_label_id = 2').get('フランス') as { value: number };
      expect(saved.value).toBeCloseTo(0.7);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('他ユーザーのuser_idでは既存の評価が見えず、再度Jevへ送られる(user_idで絞り込まれる)', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('other-user', datetime('now'), NULL)`).run();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);
    db.prepare(
      `INSERT INTO jev_country_keyword_evaluations (keyword, user_id, jev_country_keyword_label_id, value) VALUES ('フランス', 'other-user', 1, 0.1)`
    ).run();

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ answers: { '1': 0.5 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const res = await postJevScoreKeyword(db, { keyword: 'フランス' }, {}, 'test-user');
      expect(res.status).toBe(200);
      expect(fetchCalled).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Jev API呼び出し失敗時は502を返し、何も書き込まない', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('internal error', { status: 500 })) as typeof fetch;
    try {
      const res = await postJevScoreKeyword(db, { keyword: 'フランス' });
      expect(res.status).toBe(502);
      const count = db.prepare('SELECT COUNT(*) as c FROM jev_country_keyword_evaluations').get() as { c: number };
      expect(count.c).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
