/**
 * POST /api/aichat/qsearch-external, POST /api/aichat/qsearch-external/latest-answer のテスト
 *
 * 対象: dynamicnekoの/ai-cacheページ(AiCachePage)がService Binding経由で
 * 呼ぶ外部API。AIチャットのスラッシュコマンド「/neko qsearch」と全く同じ
 * データ形(質問ID・質問文・言語モデルの表)を返す。質問文・回答文にキーワードを
 * 含む過去ログを検索するが、回答本文自体はここでは返さない(/neko qsearch
 * 本体がモーダルを開くまで回答を表示しない設計に揃えている)。回答本文が
 * 必要なときは、表の1行(質問ID+言語モデル)を指定して
 * /api/aichat/qsearch-external/latest-answer を別途呼ぶ。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1検索まで到達してしまう
 *   (3) keyword/id未指定・空文字でも検索/取得が実行されてしまう
 *   (4)(セキュリティ) リクエスト本文のloginをそのままuser_idとして信用すると、
 *       Bearer secretと許可済みメールアドレス1件さえ知っていれば、loginを
 *       任意の値に差し替えて他ユーザーの質問・回答全文を検索・取得できて
 *       しまう(/api/cursor-agent/query-externalで実際に発覚した脆弱性と
 *       同じ穴)。サーバー側はリクエスト本文のloginを一切受け取らず、
 *       emailに紐づくgithub_loginだけを信頼すること
 *   (5) 許可済みだがgithub_login未登録のメールアドレスがuser_id空文字等で
 *       検索されてしまう
 *   (6) D1未設定時にフェイルオープンする
 *   (7) qsearch-externalが検索結果に回答本文まで含めて返してしまう
 *       (/neko qsearch本体の表示と食い違う。件数が多いと重くもなる)
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';

const SECRET = 'test-aichat-external-secret';

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
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(allowedUsers: Record<string, string>): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE dynamicneko_aichat_allowed_users (email TEXT PRIMARY KEY, github_login TEXT);
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_hash TEXT NOT NULL DEFAULT '',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT,
      created_at TEXT NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0,
      question_hash TEXT,
      image_data_url TEXT,
      image_id TEXT,
      deleted_at TEXT
    );
    CREATE TABLE aichat_images (id TEXT PRIMARY KEY, image_data_url TEXT);
    CREATE TABLE aichat_moondream_analyses (share_id TEXT, user_id TEXT, analysis_text TEXT);
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
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

function insertShare(db: DatabaseSync, id: string, userId: string, question: string, answer: string, model = '@cf/google/gemma-4-26b-a4b-it'): void {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, userId, question, answer, model);
}

describe('POST /api/aichat/qsearch-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', keyword: 'foo' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で拒否され、D1検索は実行されない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います');
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ng@example.com', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('許可');
  });

  it('keywordが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', keyword: '  ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(400);
  });

  it('許可済みだがgithub_login未登録のメールアドレスは500で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': '' });
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(500);
  });

  it('リクエスト本文にloginを含めて他ユーザーを騙ろうとしても無視され、emailに紐づく自分のloginだけで検索される(脆弱性の再発防止)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'デプロイ手順を教えて', '自分の回答');
    insertShare(db, 'share-2', 'victim-user', 'デプロイ手順その2', '他人の回答は見えないはず');
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'victim-user', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: Array<{ id: string; question: string; model: string }> };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].id).toBe('share-1');
    expect(body.rows[0].question).toBe('デプロイ手順を教えて');
  });

  it('許可済みメールアドレスは自分(emailに紐づくlogin一致)の質問だけを検索して/neko qsearchと同じ表(質問ID・質問文・言語モデル)を返す。回答本文は含めない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います', '@cf/qwen/qwen3.8-27b');
    insertShare(db, 'share-2', 'other-user', 'デプロイ方法は?', '他人の回答は見えないはず');
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: Array<Record<string, unknown>> };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].id).toBe('share-1');
    expect(body.rows[0].question).toBe('デプロイ手順を教えて');
    expect(body.rows[0].model).toBe('qwen3.8-27b');
    expect('answer' in body.rows[0]).toBe(false);
  });

  it('jev_evaluationsに評価済み行がある回答はhasJevResult=trueを返す(/ai-cacheの緑背景判定用)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います');
    insertShare(db, 'share-2', 'nekoserver', 'デプロイ方法その2を教えて', '別の回答');
    db.prepare(
      `INSERT INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES ('answer', 'share-1', 'nekoserver', 'gemma-4-26b-a4b-it', 1, 0.8)`
    ).run();
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: Array<{ id: string; hasJevResult: boolean }> };
    const byId = Object.fromEntries(body.rows.map((r) => [r.id, r.hasJevResult]));
    expect(byId['share-1']).toBe(true);
    expect(byId['share-2']).toBe(false);
  });

  it('回答が質問文・回答文どちらにもキーワードを含まない場合はヒットしない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', '今日の天気は?', '晴れです');
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: unknown[] };
    expect(body.rows).toHaveLength(0);
  });

  it('DB未設定時はフェイルクローズで503を返す', async () => {
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET }
    );
    expect(res.status).toBe(503);
  });
});

describe('POST /api/aichat/qsearch-external/latest-answer', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/qsearch-external/latest-answer',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', id: 'share-1', model: 'qwen3.8-27b' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('idが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/qsearch-external/latest-answer',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', id: '  ', model: 'qwen3.8-27b' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(400);
  });

  it('未許可メールアドレスは403で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います');
    const res = await app.request(
      '/api/aichat/qsearch-external/latest-answer',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ng@example.com', id: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(403);
  });

  it('リクエスト本文にloginを含めて他ユーザーの回答を取得しようとしても、emailに紐づく自分のloginでしか一致しない(脆弱性の再発防止)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-victim', 'victim-user', 'デプロイ手順を教えて', '他人の回答', '@cf/google/gemma-4-26b-a4b-it');
    const res = await app.request(
      '/api/aichat/qsearch-external/latest-answer',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'victim-user', id: 'share-victim', model: 'gemma-4-26b-a4b-it' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(404);
  });

  it('質問ID+言語モデルが一致する自分の最新回答を返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'share-1', 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います', '@cf/google/gemma-4-26b-a4b-it');
    const res = await app.request(
      '/api/aichat/qsearch-external/latest-answer',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', id: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { answer: string; question: string };
    expect(body.answer).toBe('デプロイはwranglerで行います');
    expect(body.question).toBe('デプロイ手順を教えて');
  });

  it('一致する過去ログが無ければ404', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await app.request(
      '/api/aichat/qsearch-external/latest-answer',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', id: 'no-such-id', model: 'gemma-4-26b-a4b-it' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(404);
  });

  it('DB未設定時はフェイルクローズで503を返す', async () => {
    const res = await app.request(
      '/api/aichat/qsearch-external/latest-answer',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', id: 'share-1', model: 'gemma-4-26b-a4b-it' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET }
    );
    expect(res.status).toBe(503);
  });
});
