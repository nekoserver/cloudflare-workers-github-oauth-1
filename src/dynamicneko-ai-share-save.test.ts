import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { saveDynamicnekoAiShare } from './index';

// 対象: dynamicnekoのAI問い合わせウィジェット(/api/aichat/query-external)から
// 得られたAI応答を、AIチャットページ(/aichat)左サイドパネルから参照できるよう
// ai_chat_sharesへ保存するsaveDynamicnekoAiShare。dynamicneko側はWebセッション
// (JWT)を持たないため、dynamicneko側のGitHubログインsession.loginをそのまま
// user_idとして使い、対応するuser_sessionsが存在する場合のみ保存する。
//
// 故障シナリオ:
//   (1) loginが空の場合にNULL/空文字のuser_idで保存してしまう(FK不整合)
//   (2) 対応するuser_sessionsが存在しない場合でも保存してしまう
//       (本体Workerに一度もログインしたことが無いdynamicnekoユーザーの
//       データが宙に浮いたuser_idで残ってしまう)
//   (3) DB書き込みが失敗した場合に例外を伝播させ、dynamicneko側への
//       AI応答自体まで失敗させてしまう(付随機能のため握りつぶすべき)
//   (4) source列に'dynamicneko'が正しく記録されない(Web由来・Slack由来との
//       区別ができない)

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              const row = stmt.get(...(args as never[]));
              return (row ? (row as T) : null);
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
    CREATE TABLE user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE
    );
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_hash TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      conversation_hash TEXT,
      question_hash TEXT,
      source TEXT
    );
  `);
  return db;
}

const baseParams = {
  question: 'このWorkerは何をする?',
  answer: 'ダイナミックWorkerを実行します',
  model: '@cf/google/gemma-4-26b-a4b-it',
};

describe('saveDynamicnekoAiShare: dynamicnekoからのAI応答をai_chat_sharesへ保存する', () => {
  it('対応するuser_sessionsが存在するloginなら、そのユーザー名義でai_chat_sharesへ保存する(source=dynamicneko)', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO user_sessions (user_id) VALUES (?)').run('octocat');

    await saveDynamicnekoAiShare(wrapD1(db) as never, 'octocat', baseParams);

    const row = db.prepare('SELECT * FROM ai_chat_shares').get() as Record<string, unknown>;
    expect(row.user_id).toBe('octocat');
    expect(row.question).toBe('このWorkerは何をする?');
    expect(row.answer).toBe('ダイナミックWorkerを実行します');
    expect(row.model).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(row.source).toBe('dynamicneko');
  });

  it('loginが空文字の場合は保存をスキップし、例外を投げない', async () => {
    const db = setupDb();
    await expect(saveDynamicnekoAiShare(wrapD1(db) as never, '', baseParams)).resolves.toBeUndefined();
    const count = (db.prepare('SELECT COUNT(*) as c FROM ai_chat_shares').get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it('対応するuser_sessionsが無いloginの場合は保存をスキップし、例外を投げない', async () => {
    const db = setupDb();
    await expect(saveDynamicnekoAiShare(wrapD1(db) as never, 'unknown-user', baseParams)).resolves.toBeUndefined();
    const count = (db.prepare('SELECT COUNT(*) as c FROM ai_chat_shares').get() as { c: number }).c;
    expect(count).toBe(0);
  });

  it('DB書き込みが失敗しても例外を投げない(付随機能のためdynamicneko側への応答は成功のまま扱う)', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO user_sessions (user_id) VALUES (?)').run('octocat');
    db.exec('DROP TABLE ai_chat_shares');

    await expect(saveDynamicnekoAiShare(wrapD1(db) as never, 'octocat', baseParams)).resolves.toBeUndefined();
  });

  it('別のloginは別のユーザー名義で独立して保存される', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO user_sessions (user_id) VALUES (?)').run('alice');
    db.prepare('INSERT INTO user_sessions (user_id) VALUES (?)').run('bob');

    await saveDynamicnekoAiShare(wrapD1(db) as never, 'alice', baseParams);
    await saveDynamicnekoAiShare(wrapD1(db) as never, 'bob', { ...baseParams, question: '別の質問' });

    const rows = db.prepare('SELECT user_id, question FROM ai_chat_shares ORDER BY user_id').all() as Array<{ user_id: string; question: string }>;
    expect(rows).toEqual([
      { user_id: 'alice', question: 'このWorkerは何をする?' },
      { user_id: 'bob', question: '別の質問' },
    ]);
  });
});
