import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { enrichSearchResultsWithKeywordCounts } from './index';

// 対象: /answer-graph の起点検索(`/api/aichat/shares/search`)で返す各行に、
// その共有(回答)に aichat_search_log の share_id で紐づくキーワードの総数
// (keywordCount)を付与する enrichSearchResultsWithKeywordCounts。
//
// キーワードの出所は回答伝播グラフの第1層(findKeywordsForShares)と同じ
// share_id 紐づけであり、一人称モード最前列のキーワード数と一致する。
//
// 故障シナリオ:
//   (1) 別の共有に紐づくキーワードまで件数に数えてしまう(検索履歴全体への
//       部分一致方式に逆戻りし、グラフ最前列のキーワード群と食い違う)
//   (2) 検索結果が0件のときにDBへ無駄な問い合わせをする、またはエラーになる
//   (3) 元のフィールド(id・question・created_at等)がkeywordCount付与後に失われる
//   (4) 同じキーワードが複数回記録されている共有で重複カウントされる

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
            async all<T = D1Row>(): Promise<{ results?: T[] }> {
              const rows = stmt.all(...(args as never[])) as unknown as T[];
              return { results: rows };
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
    CREATE TABLE aichat_search_log (
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      share_id TEXT NOT NULL,
      select_count INTEGER NOT NULL DEFAULT 1,
      last_searched_at TEXT NOT NULL
    );
  `);
  return db;
}

function insertKeyword(db: DatabaseSync, userId: string, keyword: string, shareId: string, count = 1) {
  db.prepare(
    `INSERT INTO aichat_search_log (user_id, keyword, share_id, select_count, last_searched_at) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, keyword, shareId, count, '2026-01-01T00:00:00.000Z');
}

describe('enrichSearchResultsWithKeywordCounts: 検索結果へのキーワード総数付与', () => {
  it('その共有に紐づくキーワードだけを数える(別の共有に紐づくキーワードは数えない)', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', 'Hono', 's1');
    insertKeyword(db, 'u1', 'エラーレスポンス', 's1');
    insertKeyword(db, 'u1', '実装', 's-other');
    insertKeyword(db, 'u1', '設計', 's-other');
    const results = [
      { id: 's1', question: 'Honoのエラー処理について', answer: 'Honoの実装では例外の設計が重要です' },
    ];

    const enriched = await enrichSearchResultsWithKeywordCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].keywordCount).toBe(2);
  });

  it('他ユーザーの同じshare_idのキーワードは数えない', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', 'Hono', 's1');
    insertKeyword(db, 'u2', 'よそのキーワード', 's1');
    const results = [{ id: 's1', question: 'Q', answer: 'A' }];

    const enriched = await enrichSearchResultsWithKeywordCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].keywordCount).toBe(1);
  });

  it('同じキーワードが複数回記録されていても重複カウントしない', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', 'Hono', 's1', 3);
    insertKeyword(db, 'u1', 'Hono', 's1', 5);
    const results = [{ id: 's1', question: 'Q', answer: 'A' }];

    const enriched = await enrichSearchResultsWithKeywordCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].keywordCount).toBe(1);
  });

  it('元の行のフィールド(id・question等)はkeywordCount付与後も保持される', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅', 's1');
    const results = [
      { id: 's1', question: 'Q', answer: '駅の話です', created_at: '2026-01-01T00:00:00.000Z' },
    ];

    const enriched = await enrichSearchResultsWithKeywordCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0]).toMatchObject({ id: 's1', question: 'Q', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1 });
  });

  it('検索結果が0件のときは空配列を返しDBへ問い合わせない', async () => {
    const db = setupDb();
    let queried = false;
    const spyDb = {
      prepare(sql: string) {
        queried = true;
        return wrapD1(db).prepare(sql);
      },
    };

    const enriched = await enrichSearchResultsWithKeywordCounts(spyDb as never, 'u1', []);

    expect(enriched).toEqual([]);
    expect(queried).toBe(false);
  });

  it('キーワードが1件も紐づいていない共有はkeywordCount=0になる', async () => {
    const db = setupDb();
    const results = [{ id: 's1', question: 'Q', answer: '何かの回答' }];

    const enriched = await enrichSearchResultsWithKeywordCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].keywordCount).toBe(0);
  });
});
