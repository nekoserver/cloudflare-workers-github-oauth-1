/**
 * POST /api/aichat/jev-stats-external のテスト
 *
 * 対象: dynamicnekoの/ai-cacheページ向けJev分析ダッシュボード集計API。
 * (1)過去回答文の全登録件数とJev分析済み件数、(2)モデル別の分析済み件数・
 * 平均score、(3)ラベル(分析観点)別の平均scoreをスコア順に返す。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1集計まで到達してしまう
 *   (3) リクエスト本文のloginをそのままuser_idとして信用してしまう
 *       (他エンドポイントで発覚した脆弱性と同じ穴)
 *   (4) 他ユーザーの登録件数・分析件数が混入してしまう
 *   (5) 1ラベルでも評価済みならshare_id単位で「分析済み」1件として数える
 *       はずが、ラベル数(20件)ぶん重複カウントしてしまう
 *   (6) DB未設定時にフェイルオープンする
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';

const SECRET = 'test-aichat-external-secret';

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
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(allowedUsers: Record<string, string>): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE dynamicneko_aichat_allowed_users (email TEXT PRIMARY KEY, github_login TEXT);
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
      image_data_url TEXT,
      image_id TEXT,
      deleted_at TEXT
    );
    CREATE TABLE jev_label_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE jev_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT,
      jev_group_id INTEGER NOT NULL,
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
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

function insertShare(db: DatabaseSync, id: string, userId: string, model = '@cf/google/gemma-4-26b-a4b-it'): void {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES (?, ?, 'q', 'a', ?, datetime('now'))`
  ).run(id, userId, model);
}

function insertLabel(db: DatabaseSync, id: number, text: string): void {
  db.prepare(`INSERT OR IGNORE INTO jev_label_groups (id, name) VALUES (1, 'テストグループ')`).run();
  db.prepare(`INSERT INTO jev_labels (id, question_type, question_text, options_json, jev_group_id) VALUES (?, 'score', ?, '["a","b"]', 1)`).run(id, text);
}

function insertEvaluation(db: DatabaseSync, args: { shareId: string; userId: string; model: string; labelId: number; value: number }): void {
  db.prepare(
    `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', ?, ?, ?, ?, ?)`
  ).run(args.shareId, args.userId, args.model, args.labelId, args.value);
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET };

async function postStats(db: DatabaseSync, email: string): Promise<Response> {
  return app.request(
    '/api/aichat/jev-stats-external',
    { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) },
    { ...BASE_ENV, DB: wrapD1(db) }
  );
}

describe('POST /api/aichat/jev-stats-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/jev-stats-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postStats(db, 'ng@example.com');
    expect(res.status).toBe(403);
  });

  it('登録件数と分析済み件数を正しく数える(1件のshare_idに複数ラベルの評価があっても分析済み1件)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'gemma-4-26b-a4b-it');
    insertShare(db, 'share-2', 'nekoserver', 'gemma-4-26b-a4b-it');
    insertLabel(db, 1, 'ラベル1');
    insertLabel(db, 2, 'ラベル2');
    insertEvaluation(db, { shareId: 'share-1', userId: 'nekoserver', model: 'gemma-4-26b-a4b-it', labelId: 1, value: 0.8 });
    insertEvaluation(db, { shareId: 'share-1', userId: 'nekoserver', model: 'gemma-4-26b-a4b-it', labelId: 2, value: 0.6 });

    const res = await postStats(db, 'ok@example.com');
    expect(res.status).toBe(200);
    const body = await res.json() as { totalAnswers: number; analyzedAnswers: number };
    expect(body.totalAnswers).toBe(2);
    expect(body.analyzedAnswers).toBe(1);
  });

  it('他ユーザーの登録件数・分析件数は混入しない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-mine', 'nekoserver', 'gemma-4-26b-a4b-it');
    insertShare(db, 'share-other', 'other-user', 'gemma-4-26b-a4b-it');
    insertLabel(db, 1, 'ラベル1');
    insertEvaluation(db, { shareId: 'share-other', userId: 'other-user', model: 'gemma-4-26b-a4b-it', labelId: 1, value: 0.9 });

    const res = await postStats(db, 'ok@example.com');
    const body = await res.json() as { totalAnswers: number; analyzedAnswers: number };
    expect(body.totalAnswers).toBe(1);
    expect(body.analyzedAnswers).toBe(0);
  });

  it('リクエスト本文にloginを含めて他ユーザーの集計を騙ろうとしても、emailに紐づく自分のloginでしか集計されない(脆弱性の再発防止)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-victim', 'victim-user', 'gemma-4-26b-a4b-it');
    const res = await app.request(
      '/api/aichat/jev-stats-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'victim-user' }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    const body = await res.json() as { totalAnswers: number };
    expect(body.totalAnswers).toBe(0);
  });

  it('モデル別の分析済み件数・平均scoreをスコア降順で返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'gemma-4-26b-a4b-it');
    insertShare(db, 'share-2', 'nekoserver', 'qwen3.8-27b');
    insertLabel(db, 1, 'ラベル1');
    insertLabel(db, 2, 'ラベル2');
    insertEvaluation(db, { shareId: 'share-1', userId: 'nekoserver', model: 'gemma-4-26b-a4b-it', labelId: 1, value: 0.5 });
    insertEvaluation(db, { shareId: 'share-1', userId: 'nekoserver', model: 'gemma-4-26b-a4b-it', labelId: 2, value: 0.5 });
    insertEvaluation(db, { shareId: 'share-2', userId: 'nekoserver', model: 'qwen3.8-27b', labelId: 1, value: 0.9 });
    insertEvaluation(db, { shareId: 'share-2', userId: 'nekoserver', model: 'qwen3.8-27b', labelId: 2, value: 0.9 });

    const res = await postStats(db, 'ok@example.com');
    const body = await res.json() as { byModel: Array<{ model: string; analyzedCount: number; avgScore: number }> };
    expect(body.byModel).toEqual([
      { model: 'qwen3.8-27b', analyzedCount: 1, avgScore: 0.9 },
      { model: 'gemma-4-26b-a4b-it', analyzedCount: 1, avgScore: 0.5 },
    ]);
  });

  it('ラベル別の平均scoreをスコア降順で返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'gemma-4-26b-a4b-it');
    insertLabel(db, 1, '良いラベル');
    insertLabel(db, 2, '悪いラベル');
    insertEvaluation(db, { shareId: 'share-1', userId: 'nekoserver', model: 'gemma-4-26b-a4b-it', labelId: 1, value: 0.95 });
    insertEvaluation(db, { shareId: 'share-1', userId: 'nekoserver', model: 'gemma-4-26b-a4b-it', labelId: 2, value: 0.1 });

    const res = await postStats(db, 'ok@example.com');
    const body = await res.json() as { byLabel: Array<{ label: string; avgScore: number }> };
    expect(body.byLabel).toEqual([
      { label: '良いラベル', avgScore: 0.95 },
      { label: '悪いラベル', avgScore: 0.1 },
    ]);
  });

  it('分析済みデータが1件も無ければ0件・空配列を返す(エラーにしない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'gemma-4-26b-a4b-it');
    const res = await postStats(db, 'ok@example.com');
    expect(res.status).toBe(200);
    const body = await res.json() as { totalAnswers: number; analyzedAnswers: number; byModel: unknown[]; byLabel: unknown[] };
    expect(body.totalAnswers).toBe(1);
    expect(body.analyzedAnswers).toBe(0);
    expect(body.byModel).toEqual([]);
    expect(body.byLabel).toEqual([]);
  });

  it('DB未設定時はフェイルクローズで503を返す', async () => {
    const res = await app.request(
      '/api/aichat/jev-stats-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com' }) },
      { ...BASE_ENV }
    );
    expect(res.status).toBe(503);
  });
});
