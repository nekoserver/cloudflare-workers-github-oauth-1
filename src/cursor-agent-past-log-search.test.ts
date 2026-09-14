import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import app, {
  STATUS_TABLE_DEFINITIONS,
  STATUS_MIGRATION_SQL,
  TABLE_COLUMN_KEYS,
  TABLE_GROUP_MAP,
  COLUMN_FK_TARGETS,
} from './index';
import { createJWT } from './utils/jwt';
import { persistCursorAgentPastLogHits } from './utils/cursorAgentLaunch';

// 対象: POST /api/cursor-agent/history/past-log-search と
// cursor_agent_search_log / cursor_agent_search_history。
// AIチャットの aichat_search_log(キーワード×ヒット共有)と同じく、
// 「過去ログ検索」完了時だけキーワードとヒットした起動履歴を結びつける。
//
// 故障シナリオ:
//   (1) 空キーワードで INSERT する
//   (2) 他人の launch_id を結びつける
//   (3) 同じキーワード×起動で行が増殖する(UNIQUE欠如)
//   (4) 表未作成で空成功を返す
//   (5) GET のインクリメンタル検索まで保存してしまう
//   (6) クライアントが送った launchIds を信じて保存する

const JWT_SECRET = 'test-secret';
const ALLOWED_REPO = 'nekoserver/cloudflare-workers-github-oauth-1';
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

