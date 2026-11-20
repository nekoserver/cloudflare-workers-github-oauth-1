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
        async run(): Promise<{ success: boolean; meta: { changes: number } }> {
          const result = stmt.run(...(args as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
    async batch(stmts: Array<{ run(): Promise<unknown> }>) {
      const results = [];
      for (const s of stmts) results.push(await s.run());
      return results;
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
    CREATE TABLE ai_summary_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary_log_id INTEGER NOT NULL REFERENCES ai_summary_log(id),
      keyword TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(summary_log_id, keyword)
    );
    CREATE TABLE ai_summary_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary_log_id INTEGER NOT NULL REFERENCES ai_summary_log(id),
      file_path TEXT NOT NULL,
      file_ext TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(summary_log_id, file_path)
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
      repo_name TEXT NOT NULL,
      committed_at TEXT
    );
    CREATE TABLE installation_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installation_id INTEGER NOT NULL,
      repo_name TEXT,
      repository_selection TEXT NOT NULL DEFAULT 'selected',
      permissions TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE commit_file_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_name TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      file_path TEXT NOT NULL,
      committed_at TEXT NOT NULL,
      UNIQUE(repo_name, commit_hash, file_path)
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

  it('installation_permissionsに行が無くても、組み込み済みの追跡対象(rails-root)は400にならない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postSummary(db, 'ok@example.com', 'h1', 'nekoserver/rails-root');
    expect(res.status).not.toBe(400);
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

  it('キャッシュ済みだがキーワード未抽出の場合、タップ時にその場で抽出・保存して返す(ユーザー要望2026-10-11)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', REPO_NAME, 42, 'h1', '- 概要\nバグを修正した', 'existing-model');
    const aiEnv = makeAiEnv('- 概要\nバグを修正した');

    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME, aiEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cached: boolean; keywords?: string[] };
    expect(body.cached).toBe(true);
    expect(body.keywords?.length).toBeGreaterThan(0);
    // 要約本体は生成しない(キャッシュ済みのため)、キーワード抽出のみ1回。
    expect(aiEnv.AI.run).toHaveBeenCalledTimes(1);
    const stored = db.prepare(
      'SELECT k.keyword FROM ai_summary_keywords k JOIN ai_summary_log l ON l.id = k.summary_log_id ORDER BY k.id'
    ).all() as Array<{ keyword: string }>;
    expect(stored.length).toBeGreaterThan(0);
    expect(body.keywords).toEqual(stored.map((r) => r.keyword));
  });

  it('キャッシュ済みで既にキーワード抽出済みの場合は、AIを再度呼ばずそのまま返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', REPO_NAME, 42, 'h1', '- 概要\nバグを修正した', 'existing-model');
    db.prepare(
      `INSERT INTO ai_summary_keywords (summary_log_id, keyword) SELECT id, 'バグ修正' FROM ai_summary_log WHERE request_id = 'req-1'`
    ).run();
    const aiEnv = makeAiEnv('- 概要\nバグを修正した');

    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME, aiEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cached: boolean; keywords?: string[] };
    expect(body.keywords).toEqual(['バグ修正']);
    expect(aiEnv.AI.run).not.toHaveBeenCalled();
  });

  it('キャッシュ済みでキーワード未抽出だがAIバインディング未設定の場合は、例外にせず空のキーワードのまま返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', REPO_NAME, 42, 'h1', '- 概要\nバグを修正した', 'existing-model');

    const res = await postSummary(db, 'ok@example.com', 'h1', REPO_NAME);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cached: boolean; keywords?: string[] };
    expect(body.cached).toBe(true);
    expect(body.keywords).toEqual([]);
  });

  it('マージコミット経由のキャッシュでもキーワード未抽出ならその場で抽出・保存する', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'req-1', REPO_NAME, 42, 'branch-tip-sha', '- 概要\nWebhookで生成済みの要約', 'existing-model');
    insertMergeCommitIndexRow(db, 'merge-commit-sha', REPO_NAME, 1, 42);
    const aiEnv = makeAiEnv('- 概要\nWebhookで生成済みの要約');

    const res = await postSummary(db, 'ok@example.com', 'merge-commit-sha', REPO_NAME, aiEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { source?: string; keywords?: string[] };
    expect(body.source).toBe('repo_commit_index');
    expect(body.keywords?.length).toBeGreaterThan(0);
    expect(aiEnv.AI.run).toHaveBeenCalledTimes(1);
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

  it('旧 Llama 設定でも tree-view のコミット要約を Gemma 4 で生成して保存する', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    stubGithubCommitApi();
    const model = '@cf/google/gemma-4-26b-a4b-it';
    const summary = 'Gemma 4 が生成したコミット要約';
    const run = vi.fn().mockResolvedValue({ choices: [{ message: { content: summary } }] });
    const res = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, {
      GITHUB_TOKEN: 'gh-token',
      AI_MODEL: '@cf/meta/llama-3.1-8b-instruct-fp8',
      AI: { run },
    });
    expect(run).toHaveBeenNthCalledWith(1, model, {
      chat_template_kwargs: { enable_thinking: false },
      messages: [{ role: 'user', content: expect.stringContaining('fix: 何かを直した') }],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ summary, model, source: 'generated', cached: false });
    expect(db.prepare('SELECT model FROM ai_summary_log').get()).toEqual({ model });
  });

  it('明示したモデルで生成に失敗した場合は Gemma 4 にフォールバックする', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    stubGithubCommitApi();
    const primary = '@cf/google/gemma-3-12b-it';
    const fallback = '@cf/google/gemma-4-26b-a4b-it';
    const run = vi.fn().mockRejectedValueOnce(new Error('primary unavailable'))
      .mockResolvedValue({ choices: [{ message: { content: 'フォールバック要約' } }] });
    const res = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, {
      GITHUB_TOKEN: 'gh-token', AI_MODEL: primary, AI: { run },
    });
    expect(run.mock.calls.slice(0, 2).map(([model]) => model)).toEqual([primary, fallback]);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ summary: 'フォールバック要約', model: fallback });
  });

  it('新規生成した要約はai_summary_log/commit_agent_logへ保存され、次回は生成し直さず直接一致で返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    stubGithubCommitApi({ message: 'fix: 記録漏れ期間中のコミット' });
    const aiEnv = makeAiEnv('- 概要\n新規生成した要約');
    const first = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, { GITHUB_TOKEN: 'gh-token', ...aiEnv });
    expect(first.status).toBe(200);
    // 要約本体(1回)+キーワード抽出(1回)でAI.runは2回呼ばれる。
    expect(aiEnv.AI.run).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
    const second = await postSummary(db, 'ok@example.com', 'orphan-sha', REPO_NAME, { GITHUB_TOKEN: 'gh-token', ...aiEnv });
    expect(second.status).toBe(200);
    const body = (await second.json()) as { summary: string; source?: string; cached?: boolean; keywords?: string[] };
    expect(body.summary).toBe('- 概要\n新規生成した要約');
    expect(body.source).toBe('ai_summary_log');
    expect(body.cached).toBe(true);
    const stored = db.prepare(
      'SELECT k.keyword FROM ai_summary_keywords k JOIN ai_summary_log l ON l.id = k.summary_log_id ORDER BY k.id'
    ).all() as Array<{ keyword: string }>;
    expect(stored.length).toBeGreaterThan(0);
    expect(body.keywords).toEqual(stored.map((r) => r.keyword));
    // 2回目はAIを再度呼ばない(fetchもスタブしていないため、呼ばれたら例外で落ちる)。
    expect(aiEnv.AI.run).toHaveBeenCalledTimes(2);
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

