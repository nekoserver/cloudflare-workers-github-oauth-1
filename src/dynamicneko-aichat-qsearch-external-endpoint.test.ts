/**
 * POST /api/aichat/qsearch-external のテスト
 *
 * 対象: dynamicnekoの/ai-cacheページ(AiCachePage)がService Binding経由で
 * 呼ぶ外部API。AIチャットのスラッシュコマンド「/neko qsearch」と同じ
 * searchAiChatShares を使い、質問文・回答文にキーワードを含む過去ログを
 * 検索して回答本文まで含めて返す。Bearer secret(AICHAT_EXTERNAL_SECRET、
 * 他の外部APIと共用)で認証した上、dynamicneko_aichat_allowed_usersに
 * 登録されたメールアドレスかどうかを判定する。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1検索まで到達してしまう
 *   (3) keyword未指定・空文字でも検索が実行されてしまう
 *   (4)(セキュリティ) リクエスト本文のloginをそのままuser_idとして信用すると、
 *       Bearer secretと許可済みメールアドレス1件さえ知っていれば、loginを
 *       任意の値に差し替えて他ユーザーの質問・回答全文を検索できてしまう
 *       (/api/cursor-agent/query-externalで実際に発覚した脆弱性と同じ穴)。
 *       サーバー側はリクエスト本文のloginを一切受け取らず、emailに紐づく
 *       github_loginだけを信頼すること
 *   (5) 許可済みだがgithub_login未登録のメールアドレスがuser_id空文字等で
 *       検索されてしまう
 *   (6) D1未設定時にフェイルオープンする
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
  `);
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

function insertShare(db: DatabaseSync, userId: string, question: string, answer: string, model = '@cf/google/gemma-4-26b-a4b-it'): void {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(`share-${Math.random().toString(36).slice(2)}`, userId, question, answer, model);
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
    insertShare(db, 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います');
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
    insertShare(db, 'nekoserver', 'デプロイ手順を教えて', '自分の回答');
    insertShare(db, 'victim-user', 'デプロイ手順その2', '他人の回答は見えないはず');
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', login: 'victim-user', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: Array<{ question: string; answer: string | null }> };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].question).toBe('デプロイ手順を教えて');
    expect(body.rows[0].answer).toBe('自分の回答');
  });

  it('許可済みメールアドレスは自分(emailに紐づくlogin一致)の質問・回答だけを検索して返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'nekoserver', 'デプロイ手順を教えて', 'デプロイはwranglerで行います');
    insertShare(db, 'other-user', 'デプロイ方法は?', '他人の回答は見えないはず');
    const res = await app.request(
      '/api/aichat/qsearch-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ok@example.com', keyword: 'デプロイ' }) },
      { AICHAT_EXTERNAL_SECRET: SECRET, DB: wrapD1(db) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: Array<{ id: string; question: string; createdAtJst: string; answer: string | null; model?: string | null }> };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].question).toBe('デプロイ手順を教えて');
    expect(body.rows[0].answer).toBe('デプロイはwranglerで行います');
  });

  it('回答が質問文・回答文どちらにもキーワードを含まない場合はヒットしない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertShare(db, 'nekoserver', '今日の天気は?', '晴れです');
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
