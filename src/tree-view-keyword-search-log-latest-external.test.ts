/**
 * POST /api/tree-view-keyword-search-log-latest-external のテスト
 *
 * 対象: dynamicnekoのtree-view検索結果パネルの「更新可」/「最新状態」
 * バッジ(ユーザー要望2026-10-16)が、前回保存済みの直近1件のスナップ
 * ショットを取得するためのAPI。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1クエリまで到達してしまう
 *   (3) repoName/queryが空でも受け付けてしまう
 *   (4) 一度も保存していない場合にエラーとして扱ってしまう(found: falseで
 *       正常に返すべき)
 *   (5) 他ユーザー(他のuser_id)が保存したログを誤って返してしまう
 *   (6) 同じrepoName・queryで複数回保存されている場合に、最新(searched_at
 *       が一番新しい)もの以外を返してしまう
 *   (7) 別のquery文字列で保存されたログを混同して返してしまう
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';

function makeUserToken(email: string, secret: string = USER_TOKEN_SECRET, expiresIn = 60): Promise<string> {
  return createJWT({ sub: email }, secret, expiresIn);
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
        async run(): Promise<{ success: boolean; meta: { last_row_id: number } }> {
          stmt.run(...(args as never[]));
          const { id } = db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number };
          return { success: true, meta: { last_row_id: id } };
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
    CREATE TABLE tree_view_keyword_search_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      file_count INTEGER NOT NULL,
      searched_at TEXT NOT NULL
    );
    CREATE TABLE tree_view_keyword_search_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      search_log_id INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      occurrence_count INTEGER NOT NULL
    );
  `);
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

function insertLog(db: DatabaseSync, userId: string, repoName: string, query: string, fileCount: number, searchedAt: string): number {
  db.prepare(
    `INSERT INTO tree_view_keyword_search_log (repo_name, user_id, query, file_count, searched_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(repoName, userId, query, fileCount, searchedAt);
  return (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
}

function insertResult(db: DatabaseSync, searchLogId: number, keyword: string, occurrenceCount: number): void {
  db.prepare(`INSERT INTO tree_view_keyword_search_results (search_log_id, keyword, occurrence_count) VALUES (?, ?, ?)`).run(
    searchLogId,
    keyword,
    occurrenceCount,
  );
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET };

async function postLatest(db: DatabaseSync, email: string, repoName: string, query: string, bearer: string = SECRET): Promise<Response> {
  const userToken = await makeUserToken(email);
  return app.request(
    '/api/tree-view-keyword-search-log-latest-external',
    { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, repoName, query }) },
    { ...BASE_ENV, DB: wrapD1(db) },
  );
}

describe('POST /api/tree-view-keyword-search-log-latest-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postLatest(db, 'ok@example.com', 'owner/repo', 'oauth', 'wrong-secret');
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postLatest(db, 'ng@example.com', 'owner/repo', 'oauth');
    expect(res.status).toBe(403);
  });

  it('repoNameが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postLatest(db, 'ok@example.com', '', 'oauth');
    expect(res.status).toBe(400);
  });

  it('queryが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postLatest(db, 'ok@example.com', 'owner/repo', '');
    expect(res.status).toBe(400);
  });

  it('一度も保存していない場合はfound: falseを200で返す(エラーにしない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postLatest(db, 'ok@example.com', 'owner/repo', 'oauth');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { found: boolean };
    expect(body.found).toBe(false);
  });

  it('正常系: 保存済みの最新スナップショット(fileCount・results)を返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const logId = insertLog(db, 'nekoserver', 'owner/repo', 'oauth', 3, '2026-10-16T00:00:00Z');
    insertResult(db, logId, 'リファクタ', 5);
    insertResult(db, logId, '認証', 2);

    const res = await postLatest(db, 'ok@example.com', 'owner/repo', 'oauth');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { found: boolean; fileCount: number; results: { keyword: string; occurrenceCount: number }[] };
    expect(body.found).toBe(true);
    expect(body.fileCount).toBe(3);
    expect(body.results.sort((a, b) => a.keyword.localeCompare(b.keyword))).toEqual([
      { keyword: 'リファクタ', occurrenceCount: 5 },
      { keyword: '認証', occurrenceCount: 2 },
    ]);
  });

  it('同じrepoName・queryで複数回保存されている場合、searched_atが最新のものを返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const oldLogId = insertLog(db, 'nekoserver', 'owner/repo', 'oauth', 1, '2026-10-15T00:00:00Z');
    insertResult(db, oldLogId, '古い', 1);
    const newLogId = insertLog(db, 'nekoserver', 'owner/repo', 'oauth', 4, '2026-10-16T00:00:00Z');
    insertResult(db, newLogId, '新しい', 9);

    const res = await postLatest(db, 'ok@example.com', 'owner/repo', 'oauth');
    const body = (await res.json()) as { fileCount: number; results: { keyword: string }[] };
    expect(body.fileCount).toBe(4);
    expect(body.results).toEqual([{ keyword: '新しい', occurrenceCount: 9 }]);
  });

  it('別のqueryで保存されたログは混同しない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const logId = insertLog(db, 'nekoserver', 'owner/repo', 'jwt', 1, '2026-10-16T00:00:00Z');
    insertResult(db, logId, 'jwt用', 1);

    const res = await postLatest(db, 'ok@example.com', 'owner/repo', 'oauth');
    const body = (await res.json()) as { found: boolean };
    expect(body.found).toBe(false);
  });

  it('他ユーザーが保存したログは返さない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver', 'other@example.com': 'other-login' });
    const logId = insertLog(db, 'other-login', 'owner/repo', 'oauth', 1, '2026-10-16T00:00:00Z');
    insertResult(db, logId, '他人のキー', 1);

    const res = await postLatest(db, 'ok@example.com', 'owner/repo', 'oauth');
    const body = (await res.json()) as { found: boolean };
    expect(body.found).toBe(false);
  });
});
