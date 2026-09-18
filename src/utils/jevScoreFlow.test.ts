import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runJevScoreForShare, runJevScoreForKeyword, type JevScoreDb } from './jevScoreFlow';

function wrapD1(db: DatabaseSync): JevScoreDb {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const makeChain = (args: unknown[]) => ({
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
    CREATE TABLE jev_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT
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
  return db;
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

describe('runJevScoreForShare', () => {
  it('未評価ラベルだけJevへ送り、既評価ラベルは再送しない。ベリファイ成功でverified:trueを返す', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);
    insertEvaluation(db, { shareId: 'share-1', userId: 'test-user', model: 'model-x', labelId: 1, value: 0.9 });

    let requestedLabelIds: string[] = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body));
      requestedLabelIds = Object.keys(parsed.questions);
      return { ok: true, status: 200, json: async () => ({ answers: { '2': 0.42 } }), text: async () => '' };
    }) as unknown as typeof fetch;

    const result = await runJevScoreForShare({
      db: wrapD1(db),
      jevApiKey: 'key',
      fetchImpl,
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: '回答文です',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(requestedLabelIds).toEqual(['2']);
    expect(result.verified).toBe(true);
    expect(result.state).toBe('green');
    expect(result.values.find((v) => v.jevLabelId === 1)?.value).toBeCloseTo(0.9);
    expect(result.values.find((v) => v.jevLabelId === 2)?.value).toBeCloseTo(0.42);
  });

  it('全ラベル評価済みならJevを一切呼ばずキャッシュ済みの結果だけを返す', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);
    insertEvaluation(db, { shareId: 'share-1', userId: 'test-user', model: 'model-x', labelId: 1, value: 0.7 });

    let fetchCalled = false;
    const fetchImpl = (async () => {
      fetchCalled = true;
      return { ok: true, status: 200, json: async () => ({ answers: {} }), text: async () => '' };
    }) as unknown as typeof fetch;

    const result = await runJevScoreForShare({
      db: wrapD1(db),
      jevApiKey: 'key',
      fetchImpl,
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: '回答文です',
    });

    expect(fetchCalled).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('jev_labelsが0件なら500エラーを返す', async () => {
    const db = setupDb();
    const result = await runJevScoreForShare({
      db: wrapD1(db),
      jevApiKey: 'key',
      fetchImpl: (async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })) as unknown as typeof fetch,
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(500);
    expect(result.error).toContain('jev_labels');
  });

  it('Jev API呼び出し失敗時は502を返し、jev_evaluationsに何も書き込まない', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);

    const fetchImpl = (async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => 'internal error' })) as unknown as typeof fetch;
    const result = await runJevScoreForShare({
      db: wrapD1(db),
      jevApiKey: 'key',
      fetchImpl,
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(502);

    const count = db.prepare('SELECT COUNT(*) as c FROM jev_evaluations WHERE share_id = ?').get('share-1') as { c: number };
    expect(count.c).toBe(0);
  });

  it('レスポンスで一部ラベルの結果が欠けている場合、502(callJevApiのunexpected_shape)を返し何も書き込まない', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);

    const fetchImpl = (async () => ({ ok: true, status: 200, json: async () => ({ answers: { '1': 0.5 } }), text: async () => '' })) as unknown as typeof fetch;
    const result = await runJevScoreForShare({
      db: wrapD1(db),
      jevApiKey: 'key',
      fetchImpl,
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(502);

    const count = db.prepare('SELECT COUNT(*) as c FROM jev_evaluations WHERE share_id = ?').get('share-1') as { c: number };
    expect(count.c).toBe(0);
  });
});

function setupKeywordDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
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
  return db;
}

function insertKeywordLabels(db: DatabaseSync, labels: { id: number; text: string; optionsJson?: string | null }[]): void {
  for (const label of labels) {
    db.prepare(`INSERT INTO jev_country_keyword_labels (id, question_text, options_json) VALUES (?, ?, ?)`).run(
      label.id,
      label.text,
      label.optionsJson === undefined ? JSON.stringify(['悪い状態', '良い状態']) : label.optionsJson
    );
  }
}

function insertKeywordEvaluation(db: DatabaseSync, args: { keyword: string; userId: string; labelId: number; value: number }): void {
  db.prepare(
    `INSERT INTO jev_country_keyword_evaluations (keyword, user_id, jev_country_keyword_label_id, value) VALUES (?, ?, ?, ?)`
  ).run(args.keyword, args.userId, args.labelId, args.value);
}