describe('POST /api/commit-summary-status-external', () => {
  async function postStatus(db: DatabaseSync, body: Record<string, unknown>): Promise<Response> {
    const userToken = await makeUserToken('ok@example.com');
    return app.request(
      '/api/commit-summary-status-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, ...body }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
  }

  it('直接一致・マージコミット経由はcached、要約の無いものは含まれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'r1', REPO_NAME, 10, 'aaa1111', '- 要約A', 'm');
    insertExistingAiSummary(db, 'r2', REPO_NAME, 11, 'bbb2222', '', 'm');
    insertExistingAiSummary(db, 'r3', REPO_NAME, 12, 'ddd4444', '- 要約D', 'm');
    insertMergeCommitIndexRow(db, 'ccc3333', REPO_NAME, 1, 12);
    const res = await postStatus(db, { repoName: REPO_NAME, commitHashes: ['aaa1111', 'bbb2222', 'ccc3333', 'eee5555'] });
    expect(res.status).toBe(200);
    const body = await res.json() as { cached: string[] };
    expect(body.cached).toEqual(['aaa1111', 'ccc3333']);
  });

  it('withKeywordsはキーワード抽出済みのcachedだけを含む部分集合になる', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'r1', REPO_NAME, 10, 'aaa1111', '- 要約A(キーワード抽出済み)', 'm');
    insertExistingAiSummary(db, 'r2', REPO_NAME, 11, 'bbb2222', '- 要約B(キーワード未抽出)', 'm');
    db.prepare(
      `INSERT INTO ai_summary_keywords (summary_log_id, keyword) SELECT id, '要約A' FROM ai_summary_log WHERE request_id = 'r1'`
    ).run();
    const res = await postStatus(db, { repoName: REPO_NAME, commitHashes: ['aaa1111', 'bbb2222'] });
    expect(res.status).toBe(200);
    const body = await res.json() as { cached: string[]; withKeywords: string[] };
    expect(body.cached).toEqual(['aaa1111', 'bbb2222']);
    expect(body.withKeywords).toEqual(['aaa1111']);
  });

  it('マージコミット経由でcachedな要約もwithKeywordsに正しく反映される', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'r1', REPO_NAME, 42, 'aaa1111', '- 要約', 'm');
    insertMergeCommitIndexRow(db, 'ccc3333', REPO_NAME, 1, 42);
    db.prepare(
      `INSERT INTO ai_summary_keywords (summary_log_id, keyword) SELECT id, '要約' FROM ai_summary_log WHERE request_id = 'r1'`
    ).run();
    const res = await postStatus(db, { repoName: REPO_NAME, commitHashes: ['ccc3333'] });
    const body = await res.json() as { cached: string[]; withKeywords: string[] };
    expect(body.cached).toEqual(['ccc3333']);
    expect(body.withKeywords).toEqual(['ccc3333']);
  });

  it('別リポジトリの要約はcachedにならない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertExistingAiSummary(db, 'r1', 'nekoserver/other', 10, 'aaa1111', '- 要約A', 'm');
    const res = await postStatus(db, { repoName: REPO_NAME, commitHashes: ['aaa1111'] });
    expect((await res.json() as { cached: string[] }).cached).toEqual([]);
  });

  it('bind上限を超える件数(100件)でも全件判定できる', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const hashes = Array.from({ length: 100 }, (_, i) => (i + 1).toString(16).padStart(8, '0'));
    insertExistingAiSummary(db, 'rx', REPO_NAME, 1, hashes[99], '- 要約', 'm');
    const res = await postStatus(db, { repoName: REPO_NAME, commitHashes: hashes });
    expect((await res.json() as { cached: string[] }).cached).toEqual([hashes[99]]);
  });

  it('commitHashesが空・不正なら400、未許可メールは403', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    expect((await postStatus(db, { repoName: REPO_NAME, commitHashes: [] })).status).toBe(400);
    expect((await postStatus(db, { repoName: REPO_NAME, commitHashes: ['zz;drop'] })).status).toBe(400);
    expect((await postStatus(db, { commitHashes: ['aaa1111'] })).status).toBe(400);
    const ngToken = await makeUserToken('ng@example.com');
    const res = await app.request('/api/commit-summary-status-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken: ngToken, repoName: REPO_NAME, commitHashes: ['aaa1111'] }) },
      { ...BASE_ENV, DB: wrapD1(db) });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/commit-file-latest-external', () => {
  async function postLatest(db: DatabaseSync, body: Record<string, unknown>): Promise<Response> {
    const userToken = await makeUserToken('ok@example.com');
    return app.request(
      '/api/commit-file-latest-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, ...body }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
  }

  function insertCommitFileChange(db: DatabaseSync, repoName: string, commitHash: string, filePath: string, committedAt: string): void {
    db.prepare(
      `INSERT INTO commit_file_changes (repo_name, commit_hash, file_path, committed_at) VALUES (?, ?, ?, ?)`
    ).run(repoName, commitHash, filePath, committedAt);
  }

  it('同じファイルに複数コミットがある場合、committed_atが最新のものを返す', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommitFileChange(db, REPO_NAME, 'aaa1111', 'src/a.ts', '2026-10-01T00:00:00.000Z');
    insertCommitFileChange(db, REPO_NAME, 'bbb2222', 'src/a.ts', '2026-10-10T00:00:00.000Z');
    const res = await postLatest(db, { repoName: REPO_NAME, filePaths: ['src/a.ts'] });
    expect(res.status).toBe(200);
    const body = await res.json() as { latest: Record<string, { commitHash: string; committedAt: string }> };
    expect(body.latest['src/a.ts']).toEqual({ commitHash: 'bbb2222', committedAt: '2026-10-10T00:00:00.000Z' });
  });

  it('記録の無いファイルはレスポンスのキーに含まれない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommitFileChange(db, REPO_NAME, 'aaa1111', 'src/a.ts', '2026-10-01T00:00:00.000Z');
    const res = await postLatest(db, { repoName: REPO_NAME, filePaths: ['src/a.ts', 'src/missing.ts'] });
    const body = await res.json() as { latest: Record<string, unknown> };
    expect(Object.keys(body.latest)).toEqual(['src/a.ts']);
  });

  it('別リポジトリの記録は返さない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertCommitFileChange(db, 'nekoserver/other', 'aaa1111', 'src/a.ts', '2026-10-01T00:00:00.000Z');
    const res = await postLatest(db, { repoName: REPO_NAME, filePaths: ['src/a.ts'] });
    const body = await res.json() as { latest: Record<string, unknown> };
    expect(Object.keys(body.latest)).toEqual([]);
  });

  it('filePathsが空・repoName未指定は400、未許可メールは403', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    expect((await postLatest(db, { repoName: REPO_NAME, filePaths: [] })).status).toBe(400);
    expect((await postLatest(db, { filePaths: ['src/a.ts'] })).status).toBe(400);
    const ngToken = await makeUserToken('ng@example.com');
    const res = await app.request('/api/commit-file-latest-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken: ngToken, repoName: REPO_NAME, filePaths: ['src/a.ts'] }) },
      { ...BASE_ENV, DB: wrapD1(db) });
    expect(res.status).toBe(403);
  });

  it('Bearer secretが一致しなければ401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const userToken = await makeUserToken('ok@example.com');
    const res = await app.request('/api/commit-file-latest-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong-secret', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, repoName: REPO_NAME, filePaths: ['src/a.ts'] }) },
      { ...BASE_ENV, DB: wrapD1(db) });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/commit-file-changes-external', () => {
  async function postChanges(db: DatabaseSync, body: Record<string, unknown>): Promise<Response> {
    const userToken = await makeUserToken('ok@example.com');
    return app.request(
      '/api/commit-file-changes-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, ...body }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
  }

  function readCommitFileChanges(db: DatabaseSync, repoName: string, commitHash: string): Array<{ file_path: string; committed_at: string }> {
    return db.prepare(
      `SELECT file_path, committed_at FROM commit_file_changes WHERE repo_name = ? AND commit_hash = ? ORDER BY file_path`
    ).all(repoName, commitHash) as Array<{ file_path: string; committed_at: string }>;
  }

  it('filePathsをcommit_file_changesへ保存する', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postChanges(db, {
      repoName: REPO_NAME, commitHash: 'aaa1111', filePaths: ['src/a.ts', 'src/b.ts'], committedAt: '2026-10-15T01:00:00.000Z',
    });
    expect(res.status).toBe(200);
    const rows = readCommitFileChanges(db, REPO_NAME, 'aaa1111');
    expect(rows).toEqual([
      { file_path: 'src/a.ts', committed_at: '2026-10-15T01:00:00.000Z' },
      { file_path: 'src/b.ts', committed_at: '2026-10-15T01:00:00.000Z' },
    ]);
  });

  it('committedAt省略時は現在時刻を使う', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const res = await postChanges(db, { repoName: REPO_NAME, commitHash: 'aaa1111', filePaths: ['src/a.ts'] });
    expect(res.status).toBe(200);
    const rows = readCommitFileChanges(db, REPO_NAME, 'aaa1111');
    expect(rows[0].committed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('同じ内容を2回送っても重複せず冪等(push webhook経由で既に記録済みの場合も無害)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    await postChanges(db, { repoName: REPO_NAME, commitHash: 'aaa1111', filePaths: ['src/a.ts'], committedAt: '2026-10-15T01:00:00.000Z' });
    const res2 = await postChanges(db, { repoName: REPO_NAME, commitHash: 'aaa1111', filePaths: ['src/a.ts'], committedAt: '2026-10-15T02:00:00.000Z' });
    expect(res2.status).toBe(200);
    const rows = readCommitFileChanges(db, REPO_NAME, 'aaa1111');
    // UNIQUE(repo_name, commit_hash, file_path)によりINSERT OR IGNOREされ、
    // 最初に記録された値(push webhook等が先行していた場合も含む)が保持される。
    expect(rows).toEqual([{ file_path: 'src/a.ts', committed_at: '2026-10-15T01:00:00.000Z' }]);
  });

  it('filePathsが空・201件以上・commitHash不正・repoName未指定は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    expect((await postChanges(db, { repoName: REPO_NAME, commitHash: 'aaa1111', filePaths: [] })).status).toBe(400);
    expect((await postChanges(db, {
      repoName: REPO_NAME, commitHash: 'aaa1111', filePaths: Array.from({ length: 201 }, (_, i) => `f${i}.ts`),
    })).status).toBe(400);
    expect((await postChanges(db, { repoName: REPO_NAME, commitHash: 'zz;drop', filePaths: ['src/a.ts'] })).status).toBe(400);
    expect((await postChanges(db, { commitHash: 'aaa1111', filePaths: ['src/a.ts'] })).status).toBe(400);
  });

  it('未許可メールは403、Bearer secret不一致は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const ngToken = await makeUserToken('ng@example.com');
    const res403 = await app.request('/api/commit-file-changes-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken: ngToken, repoName: REPO_NAME, commitHash: 'aaa1111', filePaths: ['src/a.ts'] }) },
      { ...BASE_ENV, DB: wrapD1(db) });
    expect(res403.status).toBe(403);

    const okToken = await makeUserToken('ok@example.com');
    const res401 = await app.request('/api/commit-file-changes-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong-secret', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken: okToken, repoName: REPO_NAME, commitHash: 'aaa1111', filePaths: ['src/a.ts'] }) },
      { ...BASE_ENV, DB: wrapD1(db) });
    expect(res401.status).toBe(401);
  });
});

