/**
 * POST /api/aichat/jev-score-external のテスト
 *
 * 対象: dynamicnekoの/ai-cacheページの一括処理ボタンが呼ぶ外部API。
 * Jev(TypeSafe AI System One Model)にshare_id(質問ID)の回答または質問文を
 * jev_labelsの各ラベルで評価させ、jev_evaluationsへ(target_type, share_id,
 * user_id, model, jev_label_id)で紐付けて保存する。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1検索まで到達してしまう
 *   (3) リクエスト本文のloginをそのままuser_idとして信用してしまう
 *       (qsearch-externalで発覚した脆弱性と同じ穴)
 *   (4) 既に評価済みのラベルもJevへ再送してしまう(重複課金・重複行)
 *   (5) 全ラベル評価済みなのにJevへ問い合わせてしまう
 *   (6) Jev API呼び出し失敗時にエラーが記録されず、空の成功扱いになってしまう
 *   (7) target_type='source_question'なのにmodelを保存してしまい、
 *       モデル非依存であるべき評価がモデル別に分裂する
 *   (8) JEV_API_KEY未設定時にフェイルオープンする
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';

const SECRET = 'test-aichat-external-secret';
const JEV_KEY = 'test-jev-key';

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
    CREATE TABLE aichat_images (id TEXT PRIMARY KEY, image_data_url TEXT);
    CREATE TABLE aichat_moondream_analyses (share_id TEXT, user_id TEXT, analysis_text TEXT);
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

function insertShare(db: DatabaseSync, id: string, userId: string, question: string, answer: string, model = '@cf/google/gemma-4-26b-a4b-it'): void {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, userId, question, answer, model);
}

function insertLabels(db: DatabaseSync, labels: { id: number; text: string; optionsJson?: string | null }[]): void {
  db.prepare(`INSERT INTO jev_label_groups (id, name) VALUES (1, 'テストグループ')`).run();
  for (const label of labels) {
    db.prepare(`INSERT INTO jev_labels (id, question_type, question_text, options_json, jev_group_id) VALUES (?, 'score', ?, ?, 1)`).run(
      label.id,
      label.text,
      label.optionsJson === undefined ? JSON.stringify(['悪い状態', '良い状態']) : label.optionsJson
    );
  }
}

function insertEvaluation(db: DatabaseSync, args: { targetType: string; shareId: string; userId: string; model: string | null; labelId: number; value: number }): void {
  db.prepare(
    `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(args.targetType, args.shareId, args.userId, args.model, args.labelId, args.value);
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, JEV_API_KEY: JEV_KEY };

describe('POST /api/aichat/jev-score-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/jev-score-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', shareId: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('JEV_API_KEY未設定時は503を返す(フェイルオープンしない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/jev-score-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', shareId: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(503);
  });

  it('未許可メールアドレスは403で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/jev-score-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ng@example.com', shareId: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(403);
  });

  it('shareIdが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/jev-score-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', shareId: '  ', model: 'gemma-4-26b-a4b-it' }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(400);
  });

  it('リクエスト本文にloginを含めて他ユーザーの回答を評価させようとしても、emailに紐づく自分のloginでしか一致しない(脆弱性の再発防止)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-victim', 'victim-user', '他人の質問', '他人の回答', '@cf/google/gemma-4-26b-a4b-it');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);
    const res = await app.request(
      '/api/aichat/jev-score-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'victim-user', shareId: 'share-victim', model: 'gemma-4-26b-a4b-it' }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(404);
  });

  it('全ラベル評価済みならJevを呼ばずキャッシュ済みの結果だけを返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', '質問', '回答', '@cf/google/gemma-4-26b-a4b-it');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);
    insertEvaluation(db, { targetType: 'answer', shareId: 'share-1', userId: 'nekoserver', model: 'gemma-4-26b-a4b-it', labelId: 1, value: 0.9 });
    insertEvaluation(db, { targetType: 'answer', shareId: 'share-1', userId: 'nekoserver', model: 'gemma-4-26b-a4b-it', labelId: 2, value: 0.1 });

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      const res = await app.request(
        '/api/aichat/jev-score-external',
        { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', shareId: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
        { ...BASE_ENV, DB: wrapD1(db) }
      );
      expect(res.status).toBe(200);
      const bodyJson = await res.json() as { scores: Array<{ labelId: number; value: number }>; cachedCount: number; newlyEvaluatedCount: number };
      expect(bodyJson.cachedCount).toBe(2);
      expect(bodyJson.newlyEvaluatedCount).toBe(0);
      expect(bodyJson.scores).toHaveLength(2);
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('未評価ラベルだけをJevへ送り、結果をjev_evaluationsに保存して評価済み+新規をまとめて返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', '質問', '回答', '@cf/google/gemma-4-26b-a4b-it');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);
    insertEvaluation(db, { targetType: 'answer', shareId: 'share-1', userId: 'nekoserver', model: 'gemma-4-26b-a4b-it', labelId: 1, value: 0.9 });

    let requestedQuestions: unknown = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      requestedQuestions = JSON.parse(String(init?.body)).questions;
      return new Response(JSON.stringify({ answers: { '2': 0.42 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const res = await app.request(
        '/api/aichat/jev-score-external',
        { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', shareId: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
        { ...BASE_ENV, DB: wrapD1(db) }
      );
      expect(res.status).toBe(200);
      const bodyJson = await res.json() as { scores: Array<{ labelId: number; value: number }>; cachedCount: number; newlyEvaluatedCount: number };
      expect(bodyJson.cachedCount).toBe(1);
      expect(bodyJson.newlyEvaluatedCount).toBe(1);
      expect(bodyJson.scores.sort((a, b) => a.labelId - b.labelId)).toEqual([
        { labelId: 1, value: 0.9 },
        { labelId: 2, value: 0.42 },
      ]);
      expect(Object.keys(requestedQuestions as Record<string, unknown>).length).toBe(1);

      const saved = db.prepare('SELECT jev_label_id, value FROM jev_evaluations WHERE share_id = ? AND jev_label_id = 2').get('share-1') as { jev_label_id: number; value: number };
      expect(saved.value).toBeCloseTo(0.42);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('target_type=source_questionの場合は質問文を評価対象にし、modelはNULLで保存する(モデル非依存)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'これは質問です', 'これは回答です', '@cf/google/gemma-4-26b-a4b-it');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);

    let capturedState: string | null = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedState = JSON.parse(String(init?.body)).state;
      return new Response(JSON.stringify({ answers: { '1': 0.55 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const res = await app.request(
        '/api/aichat/jev-score-external',
        { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', shareId: 'share-1', model: 'gemma-4-26b-a4b-it', targetType: 'source_question' }) },
        { ...BASE_ENV, DB: wrapD1(db) }
      );
      expect(res.status).toBe(200);
      expect(capturedState).toBe('これは質問です');

      const saved = db.prepare('SELECT model FROM jev_evaluations WHERE share_id = ? AND target_type = ?').get('share-1', 'source_question') as { model: string | null };
      expect(saved.model).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Jev API呼び出し失敗時は502エラーを返しjev_evaluationsに何も保存しない(握りつぶさない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', '質問', '回答', '@cf/google/gemma-4-26b-a4b-it');
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('internal error', { status: 500 })) as typeof fetch;
    try {
      const res = await app.request(
        '/api/aichat/jev-score-external',
        { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', shareId: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
        { ...BASE_ENV, DB: wrapD1(db) }
      );
      expect(res.status).toBe(502);
      const bodyJson = await res.json() as { error: string };
      expect(bodyJson.error).not.toBe('');
      const count = db.prepare('SELECT COUNT(*) as c FROM jev_evaluations').get() as { c: number };
      expect(count.c).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('jev_labels.options_jsonがcriteria(2要素配列)として不正な場合は500で失敗し、Jevへは送らない(黙って進めない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', '質問', '回答', '@cf/google/gemma-4-26b-a4b-it');
    insertLabels(db, [{ id: 1, text: 'ラベル1', optionsJson: null }]);

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      const res = await app.request(
        '/api/aichat/jev-score-external',
        { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', shareId: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
        { ...BASE_ENV, DB: wrapD1(db) }
      );
      expect(res.status).toBe(500);
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('DB未設定時はフェイルクローズで503を返す', async () => {
    const res = await app.request(
      '/api/aichat/jev-score-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', shareId: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
      { ...BASE_ENV }
    );
    expect(res.status).toBe(503);
  });
});
