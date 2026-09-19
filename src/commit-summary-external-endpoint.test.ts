/**
 * POST /api/commit-summary-external のテスト
 *
 * 対象: dynamicnekoの/tree-viewコミット履歴モーダルの「要約」ボタン用API。
 * commitHashの実在確認とcommit_messageの取得はGitHub Commit APIへ直接
 * 問い合わせて行い(repo_commit_indexという手動同期のミラーテーブルには
 * 依存しない。直近マージされたコミットがまだ反映されておらず「存在しない」
 * と誤判定される不具合があったため2026-09-19に変更)、GitHub Commit APIから
 * diffを取得したうえで既存のPR要約パイプライン(runSummaryPipeline)を
 * 再利用して日本語要約を生成し、commit_summary_cache(全ユーザー共有、
 * user_id列を持たない)にキャッシュする。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1クエリまで到達してしまう
 *   (3) repoNameがcommit-summary-externalの対象外リポジトリでも
 *       受け付けてしまう(任意のリポジトリのコミットを要約できてしまう)
 *   (4) GitHub上に実在しないcommitHashに対して任意の内容でAIを呼んでしまう
 *       (commitMessageをボディから信用しない)
 *   (5) 既にキャッシュ済みのコミットに対して再度AI/diff取得を行ってしまう
 *       (二重コスト)
 *   (6) 1時間あたりの新規要約生成数に上限が無く、無制限にAIを呼べてしまう
 *   (7) AI要約パイプライン失敗時に握りつぶしてキャッシュへ保存してしまう
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';
const GITHUB_TOKEN = 'test-github-token';
const REPO_NAME = 'nekoserver/dynamicneko';

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

// GitHub Commit API(https://api.github.com/repos/{repo}/commits/{sha})は
// JSON(メタデータ取得用、Accept: application/vnd.github+json)とdiff
// (Accept: application/vnd.github.v3.diff)の両方でこのendpointが叩くため、
// Acceptヘッダで振り分けるfetchモックを共通ヘルパーとして用意する。
function makeGithubFetchMock(opts: { exists?: boolean; message?: string; diff?: string } = {}) {
  const exists = opts.exists ?? true;
  const message = opts.message ?? 'fix: バグ修正';
  const diff = opts.diff ?? 'diff --git a/foo.ts b/foo.ts\n+fixed';
  const calls: { url: string; accept: string }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const accept = (init?.headers as Record<string, string> | undefined)?.Accept ?? '';
    calls.push({ url, accept });
    if (!exists) return { ok: false, status: 404, text: async () => 'Not Found' } as Response;
    if (accept === 'application/vnd.github.v3.diff') {
      return { ok: true, status: 200, text: async () => diff } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ commit: { message } }) } as Response;
  });
  return { fetchMock, calls };
}

async function postSummary(
  db: DatabaseSync,
  email: string,
  commitHash: string,
  repoName: string,
  aiRun: (...args: unknown[]) => Promise<unknown>,
  extraEnv: Record<string, unknown> = {}
): Promise<Response> {
  const userToken = await makeUserToken(email);
  return app.request(
    '/api/commit-summary-external',
    { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, commitHash, repoName }) },
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
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, commitHash: 'h1', repoName: REPO_NAME }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('commitHashが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSummary(db, 'ok@example.com', '', REPO_NAME, vi.fn());
    expect(res.status).toBe(400);
  });

  it('対象外のrepoNameは400で拒否され、GitHub API/AIは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { fetchMock } = makeGithubFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const aiRun = vi.fn();
    const res = await postSummary(db, 'ok@example.com', 'h1', 'someone/unrelated-repo', aiRun);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(aiRun).not.toHaveBeenCalled();
  });

  it('未許可メールアドレスは403で拒否され、GitHub API/AIは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { fetchMock } = makeGithubFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const aiRun = vi.fn();
    const res = await postSummary(db, 'ng@example.com', 'h1', REPO_NAME, aiRun);
    expect(res.status).toBe(403);
    expect(aiRun).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GitHub上に実在しないcommitHashは404で、AIは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { fetchMock } = makeGithubFetchMock({ exists: false });
    vi.stubGlobal('fetch', fetchMock);
    const aiRun = vi.fn();
    const res = await postSummary(db, 'ok@example.com', 'does-not-exist', REPO_NAME, aiRun);
    expect(res.status).toBe(404);
    expect(aiRun).not.toHaveBeenCalled();
  });

  it('既にキャッシュ済みのコミットはAI/diff取得を呼ばず、キャッシュ内容をそのまま返す(cached:true)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCachedSummary(db, 'h1', REPO_NAME, '- 概要\nバグを修正した', 'test-model');
    const { fetchMock, calls } = makeGithubFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const aiRun = vi.fn();

    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME, aiRun);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: string; model: string; cached: boolean };
    expect(body.summary).toBe('- 概要\nバグを修正した');
    expect(body.model).toBe('test-model');
    expect(body.cached).toBe(true);
    expect(aiRun).not.toHaveBeenCalled();
    // メタデータ確認(json)は1回呼ぶが、diff取得は呼ばない。
    expect(calls.filter((c) => c.accept === 'application/vnd.github.v3.diff').length).toBe(0);
  });

  it('正常系: GitHubからcommit_messageとdiffを取得してAI要約を生成し、commit_summary_cacheへ保存してcached:falseで返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { fetchMock, calls } = makeGithubFetchMock({ message: 'fix: SQLインジェクションの修正\n\n詳細な説明文' });
    vi.stubGlobal('fetch', fetchMock);
    const aiRun = vi.fn(async () => ({ response: '- 概要\nSQLインジェクションを修正した' }));

    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME, aiRun);
    expect(res.status).toBe(200);
    expect(calls.every((c) => c.url === `https://api.github.com/repos/${REPO_NAME}/commits/h1`)).toBe(true);
    expect(calls.some((c) => c.accept === 'application/vnd.github.v3.diff')).toBe(true);
    const body = (await res.json()) as { summary: string; model: string; cached: boolean };
    expect(body.summary).toBe('- 概要\nSQLインジェクションを修正した');
    expect(body.cached).toBe(false);

    const savedRow = db.prepare('SELECT summary, repo_name FROM commit_summary_cache WHERE commit_hash = ?').get('h1') as
      | { summary: string; repo_name: string }
      | undefined;
    expect(savedRow?.summary).toBe('- 概要\nSQLインジェクションを修正した');
    expect(savedRow?.repo_name).toBe(REPO_NAME);
  });

  it('AI要約パイプラインが失敗した場合は502で、commit_summary_cacheへは保存しない(握りつぶさない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { fetchMock } = makeGithubFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const aiRun = vi.fn(async () => ({ response: '' }));

    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME, aiRun);
    expect(res.status).toBe(502);
    const savedRow = db.prepare('SELECT * FROM commit_summary_cache WHERE commit_hash = ?').get('h1');
    expect(savedRow).toBeUndefined();
  });

  it('1時間あたりの新規要約生成数の上限に達している場合は429で拒否し、diff取得/AIは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    for (let i = 0; i < 30; i++) {
      insertCachedSummary(db, `h-old-${i}`, REPO_NAME, '既存の要約', 'test-model');
    }
    const { fetchMock, calls } = makeGithubFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const aiRun = vi.fn();

    const res = await postSummary(db, 'ok@example.com', 'h-new', REPO_NAME, aiRun);
    expect(res.status).toBe(429);
    expect(aiRun).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.accept === 'application/vnd.github.v3.diff').length).toBe(0);
  });

  it('GITHUB_TOKEN未設定の場合は503', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME, vi.fn(), { GITHUB_TOKEN: undefined });
    expect(res.status).toBe(503);
  });
});
