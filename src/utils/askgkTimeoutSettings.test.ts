import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAskgkTimeoutSetting, saveAskgkTimeoutSetting, validateAskgkTimeoutSeconds } from './askgkTimeoutSettings';
import { askTunnelSigner } from './tunnelSignerAsk';
import { getSettingsPage } from '../views/settings';

const databases: DatabaseSync[] = [];
afterEach(() => { vi.useRealTimers(); databases.splice(0).forEach(db => db.close()); });
function setup() {
  const sql = new DatabaseSync(':memory:'); databases.push(sql);
  sql.exec(readFileSync('migrations/0189_create_askgk_timeout_settings.sql', 'utf8'));
  const db = { prepare: (query: string) => {
    const bind = (...args: (string | number)[]) => ({
      first: async () => sql.prepare(query).get(...args) ?? null,
      run: async () => ({ meta: { changes: Number(sql.prepare(query).run(...args).changes) } }),
    });
    return { ...bind(), bind };
  } } as unknown as D1Database;
  return { sql, db };
}
const id = 'codex-00000000-0000-0000-0000-000000000001';
const response = (body: unknown) => new Response(JSON.stringify({ ok: true, status: 200, body: JSON.stringify(body) }));

describe('persisted askgk timeout', () => {
  it('remembers the default and preserves revisions across reads and restores', async () => {
    const { db, sql } = setup();
    expect(await readAskgkTimeoutSetting(db)).toEqual({ revision: 1, timeoutSeconds: 120 });
    await saveAskgkTimeoutSetting(db, 300, 1, 'admin');
    expect(await readAskgkTimeoutSetting(db)).toEqual({ revision: 2, timeoutSeconds: 300 });
    await saveAskgkTimeoutSetting(db, 120, 2, 'admin');
    expect(sql.prepare('SELECT timeout_seconds FROM askgk_timeout_settings ORDER BY revision').all()).toEqual([{ timeout_seconds: 120 }, { timeout_seconds: 300 }, { timeout_seconds: 120 }]);
  });
  it('rejects stale concurrent saves without overwriting the winning revision', async () => {
    const { db } = setup();
    await saveAskgkTimeoutSetting(db, 240, 1, 'first');
    await expect(saveAskgkTimeoutSetting(db, 60, 1, 'second')).rejects.toThrow('別の操作');
    expect((await readAskgkTimeoutSetting(db)).timeoutSeconds).toBe(240);
  });
  it.each([0, 301, -1, 1.5, '300', null, NaN])('rejects invalid timeout %s', value => {
    expect(() => validateAskgkTimeoutSeconds(value)).toThrow();
  });
  it('fails closed when stored state is missing or corrupt', async () => {
    const { db, sql } = setup();
    sql.exec('PRAGMA ignore_check_constraints=ON; UPDATE askgk_timeout_settings SET timeout_seconds=301');
    await expect(readAskgkTimeoutSetting(db)).rejects.toThrow();
    sql.exec('DELETE FROM askgk_timeout_settings');
    await expect(readAskgkTimeoutSetting(db)).rejects.toThrow();
  });
  it('uses one submission followed by ID-only polling, even past the former 60s cutoff', async () => {
    vi.useFakeTimers();
    const { db } = setup(); let polls = 0;
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(JSON.parse(String(init?.body)).body);
      if (payload.message !== undefined) {
        expect(payload.wait_seconds).toBe(0);
        return response({ ask_status: 'pending', ask_id: id });
      }
      expect(payload).toEqual({ format: 'json', ask_id: id });
      return response(++polls < 65 ? { ask_status: 'running', ask_id: id } : { ask_status: 'done', ask_id: id, reply: 'finished' });
    });
    const promise = askTunnelSigner({ fetch }, 'codex_prompt="test"', { DB: db });
    await vi.advanceTimersByTimeAsync(65_000);
    expect((await promise).reply).toBe('finished');
    expect(fetch).toHaveBeenCalledTimes(66);
  });
  it('honors a saved 300-second budget beyond the former 120-second limit', async () => {
    vi.useFakeTimers();
    const { db } = setup(); await saveAskgkTimeoutSetting(db, 300, 1, 'admin');
    let polls = 0; let settled = false;
    const fetch = vi.fn(async () => response(++polls < 131 ? { ask_status: 'running', ask_id: id } : { ask_status: 'done', ask_id: id, reply: 'long result' }));
    const promise = askTunnelSigner({ fetch }, 'codex_prompt="test"', { DB: db }).then(result => { settled = true; return result; });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await promise).reply).toBe('long result');
  });
  it('uses the saved deadline on the next request, stops polling and retains the job ID', async () => {
    vi.useFakeTimers();
    const { db } = setup(); await saveAskgkTimeoutSetting(db, 2, 1, 'admin');
    const fetch = vi.fn(async () => response({ ask_status: 'running', ask_id: id }));
    const promise = askTunnelSigner({ fetch }, 'codex_prompt="test"', { DB: db });
    const checked = expect(promise).rejects.toThrow('2秒');
    await vi.advanceTimersByTimeAsync(2_000); await checked;
    const calls = fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
  it('does not submit when the persisted settings cannot be read', async () => {
    const { db, sql } = setup(); sql.exec('DROP TABLE askgk_timeout_settings');
    const fetch = vi.fn();
    await expect(askTunnelSigner({ fetch }, 'test', { DB: db })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('renders the persisted value and revision with an explicit 300s bound', () => {
    const html = getSettingsPage({ username: 'admin', issuedAt: '', expiresAt: '', expiresAtTimestamp: 0, askgkTimeoutSetting: { timeoutSeconds: 240, revision: 5 } });
    expect(html).toContain('max="300"'); expect(html).toContain('value="240" data-revision="5"');
    expect(html).toContain('/api/settings/askgk-timeout');
    expect(html).toContain('credentials: \'include\'');
  });
});
