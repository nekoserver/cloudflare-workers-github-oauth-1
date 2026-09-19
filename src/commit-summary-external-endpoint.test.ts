/**
 * POST /api/commit-summary-external のテスト
 *
 * 対象: dynamicnekoの/tree-viewコミット履歴モーダルの「要約」ボタン用API。
 * commit_hashをrepo_commit_indexに照合して実在する保存済み本文を取得し、
 * GitHub Commit APIからdiffを取得したうえで既存のPR要約パイプライン
 * (runSummaryPipeline)を再利用して日本語要約を生成し、commit_summary_cache
 * (全ユーザー共有、user_id列を持たない)にキャッシュする。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1クエリまで到達してしまう
 *   (3) repo_commit_indexに存在しないcommitHashに対して任意の内容で
 *       AIを呼んでしまう(commitMessageをボディから信用しない)
 *   (4) 既にキャッシュ済みのコミットに対して再度AI/diff取得を行ってしまう
 *       (二重コスト)
 *   (5) 1時間あたりの新規要約生成数に上限が無く、無制限にAIを呼べてしまう
 *   (6) AI要約パイプライン失敗時に握りつぶしてキャッシュへ保存してしまう
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';
const GITHUB_TOKEN = 'test-github-token';

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
        async run(): Promise<{ success: boolean }> {
          stmt.run(...(args as never[]));
          return { success: true };
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
    CREATE TABLE repo_commit_index (
      commit_hash TEXT PRIMARY KEY,
      seq_num INTEGER NOT NULL,
      github_pr_number INTEGER,
      commit_message TEXT NOT NULL,
      repo_name TEXT NOT NULL
    );
    CREATE TABLE commit_summary_cache (
      commit_hash TEXT PRIMARY KEY,
      repo_name TEXT NOT NULL,
      summary TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

function insertCommit(db: DatabaseSync, hash: string, repoName: string, seqNum: number, message: string): void {
  db.prepare(`INSERT INTO repo_commit_index (commit_hash, seq_num, github_pr_number, commit_message, repo_name) VALUES (?, ?, NULL, ?, ?)`)
    .run(hash, seqNum, message, repoName);
}

function insertCachedSummary(db: DatabaseSync, hash: string, repoName: string, summary: string, model: string, createdAt?: string): void {
  if (createdAt) {
    db.prepare(`INSERT INTO commit_summary_cache (commit_hash, repo_name, summary, model, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(hash, repoName, summary, model, createdAt);
  } else {
    db.prepare(`INSERT INTO commit_summary_cache (commit_hash, repo_name, summary, model) VALUES (?, ?, ?, ?)`)
      .run(hash, repoName, summary, model);
  }
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET, GITHUB_TOKEN };

async function postSummary(
  db: DatabaseSync,
  email: string,
  commitHash: string,
  aiRun: (...args: unknown[]) => Promise<unknown>,
  extraEnv: Record<string, unknown> = {}
): Promise<Response> {
  const userToken = await makeUserToken(email);
  return app.request(
    '/api/commit-summary-external',
    { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, commitHash }) },
    { ...BASE_ENV, DB: wrapD1(db), AI: { run: aiRun }, ...extraEnv }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/commit-summary-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/commit-summary-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, commitHash: 'h1' }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('commitHashが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSummary(db, 'ok@example.com', '', vi.fn());
    expect(res.status).toBe(400);
  });

  it('未許可メールアドレスは403で拒否され、AI/diff取得は呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommit(db, 'h1', 'nekoserver/dynamicneko', 1, 'fix: バグ修正');
    const aiRun = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await postSummary(db, 'ng@example.com', 'h1', aiRun);
    expect(res.status).toBe(403);
    expect(aiRun).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('repo_commit_indexに存在しないcommitHashは404で、AI/diff取得は呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const aiRun = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await postSummary(db, 'ok@example.com', 'does-not-exist', aiRun);
    expect(res.status).toBe(404);
    expect(aiRun).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('既にキャッシュ済みのコミットはAI/diff取得を呼ばず、キャッシュ内容をそのまま返す(cached:true)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommit(db, 'h1', 'nekoserver/dynamicneko', 1, 'fix: バグ修正');
    insertCachedSummary(db, 'h1', 'nekoserver/dynamicneko', '- 概要\nバグを修正した', 'test-model');
    const aiRun = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await postSummary(db, 'ok@example.com', 'h1', aiRun);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: string; model: string; cached: boolean };
    expect(body.summary).toBe('- 概要\nバグを修正した');
    expect(body.model).toBe('test-model');
    expect(body.cached).toBe(true);
    expect(aiRun).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('正常系: diffを取得してAI要約を生成し、commit_summary_cacheへ保存してcached:falseで返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommit(db, 'h1', 'nekoserver/dynamicneko', 1, 'fix: SQLインジェクションの修正\n\n詳細な説明文');
    let requestedUrl = '';
    const fetchMock = vi.fn(async (url: string) => {
      requestedUrl = url;
      return { ok: true, text: async () => 'diff --git a/foo.ts b/foo.ts\n+fixed', status: 200 } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const aiRun = vi.fn(async () => ({ response: '- 概要\nSQLインジェクションを修正した' }));

    const res = await postSummary(db, 'ok@example.com', 'h1', aiRun);
    expect(res.status).toBe(200);
    expect(requestedUrl).toBe('https://api.github.com/repos/nekoserver/dynamicneko/commits/h1');
    const body = (await res.json()) as { summary: string; model: string; cached: boolean };
    expect(body.summary).toBe('- 概要\nSQLインジェクションを修正した');
    expect(body.cached).toBe(false);

    const savedRow = db.prepare('SELECT summary, repo_name FROM commit_summary_cache WHERE commit_hash = ?').get('h1') as
      | { summary: string; repo_name: string }
      | undefined;
    expect(savedRow?.summary).toBe('- 概要\nSQLインジェクションを修正した');
    expect(savedRow?.repo_name).toBe('nekoserver/dynamicneko');
  });

  it('AI要約パイプラインが失敗した場合は502で、commit_summary_cacheへは保存しない(握りつぶさない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommit(db, 'h1', 'nekoserver/dynamicneko', 1, 'fix: バグ修正');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'diff', status: 200 }) as Response));
    const aiRun = vi.fn(async () => ({ response: '' }));

    const res = await postSummary(db, 'ok@example.com', 'h1', aiRun);
    expect(res.status).toBe(502);
    const savedRow = db.prepare('SELECT * FROM commit_summary_cache WHERE commit_hash = ?').get('h1');
    expect(savedRow).toBeUndefined();
  });

  it('1時間あたりの新規要約生成数の上限に達している場合は429で拒否し、AI/diff取得は呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommit(db, 'h-new', 'nekoserver/dynamicneko', 31, 'fix: 31件目のバグ修正');
    for (let i = 0; i < 30; i++) {
      insertCachedSummary(db, `h-old-${i}`, 'nekoserver/dynamicneko', '既存の要約', 'test-model');
    }
    const aiRun = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await postSummary(db, 'ok@example.com', 'h-new', aiRun);
    expect(res.status).toBe(429);
    expect(aiRun).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GITHUB_TOKEN未設定の場合は503', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommit(db, 'h1', 'nekoserver/dynamicneko', 1, 'fix: バグ修正');
    const res = await postSummary(db, 'ok@example.com', 'h1', vi.fn(), { GITHUB_TOKEN: undefined });
    expect(res.status).toBe(503);
  });
});
