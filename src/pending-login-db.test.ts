import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { savePendingLogin, consumePendingLogin } from './utils/emailConfirmGate';

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
        async all<T>(): Promise<{ results: T[] }> {
          const rows = stmt.all(...(args as never[]));
          return { results: rows as T[] };
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

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
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
  return db;
}

const baseRecord = {
  token: 'tok-1',
  githubLogin: 'octocat',
  githubName: 'The Octocat',
  githubId: 1,
  email: 'octocat@example.com',
  githubAccessToken: 'gho_xxx',
  grantedScopes: 'repo user',
  timezone: 'Asia/Tokyo',
  sessionDuration: '1h',
  returnToPath: '/welcome',
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T00:30:00.000Z',
};

describe('savePendingLogin / consumePendingLogin — メール確認待ちログインのD1保存', () => {
  it('DBが無い場合はsaveがfalseを返す', async () => {
    expect(await savePendingLogin(undefined, baseRecord)).toBe(false);
  });

  it('保存したレコードをtokenで取り出せる', async () => {
    const db = setupDb();
    const wrapped = wrapD1(db) as never;
    expect(await savePendingLogin(wrapped, baseRecord)).toBe(true);

    const record = await consumePendingLogin(wrapped, baseRecord.token);
    expect(record).not.toBeNull();
    expect(record!.githubLogin).toBe('octocat');
    expect(record!.email).toBe('octocat@example.com');
  });

  it('一度consumeしたトークンは再利用できない(一度きりのリンク)', async () => {
    const db = setupDb();
    const wrapped = wrapD1(db) as never;
    await savePendingLogin(wrapped, baseRecord);

    const first = await consumePendingLogin(wrapped, baseRecord.token);
    expect(first).not.toBeNull();

    const second = await consumePendingLogin(wrapped, baseRecord.token);
    expect(second).toBeNull();
  });

  it('存在しないtokenはnullを返す', async () => {
    const db = setupDb();
    const wrapped = wrapD1(db) as never;
    const record = await consumePendingLogin(wrapped, 'no-such-token');
    expect(record).toBeNull();
  });

  it('DBが無い場合はconsumeもnullを返す', async () => {
    expect(await consumePendingLogin(undefined, 'tok-1')).toBeNull();
  });
});
