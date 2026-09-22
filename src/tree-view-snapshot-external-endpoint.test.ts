/**
 * POST /api/tree-view-repos-external, /api/tree-view-snapshot-external,
 * /api/tree-view-snapshot-refresh-external, および cronから呼ばれる
 * syncAllTreeViewSnapshots のテスト。
 *
 * 対象: dynamicnekoの/tree-viewサイドバーツリーを、以前は手作業でgit ls-tree
 * の結果をTypeScriptファイルへ焼き込んでいた静的スナップショットから、
 * cronトリガー(scheduled)によるGitHub Trees API同期+D1キャッシュへ切り替える
 * ための基盤。「今すぐ更新」の手動ライブ再取得も併用する(ユーザー要望)。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1クエリまで到達してしまう
 *   (3) repoNameがnekoserver組織配下以外でも受け付けてしまう
 *   (4) まだ同期されていないリポジトリのスナップショット取得で
 *       握りつぶして200(空データ)を返してしまう
 *   (5) 手動更新でGitHub API呼び出し失敗時に握りつぶしてok扱いにしてしまう
 *   (6) 手動更新のレート制限が無く、無制限にGitHub APIを叩けてしまう
 *   (7) syncAllTreeViewSnapshotsが、内容が変わっていないリポジトリまで
 *       毎回D1へ書き込んでしまう(不要な書き込みが発生する)
 *   (8) syncAllTreeViewSnapshotsが、installation_permissionsに存在しない
 *       (=GitHub Appがアクセスできない)リポジトリまで同期してしまう
 *   (9) syncAllTreeViewSnapshotsで1つのリポジトリの取得が失敗しても、
 *       残りのリポジトリの同期が止まってしまう
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app, { syncAllTreeViewSnapshots } from './index';
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
    CREATE TABLE tree_view_snapshots (repo_name TEXT PRIMARY KEY, tree_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE tree_view_snapshot_refresh_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, repo_name TEXT NOT NULL, requested_at TEXT NOT NULL);
    CREATE TABLE tree_view_update_log (id INTEGER PRIMARY KEY AUTOINCREMENT, repo_name TEXT NOT NULL, update_source TEXT NOT NULL, status TEXT NOT NULL, changed INTEGER, error_detail TEXT, executed_at TEXT NOT NULL);
    CREATE TABLE installation_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installation_id INTEGER NOT NULL,
      repo_name TEXT,
      repository_selection TEXT NOT NULL DEFAULT 'selected',
      permissions TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
  `);
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

function insertSnapshot(db: DatabaseSync, repoName: string, tree: unknown, updatedAt = '2026-09-19T00:00:00.000Z'): void {
  db.prepare('INSERT INTO tree_view_snapshots (repo_name, tree_json, updated_at) VALUES (?, ?, ?)')
    .run(repoName, JSON.stringify(tree), updatedAt);
}

function insertInstallationRepo(db: DatabaseSync, repoName: string): void {
  db.prepare(
    `INSERT INTO installation_permissions (installation_id, repo_name, repository_selection, permissions, updated_at) VALUES (1, ?, 'selected', '{}', '2026-09-19T00:00:00.000Z')`
  ).run(repoName);
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET, GITHUB_TOKEN };

async function postExternal(path: string, db: DatabaseSync, body: Record<string, unknown>, authHeader = `Bearer ${SECRET}`): Promise<Response> {
  return app.request(
    path,
    { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { ...BASE_ENV, DB: wrapD1(db) }
  );
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('POST /api/tree-view-repos-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postExternal('/api/tree-view-repos-external', db, { userToken: 'x' }, 'Bearer wrong');
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ng@example.com');
    const res = await postExternal('/api/tree-view-repos-external', db, { userToken });
    expect(res.status).toBe(403);
  });

  it('同期済みリポジトリの一覧を返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertSnapshot(db, 'nekoserver/dynamicneko', { name: 'nekoserver/dynamicneko', type: 'dir' });
    insertSnapshot(db, 'nekoserver/cloudflare-workers-github-oauth-1', { name: 'nekoserver/cloudflare-workers-github-oauth-1', type: 'dir' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/tree-view-repos-external', db, { userToken });
    expect(res.status).toBe(200);
    const body = await res.json() as { repos: Array<{ repoName: string }> };
    expect(body.repos.map((r) => r.repoName)).toEqual(['nekoserver/cloudflare-workers-github-oauth-1', 'nekoserver/dynamicneko']);
  });
});

describe('POST /api/tree-view-snapshot-external', () => {
  it('対象外のrepoNameは400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/tree-view-snapshot-external', db, { userToken, repoName: 'someone/unrelated-repo' });
    expect(res.status).toBe(400);
  });

  it('未同期のリポジトリは404で、握りつぶして空データを返さない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/tree-view-snapshot-external', db, { userToken, repoName: 'nekoserver/dynamicneko' });
    expect(res.status).toBe(404);
  });

  it('正常系: 保存済みのツリーJSONをそのまま返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const tree = { name: 'nekoserver/dynamicneko', type: 'dir', children: [{ name: 'README.md', type: 'file' }] };
    insertSnapshot(db, 'nekoserver/dynamicneko', tree, '2026-09-19T12:00:00.000Z');
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/tree-view-snapshot-external', db, { userToken, repoName: 'nekoserver/dynamicneko' });
    expect(res.status).toBe(200);
    const body = await res.json() as { tree: unknown; updatedAt: string };
    expect(body.tree).toEqual(tree);
    expect(body.updatedAt).toBe('2026-09-19T12:00:00.000Z');
  });
});

describe('POST /api/tree-view-snapshot-refresh-external', () => {
  it('対象外のrepoNameは400で、GitHubは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/tree-view-snapshot-refresh-external', db, { userToken, repoName: 'someone/unrelated-repo' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('installation_permissionsに存在しないリポジトリは403で、GitHubは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/tree-view-snapshot-refresh-external', db, { userToken, repoName: 'nekoserver/dynamicneko' });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('正常系: GitHub Trees APIから取得してD1へ保存し、そのままレスポンスで返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertInstallationRepo(db, 'nekoserver/dynamicneko');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ tree: [{ path: 'README.md', type: 'blob' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/tree-view-snapshot-refresh-external', db, { userToken, repoName: 'nekoserver/dynamicneko' });
    expect(res.status).toBe(200);
    const body = await res.json() as { tree: { children?: Array<{ name: string }> } };
    expect(body.tree.children?.map((c) => c.name)).toEqual(['README.md']);
    const saved = db.prepare('SELECT tree_json FROM tree_view_snapshots WHERE repo_name = ?').get('nekoserver/dynamicneko') as { tree_json: string } | undefined;
    expect(saved).toBeDefined();
    expect(db.prepare('SELECT repo_name, update_source, status, changed FROM tree_view_update_log').get()).toEqual({
      repo_name: 'nekoserver/dynamicneko', update_source: 'manual', status: 'succeeded', changed: 1,
    });
  });

  it('GitHub API呼び出し失敗時は502を返し、jev同様に握りつぶさない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertInstallationRepo(db, 'nekoserver/dynamicneko');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/tree-view-snapshot-refresh-external', db, { userToken, repoName: 'nekoserver/dynamicneko' });
    expect(res.status).toBe(502);
    expect(db.prepare('SELECT status, changed, error_detail FROM tree_view_update_log').get()).toEqual({
      status: 'failed', changed: null, error_detail: expect.stringContaining('ステータス404'),
    });
  });

  it('10分あたり5回の上限に達すると429で拒否し、GitHubは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertInstallationRepo(db, 'nekoserver/dynamicneko');
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO tree_view_snapshot_refresh_log (user_id, repo_name, requested_at) VALUES (?, ?, ?)')
        .run('nekoserver', `nekoserver/repo-${i}`, now);
    }
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const userToken = await makeUserToken('ok@example.com');
    const res = await postExternal('/api/tree-view-snapshot-refresh-external', db, { userToken, repoName: 'nekoserver/dynamicneko' });
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('syncAllTreeViewSnapshots (cron)', () => {
  it('installation_permissionsに記録済みのnekoserver配下リポジトリだけを同期する', async () => {
    const db = setupDb({});
    insertInstallationRepo(db, 'nekoserver/dynamicneko');
    insertInstallationRepo(db, 'someone-else/unrelated-repo');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ tree: [{ path: 'a.ts', type: 'blob' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncAllTreeViewSnapshots({ ...BASE_ENV, DB: wrapD1(db) } as never);
    expect(result.synced).toEqual(['nekoserver/dynamicneko']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('nekoserver/dynamicneko');
    expect(db.prepare('SELECT update_source, status, changed FROM tree_view_update_log').get()).toEqual({ update_source: 'scheduled', status: 'succeeded', changed: 1 });
  });

  it('内容が前回と変わっていないリポジトリはD1へ書き込まない(skippedに入る)', async () => {
    const db = setupDb({});
    insertInstallationRepo(db, 'nekoserver/dynamicneko');
    const existingTree = { name: 'nekoserver/dynamicneko', type: 'dir', children: [{ name: 'a.ts', type: 'file' }] };
    insertSnapshot(db, 'nekoserver/dynamicneko', existingTree, '2026-09-18T00:00:00.000Z');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tree: [{ path: 'a.ts', type: 'blob' }] }), { status: 200 })));

    const result = await syncAllTreeViewSnapshots({ ...BASE_ENV, DB: wrapD1(db) } as never);
    expect(result.skipped).toEqual(['nekoserver/dynamicneko']);
    expect(result.synced).toEqual([]);
    const row = db.prepare('SELECT updated_at FROM tree_view_snapshots WHERE repo_name = ?').get('nekoserver/dynamicneko') as { updated_at: string };
    expect(row.updated_at).toBe('2026-09-18T00:00:00.000Z');
    expect(db.prepare('SELECT update_source, status, changed FROM tree_view_update_log').get()).toEqual({ update_source: 'scheduled', status: 'succeeded', changed: 0 });
  });

  it('1つのリポジトリの取得が失敗しても、残りのリポジトリの同期は継続する', async () => {
    const db = setupDb({});
    insertInstallationRepo(db, 'nekoserver/repo-a');
    insertInstallationRepo(db, 'nekoserver/repo-b');
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('repo-a')) return new Response('error', { status: 500 });
      return new Response(JSON.stringify({ tree: [{ path: 'b.ts', type: 'blob' }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncAllTreeViewSnapshots({ ...BASE_ENV, DB: wrapD1(db) } as never);
    expect(result.failed.map((f) => f.repoName)).toEqual(['nekoserver/repo-a']);
    expect(result.synced).toEqual(['nekoserver/repo-b']);
    expect(db.prepare("SELECT status, changed FROM tree_view_update_log WHERE repo_name = 'nekoserver/repo-a'").get()).toEqual({ status: 'failed', changed: null });
  });
});
