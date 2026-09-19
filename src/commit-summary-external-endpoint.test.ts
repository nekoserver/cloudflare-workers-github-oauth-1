/**
 * POST /api/commit-summary-external のテスト
 *
 * 対象: dynamicnekoの/tree-viewコミット履歴モーダルの「要約」ボタン用API。
 * PRマージ時のWebhookパイプラインが既にcommit_agent_log/ai_summary_logへ
 * 保存している日本語要約を読み出して返すだけの、読み出し専用API。新しく
 * AIを呼んで要約を生成することはしない(2026-09-19: 当初は見つからない場合に
 * GitHub Commit API+AIで新規生成し専用の新テーブルcommit_summary_cacheへ
 * キャッシュする実装にしていたが、そもそも対象のコミットは全てWebhookで
 * 要約済みのため不要な複雑化だった。既存の記録箇所を正しく参照する方に倒した)。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) 未許可メールアドレスがD1クエリまで到達してしまう
 *   (3) repoNameがcommit-summary-externalの対象外リポジトリでも
 *       受け付けてしまう(任意のリポジトリのコミットを要約として読み出せてしまう)
 *   (4) commit_agent_log.repo_full_nameを見ずにcommit_shaだけで照合し、
 *       他リポジトリの同名shaの要約を誤って返してしまう
 *   (5) ai_summary_log.summaryがNULL/空文字の行(要約生成に失敗した記録)を
 *       「要約済み」として返してしまう
 *   (6) 見つからない場合にエラーで終わらず、握りつぶして200を返してしまう
 *   (7) commit_agent_logにはPRブランチ先端のshaしか記録されないため、
 *       /tree-viewのコミット一覧(GitHub Commits API、main全履歴)で
 *       マージコミット自体をクリックした場合にcommit_sha直接一致では
 *       見つからず、実際には要約済みなのに404を返してしまう
 *       (2026-09-19に実際にユーザーから報告された不具合。
 *       repo_commit_index.github_pr_number経由のフォールバックで解消する)
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
    CREATE TABLE ai_summary_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL UNIQUE,
      repo_full_name TEXT,
      pr_number INTEGER,
      model TEXT,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE commit_agent_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      repo_full_name TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      commit_sha TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  return db;
}

// PRマージ時のWebhookパイプラインが既に残した記録(commit_agent_log +
// ai_summary_log)を模す。
function insertExistingAiSummary(
  db: DatabaseSync,
  requestId: string,
  repoName: string,
  prNumber: number,
  commitSha: string,
  summary: string | null,
  model: string | null
): void {
  db.prepare(`INSERT INTO ai_summary_log (request_id, repo_full_name, pr_number, model, summary) VALUES (?, ?, ?, ?, ?)`)
    .run(requestId, repoName, prNumber, model, summary);
  db.prepare(`INSERT INTO commit_agent_log (request_id, repo_full_name, pr_number, commit_sha) VALUES (?, ?, ?, ?)`)
    .run(requestId, repoName, prNumber, commitSha);
}

// repo_commit_indexに、mainブランチのマージコミット(commit_agent_logには
// 記録されないshaを持つ)を模した行を挿入する。
function insertMergeCommitIndexRow(
  db: DatabaseSync,
  commitHash: string,
  repoName: string,
  seqNum: number,
  prNumber: number | null
): void {
  db.prepare(
    `INSERT INTO repo_commit_index (commit_hash, seq_num, github_pr_number, commit_message, repo_name) VALUES (?, ?, ?, ?, ?)`
  ).run(commitHash, seqNum, prNumber, prNumber !== null ? `Merge pull request #${prNumber} from example/branch` : 'docs: 更新', repoName);
}

const BASE_ENV = { AICHAT_EXTERNAL_SECRET: SECRET, AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET };

async function postSummary(db: DatabaseSync, email: string, commitHash: string, repoName: string): Promise<Response> {
  const userToken = await makeUserToken(email);
  return app.request(
    '/api/commit-summary-external',
    { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, commitHash, repoName }) },
    { ...BASE_ENV, DB: wrapD1(db) }
  );
}

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
    const res = await postSummary(db, 'ok@example.com', '', REPO_NAME);
    expect(res.status).toBe(400);
  });

  it('対象外のrepoNameは400で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSummary(db, 'ok@example.com', 'h1', 'someone/unrelated-repo');
    expect(res.status).toBe(400);
  });

  it('未許可メールアドレスは403で拒否される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', REPO_NAME, 1, 'h1', '- 概要\n要約済み', 'test-model');
    const res = await postSummary(db, 'ng@example.com', 'h1', REPO_NAME);
    expect(res.status).toBe(403);
  });

  it('正常系: ai_summary_logに記録済みの要約をそのまま返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', REPO_NAME, 42, 'h1', '- 概要\nWebhookで生成済みの要約', 'existing-model');

    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: string; model: string; cached: boolean; source?: string };
    expect(body.summary).toBe('- 概要\nWebhookで生成済みの要約');
    expect(body.model).toBe('existing-model');
    expect(body.cached).toBe(true);
    expect(body.source).toBe('ai_summary_log');
  });

  it('記録が見つからない場合は404で、握りつぶしてok扱いにしない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSummary(db, 'ok@example.com', 'does-not-exist', REPO_NAME);
    expect(res.status).toBe(404);
  });

  it('summaryがNULL(要約生成に失敗した記録)の場合は404扱いにする(要約済みとして返さない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', REPO_NAME, 1, 'h1', null, null);
    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME);
    expect(res.status).toBe(404);
  });

  it('summaryが空文字の記録も404扱いにする', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', REPO_NAME, 1, 'h1', '', 'test-model');
    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME);
    expect(res.status).toBe(404);
  });

  it('同じcommit_shaでも別リポジトリの記録は返さない(repo_full_nameも照合する)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', 'nekoserver/cf-auth', 1, 'h1', '- 概要\n別リポジトリの要約', 'test-model');
    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME);
    expect(res.status).toBe(404);
  });

  it('マージコミット(commit_agent_logにはブランチ先端shaしか無く直接一致しない)でも、repo_commit_index.github_pr_number経由でai_summary_logの要約を返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    // PRブランチ先端sha(branch-tip-sha)がcommit_agent_logに記録されている。
    insertExistingAiSummary(db, 'req-1', REPO_NAME, 42, 'branch-tip-sha', '- 概要\nWebhookで生成済みの要約', 'existing-model');
    // マージコミット自体は別sha(merge-commit-sha)で、repo_commit_indexに
    // github_pr_number=42として記録されている(commit_agent_logには無い)。
    insertMergeCommitIndexRow(db, 'merge-commit-sha', REPO_NAME, 1, 42);

    const res = await postSummary(db, 'ok@example.com', 'merge-commit-sha', REPO_NAME);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: string; model: string; source?: string };
    expect(body.summary).toBe('- 概要\nWebhookで生成済みの要約');
    expect(body.source).toBe('repo_commit_index');
  });

  it('repo_commit_indexにgithub_pr_numberが無い(PRに紐付かない直接コミット)場合はフォールバックせず404のまま', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertMergeCommitIndexRow(db, 'direct-commit-sha', REPO_NAME, 1, null);
    const res = await postSummary(db, 'ok@example.com', 'direct-commit-sha', REPO_NAME);
    expect(res.status).toBe(404);
  });

  it('repo_commit_index経由でも別リポジトリのpr_numberの要約は返さない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', 'nekoserver/cf-auth', 42, 'branch-tip-sha', '- 概要\n別リポジトリの要約', 'test-model');
    insertMergeCommitIndexRow(db, 'merge-commit-sha', REPO_NAME, 1, 42);
    const res = await postSummary(db, 'ok@example.com', 'merge-commit-sha', REPO_NAME);
    expect(res.status).toBe(404);
  });
});
