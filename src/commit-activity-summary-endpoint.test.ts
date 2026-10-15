/**
 * GET /api/commit-activity-summary のテスト
 *
 * 対象: SPEC.cloudflare-workers-github-oauth-1.20261015.commit-activity-dashboard.md
 * で設計した、repo_commit_index(日別コミット数)・commit_file_changes(日別
 * 変更ファイル数・頻出ファイル)・commit_summary_topics経由(日別Topic)を
 * 束ねる集計API。/statusページの新規モーダルから呼ばれる想定。
 *
 * 故障シナリオ:
 *   (1) repoName未指定でも全リポジトリ横断で返してしまう(SPEC6章の
 *       リポジトリ境界の原則に反する)
 *   (2) 別リポジトリのデータが混入する
 *   (3) 3つのクエリの日付集合がずれたときにmergeCommitActivityDailyへの
 *       受け渡しを誤り、欠落した軸が0件/空配列にならない
 *   (4) 未ログインでも叩けてしまう
 *   (5) committed_atがNULLの行(マージコミット等)をdate()集計に混ぜて
 *       SQLエラーになる、または誤集計する
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';
const REPO_NAME = 'nekoserver/dynamicneko';

function makeAuthHeader(sub = 'user-1'): Promise<string> {
  return createJWT({ sub, name: 'Test' }, JWT_SECRET).then((token) => `Bearer ${token}`);
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      // authMiddlewareはuser_sessionsを参照する(revoked_at確認・
      // last_activity_at更新)が、本テストの関心事(集計クエリ)とは
      // 無関係のため、専用テーブルを作らずここで無害な結果を返す。
      if (sql.includes('user_sessions')) {
        return {
          bind: () => ({
            first: async () => null,
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          }),
        };
      }
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

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE repo_commit_index (
      commit_hash TEXT PRIMARY KEY,
      seq_num INTEGER NOT NULL,
      github_pr_number INTEGER,
      commit_message TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      committed_at TEXT
    );
    CREATE TABLE commit_file_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_name TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      file_path TEXT NOT NULL,
      committed_at TEXT NOT NULL,
      UNIQUE(repo_name, commit_hash, file_path)
    );
    CREATE TABLE ai_summary_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_full_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE commit_summary_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE commit_summary_topic_links (
      topic_id INTEGER NOT NULL,
      summary_log_id INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      PRIMARY KEY(topic_id, summary_log_id)
    );
  `);
  return db;
}

function insertCommit(db: DatabaseSync, hash: string, seq: number, repoName: string, committedAt: string | null): void {
  db.prepare(
    `INSERT INTO repo_commit_index (commit_hash, seq_num, github_pr_number, commit_message, repo_name, committed_at) VALUES (?, ?, NULL, 'msg', ?, ?)`
  ).run(hash, seq, repoName, committedAt);
}

function insertFileChange(db: DatabaseSync, repoName: string, commitHash: string, filePath: string, committedAt: string): void {
  db.prepare(
    `INSERT INTO commit_file_changes (repo_name, commit_hash, file_path, committed_at) VALUES (?, ?, ?, ?)`
  ).run(repoName, commitHash, filePath, committedAt);
}

function insertTopic(db: DatabaseSync, repoName: string, topicName: string, createdAt: string): void {
  db.prepare(`INSERT INTO ai_summary_log (repo_full_name, created_at) VALUES (?, ?)`).run(repoName, createdAt);
  const logId = db.prepare(`SELECT last_insert_rowid() as id`).get() as { id: number };
  db.prepare(`INSERT OR IGNORE INTO commit_summary_topics (name, created_at) VALUES (?, ?)`).run(topicName, createdAt);
  const topicId = (db.prepare(`SELECT id FROM commit_summary_topics WHERE name = ?`).get(topicName) as { id: number }).id;
  db.prepare(`INSERT INTO commit_summary_topic_links (topic_id, summary_log_id, recorded_at) VALUES (?, ?, ?)`).run(topicId, logId.id, createdAt);
}

async function getSummary(db: DatabaseSync, repoName: string | null): Promise<Response> {
  const auth = await makeAuthHeader();
  const qs = repoName !== null ? `?repoName=${encodeURIComponent(repoName)}` : '';
  return app.request(
    `/api/commit-activity-summary${qs}`,
    { headers: { Authorization: auth } },
    { JWT_SECRET, DB: wrapD1(db) }
  );
}

describe('GET /api/commit-activity-summary', () => {
  it('未ログインは401', async () => {
    const db = setupDb();
    const res = await app.request('/api/commit-activity-summary?repoName=' + REPO_NAME, {}, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(401);
  });

  it('repoName未指定は400', async () => {
    const db = setupDb();
    const res = await getSummary(db, null);
    expect(res.status).toBe(400);
  });

  it('3軸(コミット数・変更ファイル数・Topic)を日付で統合して返す', async () => {
    const db = setupDb();
    insertCommit(db, 'aaa1111', 1, REPO_NAME, '2026-10-14T01:00:00Z');
    insertCommit(db, 'bbb2222', 2, REPO_NAME, '2026-10-14T05:00:00Z');
    insertFileChange(db, REPO_NAME, 'aaa1111', 'src/a.ts', '2026-10-14T01:00:00Z');
    insertTopic(db, REPO_NAME, 'tree-view', '2026-10-14T01:00:00Z');

    const res = await getSummary(db, REPO_NAME);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { repoName: string; daily: Array<{ date: string; commitCount: number; fileChangeCount: number; topics: string[] }> };
    expect(body.repoName).toBe(REPO_NAME);
    expect(body.daily).toEqual([{ date: '2026-10-14', commitCount: 2, fileChangeCount: 1, topics: ['tree-view'] }]);
  });

  it('committed_atがNULLのコミット(マージコミット等)は日別集計から除外する', async () => {
    const db = setupDb();
    insertCommit(db, 'aaa1111', 1, REPO_NAME, '2026-10-14T01:00:00Z');
    insertCommit(db, 'merge0001', 2, REPO_NAME, null);

    const res = await getSummary(db, REPO_NAME);
    const body = (await res.json()) as { daily: Array<{ date: string; commitCount: number }> };
    expect(body.daily).toEqual([{ date: '2026-10-14', commitCount: 1, fileChangeCount: 0, topics: [] }]);
  });

  it('別リポジトリのデータは混入しない', async () => {
    const db = setupDb();
    insertCommit(db, 'aaa1111', 1, 'nekoserver/other', '2026-10-14T01:00:00Z');
    insertFileChange(db, 'nekoserver/other', 'aaa1111', 'src/a.ts', '2026-10-14T01:00:00Z');
    insertTopic(db, 'nekoserver/other', 'other-topic', '2026-10-14T01:00:00Z');

    const res = await getSummary(db, REPO_NAME);
    const body = (await res.json()) as { daily: unknown[] };
    expect(body.daily).toEqual([]);
  });

  it('backfillCoverageはcommitted_atが埋まっている行数の比率を返す', async () => {
    const db = setupDb();
    insertCommit(db, 'aaa1111', 1, REPO_NAME, '2026-10-14T01:00:00Z');
    insertCommit(db, 'bbb2222', 2, REPO_NAME, null);
    insertCommit(db, 'ccc3333', 3, REPO_NAME, null);
    insertCommit(db, 'other', 1, 'nekoserver/other', null);

    const res = await getSummary(db, REPO_NAME);
    const body = (await res.json()) as { backfillCoverage: { totalCommits: number; committedAtFilled: number; ratio: number } };
    expect(body.backfillCoverage).toEqual({ totalCommits: 3, committedAtFilled: 1, ratio: 1 / 3 });
  });

  it('topFilesは変更回数の多い順に最大10件返す', async () => {
    const db = setupDb();
    insertFileChange(db, REPO_NAME, 'aaa1111', 'src/a.ts', '2026-10-14T01:00:00Z');
    insertFileChange(db, REPO_NAME, 'bbb2222', 'src/a.ts', '2026-10-15T01:00:00Z');
    insertFileChange(db, REPO_NAME, 'aaa1111', 'src/b.ts', '2026-10-14T01:00:00Z');

    const res = await getSummary(db, REPO_NAME);
    const body = (await res.json()) as { topFiles: Array<{ filePath: string; changeCount: number }> };
    expect(body.topFiles).toEqual([
      { filePath: 'src/a.ts', changeCount: 2 },
      { filePath: 'src/b.ts', changeCount: 1 },
    ]);
  });
});