async function makeAuthHeader(sub: string) {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
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
        async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
          const res = stmt.run(...(args as never[]));
          return { meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) } };
        },
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(withSearchTables = true): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE cursor_agent_launch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      repo_full_name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      agent_id TEXT,
      agent_name TEXT,
      agent_url TEXT,
      cursor_response TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE cursor_agent_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      launch_id INTEGER NOT NULL REFERENCES cursor_agent_launch_log(id),
      agent_status TEXT,
      run_status TEXT,
      report_text TEXT,
      raw_response TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE cursor_agent_answer_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      launch_id INTEGER NOT NULL UNIQUE REFERENCES cursor_agent_launch_log(id),
      answer_text TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      revoked_at TEXT,
      last_activity_at TEXT
    );
  `);
  if (withSearchTables) {
    db.exec(`
      CREATE TABLE cursor_agent_search_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        launch_id INTEGER NOT NULL REFERENCES cursor_agent_launch_log(id),
        first_searched_at TEXT NOT NULL,
        last_searched_at TEXT NOT NULL,
        select_count INTEGER NOT NULL DEFAULT 1,
        result_count INTEGER
      );
      CREATE UNIQUE INDEX idx_cursor_agent_search_log_unique ON cursor_agent_search_log(user_id, keyword, launch_id);
      CREATE TABLE cursor_agent_search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        launch_id INTEGER NOT NULL REFERENCES cursor_agent_launch_log(id),
        seq_num INTEGER NOT NULL,
        searched_at TEXT NOT NULL,
        result_count INTEGER
      );
    `);
  }
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('other-user');
  return db;
}

function insertLaunch(db: DatabaseSync, userId: string, prompt: string, agentId: string, createdAt: string): number {
  const res = db.prepare(
    `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, ALLOWED_REPO, prompt, agentId, '{}', createdAt);
  const launchId = Number(res.lastInsertRowid);
  db.prepare(
    `INSERT INTO cursor_agent_status_log (launch_id, agent_status, run_status, report_text, raw_response, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(launchId, 'FINISHED', 'COMPLETED', 'レポート', '{}', createdAt);
  return launchId;
}

describe('cursor_agent_search_log / cursor_agent_search_history レジストリ', () => {
  it('STATUS_TABLE_DEFINITIONS に両テーブルが 0140 で登録されている', () => {
    const names = STATUS_TABLE_DEFINITIONS.map((d) => d.name);
    expect(names).toContain('cursor_agent_search_log');
    expect(names).toContain('cursor_agent_search_history');
    expect(STATUS_TABLE_DEFINITIONS.find((d) => d.name === 'cursor_agent_search_log')?.migration).toBe('0140');
    expect(STATUS_TABLE_DEFINITIONS.find((d) => d.name === 'cursor_agent_search_history')?.migration).toBe('0140');
  });

  it('STATUS_MIGRATION_SQL 0140 に UNIQUE と launch_id FK がある', () => {
    const sql = STATUS_MIGRATION_SQL['0140'];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS cursor_agent_search_log');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS cursor_agent_search_history');
    expect(sql).toContain('idx_cursor_agent_search_log_unique');
    expect(sql).toContain('REFERENCES cursor_agent_launch_log(id)');
    expect(sql).not.toContain('--');
  });

  it('TABLE_COLUMN_KEYS / TABLE_GROUP_MAP / COLUMN_FK_TARGETS が揃っている', () => {
    expect(TABLE_COLUMN_KEYS.cursor_agent_search_log).toEqual({
      id: 'pk', user_id: 'fk', launch_id: 'fk', keyword: 'idx',
    });
    expect(TABLE_COLUMN_KEYS.cursor_agent_search_history).toEqual({
      id: 'pk', user_id: 'fk', launch_id: 'fk', keyword: 'idx', seq_num: 'idx',
    });
    expect(TABLE_GROUP_MAP.cursor_agent_search_log).toBe('ai');
    expect(TABLE_GROUP_MAP.cursor_agent_search_history).toBe('ai');
    expect(COLUMN_FK_TARGETS.cursor_agent_search_log).toEqual({
      user_id: 'user_sessions', launch_id: 'cursor_agent_launch_log',
    });
    expect(COLUMN_FK_TARGETS.cursor_agent_search_history).toEqual({
      user_id: 'user_sessions', launch_id: 'cursor_agent_launch_log',
    });
  });

  it('migrations/0140_create_cursor_agent_search_log.sql が存在する', () => {
    const file = path.join(MIGRATIONS_DIR, '0140_create_cursor_agent_search_log.sql');
    expect(fs.existsSync(file)).toBe(true);
    const sql = fs.readFileSync(file, 'utf-8');
    expect(sql).toContain('cursor_agent_search_log');
    expect(sql).toContain('cursor_agent_search_history');
    expect(sql).not.toContain('--');
  });
});

describe('persistCursorAgentPastLogHits', () => {
  it('キーワードとヒットした launch_id を結び、再実行では select_count を増やす', async () => {
    const db = setupDb();
    const launchId = insertLaunch(db, 'user1', 'kaleidoscope を直して', 'bc-1', '2026-09-14 00:00:00');
    const wrapped = wrapD1(db);
    const first = await persistCursorAgentPastLogHits(wrapped, {
      userId: 'user1', keyword: 'kaleidoscope', launchIds: [launchId], resultCount: 1, nowIso: '2026-09-14T01:00:00.000Z',
    });
    expect(first).toMatchObject({ ok: true, savedCount: 1, keyword: 'kaleidoscope' });
    const second = await persistCursorAgentPastLogHits(wrapped, {
      userId: 'user1', keyword: 'kaleidoscope', launchIds: [launchId], resultCount: 1, nowIso: '2026-09-14T02:00:00.000Z',
    });
    expect(second.ok).toBe(true);
    const logRows = db.prepare('SELECT keyword, launch_id, select_count FROM cursor_agent_search_log').all() as Array<{ keyword: string; launch_id: number; select_count: number }>;
    expect(logRows).toEqual([{ keyword: 'kaleidoscope', launch_id: launchId, select_count: 2 }]);
    const histCount = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_search_history').get() as { c: number };
    expect(histCount.c).toBe(2);
  });

  it('表が無いときは persist_failed を返し、空成功にしない', async () => {
    const db = setupDb(false);
    const wrapped = wrapD1(db);
    const result = await persistCursorAgentPastLogHits(wrapped, {
      userId: 'user1', keyword: 'kaleidoscope', launchIds: [1], resultCount: 1, nowIso: '2026-09-14T00:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('persist_failed');
    if (!result.ok) expect(result.detail.length).toBeGreaterThan(0);
  });
});

describe('POST /api/cursor-agent/history/past-log-search', () => {
  it('ヒットした自分の起動だけをキーワードに結び、他人の行は保存しない', async () => {
    const db = setupDb();
    const matchId = insertLaunch(db, 'user1', '関係ないプロンプト', 'bc_ans_1', '2026-09-14 00:00:00');
    const otherId = insertLaunch(db, 'other-user', '他人', 'bc_ans_3', '2026-09-14 02:00:00');
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(matchId, '**kaleidoscope** を直しました');
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(otherId, '他人の kaleidoscope 回答');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history/past-log-search', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'kaleidoscope', launchIds: [otherId] }),
    }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ id: number }>; savedCount: number };
    expect(data.rows.map((r) => r.id)).toEqual([matchId]);
    expect(data.savedCount).toBe(1);
    const logRows = db.prepare('SELECT user_id, keyword, launch_id FROM cursor_agent_search_log').all() as Array<{ user_id: string; keyword: string; launch_id: number }>;
    expect(logRows).toEqual([{ user_id: 'user1', keyword: 'kaleidoscope', launch_id: matchId }]);
  });

  it('空キーワードは保存せず 400 を返す', async () => {
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history/past-log-search', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: '   ' }),
    }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(400);
    const count = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_search_log').get() as { c: number };
    expect(count.c).toBe(0);
  });

  it('GET の q 検索では過去ログへ保存しない', async () => {
    const db = setupDb();
    const matchId = insertLaunch(db, 'user1', 'kaleidoscope を直して', 'bc-1', '2026-09-14 00:00:00');
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(matchId, 'kaleidoscope 完了');
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history?q=kaleidoscope', {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ id: number }> };
    expect(data.rows.map((r) => r.id)).toEqual([matchId]);
    const count = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_search_log').get() as { c: number };
    expect(count.c).toBe(0);
  });

  it('表未作成でも検索結果は返し、persistError を載せる', async () => {
    const db = setupDb(false);
    const matchId = insertLaunch(db, 'user1', 'kaleidoscope を直して', 'bc-1', '2026-09-14 00:00:00');
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(matchId, 'kaleidoscope 完了');
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history/past-log-search', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'kaleidoscope' }),
    }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ id: number }>; persistError?: string; savedCount: number };
    expect(data.rows.map((r) => r.id)).toEqual([matchId]);
    expect(data.savedCount).toBe(0);
    expect(data.persistError).toBeTruthy();
  });
});
