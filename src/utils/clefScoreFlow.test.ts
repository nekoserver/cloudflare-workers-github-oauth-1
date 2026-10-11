import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runClefScoreForShare } from './clefScoreFlow';
import type { JevScoreDb } from './jevScoreFlow';

// 対象: Clefによるラベル評価のオーケストレーション(src/utils/clefScoreFlow.ts)。
// PLAN.cloudflare-workers-github-oauth-1.20261011.judgment-models.mdのステップ③。
// runJevScoreForShare(jevScoreFlow.ts)と同じ構造(未評価ラベルだけ問い合わせ→
// 書き込み→ベリファイ)だが、書き込み先がclef_evaluations(jev_evaluationsとは
// 別テーブル)で、呼び出し先がcallClefScoreApi(env.AI.run())になっている。
// jev_labelsは共有するが、jev_evaluationsには一切書き込まない
// (既存のJevスコアと混ざらないことを検証する)。

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

function insertClefEvaluation(db: DatabaseSync, args: { shareId: string; userId: string; model: string; clefModel: string; labelId: number; value: number }): void {
  db.prepare(
    `INSERT INTO clef_evaluations (target_type, share_id, user_id, model, jev_label_id, clef_model, value) VALUES ('answer', ?, ?, ?, ?, ?, ?)`
  ).run(args.shareId, args.userId, args.model, args.labelId, args.clefModel, args.value);
}

describe('runClefScoreForShare', () => {
  it('未評価ラベルだけClefへ送り、既評価ラベルは再送しない。ベリファイ成功でverified:trueを返す', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);
    insertClefEvaluation(db, { shareId: 'share-1', userId: 'test-user', model: 'model-x', clefModel: '@cf/cloudflare/clef-flash', labelId: 1, value: 0.9 });

    const run = vi.fn().mockResolvedValue({ answers: { '2': { type: 'score', score: 0.42 } } });
    const result = await runClefScoreForShare({
      db: wrapD1(db),
      ai: { run },
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: '回答文です',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(run).toHaveBeenCalledTimes(1);
    const [, input] = run.mock.calls[0];
    expect(Object.keys(input.questions)).toEqual(['2']);
    expect(result.verified).toBe(true);
    expect(result.values.find((v) => v.jevLabelId === 1)?.value).toBeCloseTo(0.9);
    expect(result.values.find((v) => v.jevLabelId === 2)?.value).toBeCloseTo(0.42);
  });

  it('全ラベル評価済みならClefを一切呼ばずキャッシュ済みの結果だけを返す', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);
    insertClefEvaluation(db, { shareId: 'share-1', userId: 'test-user', model: 'model-x', clefModel: '@cf/cloudflare/clef-flash', labelId: 1, value: 0.7 });

    const run = vi.fn();
    const result = await runClefScoreForShare({
      db: wrapD1(db),
      ai: { run },
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: '回答文です',
    });

    expect(run).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('jev_labelsが0件なら500エラーを返す', async () => {
    const db = setupDb();
    const result = await runClefScoreForShare({
      db: wrapD1(db),
      ai: { run: vi.fn() },
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

  it('Clef呼び出し失敗時は502を返し、clef_evaluationsに何も書き込まない', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);

    const run = vi.fn().mockRejectedValue(new Error('binding unavailable'));
    const result = await runClefScoreForShare({
      db: wrapD1(db),
      ai: { run },
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(502);

    const count = db.prepare('SELECT COUNT(*) as c FROM clef_evaluations WHERE share_id = ?').get('share-1') as { c: number };
    expect(count.c).toBe(0);
  });

  it('レスポンスで一部ラベルの結果が欠けている場合、502を返し何も書き込まない', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }, { id: 2, text: 'ラベル2' }]);

    const run = vi.fn().mockResolvedValue({ answers: { '1': { score: 0.5 } } });
    const result = await runClefScoreForShare({
      db: wrapD1(db),
      ai: { run },
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(502);

    const count = db.prepare('SELECT COUNT(*) as c FROM clef_evaluations WHERE share_id = ?').get('share-1') as { c: number };
    expect(count.c).toBe(0);
  });

  it('jev_evaluations(既存のJevスコア)には一切書き込まない', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);
    const run = vi.fn().mockResolvedValue({ answers: { '1': { score: 0.5 } } });
    await runClefScoreForShare({
      db: wrapD1(db),
      ai: { run },
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: 'x',
    });
    const count = db.prepare('SELECT COUNT(*) as c FROM jev_evaluations').get() as { c: number };
    expect(count.c).toBe(0);
  });

  it('既定モデルはclef-flash。異なるclef_model(例: clef)で評価済みの行は再送対象のまま扱う', async () => {
    const db = setupDb();
    insertLabels(db, [{ id: 1, text: 'ラベル1' }]);
    // 既存の評価は別モデル(clef)によるもの → clef-flashでは未評価扱いになるべき
    insertClefEvaluation(db, { shareId: 'share-1', userId: 'test-user', model: 'model-x', clefModel: '@cf/cloudflare/clef', labelId: 1, value: 0.3 });

    const run = vi.fn().mockResolvedValue({ answers: { '1': { score: 0.6 } } });
    const result = await runClefScoreForShare({
      db: wrapD1(db),
      ai: { run },
      targetType: 'answer',
      userId: 'test-user',
      shareId: 'share-1',
      model: 'model-x',
      stateText: 'x',
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.values.find((v) => v.jevLabelId === 1)?.value).toBeCloseTo(0.6);
  });
});
