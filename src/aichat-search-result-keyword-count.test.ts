import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { enrichSearchResultsWithKeywordCounts } from './index';

// 対象: /answer-graph の起点検索(`/api/aichat/shares/search`)で返す各行に、
// その回答本文に含まれる登録済みキーワードの総数(keywordCount)を付与する
// enrichSearchResultsWithKeywordCounts。
//
// 故障シナリオ:
//   (1) 質問文にしか含まれず回答本文には無いキーワードまで件数に数えてしまう
//       (回答伝播グラフのキーワード抽出を回答本文のみに揃えた修正と矛盾する)
//   (2) 検索結果が0件のときにDBへ無駄な問い合わせをする、またはエラーになる
//   (3) 元のフィールド(id・question・created_at等)がkeywordCount付与後に失われる

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
      select_count INTEGER NOT NULL DEFAULT 1,
      last_searched_at TEXT NOT NULL
    );
  `);
  return db;
}

function insertKeyword(db: DatabaseSync, userId: string, keyword: string, count = 1) {
  db.prepare(
    `INSERT INTO aichat_search_log (user_id, keyword, select_count, last_searched_at) VALUES (?, ?, ?, ?)`
  ).run(userId, keyword, count, '2026-01-01T00:00:00.000Z');
}

describe('enrichSearchResultsWithKeywordCounts: 検索結果へのキーワード総数付与', () => {
  it('回答本文に含まれる登録済みキーワードの件数を付与する(質問文にしか無いキーワードは数えない)', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅');
    insertKeyword(db, 'u1', '新幹線');
    insertKeyword(db, 'u1', '飛行機');
    const results = [
      { id: 's1', question: '新幹線の駅について教えて', answer: '駅の周辺には商業施設があります' },
    ];

    const enriched = await enrichSearchResultsWithKeywordCounts(wrapD1(db) as never, 'u1', results);

    // 「駅」は回答本文に含まれるので数える。「新幹線」は質問文にしか無いので数えない。
    // 「飛行機」はどちらにも無い。
    expect(enriched[0].keywordCount).toBe(1);
  });

  it('元の行のフィールド(id・question等)はkeywordCount付与後も保持される', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅');
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

  it('登録済みキーワードが1つも無い場合は全行keywordCount=0になる', async () => {
    const db = setupDb();
    const results = [{ id: 's1', question: 'Q', answer: '何かの回答' }];

    const enriched = await enrichSearchResultsWithKeywordCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].keywordCount).toBe(0);
  });
});
