/**
 * POST /api/tsubuyaki-external のテスト
 *
 * 対象: dynamicnekoの/slack-postページ(React版つぶやき投稿)向けのexternal API。
 * 本体Workerの内部版(Cookie認証、POST /api/tsubuyaki)と同じロジック
 * (validateFreeText/buildFreeTextSlackMessage/sendTsubuyakiToSlack)を、
 * dynamicnekoからのService Binding経由の呼び出し用に別ルートとして公開する。
 * NOTIFY_TARGET/notification_settings.slack_enabledは自動通知向けの切り替えで
 * あり、この明示的な投稿操作とは無関係なため参照しない(本体Worker自身の
 * SOT/SLACK_CHANNEL_IDで直接Slackへ投稿する)。認可はjev-score-external等と同じ
 * 「Bearer secret(AICHAT_EXTERNAL_SECRET)→userToken(署名付きJWT)のsubを
 * emailとして検証→dynamicneko_aichat_allowed_usersで許可確認→
 * 登録済みgithub_loginを表示名に使う(本文の生emailやloginは信用しない)」の順。
 *
 * 故障シナリオ:
 *   (1) Bearer secretが一致しないリクエストが素通りしてしまう
 *   (2) userTokenが無い/偽造されている場合に本文の生emailを信用してしまう
 *   (3) 未許可メールアドレスがSlack投稿できてしまう
 *   (4) 本文が空/長すぎる場合でもSlackへ投稿されてしまう
 *   (5) 許可済みメールアドレスだがgithub_login未登録の場合にemailそのものを
 *       表示名に使う等、事故る形でSlackに投稿されてしまう
 *   (6) Slack secret(SOT/SLACK_CHANNEL_ID)が未設定/送信失敗した
 *       場合にok:trueを返してしまう(握りつぶし)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

const SECRET = 'test-aichat-external-secret';
const USER_TOKEN_SECRET = 'test-user-token-secret';

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
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(allowedUsers: Record<string, string | null>): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE dynamicneko_aichat_allowed_users (email TEXT PRIMARY KEY, github_login TEXT);`);
  const insert = db.prepare('INSERT INTO dynamicneko_aichat_allowed_users (email, github_login) VALUES (?, ?)');
  for (const [email, login] of Object.entries(allowedUsers)) {
    insert.run(email, login);
  }
  return db;
}

function makeEnv(overrides: {
  db?: DatabaseSync;
  slackOauthToken?: string;
  slackChannelId?: string;
} = {}) {
  const db = overrides.db ?? setupDb({ 'octocat@example.com': 'octocat' });
  return {
    DB: wrapD1(db),
    AICHAT_EXTERNAL_SECRET: SECRET,
    AICHAT_USER_TOKEN_SECRET: USER_TOKEN_SECRET,
    SOT: overrides.slackOauthToken ?? 'xoxb-dummy',
    SLACK_CHANNEL_ID: overrides.slackChannelId ?? 'C123',
  } as unknown as Parameters<typeof app.request>[2];
}

async function postRoute(env: ReturnType<typeof makeEnv>, body: unknown, authHeader = `Bearer ${SECRET}`) {
  return app.request('/api/tsubuyaki-external', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, env);
}

describe('POST /api/tsubuyaki-external', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('Bearer secretが一致しない場合は401', async () => {
    const res = await postRoute(makeEnv(), { userToken: 'x', text: 'こんにちは' }, 'Bearer wrong-secret');
    expect(res.status).toBe(401);
  });

  it('userTokenが無い場合は401(本文の生emailは受け付けない)', async () => {
    const res = await postRoute(makeEnv(), { text: 'こんにちは' });
    expect(res.status).toBe(401);
  });

  it('userTokenの署名が不正な場合は401', async () => {
    const forged = await createJWT({ sub: 'octocat@example.com' }, 'wrong-secret', 60);
    const res = await postRoute(makeEnv(), { userToken: forged, text: 'こんにちは' });
    expect(res.status).toBe(401);
  });

  it('未許可メールアドレスは403で拒否され、Slackへは投稿されない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const token = await makeUserToken('not-allowed@example.com');
    const res = await postRoute(makeEnv({ db: setupDb({ 'octocat@example.com': 'octocat' }) }), { userToken: token, text: 'こんにちは' });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('本文が空の場合は400で拒否され、Slackへは投稿されない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const token = await makeUserToken('octocat@example.com');
    const res = await postRoute(makeEnv(), { userToken: token, text: '   ' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('許可済みメールアドレスだがgithub_login未登録の場合は500で拒否される(emailそのものを表示名に使わない)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const token = await makeUserToken('nologin@example.com');
    const res = await postRoute(makeEnv({ db: setupDb({ 'nologin@example.com': null }) }), { userToken: token, text: 'こんにちは' });
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Slackのsecretが未設定の場合は503を返す(握りつぶさない)', async () => {
    const token = await makeUserToken('octocat@example.com');
    const res = await postRoute(makeEnv({ slackOauthToken: '' }), { userToken: token, text: 'こんにちは' });
    expect(res.status).toBe(503);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
  });

  it('送信に失敗した場合は502でエラー内容を返す(握りつぶさない)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('down', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const token = await makeUserToken('octocat@example.com');
    const res = await postRoute(makeEnv(), { userToken: token, text: 'こんにちは' });
    expect(res.status).toBe(502);
  });

  it('正常系: 許可済みユーザーの投稿をgithub_login表示名で直接Slackへ送信しok:trueを返す', async () => {
    let receivedBody: unknown = null;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      receivedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const token = await makeUserToken('octocat@example.com');
    const res = await postRoute(makeEnv(), { userToken: token, text: 'テスト投稿です' });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    const sentText = (receivedBody as { text: string }).text;
    expect(sentText).toContain('octocat');
    expect(sentText).toContain('テスト投稿です');
  });

  it('本文の前後の空白はtrimしてから投稿する', async () => {
    let receivedBody: unknown = null;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      receivedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const token = await makeUserToken('octocat@example.com');
    await postRoute(makeEnv(), { userToken: token, text: '  空白付きテキスト  ' });
    const sentText = (receivedBody as { text: string }).text;
    expect(sentText).toContain('空白付きテキスト');
    expect(sentText).not.toContain('  空白付きテキスト  ');
  });
});
