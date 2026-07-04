import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { lookupHeritageKeywordTopics } from './index';

// ===========================================================================
// 根本原因:
//   世界遺産アクセスランキングページのアコーディオンで表示される「見どころ」等の
//   トピックバッジは heritage_question_view_log（閲覧ログ）だけを見て表示可否を
//   決めている。一方、バッジをクリックした際に実際の回答本文を取得する
//   /api/aichat/shares/by-keyword は ai_chat_shares を deleted_at IS NULL で
//   絞り込んで検索する。
//   AIチャット共有（ai_chat_shares）を削除（ソフトデリート）しても
//   heritage_question_view_log 側の行は一切連動して削除されないため、
//   「回答は消えているのにバッジだけ残り続け、クリックしても
//   『該当する過去ログが見つかりませんでした』になる」という不整合が発生する。
//
// 本テストは実際の SQLite（node:sqlite）で本番と同じスキーマ・同じ
// lookupHeritageKeywordTopics の実装を実行し、この不整合を再現する。
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE TABLE heritage_ai_question_masters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL UNIQUE
    );
    CREATE TABLE heritage_question_view_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      heritage_name TEXT NOT NULL,
      question_master_id INTEGER NOT NULL,
      searched_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    INSERT INTO heritage_ai_question_masters (id, topic) VALUES
      (1, '交通手段'), (2, '見どころ'), (3, '最寄り空港'),
      (4, '鉄道でのアクセス'), (5, '宿泊施設'), (6, 'スポーツ施設');
  `);
  return db;
}

function insertShare(db: DatabaseSync, id: string, heritage: string, topic: string, deleted: boolean) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, deleted_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, 'user1', `「${heritage}」の「${topic}」について説明してください`, '回答本文', 'model-x', deleted ? '2026-01-01T00:00:00Z' : null);
}

function insertViewLog(db: DatabaseSync, heritage: string, topicId: number) {
  db.prepare(
    `INSERT INTO heritage_question_view_log (user_id, heritage_name, question_master_id) VALUES (?, ?, ?)`
  ).run('user1', heritage, topicId);
}

describe('lookupHeritageKeywordTopics — 実SQLiteでの削除済み共有の除外', () => {
  it('回答がまだ存在する場合はバッジが表示される（正常系）', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'タージ・マハル', '見どころ', false);
    insertViewLog(db, 'タージ・マハル', 2);
    const { hits } = await lookupHeritageKeywordTopics(wrapD1(db), 'user1', ['タージ・マハル']);
    expect(hits['タージ・マハル']).toContain('見どころ');
  });

  it('バグ再現: AIチャット共有を削除しても閲覧ログが残り、実データが無いのにバッジが表示され続ける', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'タージ・マハル', '見どころ', true); // ソフトデリート済み
    insertViewLog(db, 'タージ・マハル', 2);
    const { hits } = await lookupHeritageKeywordTopics(wrapD1(db), 'user1', ['タージ・マハル']);
    // 修正後はここが false（バッジ非表示）になるべき
    expect(hits['タージ・マハル']).not.toContain('見どころ');
  });

  it('同じ世界遺産の別トピックの回答が生きていれば、そのトピックのバッジだけは正しく表示される', async () => {
    const db = setupDb();
    insertShare(db, 'share-1', 'タージ・マハル', '見どころ', true); // 削除済み
    insertShare(db, 'share-2', 'タージ・マハル', '交通手段', false); // 生存
    insertViewLog(db, 'タージ・マハル', 2); // 見どころ
    insertViewLog(db, 'タージ・マハル', 1); // 交通手段
    const { hits } = await lookupHeritageKeywordTopics(wrapD1(db), 'user1', ['タージ・マハル']);
    expect(hits['タージ・マハル']).toContain('交通手段');
    expect(hits['タージ・マハル']).not.toContain('見どころ');
  });
});
