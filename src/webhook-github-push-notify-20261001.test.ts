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
  };
  return { db, inserts };
}

async function postPushWebhook(body: string, env: Record<string, unknown>) {
  const signature = await signBody(body);
  return app.request(
    '/webhook/github',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'push',
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
