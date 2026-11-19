/**
 * /muse-search の検索キーの記録(D1 muse_search_key_log)のテスト用の偽のD1。node:sqlite の本物のSQLiteで動かし、
 * 実際のSQL(instr・replace・json 以外の集計・CHECK制約)を確かめる。ai_chat_shares と muse_search_key_log は、
 * 本番と同じ定義(STATUS_MIGRATION_SQL['0036'] の CREATE TABLE、migrations/0074・0195)から作る。
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { STATUS_MIGRATION_SQL } from '../index';

export function createMuseSearchKeysSqlite(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  const createShares = STATUS_MIGRATION_SQL['0036'].split(/;\s*\n/)[0] + ';';
  sqlite.exec(createShares);
  sqlite.exec(readFileSync('migrations/0074_add_deleted_at_to_ai_chat_shares.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0195_create_muse_search_key_log.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0196_create_muse_search_answer_log.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0197_create_muse_user_handles.sql', 'utf8'));
  return sqlite;
}

type Row = Record<string, unknown>;
export type D1Options = {
  /** この正規表現に一致するSQLは、実行時に例外にする(D1の障害を再現する)。 */
  failOn?: RegExp;
  /** 認証(user_sessions)など、このテストのSQLiteに無いテーブルへのSQLを横取りする。 */
  intercept?: (sql: string) => Row | null | undefined;
};

export function createD1(sqlite: DatabaseSync, options: D1Options = {}): D1Database {
  const statement = (sql: string, args: unknown[] = []) => {
    const guard = () => {
      if (options.failOn?.test(sql)) throw new Error('d1 down');
    };
    return {
      bind: (...values: unknown[]) => statement(sql, values),
      first: async () => {
        guard();
        const intercepted = options.intercept?.(sql);
        if (intercepted !== undefined) return intercepted;
        const row = sqlite.prepare(sql).get(...(args as never[]));
        return row ? { ...row } : null;
      },
      all: async () => {
        guard();
        if (options.intercept?.(sql) !== undefined) return { results: [] };
        return { results: sqlite.prepare(sql).all(...(args as never[])).map((r) => ({ ...r })) };
      },
      run: async () => {
        guard();
        if (options.intercept?.(sql) !== undefined) return { success: true, meta: { changes: 0 } };
        const result = sqlite.prepare(sql).run(...(args as never[]));
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  };
  return { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
}
