import { afterEach, describe, expect, it, vi } from 'vitest';
import app from './index';

// 対象: POST /webhook/github のpushイベント処理。
//
// 背景: /webhook/githubはpull_request・installation(_repositories)・
// repository(created)の3種類のイベントしか通知先(Slack/外部Worker=cf-auth)へ
// 転送しておらず、pushイベント(リポジトリwebhookの既定イベント)は
// webhook_logテーブルに記録されるだけで通知が一切飛ばなかった
// (rails-rootのpush webhookがcf-authに記録されないという報告で判明)。
// src/utils/githubPushNotify.tsのbuildPushNotificationText()を呼び、
// NOTIFY_TARGET=workerのときにdispatchNotification経由で外部Worker(cf-auth)の
// /ingestへ実際にfetchされることを、実リクエストで確認する。
//
// 故障シナリオ:
//   (1) pushイベントで通知(fetch)が一切発生しない(今回の不具合の再発)
//   (2) 通知先未設定でもエラーにならず処理自体は継続する(既存方針の維持)
//   (3) installation等repositoryを持たないイベントで例外を投げる(回帰無し確認)

const secret = 'test-github-webhook-secret';

async function signBody(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256=${hex}`;
}

function noopDb() {
  return {
    prepare: () => ({
      bind: () => ({
        run: () => Promise.resolve({ success: true }),
        first: () => Promise.resolve(null),
        all: () => Promise.resolve({ results: [] }),
      }),
    }),
  };
}

type RecordedInsert = { sql: string; bindings: unknown[] };

function recordingDb() {
  const inserts: RecordedInsert[] = [];
  const db = {
    prepare(sql: string) {
      let boundArgs: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          boundArgs = args;
          return this;
        },
        run: () => {
          inserts.push({ sql, bindings: boundArgs });
          return Promise.resolve({ success: true });
        },
        first: () => Promise.resolve(null),
        all: () => Promise.resolve({ results: [] }),
      };
    },
    batch: (stmts: Array<{ run(): Promise<unknown> }>) => Promise.all(stmts.map((s) => s.run())),
  };
  return { db, inserts };
}

// runSummaryPipeline(要約本体)とextractPrerequisiteTerms(キーワード抽出)は
// 同じモデル(DEFAULT_AI_MODEL=ANSWER_PREREQUISITE_TERMS_MODEL=gemma-4)を
// 使うため、モデル名では区別できない。プロンプト文言で呼び分ける。
function makeAiStub(summaryText: string, keywords: string[]) {
  const run = vi.fn(async (_model: string, input: { messages: { role: string; content: string }[] }) => {
    const userContent = input.messages.find((m) => m.role === 'user')?.content ?? '';
    if (userContent.includes('次の文章を理解するのに必要な用語や概念')) {
      return { response: keywords.join('\n') };
    }
    return { response: summaryText };
  });
  return { run };
}

async function postPushWebhook(body: string, env: Record<string, unknown>, event = 'push') {
  const signature = await signBody(body);
  return app.request(
    '/webhook/github',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': event,
        'X-GitHub-Delivery': 'delivery-push-test',
      },
      body,
    },
    env
  );
}

describe('POST /webhook/github: pushイベントで通知先(cf-auth)へ転送する', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('NOTIFY_TARGET=workerのとき、pushイベントで外部Worker(cf-auth)のURLへfetchする', async () => {
    let receivedBody: unknown = null;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      receivedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      pusher: { name: 'okiraku' },
      commits: [{ id: 'a', message: 'first commit' }],
      head_commit: { id: 'a', message: 'first commit' },
      compare: 'https://github.com/nekoserver/rails-root/compare/a...b',
    });

    const response = await postPushWebhook(body, {
      GITHUB_WEBHOOK_SECRET: secret,
      DB: noopDb(),
      NOTIFY_TARGET: 'worker',
      NOTIFY_WORKER_URL: 'https://notify.example.com/ingest',
      NOTIFY_WORKER_SECRET: 'worker-secret',
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]![0]);
    expect(calledUrl).toBe('https://notify.example.com/ingest');
    const sentText = (receivedBody as { text: string }).text;
    expect(sentText).toContain('nekoserver/rails-root');
    expect(sentText).toContain('main');
    expect(sentText).toContain('okiraku');
    // channelにSlackチャンネル名ではなくリポジトリ名を渡す。cf-auth側の/ingestが
    // これをalt_notify_ingest_log.channelへ保存し、リポジトリ単位で絞り込める
    // ようにするため(2026-10-04、rails-rootのpushコミットがcf-auth側で
    // リポジトリ別に読み出せなかった不具合の修正)。
    expect((receivedBody as { channel: string }).channel).toBe('nekoserver/rails-root');
  });

  it.each([undefined, 'slack'])('Slack OFFでもNOTIFY_TARGET=%sからcf-authへ転送し、コミットを記録する', async (target) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const { db, inserts } = recordingDb();
    const prepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const statement = prepare(sql);
      if (sql.includes('SELECT slack_enabled')) {
        statement.first = async () => ({ slack_enabled: 0 }) as never;
      }
      return statement;
    };
    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { full_name: 'nekoserver/cloudflare-workers-github-oauth-1' },
      commits: [{ id: 'abc', message: 'fix: commit log' }],
    });
    const response = await postPushWebhook(body, {
      GITHUB_WEBHOOK_SECRET: secret, DB: db, NOTIFY_TARGET: target,
      SOT: 'slack-token', SLACK_CHANNEL_ID: 'C123',
      NOTIFY_WORKER_URL: 'https://cf-auth.example/ingest',
      NOTIFY_WORKER_SECRET: 'worker-secret',
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://cf-auth.example/ingest');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer worker-secret');
    expect(JSON.parse(String(init!.body)).channel).toBe('nekoserver/cloudflare-workers-github-oauth-1');
    expect(inserts.some(i => i.sql.includes('INSERT INTO ai_summary_log'))).toBe(true);
    expect(inserts.some(i => i.sql.includes('INSERT OR IGNORE INTO repo_commit_index'))).toBe(true);
  });

  it.each(['nekoserver/cloudflare-workers-github-oauth-1', 'nekoserver/rails-root'])(
    'Slack ONでも%sのコミットログは送信せず本体D1に保存する', async (repo) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const { db, inserts } = recordingDb();
      const prepare = db.prepare.bind(db);
      db.prepare = (sql: string) => {
        const statement = prepare(sql);
        if (sql.includes('SELECT slack_enabled')) {
          statement.first = async () => ({ slack_enabled: 1 }) as never;
        }
        return statement;
      };
      const body = JSON.stringify({
        ref: 'refs/heads/main', repository: { full_name: repo },
        commits: [{ id: 'abc', message: 'fix: commit log' }],
      });
      const response = await postPushWebhook(body, {
        GITHUB_WEBHOOK_SECRET: secret, DB: db, NOTIFY_TARGET: 'slack',
        SOT: 'slack-token', SLACK_CHANNEL_ID: 'C123',
        NOTIFY_WORKER_URL: 'https://cf-auth.example/ingest',
      });
      expect(response.status).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();
      const commit = inserts.find(i => i.sql.includes('INSERT OR IGNORE INTO repo_commit_index'));
      expect(commit?.bindings).toEqual(['abc', 1, null, 'fix: commit log', repo]);
      const summary = inserts.find(i => i.sql.includes('INSERT INTO ai_summary_log'));
      expect(summary?.bindings[3]).toBe('push_summary');
      expect(summary?.bindings[4]).toBe(repo);
      expect(summary?.bindings[11]).toBe(0);
      expect(inserts.some(i => i.sql.includes('INSERT INTO webhook_log'))).toBe(true);
    }
  );

  it('通知先が未設定の場合は通知をスキップするが200は返す(処理は止めない)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      commits: [],
    });

    const response = await postPushWebhook(body, { GITHUB_WEBHOOK_SECRET: secret, DB: noopDb() });
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pushのコミットメッセージからAI要約を生成し、ai_summary_logへevent_type=push_summaryで記録する', async () => {
    // 2026-10-04追加: pushはai_summary_logへ一切記録しておらず、rails-root等
    // PRを経由せず直接pushされるリポジトリが、cf-authの/wspaceメインフィード
    // (ai_summary_logをrepo_full_nameで絞り込むだけの既存ロジック)に「要約」が
    // 永久に出てこなかった不具合の修正。AI bindingは無しでも処理を止めない
    // (NO_BINDINGエラー文字列がsummaryとして記録される)ことも確認する。
    vi.stubGlobal('fetch', vi.fn());
    const { db, inserts } = recordingDb();

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      pusher: { name: 'okiraku' },
      commits: [{ id: 'a', message: 'feat: add login' }, { id: 'b', message: 'fix: typo' }],
      head_commit: { id: 'b', message: 'fix: typo' },
      compare: 'https://github.com/nekoserver/rails-root/compare/a...b',
    });

    const response = await postPushWebhook(body, { GITHUB_WEBHOOK_SECRET: secret, DB: db });

    expect(response.status).toBe(200);
    const insert = inserts.find((i) => i.sql.includes('INSERT INTO ai_summary_log'));
    expect(insert).toBeDefined();
    const bindings = insert!.bindings;
    // (request_id, daily_seq, event_date, event_type, repo_full_name, pr_number, pr_action, pr_url, model, summary, diff_length, slack_notified, created_at, fallback_used, primary_model)
    expect(bindings[3]).toBe('push_summary');
    expect(bindings[4]).toBe('nekoserver/rails-root');
    expect(bindings[5]).toBeNull();
    expect(bindings[6]).toBe('push');
    expect(bindings[7]).toBe('https://github.com/nekoserver/rails-root/compare/a...b');
  });

  it('AI binding設定時、push要約と同時にキーワードを抽出してai_summary_keywordsへ保存する', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { db, inserts } = recordingDb();
    const ai = makeAiStub('- 概要\nログイン機能を修正した', ['ログイン機能', '認証トークン']);

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      pusher: { name: 'okiraku' },
      commits: [{ id: 'a', message: 'fix: login bug' }],
      head_commit: { id: 'a', message: 'fix: login bug' },
    });

    const response = await postPushWebhook(body, { GITHUB_WEBHOOK_SECRET: secret, DB: db, AI: ai });

    expect(response.status).toBe(200);
    const summaryInsert = inserts.find((i) => i.sql.includes('INSERT INTO ai_summary_log'));
    expect(summaryInsert).toBeDefined();
    const requestId = summaryInsert!.bindings[0];
    const keywordInserts = inserts.filter((i) => i.sql.includes('INSERT OR IGNORE INTO ai_summary_keywords'));
    expect(keywordInserts.map((i) => i.bindings[0])).toEqual(['ログイン機能', '認証トークン']);
    expect(keywordInserts.every((i) => i.bindings[2] === requestId)).toBe(true);
  });

  it('GITHUB_TOKEN設定時、pushのcompare URLから実際にdiffを取得してdiff_lengthに反映する', async () => {
    // 2026-10-04追加: 当初はコスト面からdiff取得を省略していたが、
    // 「PRと同じようにあるべき姿にしてほしい」という要望を受けて、
    // PRと同じfetchPrDiffをcompare URL(末尾に.diffを付けたもの)に対して
    // 呼び出し、実際の差分をAI要約の根拠・diff_lengthの実値にするよう変更した。
    let requestedDiffUrl = '';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('.diff')) {
        requestedDiffUrl = url;
        return new Response('diff --git a/x b/x\n+added line\n', { status: 200 });
      }
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { db, inserts } = recordingDb();

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      pusher: { name: 'okiraku' },
      commits: [{ id: 'a', message: 'feat: add login' }],
      compare: 'https://github.com/nekoserver/rails-root/compare/a...b',
    });

    const response = await postPushWebhook(body, { GITHUB_WEBHOOK_SECRET: secret, DB: db, GITHUB_TOKEN: 'gh-token' });

    expect(response.status).toBe(200);
    expect(requestedDiffUrl).toBe('https://github.com/nekoserver/rails-root/compare/a...b.diff');
    const insert = inserts.find((i) => i.sql.includes('INSERT INTO ai_summary_log'));
    const bindings = insert!.bindings;
    const diffText = 'diff --git a/x b/x\n+added line\n';
    expect(bindings[10]).toBe(diffText.length);
  });

  it('commitsが空のpush(ブランチ作成直後等)ではai_summary_logへ記録しない', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { db, inserts } = recordingDb();

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      commits: [],
    });

    const response = await postPushWebhook(body, { GITHUB_WEBHOOK_SECRET: secret, DB: db });
    expect(response.status).toBe(200);
    expect(inserts.some((i) => i.sql.includes('INSERT INTO ai_summary_log'))).toBe(false);
  });

  it('pushのcommitsをrepo_commit_indexへ自動追記し、マージコミットのPR番号も記録する', async () => {
    // 2026-10-04追加: repo_commit_index(CLAUDE.mdルール24)はPRマージ毎に手動で
    // SQLを実行する運用だったが、手動実行を忘れると記録が途切れる実害があった
    // ため、pushイベント受信時に自動追記するようにした。
    vi.stubGlobal('fetch', vi.fn());
    const { db, inserts } = recordingDb();

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      commits: [
        { id: 'aaaa', message: 'fix: typo' },
        { id: 'bbbb', message: 'Merge pull request #42 from nekoserver/some-branch' },
      ],
    });

    const response = await postPushWebhook(body, { GITHUB_WEBHOOK_SECRET: secret, DB: db });

    expect(response.status).toBe(200);
    const indexInserts = inserts.filter((i) => i.sql.includes('INSERT OR IGNORE INTO repo_commit_index'));
    expect(indexInserts).toHaveLength(2);
    expect(indexInserts[0]!.bindings).toEqual(['aaaa', 1, null, 'fix: typo', 'nekoserver/rails-root']);
    expect(indexInserts[1]!.bindings).toEqual([
      'bbbb',
      2,
      42,
      'Merge pull request #42 from nekoserver/some-branch',
      'nekoserver/rails-root',
    ]);
  });

  it('commitsが空のpushではrepo_commit_indexへ何も追記しない', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { db, inserts } = recordingDb();

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'rails-root', full_name: 'nekoserver/rails-root', private: true },
      commits: [],
    });

    const response = await postPushWebhook(body, { GITHUB_WEBHOOK_SECRET: secret, DB: db });
    expect(response.status).toBe(200);
    expect(inserts.some((i) => i.sql.includes('repo_commit_index'))).toBe(false);
  });
});


describe('本体リポジトリのPR要約はSlackに送信しない', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([
    ['opened', undefined], ['synchronize', undefined],
    ['opened', 'https://cf-auth.example/ingest'], ['synchronize', 'https://cf-auth.example/ingest'],
  ])('%s: Slack ONでも外部Worker設定=%sの方針に従いD1へ保存する', async (action, workerUrl) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);
    const { db, inserts } = recordingDb();
    const prepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const statement = prepare(sql);
      if (sql.includes('SELECT slack_enabled')) statement.first = async () => ({ slack_enabled: 1 }) as never;
      return statement;
    };
    const response = await postPushWebhook(JSON.stringify({
      action, repository: { full_name: 'nekoserver/cloudflare-workers-github-oauth-1' },
      pull_request: { number: 123, title: 'fix: worker commit', body: 'commit update',
        html_url: 'https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/123', user: { login: 'test' } },
    }), { GITHUB_WEBHOOK_SECRET: secret, DB: db, SOT: 'test-token', SLACK_CHANNEL_ID: 'C123',
      NOTIFY_TARGET: 'slack', NOTIFY_WORKER_URL: workerUrl }, 'pull_request');
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(workerUrl ? 1 : 0);
    if (workerUrl) expect(fetchMock.mock.calls[0][0]).toBe(workerUrl);
    const summary = inserts.find(row => row.sql.includes('INSERT INTO ai_summary_log'));
    expect(summary).toBeDefined();
    expect(summary!.bindings[3]).toBe('pr_summary');
    expect(inserts.some(row => row.sql.includes('INSERT INTO ai_summary_reviews'))).toBe(true);
  });

  it('他リポジトリのPR要約はSlack ON時に従来どおりSlackへ送る', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);
    const { db } = recordingDb();
    const prepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const statement = prepare(sql);
      if (sql.includes('SELECT slack_enabled')) statement.first = async () => ({ slack_enabled: 1 }) as never;
      return statement;
    };
    const response = await postPushWebhook(JSON.stringify({ action: 'synchronize',
      repository: { full_name: 'nekoserver/rails-root' },
      pull_request: { number: 123, title: 'fix: other repo', html_url: 'https://github.com/nekoserver/rails-root/pull/123' },
    }), { GITHUB_WEBHOOK_SECRET: secret, DB: db, SOT: 'test-token', SLACK_CHANNEL_ID: 'C123' }, 'pull_request');
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://slack.com/api/chat.postMessage');
  });
});
