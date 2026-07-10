import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { isSlackNotifyEnabled } from './index';

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const makeResult = (args: unknown[]) => ({
        async first<T>(): Promise<T | null> {
          const row = stmt.get(...(args as never[]));
          return (row ?? null) as T | null;
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
    CREATE TABLE notification_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      slack_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe('isSlackNotifyEnabled — Slack通知ユーザーオプション(デフォルトOFF)', () => {
  it('DBが無い場合はデフォルトOFF(false)を返す', async () => {
    expect(await isSlackNotifyEnabled(undefined)).toBe(false);
  });

  it('行が無い場合(マイグレーション未実行等)もデフォルトOFF(false)を返す', async () => {
    const db = setupDb();
    const result = await isSlackNotifyEnabled(wrapD1(db) as never);
    expect(result).toBe(false);
  });

  it('slack_enabled=0の行がある場合はfalseを返す', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO notification_settings (id, slack_enabled) VALUES (1, 0)').run();
    expect(await isSlackNotifyEnabled(wrapD1(db) as never)).toBe(false);
  });

  it('slack_enabled=1の行がある場合はtrueを返す(ユーザーがオプションをONにした状態)', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO notification_settings (id, slack_enabled) VALUES (1, 1)').run();
    expect(await isSlackNotifyEnabled(wrapD1(db) as never)).toBe(true);
  });
});
