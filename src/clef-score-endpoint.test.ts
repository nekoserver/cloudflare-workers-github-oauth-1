/**
 * POST /api/aichat/clef-score のテスト
 *
 * 対象: thread-tracker等に設置予定の「Clefでの評価を追加」ボタン用の内部API
 * (cookieセッション認証)。表示中の回答バブルの回答文をClef(Workers AI
 * 決定モデル)の全ラベルで評価させ、clef_evaluations(jev_evaluationsとは
 * 別テーブル、migrations/0171)へ書き込んだ後、書き込み内容を再読み込みして
 * 検証(ベリファイ)する。/api/aichat/jev-score(既存)とは完全に独立した
 * 経路で、PLAN.cloudflare-workers-github-oauth-1.20261011.judgment-models.md
 * のステップ③にあたる。
 *
 * 故障シナリオ:
 *   (1) 未認証で叩けてしまう
 *   (2) shareId/model未指定で500になる(400を返すべき)
 *   (3) 他ユーザーのai_chat_sharesを読めてしまう(user_idで絞り込まれていない)
 *   (4) 既に評価済みのラベルもClefへ再送してしまう(重複呼び出し・重複行)
 *   (5) Clef呼び出し失敗時にエラーが記録されず、空の成功扱いになってしまう
 *   (6) 書き込みSQLの成功reportだけを信用し、実際にDBへ反映されたかを
 *       確認しない(ベリファイ省略)
 *   (7) AIバインディング未設定時にフェイルオープンする
 *   (8) jev_evaluations(既存のJevスコア)に書き込んでしまう(混ざってしまう)
 */
import { describe, it, expect, vi } from 'vitest';
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
    CREATE TABLE clef_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      share_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT,
      jev_label_id INTEGER NOT NULL,
      clef_model TEXT NOT NULL,
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

function insertClefEvaluation(db: DatabaseSync, args: { shareId: string; userId: string; model: string; clefModel: string; labelId: number; value: number }): void {
  db.prepare(
    `INSERT INTO clef_evaluations (target_type, share_id, user_id, model, jev_label_id, clef_model, value) VALUES ('answer', ?, ?, ?, ?, ?, ?)`
  ).run(args.shareId, args.userId, args.model, args.labelId, args.clefModel, args.value);
}