describe('POST /api/repo-commit-committed-at-external', () => {
  async function postCommittedAt(db: DatabaseSync, body: Record<string, unknown>): Promise<Response> {
    const userToken = await makeUserToken('ok@example.com');
    return app.request(
      '/api/repo-commit-committed-at-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, ...body }) },
      { ...BASE_ENV, DB: wrapD1(db) }
    );
  }

  function readCommittedAt(db: DatabaseSync, commitHash: string): string | null {
    const row = db.prepare(`SELECT committed_at FROM repo_commit_index WHERE commit_hash = ?`).get(commitHash) as { committed_at: string | null };
    return row.committed_at;
  }

  it('committed_atがNULLの行だけ更新する', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertMergeCommitIndexRow(db, 'aaa1111', REPO_NAME, 1, null);
    const res = await postCommittedAt(db, { repoName: REPO_NAME, commits: [{ commitHash: 'aaa1111', committedAt: '2026-10-14T01:00:00Z' }] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { updatedCount: number };
    expect(body.updatedCount).toBe(1);
    expect(readCommittedAt(db, 'aaa1111')).toBe('2026-10-14T01:00:00Z');
  });

  it('既にcommitted_atが入っている行は上書きしない(push webhook由来の値を保護する)', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertMergeCommitIndexRow(db, 'aaa1111', REPO_NAME, 1, null);
    db.prepare(`UPDATE repo_commit_index SET committed_at = '2026-10-01T00:00:00Z' WHERE commit_hash = 'aaa1111'`).run();
    const res = await postCommittedAt(db, { repoName: REPO_NAME, commits: [{ commitHash: 'aaa1111', committedAt: '2026-10-14T01:00:00Z' }] });
    const body = (await res.json()) as { updatedCount: number };
    expect(body.updatedCount).toBe(0);
    expect(readCommittedAt(db, 'aaa1111')).toBe('2026-10-01T00:00:00Z');
  });

  it('別リポジトリの同じcommit_hashは更新しない', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    insertMergeCommitIndexRow(db, 'aaa1111', 'nekoserver/other', 1, null);
    const res = await postCommittedAt(db, { repoName: REPO_NAME, commits: [{ commitHash: 'aaa1111', committedAt: '2026-10-14T01:00:00Z' }] });
    const body = (await res.json()) as { updatedCount: number };
    expect(body.updatedCount).toBe(0);
    expect(readCommittedAt(db, 'aaa1111')).toBeNull();
  });

  it('commitsが空・201件以上・不正なcommitHash/committedAt・repoName未指定は400', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    expect((await postCommittedAt(db, { repoName: REPO_NAME, commits: [] })).status).toBe(400);
    expect((await postCommittedAt(db, {
      repoName: REPO_NAME, commits: Array.from({ length: 201 }, (_, i) => ({ commitHash: i.toString(16).padStart(8, '0'), committedAt: '2026-10-14T01:00:00Z' })),
    })).status).toBe(400);
    expect((await postCommittedAt(db, { repoName: REPO_NAME, commits: [{ commitHash: 'zz;drop', committedAt: '2026-10-14T01:00:00Z' }] })).status).toBe(400);
    expect((await postCommittedAt(db, { repoName: REPO_NAME, commits: [{ commitHash: 'aaa1111', committedAt: '' }] })).status).toBe(400);
    expect((await postCommittedAt(db, { commits: [{ commitHash: 'aaa1111', committedAt: '2026-10-14T01:00:00Z' }] })).status).toBe(400);
  });

  it('未許可メールは403、Bearer secret不一致は401', async () => {
    const db = setupDb({ 'ok@example.com': 'nekoserver' });
    const ngToken = await makeUserToken('ng@example.com');
    const res403 = await app.request('/api/repo-commit-committed-at-external',
      { method: 'POST', headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken: ngToken, repoName: REPO_NAME, commits: [{ commitHash: 'aaa1111', committedAt: '2026-10-14T01:00:00Z' }] }) },
      { ...BASE_ENV, DB: wrapD1(db) });
    expect(res403.status).toBe(403);

    const okToken = await makeUserToken('ok@example.com');
    const res401 = await app.request('/api/repo-commit-committed-at-external',
      { method: 'POST', headers: { Authorization: 'Bearer wrong-secret', 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken: okToken, repoName: REPO_NAME, commits: [{ commitHash: 'aaa1111', committedAt: '2026-10-14T01:00:00Z' }] }) },
      { ...BASE_ENV, DB: wrapD1(db) });
    expect(res401.status).toBe(401);
  });
});
