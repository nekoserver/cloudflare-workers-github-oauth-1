import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  syncKeywordBoundary,
  toggleKeywordBoundary,
  listUnknownKeywords,
  BOUNDARY_LABEL_QUESTION_TEXT,
  type KeywordBoundaryDb,
} from './jevKeywordBoundary';

function wrapD1(db: DatabaseSync): KeywordBoundaryDb {
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

function setupDb(withLabel = true): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
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
  if (withLabel) {
    db.prepare(
      `INSERT INTO jev_keyword_boundary_labels (question_text, options_json) VALUES (?, ?)`
    ).run(BOUNDARY_LABEL_QUESTION_TEXT, JSON.stringify(['未理解', '理解済み']));
  }
  return db;
}

describe('syncKeywordBoundary', () => {
  it('未登録のキーワードを未理解(unknown)として新規登録し、読み戻した状態を返す', async () => {
    const db = setupDb();
    const result = await syncKeywordBoundary(wrapD1(db), 'user-1', ['Worker', 'D1', 'Worker'], 'share-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 重複キーワードは1件にまとめられ、入力順を保つ。
    expect(result.entries).toEqual([
      { keyword: 'Worker', status: 'unknown' },
      { keyword: 'D1', status: 'unknown' },
    ]);

    const rows = db.prepare('SELECT keyword, value, source_share_id FROM jev_keyword_boundary_evaluations ORDER BY keyword').all() as {
      keyword: string;
      value: number;
      source_share_id: string | null;
    }[];
    expect(rows).toEqual([
      { keyword: 'D1', value: 0, source_share_id: 'share-1' },
      { keyword: 'Worker', value: 0, source_share_id: 'share-1' },
    ]);
  });

  it('既に「理解済み」として登録済みのキーワードは上書きせず、known のまま返す', async () => {
    const db = setupDb();
    const labelId = (db.prepare('SELECT id FROM jev_keyword_boundary_labels LIMIT 1').get() as { id: number }).id;
    db.prepare(
      `INSERT INTO jev_keyword_boundary_evaluations (keyword, user_id, jev_keyword_boundary_label_id, value) VALUES ('Worker', 'user-1', ?, 1)`
    ).run(labelId);

    const result = await syncKeywordBoundary(wrapD1(db), 'user-1', ['Worker'], null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries).toEqual([{ keyword: 'Worker', status: 'known' }]);
  });

  it('空文字列・空白だけのキーワードは無視し、キーワードが1件も無ければDBへ触れずentries:[]を返す', async () => {
    const db = setupDb();
    const result = await syncKeywordBoundary(wrapD1(db), 'user-1', ['', '   '], null);
    expect(result).toEqual({ ok: true, entries: [] });
  });

  it('jev_keyword_boundary_labelsが空(マイグレーション未適用相当)ならエラーを返す', async () => {
    const db = setupDb(false);
    const result = await syncKeywordBoundary(wrapD1(db), 'user-1', ['Worker'], null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('jev_keyword_boundary_labels');
  });

  it('jev_keyword_boundary_labelsテーブル自体が存在しない場合もエラーを返す(握りつぶさない)', async () => {
    const db = new DatabaseSync(':memory:');
    const result = await syncKeywordBoundary(wrapD1(db), 'user-1', ['Worker'], null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('jev_keyword_boundary_labels');
  });
});

describe('toggleKeywordBoundary', () => {
  it('未登録のキーワードをknown:trueで呼ぶと、理解済みとして新規作成される', async () => {
    const db = setupDb();
    const result = await toggleKeywordBoundary(wrapD1(db), 'user-1', 'Worker', true);
    expect(result).toEqual({ ok: true, entry: { keyword: 'Worker', status: 'known' } });
  });

  it('既存の理解済み行をknown:falseで呼ぶと未理解に戻る(UPSERTで上書き)', async () => {
    const db = setupDb();
    await toggleKeywordBoundary(wrapD1(db), 'user-1', 'Worker', true);
    const result = await toggleKeywordBoundary(wrapD1(db), 'user-1', 'Worker', false);
    expect(result).toEqual({ ok: true, entry: { keyword: 'Worker', status: 'unknown' } });

    const rows = db.prepare('SELECT value FROM jev_keyword_boundary_evaluations').all() as { value: number }[];
    expect(rows).toEqual([{ value: 0 }]);
  });

  it('前後の空白は除去するが、空文字列はエラーを返す', async () => {
    const db = setupDb();
    const trimmed = await toggleKeywordBoundary(wrapD1(db), 'user-1', '  Worker  ', true);
    expect(trimmed).toEqual({ ok: true, entry: { keyword: 'Worker', status: 'known' } });

    const empty = await toggleKeywordBoundary(wrapD1(db), 'user-1', '   ', true);
    expect(empty.ok).toBe(false);
  });
});

describe('listUnknownKeywords', () => {
  it('value=0(未理解)のキーワードだけを、更新が新しい順に返す', async () => {
    const db = setupDb();
    await syncKeywordBoundary(wrapD1(db), 'user-1', ['A', 'B', 'C'], null);
    await toggleKeywordBoundary(wrapD1(db), 'user-1', 'B', true);

    const result = await listUnknownKeywords(wrapD1(db), 'user-1', 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const keywords = result.keywords.map((k) => k.keyword).sort();
    expect(keywords).toEqual(['A', 'C']);
  });

  it('他のユーザーのキーワードは含めない', async () => {
    const db = setupDb();
    await syncKeywordBoundary(wrapD1(db), 'user-1', ['A'], null);
    await syncKeywordBoundary(wrapD1(db), 'user-2', ['B'], null);

    const result = await listUnknownKeywords(wrapD1(db), 'user-1', 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keywords.map((k) => k.keyword)).toEqual(['A']);
  });

  it('limitで件数を絞れる', async () => {
    const db = setupDb();
    await syncKeywordBoundary(wrapD1(db), 'user-1', ['A', 'B', 'C'], null);

    const result = await listUnknownKeywords(wrapD1(db), 'user-1', 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keywords).toHaveLength(2);
  });
});
