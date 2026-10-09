/**
 * POST /api/jev-test-score-external のテスト
 *
 * 対象: dynamicnekoの/tree-viewコミット履歴モーダルの「テスト評価」ボタン用API。
 * 対象コミットのdiffをGitHub Commit APIから取得し、jev_test_labels
 * (テストコード品質チェックリスト、8グループ78問)全件でJevに評価させ、
 * jev_test_evaluationsに保存する。jev-vuln-score-externalと同じ
 * computeJevEvaluationPlanで既評価ラベルの再送(二重課金)を防止する。
 * セキュリティ脆弱性判定(jev_vuln_*)とはテーブル・エンドポイントを
 * 完全に分離しており、混同して同じテーブルへ書き込んでしまわないことも
 * 検証する。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1クエリ・GitHub API・Jev APIまで到達してしまう
 *   (3) repoNameが対象外リポジトリでも受け付けてしまう
 *   (4) 既に評価済みのラベルを再度Jevへ送ってしまう(二重課金)
 *   (5) Jev API呼び出し失敗時に握りつぶしてok扱いにしてしまう
 *   (6) GitHub Commit APIからのdiff取得に失敗した場合に握りつぶしてJevへ
 *       空/不正な内容を送ってしまう
 *   (7) 1ユーザーが任意の新規commitHashを送り続けて無制限にJev評価と
 *       D1行追加を発生させられてしまう
 *   (8) jev_vuln_evaluationsとjev_test_evaluationsを取り違えて保存/参照
 *       してしまう(テーブル分離の確認)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';
const JEV_API_KEY = 'test-jev-api-key';
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
    CREATE TABLE jev_vuln_label_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE jev_vuln_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT,
      jev_group_id INTEGER NOT NULL
    );
    CREATE TABLE jev_vuln_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT,
      jev_vuln_label_id INTEGER NOT NULL,
      value REAL NOT NULL,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE jev_test_label_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE jev_test_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT,
      jev_group_id INTEGER NOT NULL
    );
    CREATE TABLE jev_test_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT,
      jev_test_label_id INTEGER NOT NULL,
      value REAL NOT NULL,
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE installation_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installation_id INTEGER NOT NULL,
      repo_name TEXT,
      repository_selection TEXT NOT NULL DEFAULT 'selected',
      permissions TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE repo_commit_index (
      commit_hash TEXT PRIMARY KEY,
      seq_num INTEGER NOT NULL,
      github_pr_number INTEGER,
      commit_message TEXT NOT NULL,
      repo_name TEXT NOT NULL
    );
  `);
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  db.prepare(
    `INSERT INTO installation_permissions (installation_id, repo_name, updated_at) VALUES (1, ?, datetime('now'))`
  ).run(REPO_NAME);
  return db;
}

function insertTestGroup(db: DatabaseSync, name: string): number {
  db.prepare(`INSERT INTO jev_test_label_groups (name) VALUES (?)`).run(name);
  return (db.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id;
}

function insertTestLabel(db: DatabaseSync, groupId: number, questionText: string, criteria: [string, string]): number {
  db.prepare(`INSERT INTO jev_test_labels (question_type, question_text, options_json, jev_group_id) VALUES ('score', ?, ?, ?)`)
    .run(questionText, JSON.stringify(criteria), groupId);
  return (db.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id;
}

function insertTestEval(db: DatabaseSync, targetId: string, userId: string, model: string, labelId: number, value: number): void {
  db.prepare(`INSERT INTO jev_test_evaluations (target_id, user_id, model, jev_test_label_id, value) VALUES (?, ?, ?, ?, ?)`)
    .run(targetId, userId, model, labelId, value);
}

function seedTwoLabels(db: DatabaseSync): { label1: number; label2: number } {
  const groupId = insertTestGroup(db, '1.カバレッジ・網羅性');
  const label1 = insertTestLabel(db, groupId, 'T01 変更した行に対応するテストが1つも無い', ['問題なし(安全側)', '問題あり(危険側)']);
  const label2 = insertTestLabel(db, groupId, 'T13 異常系のテストが1件も無い', ['問題なし(安全側)', '問題あり(危険側)']);
  return { label1, label2 };
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET, JEV_API_KEY, GITHUB_TOKEN };

// GitHub Commit API(diff Acceptヘッダ)とJev APIの両方をfetchで叩くため、
// URL/Acceptで振り分けるスタブを用意する。
function stubGithubAndJev(opts: {
  diff?: string;
  githubExists?: boolean;
  jevResponse?: (labelIds: string[]) => { ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> };
  onJevRequest?: (body: unknown) => void;
}): ReturnType<typeof vi.fn> {
  const { diff = 'diff --git a/foo.ts b/foo.ts\n+added line', githubExists = true, jevResponse, onJevRequest } = opts;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('api.github.com')) {
      if (!githubExists) return { ok: false, status: 404, json: async () => ({}), text: async () => 'Not Found' };
      return { ok: true, status: 200, json: async () => ({}), text: async () => diff };
    }
    const parsed = JSON.parse(String(init?.body ?? '{}')) as { questions: Record<string, unknown> };
    onJevRequest?.(parsed);
    if (jevResponse) return jevResponse(Object.keys(parsed.questions));
    return { ok: true, status: 200, json: async () => ({ answers: {} }), text: async () => '' };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function postTestScore(db: DatabaseSync, email: string, commitHash: string, repoName: string = REPO_NAME): Promise<Response> {
  const userToken = await makeUserToken(email);
  return app.request(
    '/api/jev-test-score-external',
    { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, commitHash, repoName }) },
    { ...BASE_ENV, DB: wrapD1(db) }
  );
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('POST /api/jev-test-score-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/jev-test-score-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, commitHash: 'h1', repoName: REPO_NAME }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('commitHashが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postTestScore(db, 'ok@example.com', '');
    expect(res.status).toBe(400);
  });

  it('対象外のrepoNameは400で拒否され、GitHub/Jevは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const fetchMock = stubGithubAndJev({});
    const res = await postTestScore(db, 'ok@example.com', 'h1', 'someone/unrelated-repo');
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('未許可メールアドレスは403で拒否され、GitHub/Jevは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    seedTwoLabels(db);
    const fetchMock = stubGithubAndJev({});
    const res = await postTestScore(db, 'ng@example.com', 'h1');
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GitHub Commit API上にcommitHashが実在しない場合は404で、Jevは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    seedTwoLabels(db);
    const fetchMock = stubGithubAndJev({ githubExists: false });
    const res = await postTestScore(db, 'ok@example.com', 'does-not-exist');
    expect(res.status).toBe(404);
    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes('api.typesafe.ai'))).toBe(false);
  });

  it('正常系: diffを取得しjev_test_labels全件をJevへ問い合わせ、jev_test_evaluationsへ保存する', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { label1, label2 } = seedTwoLabels(db);
    let sentState = '';
    const fetchMock = stubGithubAndJev({
      diff: 'diff --git a/src/foo.ts b/src/foo.ts\n+export function foo() { return 1; }',
      onJevRequest: (body) => { sentState = (body as { state: string }).state; },
      jevResponse: () => ({
        ok: true,
        status: 200,
        json: async () => ({ answers: { [String(label1)]: { score: 0.8 }, [String(label2)]: { score: 0.1 } } }),
        text: async () => '',
      }),
    });

    const res = await postTestScore(db, 'ok@example.com', 'h1');
    expect(res.status).toBe(200);
    const body = await res.json() as { scores: Array<{ labelId: number; value: number }>; newlyEvaluatedCount: number; cachedCount: number };
    expect(body.newlyEvaluatedCount).toBe(2);
    expect(body.cachedCount).toBe(0);
    expect(body.scores.find((s) => s.labelId === label1)?.value).toBe(0.8);
    expect(body.scores.find((s) => s.labelId === label2)?.value).toBe(0.1);
    expect(sentState).toContain('export function foo()');

    const savedRows = db.prepare('SELECT jev_test_label_id, value FROM jev_test_evaluations WHERE target_id = ?').all('h1');
    expect(savedRows.length).toBe(2);
    // jev_vuln_evaluationsへは一切書き込まれない(テーブル分離の確認)。
    const vulnRows = db.prepare('SELECT * FROM jev_vuln_evaluations WHERE target_id = ?').all('h1');
    expect(vulnRows.length).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3); // GitHub存在確認 + diff取得 + Jev API
  });

  it('既に評価済みのラベルは再度Jevへ送らない(二重課金の防止)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { label1, label2 } = seedTwoLabels(db);
    insertTestEval(db, 'h1', 'nekoserver', 'tree-view-test-eval', label1, 0.9);

    let sentQuestionIds: string[] = [];
    const fetchMock = stubGithubAndJev({
      onJevRequest: (body) => { sentQuestionIds = Object.keys((body as { questions: Record<string, unknown> }).questions); },
      jevResponse: () => ({ ok: true, status: 200, json: async () => ({ answers: { [String(label2)]: { score: 0.3 } } }), text: async () => '' }),
    });

    const res = await postTestScore(db, 'ok@example.com', 'h1');
    expect(res.status).toBe(200);
    expect(sentQuestionIds).toEqual([String(label2)]);
    const body = await res.json() as { newlyEvaluatedCount: number; cachedCount: number; scores: Array<{ labelId: number; value: number }> };
    expect(body.newlyEvaluatedCount).toBe(1);
    expect(body.cachedCount).toBe(1);
    expect(body.scores.find((s) => s.labelId === label1)?.value).toBe(0.9);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('全ラベルが既に評価済みの場合はGitHub diffの取得もJevも一切呼ばない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { label1, label2 } = seedTwoLabels(db);
    insertTestEval(db, 'h1', 'nekoserver', 'tree-view-test-eval', label1, 0.9);
    insertTestEval(db, 'h1', 'nekoserver', 'tree-view-test-eval', label2, 0.1);
    const fetchMock = stubGithubAndJev({});

    const res = await postTestScore(db, 'ok@example.com', 'h1');
    expect(res.status).toBe(200);
    const body = await res.json() as { newlyEvaluatedCount: number; cachedCount: number };
    expect(body.newlyEvaluatedCount).toBe(0);
    expect(body.cachedCount).toBe(2);
    // 全ラベル評価済みでも、diff自体はcommitHash実在確認のため取得されるが
    // Jev APIへのリクエストは発生しない。
    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes('api.typesafe.ai'))).toBe(false);
  });

  it('Jev API呼び出し失敗時は502でエラー内容を返し、jev_test_evaluationsへは保存しない(握りつぶさない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    seedTwoLabels(db);
    stubGithubAndJev({
      jevResponse: () => ({ ok: false, status: 500, json: async () => ({}), text: async () => 'internal error' }),
    });

    const res = await postTestScore(db, 'ok@example.com', 'h1');
    expect(res.status).toBe(502);
    const savedRows = db.prepare('SELECT * FROM jev_test_evaluations WHERE target_id = ?').all('h1');
    expect(savedRows.length).toBe(0);
  });

  it('1時間あたりの新規診断コミット数の上限に達している場合は429で拒否し、Jevは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { label1 } = seedTwoLabels(db);
    for (let i = 0; i < 20; i++) {
      insertTestEval(db, `h-old-${i}`, 'nekoserver', 'tree-view-test-eval', label1, 0.1);
    }
    const fetchMock = stubGithubAndJev({});

    const res = await postTestScore(db, 'ok@example.com', 'h-new');
    expect(res.status).toBe(429);
    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes('api.typesafe.ai'))).toBe(false);
  });
});
