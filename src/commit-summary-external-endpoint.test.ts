/**
 * POST /api/commit-summary-external のテスト
 *
 * 対象: dynamicnekoの/tree-viewコミット履歴モーダルの「要約」ボタン用API。
 * PRマージ時のWebhookパイプラインが既にcommit_agent_log/ai_summary_logへ
 * 保存している日本語要約を優先して読み出す。見つからない場合(commit_agent_log
 * の記録漏れ期間に紛れ込んだコミット等)は、GitHub Commit APIから直接diffと
 * コミットメッセージを取得してAIで新規に要約を生成し、ai_summary_log/
 * commit_agent_logへ書き込んでから返す(2026-09-19、ユーザー指摘: 一時期
 * commit_agent_logの記録が欠落していた期間があり、そのコミットは実際には
 * 一度も要約されていない可能性がある。単なる404で終わらせず、その場で
 * 生成・記録・再返却するようにした)。
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
 *   (8) GITHUB_TOKEN/AIバインディングが両方揃っているのに、記録漏れの
 *       コミットを単なる404で終わらせてしまう(新規生成・記録をしない)
 *   (9) GitHub Commit API上に実在しないcommitHashでも、新規生成を試みて
 *       500系のあいまいなエラーを返してしまう(404であるべき)
 *   (10) AI生成に失敗した場合に、握りつぶして200(空/エラー文言入りの要約)を
 *        返してしまう
 *   (11) 新規生成した要約をDBへ保存し損ねる(次回以降も毎回AIを呼び直す)
 *   (12) GITHUB_TOKEN/AIのどちらかが未設定の場合に、新規生成を試みて
 *        例外で落ちてしまう(設定不足を理由にした404であるべき)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
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
      daily_seq INTEGER NOT NULL DEFAULT 1,
      event_date TEXT NOT NULL DEFAULT (date('now')),
      event_type TEXT NOT NULL DEFAULT 'pr_summary',
      repo_full_name TEXT,
      pr_number INTEGER,
      pr_action TEXT,
      pr_url TEXT,
      model TEXT,
      summary TEXT,
      diff_length INTEGER DEFAULT 0,
      slack_notified INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE commit_agent_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      repo_full_name TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      commit_sha TEXT,
      commit_message TEXT,
      commit_author_name TEXT,
      commit_author_email TEXT,
      detected_agent_name TEXT,
      detected_agent_version TEXT,
      detected_signal TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE repo_commit_index (
      commit_hash TEXT PRIMARY KEY,
      seq_num INTEGER NOT NULL,
      github_pr_number INTEGER,
      commit_message TEXT NOT NULL,
      repo_name TEXT NOT NULL
    );
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
  db.prepare(
    `INSERT INTO installation_permissions (installation_id, repo_name, updated_at) VALUES (1, ?, datetime('now'))`
  ).run(REPO_NAME);
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

async function postSummary(
  db: DatabaseSync,
  email: string,
  commitHash: string,
  repoName: string,
  envOverrides: Record<string, unknown> = {}
): Promise<Response> {
  const userToken = await makeUserToken(email);
  return app.request(
    '/api/commit-summary-external',
    { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, commitHash, repoName }) },
    { ...BASE_ENV, DB: wrapD1(db), ...envOverrides }
  );
}

// 「記録漏れコミットの新規生成」テスト用のGitHub Commit APIモック。
// Acceptヘッダでjson(コミット情報)とdiff(vnd.github.v3.diff)を出し分ける。
function stubGithubCommitApi(opts: { exists?: boolean; message?: string } = {}): void {
  const { exists = true, message = 'fix: 何かを直した' } = opts;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!exists) {
        return new Response('Not Found', { status: 404 });
      }
      const accept = (init?.headers as Record<string, string> | undefined)?.Accept ?? '';
      if (accept.includes('diff')) {
        return new Response('diff --git a/foo.ts b/foo.ts\n+fixed', { status: 200 });
      }
      return Response.json(
        { commit: { message, author: { name: 'nekoserver', email: 'nekoserver@example.com' } } },
        { status: 200 }
      );
    })
  );
}

function makeAiEnv(response: string | null): { AI: { run: ReturnType<typeof vi.fn> } } {
  return {
    AI: {
      run: vi.fn(async () => (response === null ? { error: 'boom' } : { response })),
    },
  };
}

describe('POST /api/commit-summary-external', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('記録漏れコミット(commit_agent_log/repo_commit_indexのどちらにも無い)でも、GITHUB_TOKEN+AIが揃っていればその場で要約を新規生成して返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    stubGithubCommitApi({ message: 'fix: 記録漏れ期間中のコミット' });
    const res = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, {
      GITHUB_TOKEN: 'gh-token',
      ...makeAiEnv('- 概要\n新規生成した要約'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: string; source?: string; cached?: boolean };
    expect(body.summary).toBe('- 概要\n新規生成した要約');
    expect(body.source).toBe('generated');
    expect(body.cached).toBe(false);
  });

  it('新規生成した要約はai_summary_log/commit_agent_logへ保存され、次回は生成し直さず直接一致で返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    stubGithubCommitApi({ message: 'fix: 記録漏れ期間中のコミット' });
    const aiEnv = makeAiEnv('- 概要\n新規生成した要約');
    const first = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, { GITHUB_TOKEN: 'gh-token', ...aiEnv });
    expect(first.status).toBe(200);
    expect(aiEnv.AI.run).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    const second = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, { GITHUB_TOKEN: 'gh-token', ...aiEnv });
    expect(second.status).toBe(200);
    const body = (await second.json()) as { summary: string; source?: string; cached?: boolean };
    expect(body.summary).toBe('- 概要\n新規生成した要約');
    expect(body.source).toBe('ai_summary_log');
    expect(body.cached).toBe(true);
    // 2回目はAIを再度呼ばない(fetchもスタブしていないため、呼ばれたら例外で落ちる)。
    expect(aiEnv.AI.run).toHaveBeenCalledTimes(1);
  });

  it('GitHub Commit API上にcommitHashが実在しない場合は404(あいまいな500にしない)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    stubGithubCommitApi({ exists: false });
    const res = await postSummary(db, 'ok@example.com', 'does-not-exist-on-github', REPO_NAME, {
      GITHUB_TOKEN: 'gh-token',
      ...makeAiEnv('- 概要\n新規生成した要約'),
    });
    expect(res.status).toBe(404);
  });

  it('AI生成に失敗した場合は502を返し、握りつぶして200にしない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    stubGithubCommitApi({ message: 'fix: AI失敗ケース' });
    const res = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, {
      GITHUB_TOKEN: 'gh-token',
      ...makeAiEnv(null),
    });
    expect(res.status).toBe(502);
  });

  it('GITHUB_TOKEN未設定の場合は新規生成を試みず404(設定不足を理由に明示する)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, makeAiEnv('- 概要\n新規生成した要約'));
    expect(res.status).toBe(404);
  });

  it('AIバインディング未設定の場合は新規生成を試みず404(設定不足を理由に明示する)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, { GITHUB_TOKEN: 'gh-token' });
    expect(res.status).toBe(404);
  });
});