async function postClefScore(db: DatabaseSync, body: Record<string, unknown>, envOverrides: Record<string, unknown> = {}, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request(
    '/api/aichat/clef-score',
    { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { JWT_SECRET, DB: wrapD1(db), AI: { run: vi.fn().mockResolvedValue({ answers: {} }) }, ...envOverrides }
  );
}

describe('POST /api/aichat/clef-score', () => {
  it('未認証では401になる', async () => {
    const db = setupDb();
    const res = await app.request(
      '/api/aichat/clef-score',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareId: 'share-1', model: 'm' }) },
      { JWT_SECRET, DB: wrapD1(db), AI: { run: vi.fn() } }
    );
    expect(res.status).toBe(401);
  });

  it('shareId未指定は400になる', async () => {
    const db = setupDb();
    const res = await postClefScore(db, { model: 'm' });
    expect(res.status).toBe(400);
  });

  it('model未指定は400になる', async () => {
    const db = setupDb();
    const res = await postClefScore(db, { shareId: 'share-1' });
    expect(res.status).toBe(400);
  });

  it('AIバインディング未設定時は503を返す(フェイルオープンしない)', async () => {
    const db = setupDb();
    const res = await postClefScore(db, { shareId: 'share-1', model: 'm' }, { AI: undefined });
    expect(res.status).toBe(503);
  });

  it('他ユーザーのshareId(自分のuser_idに存在しない)は404になる', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'other-user', '質問', '回答', 'model-x');
    const res = await postClefScore(db, { shareId: 'share-1', model: 'model-x' }, {}, 'test-user');
    expect(res.status).toBe(404);
  });

  it('未評価ラベルだけClefへ送り、既評価ラベルは再送しない。書き込み後ベリファイして成功を返す', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'test-user', '質問', '回答文です', 'model-x');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);
    insertClefEvaluation(db, { shareId: 'share-1', userId: 'test-user', model: 'model-x', clefModel: '@cf/cloudflare/clef-flash', labelId: 1, value: 0.9 });

    const run = vi.fn().mockResolvedValue({ answers: { '2': { type: 'score', score: 0.42 } } });
    const res = await postClefScore(db, { shareId: 'share-1', model: 'model-x' }, { AI: { run } });
    expect(res.status).toBe(200);
    const resBody = (await res.json()) as { verified: boolean; state: string; values: { jevLabelId: number; value: number | null }[] };
    expect(resBody.verified).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    const [, input] = run.mock.calls[0];
    expect(input.state).toBe('回答文です');
    expect(Object.keys(input.questions)).toEqual(['2']);
    expect(resBody.state).toBe('green');
    expect(resBody.values.find((v) => v.jevLabelId === 1)?.value).toBeCloseTo(0.9);
    expect(resBody.values.find((v) => v.jevLabelId === 2)?.value).toBeCloseTo(0.42);

    const saved = db.prepare('SELECT jev_label_id, value FROM clef_evaluations WHERE share_id = ? AND jev_label_id = 2').get('share-1') as { jev_label_id: number; value: number };
    expect(saved.value).toBeCloseTo(0.42);
  });

  it('全ラベル評価済みならClefを一切呼ばずキャッシュ済みの結果だけを返す', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'test-user', '質問', '回答文です', 'model-x');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);
    insertClefEvaluation(db, { shareId: 'share-1', userId: 'test-user', model: 'model-x', clefModel: '@cf/cloudflare/clef-flash', labelId: 1, value: 0.7 });

    const run = vi.fn();
    const res = await postClefScore(db, { shareId: 'share-1', model: 'model-x' }, { AI: { run } });
    expect(res.status).toBe(200);
    expect(run).not.toHaveBeenCalled();
    const resBody = (await res.json()) as { verified: boolean };
    expect(resBody.verified).toBe(true);
  });

  it('Clef呼び出し失敗時は502を返し、clef_evaluationsに何も書き込まない', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'test-user', '質問', '回答文です', 'model-x');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);

    const run = vi.fn().mockRejectedValue(new Error('binding unavailable'));
    const res = await postClefScore(db, { shareId: 'share-1', model: 'model-x' }, { AI: { run } });
    expect(res.status).toBe(502);
    const count = db.prepare('SELECT COUNT(*) as c FROM clef_evaluations WHERE share_id = ?').get('share-1') as { c: number };
    expect(count.c).toBe(0);
  });

  it('レスポンスに一部ラベルの結果が欠けている場合、書き込まれなかったラベルはベリファイ失敗として検出する', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'test-user', '質問', '回答文です', 'model-x');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);

    const run = vi.fn().mockResolvedValue({ answers: { '1': { score: 0.5 } } });
    const res = await postClefScore(db, { shareId: 'share-1', model: 'model-x' }, { AI: { run } });
    expect(res.status).toBe(502);
    const count = db.prepare('SELECT COUNT(*) as c FROM clef_evaluations WHERE share_id = ?').get('share-1') as { c: number };
    expect(count.c).toBe(0);
  });

  it('jev_evaluations(既存のJevスコア)には一切書き込まない', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'test-user', '質問', '回答文です', 'model-x');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);
    const run = vi.fn().mockResolvedValue({ answers: { '1': { score: 0.5 } } });
    const res = await postClefScore(db, { shareId: 'share-1', model: 'model-x' }, { AI: { run } });
    expect(res.status).toBe(200);
    const count = db.prepare('SELECT COUNT(*) as c FROM jev_evaluations').get() as { c: number };
    expect(count.c).toBe(0);
  });
});
