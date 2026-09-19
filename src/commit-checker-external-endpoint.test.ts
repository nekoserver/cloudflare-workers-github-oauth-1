/**
 * POST /api/repo-commit-search-external, POST /api/jev-vuln-score-external のテスト
 *
 * 対象: dynamicnekoの/commit-checkerページ向けのexternal API群。
 *   - repo-commit-search-external: repo_commit_indexをcommit_messageで
 *     キーワード検索し、各候補のjev_vuln_labels診断済みフラグを付けて返す
 *   - jev-vuln-score-external: 選択されたコミットログをjev_vuln_labels全件で
 *     Jevに評価させ、jev_vuln_evaluationsに保存する(jev-score-externalと
 *     同じcomputeJevEvaluationPlanによる重複評価防止)
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) userTokenが無い/偽造されている場合に本文の生emailを信用してしまう
 *   (3) 未許可メールアドレスがD1クエリまで到達してしまう
 *   (4) 検索: 他ユーザーの診断結果を自分の診断済みとして表示してしまう
 *   (5) 検索: 全ラベル未満しか評価されていないのに診断済み扱いにしてしまう
 *   (6) スコア: 既に評価済みのラベルを再度Jevへ送ってしまう(二重課金)
 *   (7) スコア: requestJsonが実際にJevへ送る内容と食い違う
 *   (8) スコア: Jev API呼び出し失敗時に握りつぶしてok扱いにしてしまう
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';
const JEV_API_KEY = 'test-jev-api-key';

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
    CREATE TABLE jev_vuln_label_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
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
  `);
  for (const [email, login] of Object.entries(allowedUsers)) {
    db.prepare(`INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)`).run(email, login);
  }
  return db;
}

function insertCommit(db: DatabaseSync, hash: string, repoName: string, seqNum: number, message: string, prNumber: number | null = null): void {
  db.prepare(`INSERT INTO repo_commit_index (commit_hash, seq_num, github_pr_number, commit_message, repo_name) VALUES (?, ?, ?, ?, ?)`)
    .run(hash, seqNum, prNumber, message, repoName);
}

function insertGroup(db: DatabaseSync, name: string): number {
  db.prepare(`INSERT INTO jev_vuln_label_groups (name) VALUES (?)`).run(name);
  return (db.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id;
}

function insertLabel(db: DatabaseSync, groupId: number, questionText: string, criteria: [string, string]): number {
  db.prepare(`INSERT INTO jev_vuln_labels (question_type, question_text, options_json, jev_group_id) VALUES ('score', ?, ?, ?)`)
    .run(questionText, JSON.stringify(criteria), groupId);
  return (db.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id;
}

function insertVulnEval(db: DatabaseSync, targetId: string, userId: string, model: string, labelId: number, value: number): void {
  db.prepare(`INSERT INTO jev_vuln_evaluations (target_id, user_id, model, jev_vuln_label_id, value) VALUES (?, ?, ?, ?, ?)`)
    .run(targetId, userId, model, labelId, value);
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET, JEV_API_KEY };

async function postExternal(path: string, db: DatabaseSync, body: Record<string, unknown>, authHeader = `Bearer ${SECRET}`): Promise<Response> {
  return app.request(
    path,
    { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { ...BASE_ENV, DB: wrapD1(db) }
  );
}

async function postSearch(db: DatabaseSync, email: string, query: string, repoName?: string): Promise<Response> {
  const userToken = await makeUserToken(email);
  return postExternal('/api/repo-commit-search-external', db, { userToken, query, repoName });
}

async function postScore(db: DatabaseSync, email: string, commitHash: string, commitMessage: string): Promise<Response> {
  const userToken = await makeUserToken(email);
  return postExternal('/api/jev-vuln-score-external', db, { userToken, commitHash, commitMessage });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('POST /api/repo-commit-search-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postExternal('/api/repo-commit-search-external', db, { userToken: 'x', query: 'fix' }, 'Bearer wrong');
    expect(res.status).toBe(401);
  });

  it('userTokenが無い場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postExternal('/api/repo-commit-search-external', db, { query: 'fix' });
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSearch(db, 'ng@example.com', 'fix');
    expect(res.status).toBe(403);
  });

  it('queryが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSearch(db, 'ok@example.com', '');
    expect(res.status).toBe(400);
  });

  it('commit_messageの部分一致で検索し、seq_num降順で返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommit(db, 'h1', 'nekoserver/dynamicneko', 1, 'fix: 古いバグ修正');
    insertCommit(db, 'h2', 'nekoserver/dynamicneko', 2, 'feat: 新機能');
    insertCommit(db, 'h3', 'nekoserver/dynamicneko', 3, 'fix: 新しいバグ修正');
    const res = await postSearch(db, 'ok@example.com', 'バグ修正');
    expect(res.status).toBe(200);
    const body = await res.json() as { results: Array<{ commitHash: string }> };
    expect(body.results.map((r) => r.commitHash)).toEqual(['h3', 'h1']);
  });

  it('repoNameを指定するとそのリポジトリだけに絞り込む', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommit(db, 'h1', 'nekoserver/dynamicneko', 1, 'fix: バグ');
    insertCommit(db, 'h2', 'nekoserver/cloudflare-workers-github-oauth-1', 1, 'fix: バグ');
    const res = await postSearch(db, 'ok@example.com', 'バグ', 'nekoserver/dynamicneko');
    const body = await res.json() as { results: Array<{ commitHash: string }> };
    expect(body.results.map((r) => r.commitHash)).toEqual(['h1']);
  });

  it('全ラベルが評価済みのコミットだけdiagnosed:trueになる(一部だけ評価済みはfalse)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommit(db, 'h1', 'nekoserver/dynamicneko', 1, 'fix: 完全診断済み');
    insertCommit(db, 'h2', 'nekoserver/dynamicneko', 2, 'fix: 一部だけ診断済み');
    insertCommit(db, 'h3', 'nekoserver/dynamicneko', 3, 'fix: 未診断');
    const groupId = insertGroup(db, 'グループ1');
    const label1 = insertLabel(db, groupId, '質問1', ['安全', '危険']);
    const label2 = insertLabel(db, groupId, '質問2', ['安全', '危険']);
    insertVulnEval(db, 'h1', 'nekoserver', 'commit-checker', label1, 0.1);
    insertVulnEval(db, 'h1', 'nekoserver', 'commit-checker', label2, 0.2);
    insertVulnEval(db, 'h2', 'nekoserver', 'commit-checker', label1, 0.1);

    const res = await postSearch(db, 'ok@example.com', '診断済み');
    const body = await res.json() as { results: Array<{ commitHash: string; diagnosed: boolean }> };
    const byHash = new Map(body.results.map((r) => [r.commitHash, r.diagnosed]));
    expect(byHash.get('h1')).toBe(true);
    expect(byHash.get('h2')).toBe(false);
  });

  it('他ユーザーの診断結果は自分の診断済みとして扱わない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver', 'other@example.com': 'otheruser' });
    insertCommit(db, 'h1', 'nekoserver/dynamicneko', 1, 'fix: バグ');
    const groupId = insertGroup(db, 'グループ1');
    const label1 = insertLabel(db, groupId, '質問1', ['安全', '危険']);
    insertVulnEval(db, 'h1', 'otheruser', 'commit-checker', label1, 0.1);

    const res = await postSearch(db, 'ok@example.com', 'バグ');
    const body = await res.json() as { results: Array<{ commitHash: string; diagnosed: boolean }> };
    expect(body.results[0].diagnosed).toBe(false);
  });
});

describe('POST /api/jev-vuln-score-external', () => {
  function seedTwoLabels(db: DatabaseSync): { label1: number; label2: number } {
    const groupId = insertGroup(db, 'グループ1');
    const label1 = insertLabel(db, groupId, '外部到達可能か', ['該当しない(安全側)', '該当する(危険側)']);
    const label2 = insertLabel(db, groupId, '認証を迂回できるか', ['該当しない(安全側)', '該当する(危険側)']);
    return { label1, label2 };
  }

  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postExternal('/api/jev-vuln-score-external', db, { userToken: 'x', commitHash: 'h1', commitMessage: 'msg' }, 'Bearer wrong');
    expect(res.status).toBe(401);
  });

  it('commitHash/commitMessageが空の場合は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res1 = await postScore(db, 'ok@example.com', '', 'msg');
    expect(res1.status).toBe(400);
    const res2 = await postScore(db, 'ok@example.com', 'h1', '');
    expect(res2.status).toBe(400);
  });

  it('未許可メールアドレスは403で拒否され、Jevは呼ばれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    seedTwoLabels(db);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await postScore(db, 'ng@example.com', 'h1', 'fix: バグ修正');
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('正常系: 全ラベル分をJevへ問い合わせ、jev_vuln_evaluationsへ保存し、requestJsonに全ラベル分のquestionsを含める', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { label1, label2 } = seedTwoLabels(db);
    let receivedBody: unknown = null;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      receivedBody = JSON.parse(String(init.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ answers: { [String(label1)]: { score: 0.9 }, [String(label2)]: { score: 0.1 } } }),
        text: async () => '',
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await postScore(db, 'ok@example.com', 'h1', 'fix: SQL文へ未検証の入力を組み込んでいた');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      scores: Array<{ labelId: number; value: number }>;
      newlyEvaluatedCount: number;
      cachedCount: number;
      requestJson: { model: string; state: string; questions: Record<string, unknown> };
    };
    expect(body.newlyEvaluatedCount).toBe(2);
    expect(body.cachedCount).toBe(0);
    expect(body.scores.find((s) => s.labelId === label1)?.value).toBe(0.9);
    expect(body.scores.find((s) => s.labelId === label2)?.value).toBe(0.1);
    expect(Object.keys(body.requestJson.questions).sort()).toEqual([String(label1), String(label2)].sort());
    expect(body.requestJson.state).toBe('fix: SQL文へ未検証の入力を組み込んでいた');

    const savedRows = db.prepare('SELECT jev_vuln_label_id, value FROM jev_vuln_evaluations WHERE target_id = ?').all('h1');
    expect(savedRows.length).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((receivedBody as { state: string }).state).toBe('fix: SQL文へ未検証の入力を組み込んでいた');
  });

  it('既に評価済みのラベルは再度Jevへ送らない(二重課金の防止)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { label1, label2 } = seedTwoLabels(db);
    insertVulnEval(db, 'h1', 'nekoserver', 'commit-checker', label1, 0.9);

    let sentQuestionIds: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const parsed = JSON.parse(String(init.body)) as { questions: Record<string, unknown> };
      sentQuestionIds = Object.keys(parsed.questions);
      return { ok: true, status: 200, json: async () => ({ answers: { [String(label2)]: { score: 0.2 } } }), text: async () => '' };
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await postScore(db, 'ok@example.com', 'h1', 'fix: バグ修正');
    const body = await res.json() as { scores: Array<{ labelId: number; value: number }>; newlyEvaluatedCount: number; cachedCount: number };
    expect(sentQuestionIds).toEqual([String(label2)]);
    expect(body.newlyEvaluatedCount).toBe(1);
    expect(body.cachedCount).toBe(1);
    expect(body.scores.find((s) => s.labelId === label1)?.value).toBe(0.9);
  });

  it('全ラベルが既に評価済みの場合はJevを一切呼ばない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const { label1, label2 } = seedTwoLabels(db);
    insertVulnEval(db, 'h1', 'nekoserver', 'commit-checker', label1, 0.9);
    insertVulnEval(db, 'h1', 'nekoserver', 'commit-checker', label2, 0.1);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await postScore(db, 'ok@example.com', 'h1', 'fix: バグ修正');
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    const body = await res.json() as { newlyEvaluatedCount: number; cachedCount: number };
    expect(body.newlyEvaluatedCount).toBe(0);
    expect(body.cachedCount).toBe(2);
  });

  it('Jev API呼び出し失敗時は502でエラー内容を返し、jev_vuln_evaluationsへは保存しない(握りつぶさない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    seedTwoLabels(db);
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => 'internal error' }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await postScore(db, 'ok@example.com', 'h1', 'fix: バグ修正');
    expect(res.status).toBe(502);
    const savedRows = db.prepare('SELECT * FROM jev_vuln_evaluations WHERE target_id = ?').all('h1');
    expect(savedRows.length).toBe(0);
  });
});
