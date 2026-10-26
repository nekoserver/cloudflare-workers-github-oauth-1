import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCodexFiveHourReset, registerCodexResetCountdown, runCodexResetCountdownCron } from './codexResetCountdown';

const now = new Date('2026-10-22T12:00:00Z');
const reply = 'Codex 利用枠（アカウントの実データ）\ncodex 5時間枠: 残り 86%（使用 14%）、リセット 2026-10-22 14:14:36 UTC\ncodex 168時間枠: 残り 28%（使用 72%）、リセット 2026-10-27 08:22:28 UTC';

const databases: DatabaseSync[] = [];
afterEach(() => { databases.splice(0).forEach((db) => db.close()); vi.useRealTimers(); });
function setup() {
  const sql = new DatabaseSync(':memory:');
  databases.push(sql);
  sql.exec(`CREATE TABLE user_sessions (user_id TEXT PRIMARY KEY);
    INSERT INTO user_sessions VALUES ('alice'), ('bob');
    CREATE TABLE countdown_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, label TEXT, target_at TEXT, group_id TEXT, created_at TEXT, created_by TEXT, creation_reason TEXT, deleted_at TEXT, deleted_by TEXT, deletion_reason TEXT);`);
  sql.exec(readFileSync('migrations/0189_create_askgk_timeout_settings.sql', 'utf8'));
  const db = {
    prepare: (query: string) => ({ first: async () => sql.prepare(query).get() ?? null, bind: (...args: Array<string | null>) => ({ query, args }) }),
    batch: async (statements: Array<{ query: string; args: Array<string | null> }>) => {
      sql.exec('BEGIN');
      try {
        const results = statements.map(({ query, args }) => ({ meta: { changes: Number(sql.prepare(query).run(...args).changes) } }));
        sql.exec('COMMIT');
        return results;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
  return { sql, db };
}

describe('Codex five-hour reset countdown', () => {
  it('migrates existing countdown rows without deleting them', () => {
    const sql = new DatabaseSync(':memory:');
    databases.push(sql);
    sql.exec(readFileSync('migrations/0115_create_countdown_events.sql', 'utf8'));
    sql.exec("INSERT INTO countdown_events (user_id,label,target_at) VALUES ('alice','existing','2099-01-01T00:00:00Z')");
    sql.exec(readFileSync('migrations/0181_add_countdown_events_deleted_at.sql', 'utf8'));
    sql.exec(readFileSync('migrations/0182_add_countdown_events_deletion_actor.sql', 'utf8'));
    expect(sql.prepare('SELECT deleted_at FROM countdown_events').get()).toEqual({ deleted_at: null });
    expect(sql.prepare('SELECT deleted_by, deletion_reason FROM countdown_events').get()).toEqual({ deleted_by: null, deletion_reason: null });
    expect(sql.prepare('SELECT created_by, creation_reason FROM countdown_events').get()).toEqual({ created_by: null, creation_reason: null });
  });
  it('selects the five-hour quota and converts UTC to JST with seconds, including day rollover', () => {
    expect(parseCodexFiveHourReset(reply, now)).toEqual({ targetAt: '2026-10-22T14:14:36.000Z', japanTime: '2026-10-22 23:14:36' });
    expect(parseCodexFiveHourReset(reply.replace('14:14:36', '18:14:36'), now).japanTime).toBe('2026-10-23 03:14:36');
  });
  it.each([
    reply.replace('14:14:36', '14:14'),
    reply.replace('codex 5時間枠:', 'other 5時間枠:'),
    reply.replace('2026-10-22 14:14:36', '2026-02-30 14:14:36'),
    'Codexの情報を取得できませんでした',
  ])('does not invent a reset when the source is incomplete or invalid', (text) => {
    expect(() => parseCodexFiveHourReset(text, now)).toThrow();
  });
  it('rejects an elapsed reset instead of adding five hours', () => {
    expect(() => parseCodexFiveHourReset(reply, new Date('2026-10-22T15:00:00Z'))).toThrow('過去');
  });
  it('logically deletes every old reset on every refresh, including unchanged and elapsed targets', async () => {
    const { sql, db } = setup();
    const first = await registerCodexResetCountdown(db, reply, now);
    expect(first.registered).toBe(2);
    const rows = () => sql.prepare('SELECT * FROM countdown_events ORDER BY id').all();
    const active = () => rows().filter((row) => !row.deleted_at);
    const initialIds = active().map((row) => row.id);
    expect(active().every((row) => row.created_at === now.toISOString() && row.created_by === 'cron Bot'
      && row.creation_reason === '6時間cronによるCodexリセット予定の更新')).toBe(true);
    expect(await registerCodexResetCountdown(db, reply, now)).toMatchObject({ registered: 2, retired: 2, processedBy: 'cron Bot' });
    expect(rows()).toHaveLength(4);
    expect(active()).toHaveLength(2);
    expect(active().every((row) => !initialIds.includes(row.id))).toBe(true);
    expect(rows().slice(0, 2).every((row) => row.deleted_at === now.toISOString())).toBe(true);
    expect(rows().slice(0, 2).every((row) => row.deleted_by === 'cron Bot'
      && row.deletion_reason === '6時間cronによるCodexリセット予定の更新')).toBe(true);
    expect(active().every((row) => row.deleted_by === null && row.deletion_reason === null)).toBe(true);
    sql.exec("INSERT INTO countdown_events (user_id,label,target_at) VALUES ('alice','会議','2026-10-22T13:00:00.000Z')");
    await registerCodexResetCountdown(db, reply.replace('2026-10-22 14:14:36', '2026-10-23 14:14:36'), new Date('2026-10-23T00:00:00Z'));
    expect(rows()).toHaveLength(7);
    expect(active()).toHaveLength(3);
    expect(active().filter((row) => String(row.label).startsWith('Codex')).every((row) => String(row.label).includes('2026-10-23 23:14:36'))).toBe(true);
    expect(rows().filter((row) => row.target_at === first.targetAt).every((row) => row.deleted_at)).toBe(true);
    // Later runs must not rewrite the earlier audit timestamp or actor.
    expect(rows().slice(0, 2).every((row) => row.deleted_at === now.toISOString() && row.deleted_by === 'cron Bot')).toBe(true);
    expect(rows().slice(0, 2).every((row) => row.created_at === now.toISOString() && row.created_by === 'cron Bot')).toBe(true);
    expect(active().filter((row) => String(row.label).startsWith('Codex')).every((row) =>
      row.created_at === '2026-10-23T00:00:00.000Z' && row.created_by === 'cron Bot')).toBe(true);
    expect(active().find((row) => row.label === '会議')?.deleted_by).toBeNull();
  });
  it('leaves existing records intact on a failed fetch or invalid response', async () => {
    const { sql, db } = setup();
    await registerCodexResetCountdown(db, reply, now);
    await expect(registerCodexResetCountdown(db, 'リセット 不明', now)).rejects.toThrow();
    const fetcher = { fetch: vi.fn().mockRejectedValue(new Error('network failed')) };
    await expect(runCodexResetCountdownCron({ DB: db, RUST_WORKER: fetcher as unknown as Fetcher })).rejects.toThrow('network failed');
    expect(sql.prepare('SELECT * FROM countdown_events').all()).toHaveLength(2);
  });
  it('rolls back logical deletion if inserting the replacement fails', async () => {
    const { sql, db } = setup();
    await registerCodexResetCountdown(db, reply, now);
    sql.exec("CREATE TRIGGER fail_insert BEFORE INSERT ON countdown_events BEGIN SELECT RAISE(ABORT, 'insert failed'); END;");
    await expect(registerCodexResetCountdown(db, reply, now)).rejects.toThrow('insert failed');
    expect(sql.prepare('SELECT COUNT(*) AS count FROM countdown_events WHERE deleted_at IS NULL').get()).toEqual({ count: 2 });
  });
  it('uses the existing signed /status route and writes the result for the widget API', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const { sql, db } = setup();
    const fetcher = { fetch: vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body));
      expect(sent.url).toBe('https://example.com/lib/api/tunnels');
      expect(JSON.parse(sent.body).message).toBe('codex_prompt="/status"');
      return new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify({ reply }) }));
    }) };
    await runCodexResetCountdownCron({ DB: db, RUST_WORKER: fetcher as unknown as Fetcher, ASKGK_TUNNELS_URL: 'https://example.com/lib/api/tunnels' });
    expect(sql.prepare('SELECT target_at FROM countdown_events').all()).toEqual([
      { target_at: '2026-10-22T14:14:36.000Z' }, { target_at: '2026-10-22T14:14:36.000Z' },
    ]);
  });
});
