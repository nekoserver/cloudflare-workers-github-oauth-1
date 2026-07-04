import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { lookupHeritageSearchKeywordHasFlags, lookupHeritageSearchKeywordCounts } from './index';

// ===========================================================================
// 「キーワード」バッジ（acc-kw-badge）の表示可否 lookupHeritageSearchKeywordHasFlags と
// クリック後の内訳取得 lookupHeritageSearchKeywordCounts が、実SQLiteの
// JOIN/WHERE 実行結果として本当に整合しているか（バッジが出るなら必ず件数が
// 取得できるか）を実データで検証する。どちらも ai_chat_shares の
// deleted_at IS NULL を同じ結合条件で要求しているため、AIチャット共有を
// 削除した場合は両者とも一致して「バッジ非表示・件数ゼロ」になるべきで、
// 見どころバッジ（heritage_question_view_log）のような不整合は起きない
// ことをここで実証する。
// ===========================================================================

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
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE aichat_search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      share_id TEXT NOT NULL,
      seq_num INTEGER NOT NULL,
      searched_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);
  return db;
}

function insertShare(db: DatabaseSync, id: string, heritage: string, topic: string, deleted: boolean) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, deleted_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, 'user1', `「${heritage}」の「${topic}」について説明してください`, '回答本文', 'model-x', deleted ? '2026-01-01T00:00:00Z' : null);
}

function insertSearchHistory(db: DatabaseSync, keyword: string, shareId: string) {
  db.prepare(
    `INSERT INTO aichat_search_history (user_id, keyword, share_id, seq_num) VALUES (?, ?, ?, 1)`
  ).run('user1', keyword, shareId);
}

describe('キーワードバッジと件数取得の整合性（実SQLite）', () => {
  it('回答が生きていればバッジ表示(hasKeywords)と件数取得(counts)が一致する', async () => {
    const real = setupDb();
    insertShare(real, 'share-1', 'タージ・マハル', '見どころ', false);
    insertSearchHistory(real, 'インド 世界遺産', 'share-1');
    const wrapped = wrapD1(real);

    const { hasKeywords } = await lookupHeritageSearchKeywordHasFlags(wrapped, 'user1', ['タージ・マハル']);
    expect(hasKeywords['タージ・マハル']).toBe(true);

    const { keywords } = await lookupHeritageSearchKeywordCounts(wrapped, 'user1', 'タージ・マハル');
    expect(keywords).toEqual([{ keyword: 'インド 世界遺産', count: 1 }]);
  });

  it('AIチャット共有を削除すると、バッジ非表示(false)と件数ゼロ([])が一致して連動する', async () => {
    const real = setupDb();
    insertShare(real, 'share-1', 'タージ・マハル', '見どころ', true);
    insertSearchHistory(real, 'インド 世界遺産', 'share-1');
    const wrapped = wrapD1(real);

    const { hasKeywords } = await lookupHeritageSearchKeywordHasFlags(wrapped, 'user1', ['タージ・マハル']);
    expect(hasKeywords['タージ・マハル']).toBe(false);

    const { keywords } = await lookupHeritageSearchKeywordCounts(wrapped, 'user1', 'タージ・マハル');
    expect(keywords).toEqual([]);
  });

  it('複数キーワードでの検索回数を正しく集計して降順に並べる', async () => {
    const real = setupDb();
    insertShare(real, 'share-1', '万里の長城', '交通手段', false);
    insertSearchHistory(real, '中国 遺跡', 'share-1');
    insertSearchHistory(real, '中国 遺跡', 'share-1');
    insertSearchHistory(real, '長城 行き方', 'share-1');
    const wrapped = wrapD1(real);

    const { keywords } = await lookupHeritageSearchKeywordCounts(wrapped, 'user1', '万里の長城');
    expect(keywords).toEqual([
      { keyword: '中国 遺跡', count: 2 },
      { keyword: '長城 行き方', count: 1 },
    ]);
  });

  it('他ユーザーのデータは混ざらない', async () => {
    const real = setupDb();
    insertShare(real, 'share-1', 'タージ・マハル', '見どころ', false);
    db_insertOtherUserShare(real);
    insertSearchHistory(real, 'インド 世界遺産', 'share-1');
    const wrapped = wrapD1(real);
    const { hasKeywords } = await lookupHeritageSearchKeywordHasFlags(wrapped, 'user1', ['タージ・マハル']);
    expect(hasKeywords['タージ・マハル']).toBe(true);
    const { keywords } = await lookupHeritageSearchKeywordCounts(wrapped, 'other-user', 'タージ・マハル');
    expect(keywords).toEqual([]);
  });
});

function db_insertOtherUserShare(db: DatabaseSync) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)`
  ).run('share-other', 'other-user', '「タージ・マハル」の「見どころ」について説明してください', '回答', 'model-x');
}
