import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runEmailConfirmGate, resolveEmailConfirmToken, isEmailConfirmLoginEnabled, savePendingLogin } from './emailConfirmGate';

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const makeResult = (args: unknown[]) => ({
        async first<T>(): Promise<T | null> {
          const row = stmt.get(...(args as never[]));
          return (row ?? null) as T | null;
        },
        async run(): Promise<void> {
          stmt.run(...(args as never[]));
        },
      });
      return {
        ...makeResult([]),
        bind(...args: unknown[]) {
          return makeResult(args);
        },
      };
    },
  };
}

function setupDb(enabled: boolean): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE notification_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      slack_enabled INTEGER NOT NULL DEFAULT 0,
      email_confirm_login_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE email_confirm_tokens (
      token TEXT PRIMARY KEY,
      github_login TEXT NOT NULL,
      github_name TEXT,
      github_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      github_access_token TEXT NOT NULL,
      granted_scopes TEXT NOT NULL,
      timezone TEXT NOT NULL,
      session_duration TEXT NOT NULL,
      return_to TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    );
  `);
  db.prepare('INSERT INTO notification_settings (id, email_confirm_login_enabled) VALUES (1, ?)').run(enabled ? 1 : 0);
  return db;
}

const identity = {
  githubLogin: 'octocat',
  githubName: 'The Octocat',
  githubId: 1,
  email: 'octocat@example.com',
  accessToken: 'gho_xxx',
  grantedScopes: 'repo user',
  timezone: 'Asia/Tokyo',
  sessionDuration: '1h',
  returnToPath: '/welcome',
};

describe('runEmailConfirmGate — デフォルトOFFのユーザーオプションによるロックアウト防止', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ユーザーオプションがOFF(デフォルト)の場合、RESEND_API_KEYがあってもgated:falseで即ログインを許可する', async () => {
    const db = setupDb(false);
    const result = await runEmailConfirmGate(wrapD1(db) as never, 're_xxx', 'https://example.com', identity);
    expect(result.gated).toBe(false);
  });

  it('ユーザーオプションがONでもRESEND_API_KEY未設定ならgated:falseで即ログインを許可する', async () => {
    const db = setupDb(true);
    const result = await runEmailConfirmGate(wrapD1(db) as never, undefined, 'https://example.com', identity);
    expect(result.gated).toBe(false);
  });

  it('ユーザーオプションON かつ RESEND_API_KEY設定時は確認メールを送信しgated:trueで保留ページHTMLを返す', async () => {
    const db = setupDb(true);
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'abc' }), { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await runEmailConfirmGate(wrapD1(db) as never, 're_xxx', 'https://example.com', identity);
    expect(result.gated).toBe(true);
    if (result.gated && 'html' in result) {
      expect(result.html).toContain('octocat@example.com');
    } else {
      throw new Error('expected html result');
    }

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.text).toContain('https://example.com/auth/email-confirm?token=');
  });

  it('確認メール送信がAPIエラーの場合は握りつぶさずerrorStatus/errorMessageを返す', async () => {
    const db = setupDb(true);
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'invalid key' }), { status: 401 }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await runEmailConfirmGate(wrapD1(db) as never, 're_xxx', 'https://example.com', identity);
    expect(result.gated).toBe(true);
    if (result.gated && 'errorStatus' in result) {
      expect(result.errorStatus).toBe(502);
      expect(result.errorMessage).toBeTruthy();
    } else {
      throw new Error('expected error result');
    }
  });

  it('D1保存に失敗する場合(テーブル未作成等)はメール確認をスキップしgated:falseを返す(ロックアウト防止)', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE notification_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        email_confirm_login_enabled INTEGER NOT NULL DEFAULT 1
      );
    `);
    db.prepare('INSERT INTO notification_settings (id, email_confirm_login_enabled) VALUES (1, 1)').run();
    // email_confirm_tokens テーブルが無い(migration未適用)状態を再現
    const result = await runEmailConfirmGate(wrapD1(db) as never, 're_xxx', 'https://example.com', identity);
    expect(result.gated).toBe(false);
  });
});

describe('resolveEmailConfirmToken — 確認リンククリック後のトークン検証', () => {
  it('保存済みトークンを一度きり消費して取り出せる', async () => {
    const db = setupDb(true);
    await savePendingLogin(wrapD1(db) as never, {
      token: 'tok-1',
      githubLogin: identity.githubLogin,
      githubName: identity.githubName,
      githubId: identity.githubId,
      email: identity.email,
      githubAccessToken: identity.accessToken,
      grantedScopes: identity.grantedScopes,
      timezone: identity.timezone,
      sessionDuration: identity.sessionDuration,
      returnToPath: identity.returnToPath,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const resolved = await resolveEmailConfirmToken(wrapD1(db) as never, 'tok-1');
    expect(resolved.ok).toBe(true);
  });

  it('存在しないトークンはok:falseとエラーメッセージを返す', async () => {
    const db = setupDb(true);
    const resolved = await resolveEmailConfirmToken(wrapD1(db) as never, 'no-such-token');
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.message).toBeTruthy();
  });

  it('有効期限切れのトークンはok:falseを返す', async () => {
    const db = setupDb(true);
    await savePendingLogin(wrapD1(db) as never, {
      token: 'tok-expired',
      githubLogin: identity.githubLogin,
      githubName: identity.githubName,
      githubId: identity.githubId,
      email: identity.email,
      githubAccessToken: identity.accessToken,
      grantedScopes: identity.grantedScopes,
      timezone: identity.timezone,
      sessionDuration: identity.sessionDuration,
      returnToPath: identity.returnToPath,
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    const resolved = await resolveEmailConfirmToken(wrapD1(db) as never, 'tok-expired');
    expect(resolved.ok).toBe(false);
  });
});

describe('isEmailConfirmLoginEnabled', () => {
  it('DBが無い場合はデフォルトOFF(false)を返す', async () => {
    expect(await isEmailConfirmLoginEnabled(undefined)).toBe(false);
  });
});