describe('runJevScoreForKeyword', () => {
  it('未評価ラベルだけJevへ送り、既評価ラベルは再送しない。ベリファイ成功でverified:trueを返す', async () => {
    const db = setupKeywordDb();
    insertKeywordLabels(db, [{ id: 1, text: 'ビザが必要か' }, { id: 2, text: '英語が通じるか' }]);
    insertKeywordEvaluation(db, { keyword: 'フランス', userId: 'test-user', labelId: 1, value: 0.9 });

    let requestedLabelIds: string[] = [];
    let requestedState = '';
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body));
      requestedState = parsed.state;
      requestedLabelIds = Object.keys(parsed.questions);
      return { ok: true, status: 200, json: async () => ({ answers: { '2': 0.8 } }), text: async () => '' };
    }) as unknown as typeof fetch;

    const result = await runJevScoreForKeyword({
      db: wrapD1(db),
      jevApiKey: 'key',
      fetchImpl,
      userId: 'test-user',
      keyword: 'フランス',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(requestedState).toBe('フランス');
    expect(requestedLabelIds).toEqual(['2']);
    expect(result.verified).toBe(true);
    expect(result.results.find((r) => r.labelId === 1)?.value).toBeCloseTo(0.9);
    expect(result.results.find((r) => r.labelId === 2)?.value).toBeCloseTo(0.8);

    const saved = db.prepare('SELECT value FROM jev_country_keyword_evaluations WHERE keyword = ? AND jev_country_keyword_label_id = 2').get('フランス') as { value: number };
    expect(saved.value).toBeCloseTo(0.8);
  });

  it('全ラベル評価済みならJevを一切呼ばずキャッシュ済みの結果だけを返す', async () => {
    const db = setupKeywordDb();
    insertKeywordLabels(db, [{ id: 1, text: 'ラベル1' }]);
    insertKeywordEvaluation(db, { keyword: 'タイ', userId: 'test-user', labelId: 1, value: 0.6 });

    let fetchCalled = false;
    const fetchImpl = (async () => {
      fetchCalled = true;
      return { ok: true, status: 200, json: async () => ({ answers: {} }), text: async () => '' };
    }) as unknown as typeof fetch;

    const result = await runJevScoreForKeyword({ db: wrapD1(db), jevApiKey: 'key', fetchImpl, userId: 'test-user', keyword: 'タイ' });
    expect(fetchCalled).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('jev_country_keyword_labelsが0件なら500エラーを返す', async () => {
    const db = setupKeywordDb();
    const result = await runJevScoreForKeyword({
      db: wrapD1(db),
      jevApiKey: 'key',
      fetchImpl: (async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })) as unknown as typeof fetch,
      userId: 'test-user',
      keyword: 'フランス',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(500);
    expect(result.error).toContain('jev_country_keyword_labels');
  });

  it('Jev API呼び出し失敗時は502を返し、jev_country_keyword_evaluationsに何も書き込まない', async () => {
    const db = setupKeywordDb();
    insertKeywordLabels(db, [{ id: 1, text: 'ラベル1' }]);

    const fetchImpl = (async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => 'internal error' })) as unknown as typeof fetch;
    const result = await runJevScoreForKeyword({ db: wrapD1(db), jevApiKey: 'key', fetchImpl, userId: 'test-user', keyword: 'フランス' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(502);

    const count = db.prepare('SELECT COUNT(*) as c FROM jev_country_keyword_evaluations WHERE keyword = ?').get('フランス') as { c: number };
    expect(count.c).toBe(0);
  });

  it('他のユーザー・他のキーワードのデータは混ざらない(user_id・keywordで絞り込む)', async () => {
    const db = setupKeywordDb();
    insertKeywordLabels(db, [{ id: 1, text: 'ラベル1' }]);
    insertKeywordEvaluation(db, { keyword: 'フランス', userId: 'other-user', labelId: 1, value: 0.1 });
    insertKeywordEvaluation(db, { keyword: 'タイ', userId: 'test-user', labelId: 1, value: 0.2 });

    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body));
      const labelId = Object.keys(parsed.questions)[0];
      return { ok: true, status: 200, json: async () => ({ answers: { [labelId]: 0.99 } }), text: async () => '' };
    }) as unknown as typeof fetch;

    const result = await runJevScoreForKeyword({ db: wrapD1(db), jevApiKey: 'key', fetchImpl, userId: 'test-user', keyword: 'フランス' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.results.find((r) => r.labelId === 1)?.value).toBeCloseTo(0.99);
  });
});
