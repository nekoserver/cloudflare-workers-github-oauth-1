/**
 * POST /api/jev-test-score-trend-external のテスト
 *
 * 対象: dynamicnekoの/tree-viewコミット履歴モーダルの「テスト評価の推移」
 * 表示用API。1コミットのdiffは不変なため同じコミットの再評価では改善を
 * 示せない。ユーザーが「テスト評価」ボタンを押して実際に評価済みの
 * コミットだけを、repo_commit_index.seq_num(コミット順序)昇順で
 * 問題あり件数付きで返す(新しいコミットほど改善しているかを見る用途)。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1クエリまで到達してしまう
 *   (3) repoNameが対象外リポジトリでも受け付けてしまう
 *   (4) 他ユーザーの評価結果を自分の推移として返してしまう
 *   (5) 別リポジトリのコミットを混在させて返してしまう
 *   (6) seq_num順に並んでいない(時系列として意味を成さない)
 *   (7) 一部のラベルしか評価されていないコミット(レート制限等で途中で
 *       止まった)でもbadCount/evaluatedCountが不正確になる
 *   (8) 評価が1件も無いコミットが混入してしまう(評価していないのに
 *       「問題なし」のように見えてしまう)
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';
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
    CREATE TABLE repo_commit_index (
      commit_hash TEXT PRIMARY KEY,
      seq_num INTEGER NOT NULL,
      github_pr_number INTEGER,
      commit_message TEXT NOT NULL,
      repo_name TEXT NOT NULL
    );
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

function insertLabel(db: DatabaseSync): number {
  db.prepare(`INSERT INTO jev_test_labels (question_type, question_text, options_json, jev_group_id) VALUES ('score', 'T01', '["a","b"]', 1)`).run();
  return (db.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id;
}

function insertEval(db: DatabaseSync, targetId: string, userId: string, model: string, labelId: number, value: number): void {
  db.prepare(`INSERT INTO jev_test_evaluations (target_id, user_id, model, jev_test_label_id, value) VALUES (?, ?, ?, ?, ?)`)
    .run(targetId, userId, model, labelId, value);
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET };

async function postTrend(db: DatabaseSync, email: string, repoName: string = REPO_NAME): Promise<Response> {
  const userToken = await makeUserToken(email);
  return app.request(
    '/api/jev-test-score-trend-external',
    { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, repoName }) },
    { ...BASE_ENV, DB: wrapD1(db) }
  );
}

describe('POST /api/jev-test-score-trend-external', () => {
  it('Bearer secretが一致しない場合は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request(
      '/api/jev-test-score-trend-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, repoName: REPO_NAME }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
    expect(res.status).toBe(401);
  });

  it('対象外のrepoNameは400で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postTrend(db, 'ok@example.com', 'someone/unrelated-repo');
    expect(res.status).toBe(400);
  });

  it('未許可メールアドレスは403で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postTrend(db, 'ng@example.com');
    expect(res.status).toBe(403);
  });

  it('評価済みコミットが無ければ空配列を返す(握りつぶさず200)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postTrend(db, 'ok@example.com');
    expect(res.status).toBe(200);
    const body = await res.json() as { commits: unknown[] };
    expect(body.commits).toEqual([]);
  });

  it('seq_num昇順で、問題あり件数(2/3以上)/評価済み件数を付けて返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const label1 = insertLabel(db);
    const label2 = insertLabel(db);
    insertCommit(db, 'h-new', REPO_NAME, 5, 'feat: 新しいコミット');
    insertCommit(db, 'h-old', REPO_NAME, 1, 'feat: 古いコミット');
    // 古いコミット: 2問とも問題あり
    insertEval(db, 'h-old', 'nekoserver', 'tree-view-test-eval', label1, 0.9);
    insertEval(db, 'h-old', 'nekoserver', 'tree-view-test-eval', label2, 0.8);
    // 新しいコミット: 1問だけ問題あり(改善している)
    insertEval(db, 'h-new', 'nekoserver', 'tree-view-test-eval', label1, 0.9);
    insertEval(db, 'h-new', 'nekoserver', 'tree-view-test-eval', label2, 0.1);

    const res = await postTrend(db, 'ok@example.com');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      totalLabels: number;
      commits: Array<{ commitHash: string; seqNum: number; evaluatedCount: number; badCount: number }>;
    };
    expect(body.totalLabels).toBe(2);
    expect(body.commits.map((c) => c.commitHash)).toEqual(['h-old', 'h-new']);
    expect(body.commits[0].badCount).toBe(2);
    expect(body.commits[0].evaluatedCount).toBe(2);
    expect(body.commits[1].badCount).toBe(1);
    expect(body.commits[1].evaluatedCount).toBe(2);
  });

  it('他ユーザーの評価結果は混ざらない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver', 'other@example.com': 'otheruser' });
    const label1 = insertLabel(db);
    insertCommit(db, 'h1', REPO_NAME, 1, 'fix: バグ');
    insertEval(db, 'h1', 'otheruser', 'tree-view-test-eval', label1, 0.9);

    const res = await postTrend(db, 'ok@example.com');
    const body = await res.json() as { commits: unknown[] };
    expect(body.commits).toEqual([]);
  });

  it('別リポジトリのコミットは混ざらない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const label1 = insertLabel(db);
    insertCommit(db, 'h-other-repo', 'nekoserver/cloudflare-workers-github-oauth-1', 1, 'fix: 別リポジトリ');
    insertEval(db, 'h-other-repo', 'nekoserver', 'tree-view-test-eval', label1, 0.9);

    const res = await postTrend(db, 'ok@example.com', REPO_NAME);
    const body = await res.json() as { commits: unknown[] };
    expect(body.commits).toEqual([]);
  });

  it('一部のラベルしか評価されていないコミットは、その評価済み件数のみで集計する(全問評価済みとして扱わない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const label1 = insertLabel(db);
    insertLabel(db); // label2は未評価のまま
    insertCommit(db, 'h1', REPO_NAME, 1, 'fix: 途中まで評価');
    insertEval(db, 'h1', 'nekoserver', 'tree-view-test-eval', label1, 0.9);

    const res = await postTrend(db, 'ok@example.com');
    const body = await res.json() as { totalLabels: number; commits: Array<{ evaluatedCount: number; badCount: number }> };
    expect(body.totalLabels).toBe(2);
    expect(body.commits[0].evaluatedCount).toBe(1);
    expect(body.commits[0].badCount).toBe(1);
  });
});
