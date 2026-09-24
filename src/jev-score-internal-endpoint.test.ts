/**
 * POST /api/aichat/jev-score のテスト
 *
 * 対象: AIチャットの詳細プレビューモーダル(historyModal)の📔ボタンがピンク状態
 * (通常のjevテーブルにこの質問+モデルの評価データが1件も無い)のときの
 * 「追加しますか」確認後に呼ばれる内部API(cookieセッション認証)。
 * 表示中の回答バブルの回答文をJevの全ラベルで評価させ、jev_evaluationsへ
 * 書き込んだ後、書き込み内容を再読み込みして検証(ベリファイ)する。
 *
 * 故障シナリオ:
 *   (1) 未認証で叩けてしまう
 *   (2) shareId/model未指定で500になる(400を返すべき)
 *   (3) 他ユーザーのai_chat_sharesを読めてしまう(user_idで絞り込まれていない)
 *   (4) 既に評価済みのラベルもJevへ再送してしまう(重複課金・重複行)
 *   (5) Jev API呼び出し失敗時にエラーが記録されず、空の成功扱いになってしまう
 *   (6) 書き込みSQLの成功reportだけを信用し、実際にDBへ反映されたかを
 *       確認しない(ベリファイ省略)
 *   (7) JEV_API_KEY未設定時にフェイルオープンする
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
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_hash TEXT NOT NULL DEFAULT '',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT,
      created_at TEXT NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0,
      question_hash TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      image_data_url TEXT,
      image_id TEXT,
      deleted_at TEXT
    );
    CREATE TABLE aichat_images (id TEXT PRIMARY KEY, image_data_url TEXT);
    CREATE TABLE jev_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT,
      jev_group_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE jev_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      share_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT,
      jev_label_id INTEGER NOT NULL,
      value REAL NOT NULL,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('test-user', datetime('now'), NULL)`).run();
  db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('other-user', datetime('now'), NULL)`).run();
  return db;
}

function insertShare(db: DatabaseSync, id: string, userId: string, question: string, answer: string, model: string): void {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, userId, question, answer, model);
}

function insertLabels(db: DatabaseSync, labels: { id: number; text: string; optionsJson?: string | null }[]): void {
  for (const label of labels) {
    db.prepare(`INSERT INTO jev_labels (id, question_type, question_text, options_json) VALUES (?, 'score', ?, ?)`).run(
      label.id,
      label.text,
      label.optionsJson === undefined ? JSON.stringify(['悪い状態', '良い状態']) : label.optionsJson
    );
  }
}

function insertEvaluation(db: DatabaseSync, args: { shareId: string; userId: string; model: string; labelId: number; value: number }): void {
  db.prepare(
    `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', ?, ?, ?, ?, ?)`
  ).run(args.shareId, args.userId, args.model, args.labelId, args.value);
}

async function postJevScore(db: DatabaseSync, body: Record<string, unknown>, envOverrides: Record<string, unknown> = {}, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request(
    '/api/aichat/jev-score',
    { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { JWT_SECRET, JEV_API_KEY: JEV_KEY, DB: wrapD1(db), ...envOverrides }
  );
}

describe('POST /api/aichat/jev-score', () => {
  it('未認証では401になる', async () => {
    const db = setupDb();
    const res = await app.request(
      '/api/aichat/jev-score',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareId: 'share-1', model: 'm' }) },
      { JWT_SECRET, JEV_API_KEY: JEV_KEY, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('shareId未指定は400になる', async () => {
    const db = setupDb();
    const res = await postJevScore(db, { model: 'm' });
    expect(res.status).toBe(400);
  });

  it('model未指定は400になる', async () => {
    const db = setupDb();
    const res = await postJevScore(db, { shareId: 'share-1' });
    expect(res.status).toBe(400);
  });

  it('JEV_API_KEY未設定時は503を返す(フェイルオープンしない)', async () => {
    const db = setupDb();
    const res = await postJevScore(db, { shareId: 'share-1', model: 'm' }, { JEV_API_KEY: undefined });
    expect(res.status).toBe(503);
  });

  it('他ユーザーのshareId(自分のuser_idに存在しない)は404になる', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'other-user', '質問', '回答', 'model-x');
    const res = await postJevScore(db, { shareId: 'share-1', model: 'model-x' }, {}, 'test-user');
    expect(res.status).toBe(404);
  });

  it('未評価ラベルだけJevへ送り、既評価ラベルは再送しない。書き込み後ベリファイして成功を返す', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'test-user', '質問', '回答文です', 'model-x');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);
    insertEvaluation(db, { shareId: 'share-1', userId: 'test-user', model: 'model-x', labelId: 1, value: 0.9 });

    let requestedLabelIds: string[] = [];
    let requestedState = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body));
      requestedState = parsed.state;
      requestedLabelIds = Object.keys(parsed.questions);
      return new Response(JSON.stringify({ answers: { '2': 0.42 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const res = await postJevScore(db, { shareId: 'share-1', model: 'model-x' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { verified: boolean; state: string; values: { jevLabelId: number; value: number | null }[] };
      expect(body.verified).toBe(true);
      expect(requestedState).toBe('回答文です');
      expect(requestedLabelIds).toEqual(['2']);
      expect(body.state).toBe('green');
      expect(body.values.find((v) => v.jevLabelId === 1)?.value).toBeCloseTo(0.9);
      expect(body.values.find((v) => v.jevLabelId === 2)?.value).toBeCloseTo(0.42);

      const saved = db.prepare('SELECT jev_label_id, value FROM jev_evaluations WHERE share_id = ? AND jev_label_id = 2').get('share-1') as { jev_label_id: number; value: number };
      expect(saved.value).toBeCloseTo(0.42);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('全ラベル評価済みならJevを一切呼ばずキャッシュ済みの結果だけを返す', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'test-user', '質問', '回答文です', 'model-x');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);
    insertEvaluation(db, { shareId: 'share-1', userId: 'test-user', model: 'model-x', labelId: 1, value: 0.7 });

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ answers: {} }), { status: 200 });
    }) as typeof fetch;
    try {
      const res = await postJevScore(db, { shareId: 'share-1', model: 'model-x' });
      expect(res.status).toBe(200);
      expect(fetchCalled).toBe(false);
      const body = (await res.json()) as { verified: boolean };
      expect(body.verified).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Jev API呼び出し失敗時は502を返し、jev_evaluationsに何も書き込まない', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'test-user', '質問', '回答文です', 'model-x');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('internal error', { status: 500 })) as typeof fetch;
    try {
      const res = await postJevScore(db, { shareId: 'share-1', model: 'model-x' });
      expect(res.status).toBe(502);
      const count = db.prepare('SELECT COUNT(*) as c FROM jev_evaluations WHERE share_id = ?').get('share-1') as { c: number };
      expect(count.c).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('レスポンスに一部ラベルの結果が欠けている場合、書き込まれなかったラベルはベリファイ失敗として検出する', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'test-user', '質問', '回答文です', 'model-x');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      // ラベル2の結果を欠落させたレスポンス(parseJevApiResponseが
      // unexpected_shapeとしてエラーを返すケース)。
      return new Response(JSON.stringify({ answers: { '1': 0.5 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const res = await postJevScore(db, { shareId: 'share-1', model: 'model-x' });
      expect(res.status).toBe(502);
      const count = db.prepare('SELECT COUNT(*) as c FROM jev_evaluations WHERE share_id = ?').get('share-1') as { c: number };
      expect(count.c).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
