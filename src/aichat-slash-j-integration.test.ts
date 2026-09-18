/**
 * 対象: src/index.ts のAIチャットdeps `jevKeywordLookup`(/neko j <キーワード>
 * が実際に叩くクエリ本体)。
 *
 * 背景: 以前は誰も書き込まないjev_country_keyword_evaluationsテーブルを
 * 見ていたため常に0件になっていた。dynamicnekoの/ai-cacheページの
 * 一括評価ボタンが実際に書き込むのはjev_evaluations(share_id/modelキー)
 * なので、これをai_chat_shares.question・answerのキーワード部分一致
 * (searchAiChatSharesと同じ検索キーの意味論)で絞り込んで件数を返すよう
 * 修正した。このテストはその接続を保証する。
 *
 * (実データ確認済み: jev_evaluations.modelにはCloudflare Workers AIの
 * モデルID(例: @cf/google/gemma-4-26b-a4b-it)が入り、「ChatGPT」という
 * モデルは存在しない。/neko jのキーワードはモデル名ではなく、/ai-cacheの
 * 検索ボックスで使う検索キー=question/answer中の文字列を指す)
 *
 * 故障シナリオ:
 *   (1) jev_evaluationsに実データがあっても0件のまま(テーブル参照ミス)
 *   (2) 他ユーザーのjev_evaluationsが混ざる
 *   (3) target_type='source_question'(質問文自体の評価)まで誤ってカウントする
 *   (4) 同じshareに複数ラベル分の行があると重複カウントする
 *   (5) 論理削除済み(ai_chat_shares.deleted_at IS NOT NULL)のshareを含めてしまう
 *   (6) 検索キーがquestionではなくanswer側にしか出てこない場合にヒットしない
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

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

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      last_activity_at TEXT,
      revoked_at TEXT,
      idle_timeout_seconds INTEGER
    );
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_hash TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT,
      created_at TEXT,
      access_count INTEGER DEFAULT 0,
      question_hash TEXT,
      image_id TEXT,
      image_data_url TEXT,
      deleted_at TEXT
    );
    CREATE TABLE jev_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      share_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT,
      jev_label_id INTEGER NOT NULL,
      value REAL NOT NULL
    );
  `);
  db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('test-user', datetime('now'), NULL)`).run();
  return db;
}

async function postSlashJ(db: DatabaseSync, keyword: string, sub = 'test-user'): Promise<Response> {
  const authHeader = await makeAuthHeader(sub);
  return app.request(
    '/api/aichat',
    { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `/neko j ${keyword}` }) },
    { JWT_SECRET, DB: wrapD1(db) }
  );
}

describe('/neko j <キーワード> は実際にjev_evaluationsのデータを読む', () => {
  it('jev_evaluationsに評価済みデータがあればヒット件数として返す', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES ('s1', 'test-user', 'フランスの首都は?', '...', 'gpt', datetime('now'))`
    ).run();
    db.prepare(
      `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', 's1', 'test-user', 'gpt', 1, 0.9)`
    ).run();

    const res = await postSlashJ(db, 'フランス');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('1件');
    expect(body.response).not.toContain('未登録');
  });

  it('他ユーザーのjev_evaluationsは含めない', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO user_sessions (user_id, last_activity_at, revoked_at) VALUES ('other-user', datetime('now'), NULL)`).run();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES ('s1', 'other-user', 'フランスの首都は?', '...', 'gpt', datetime('now'))`
    ).run();
    db.prepare(
      `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', 's1', 'other-user', 'gpt', 1, 0.9)`
    ).run();

    const res = await postSlashJ(db, 'フランス', 'test-user');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('0件(未登録)');
  });

  it('target_type=source_questionは対象外(回答評価のみカウント)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES ('s1', 'test-user', 'フランスの首都は?', '...', 'gpt', datetime('now'))`
    ).run();
    db.prepare(
      `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('source_question', 's1', 'test-user', NULL, 1, 0.9)`
    ).run();

    const res = await postSlashJ(db, 'フランス');
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('0件(未登録)');
  });

  it('同じshareに複数ラベル分の行があっても1件として数える(share単位の重複排除)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES ('s1', 'test-user', 'フランスの首都は?', '...', 'gpt', datetime('now'))`
    ).run();
    for (let labelId = 1; labelId <= 20; labelId++) {
      db.prepare(
        `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', 's1', 'test-user', 'gpt', ?, 0.5)`
      ).run(labelId);
    }

    const res = await postSlashJ(db, 'フランス');
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('1件');
  });

  it('論理削除済み(deleted_at設定済み)のshareはカウントしない', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at, deleted_at) VALUES ('s1', 'test-user', 'フランスの首都は?', '...', 'gpt', datetime('now'), datetime('now'))`
    ).run();
    db.prepare(
      `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', 's1', 'test-user', 'gpt', 1, 0.9)`
    ).run();

    const res = await postSlashJ(db, 'フランス');
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('0件(未登録)');
  });

  it('キーワードがquestionではなくanswer側にしか出てこなくてもヒットする(検索キーの意味論はsearchAiChatSharesと同じ)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES ('s1', 'test-user', '首都はどこ?', '日本の首都は東京です', 'gemma-4-26b-a4b-it', datetime('now'))`
    ).run();
    db.prepare(
      `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', 's1', 'test-user', 'gemma-4-26b-a4b-it', 1, 0.9)`
    ).run();

    const res = await postSlashJ(db, '東京');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('1件');
    expect(body.response).not.toContain('未登録');
  });

  it('実データに存在しないキーワード(例: モデルとして存在しない「ChatGPT」)は0件(未登録)を返す', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES ('s1', 'test-user', '「Few-shot」って何ですか', '...', 'gemma-4-26b-a4b-it', datetime('now'))`
    ).run();
    db.prepare(
      `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', 's1', 'test-user', 'gemma-4-26b-a4b-it', 1, 0.9)`
    ).run();

    const res = await postSlashJ(db, 'ChatGPT');
    const body = (await res.json()) as { response?: string };
    expect(body.response).toContain('0件(未登録)');
  });
});
