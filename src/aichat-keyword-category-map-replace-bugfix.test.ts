import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { replaceKeywordCategoryMap } from './index';

// 対象: POST /api/aichat/keyword-category-map, replaceKeywordCategoryMap
// バグ: キーワード分類モーダルで任意のキーワードを選び、次のモーダルで
// 既存のカテゴリ選択を外す（あるいは別カテゴリに変更する）修正を行って
// 「分類決定」を押しても、DBの aichat_keyword_category_map から
// 外したはずのカテゴリが削除されず、変更が反映されなかったように見える。
//
// 原因: 従来のエンドポイントは送信された category_ids を
// INSERT OR IGNORE で追加するだけで、送信に含まれなくなった
// 既存マッピングを削除していなかった（追加専用、削除非対応）。
//
// 故障シナリオ:
//   (1) 既存マッピングがあるカテゴリを外して別カテゴリだけを選び直しても、
//       外したはずの既存カテゴリが残る
//   (2) 選択内容が完全に一致（変更なし）の場合は不要な削除・挿入をしない
//   (3) 他ユーザー・他キーワードのマッピングを巻き込んで削除しない

interface D1Row {
  [key: string]: unknown;
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T = D1Row>(): Promise<T | null> {
              const row = stmt.get(...(args as never[])) as unknown as T | undefined;
              return row ?? null;
            },
            async all<T = D1Row>(): Promise<{ results?: T[] }> {
              const rows = stmt.all(...(args as never[])) as unknown as T[];
              return { results: rows };
            },
            async run(): Promise<{ meta: { changes: number } }> {
              const res = stmt.run(...(args as never[]));
              return { meta: { changes: Number(res.changes) } };
            },
          };
        },
      };
    },
  };
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE aichat_keyword_category_map (
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, keyword, category_id)
    );
  `);
  return db;
}

function mappedCategoryIds(db: DatabaseSync, userId: string, keyword: string): number[] {
  const rows = db.prepare(
    `SELECT category_id FROM aichat_keyword_category_map WHERE user_id = ? AND keyword = ? ORDER BY category_id`
  ).all(userId, keyword) as unknown as { category_id: number }[];
  return rows.map((r) => r.category_id);
}

describe('replaceKeywordCategoryMap: キーワード分類の修正がDBへ反映されないバグの修正', () => {
  it('カテゴリAを外してBだけを選び直すと、Aは削除されBだけが残る', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id, created_at) VALUES ('u1', 'kw', 1, 't0')`
    ).run();

    const result = await replaceKeywordCategoryMap(wrapD1(db) as never, 'u1', 'kw', [2], 't1');

    expect(result).toEqual({ inserted: 1, deleted: 1 });
    expect(mappedCategoryIds(db, 'u1', 'kw')).toEqual([2]);
  });

  it('選択内容が変更前後で完全一致する場合は削除も挿入もしない', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id, created_at) VALUES ('u1', 'kw', 1, 't0')`
    ).run();
    db.prepare(
      `INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id, created_at) VALUES ('u1', 'kw', 2, 't0')`
    ).run();

    const result = await replaceKeywordCategoryMap(wrapD1(db) as never, 'u1', 'kw', [1, 2], 't1');

    expect(result).toEqual({ inserted: 0, deleted: 0 });
    expect(mappedCategoryIds(db, 'u1', 'kw')).toEqual([1, 2]);
  });

  it('既存マッピングが無いキーワードに新規カテゴリを割り当てると挿入のみ行われる', async () => {
    const db = setupDb();

    const result = await replaceKeywordCategoryMap(wrapD1(db) as never, 'u1', 'kw', [3, 4], 't1');

    expect(result).toEqual({ inserted: 2, deleted: 0 });
    expect(mappedCategoryIds(db, 'u1', 'kw')).toEqual([3, 4]);
  });

  it('他ユーザー・他キーワードのマッピングは削除対象に含めない', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id, created_at) VALUES ('u1', 'kw', 1, 't0')`
    ).run();
    db.prepare(
      `INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id, created_at) VALUES ('u2', 'kw', 1, 't0')`
    ).run();
    db.prepare(
      `INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id, created_at) VALUES ('u1', 'other-kw', 1, 't0')`
    ).run();

    await replaceKeywordCategoryMap(wrapD1(db) as never, 'u1', 'kw', [2], 't1');

    expect(mappedCategoryIds(db, 'u1', 'kw')).toEqual([2]);
    expect(mappedCategoryIds(db, 'u2', 'kw')).toEqual([1]);
    expect(mappedCategoryIds(db, 'u1', 'other-kw')).toEqual([1]);
  });
});
