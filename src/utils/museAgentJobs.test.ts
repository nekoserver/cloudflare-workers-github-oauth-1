import { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import { MuseAgentJobs } from './museAgentJobs';
function fixture() {
  const db = new DatabaseSync(':memory:');
  const storage = { sql: { exec(query: string, ...params: unknown[]) { const rows = db.prepare(query).all(...params as never[]); return rows; } }, transactionSync(fn: () => unknown) { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } }, setAlarm: vi.fn(async () => {}) };
  const send = vi.fn(async (_prompt: string) => Response.json({ choices: [{ message: { content: 'Museの回答' } }] }));
  return { db, storage, send, create: () => new MuseAgentJobs(storage as never, send) };
}
const requestId = 'request-1';
it('persists before delivery, deduplicates submissions and supports replies on the same Job', async () => {
  const f = fixture(), jobs = f.create();
  const first = await jobs.enqueue('owner', { requestId, agent: 'codex', prompt: '質問 “△”' });
  expect(first.status).toBe(202); const data = await first.json() as { jobId: string };
  expect((await jobs.enqueue('owner', { requestId, agent: 'codex', prompt: '質問 “△”' })).status).toBe(200);
  expect((await jobs.enqueue('owner', { requestId, agent: 'claude', prompt: '異なる内容' })).status).toBe(409);
  await jobs.processOne(); expect(f.send).toHaveBeenCalledExactlyOnceWith('質問 “△”');
  expect(await jobs.list('owner')).toEqual([expect.objectContaining({ jobId: data.jobId, messages: [expect.objectContaining({ state: 'done', reply: 'Museの回答' })] })]);
  expect((await jobs.enqueue('owner', { requestId: 'reply-1', jobId: data.jobId, agent: 'claude', prompt: '続き' })).status).toBe(202);
  await jobs.processOne();
  expect(f.send).toHaveBeenLastCalledWith(expect.stringContaining('Museの回答'));
  expect(f.send).toHaveBeenLastCalledWith(expect.stringContaining('今回の依頼 (claude):\n続き'));
  expect((await jobs.enqueue('other', { requestId: 'reply-2', jobId: data.jobId, prompt: '他人' })).status).toBe(404);
  f.db.close();
});
it('makes results available after a restart and tracks separate agent acknowledgements', async () => {
  const f = fixture(); let jobs = f.create(); await jobs.enqueue('owner', { requestId, prompt: '依頼' }); await jobs.processOne();
  jobs = f.create(); const changes = await jobs.changes('owner', 'codex');
  expect(changes.events.some((e: { state: string }) => e.state === 'done')).toBe(true);
  expect((await jobs.ack('owner', 'codex', changes.cursor)).status).toBe(200);
  expect((await jobs.changes('owner', 'codex')).events).toEqual([]);
  expect((await jobs.changes('owner', 'claude')).events.length).toBeGreaterThan(0);
  expect((await jobs.ack('owner', 'codex', changes.cursor + 100)).status).toBe(400);
  expect(await jobs.list('other')).toEqual([]); f.db.close();
});
it('never automatically resends an interrupted or ambiguous delivery', async () => {
  const f = fixture(); let jobs = f.create(); await jobs.enqueue('owner', { requestId, prompt: '依頼' });
  f.db.exec("UPDATE muse_agent_messages SET state='sending'");
  jobs = f.create(); await jobs.processOne(); expect(f.send).not.toHaveBeenCalled();
  expect(JSON.stringify(await jobs.list('owner'))).toContain('delivery_unknown');
  f.db.close();
});
it('records why a delivery failed and shows it in the list', async () => {
  const f = fixture(); const jobs = f.create();
  f.send.mockResolvedValueOnce(Response.json({ error: 'muse_not_authenticated' }, { status: 503 }));
  await jobs.enqueue('owner', { requestId, prompt: '依頼' });
  await jobs.processOne();
  const [message] = (await jobs.list('owner'))[0].messages;
  expect(message).toMatchObject({ state: 'failed', error: 'HTTP 503 muse_not_authenticated' });
  f.db.close();
});
it('retries a not-yet-sent delivery while the tailnet is not connected, then completes', async () => {
  const f = fixture(); const jobs = f.create();
  f.send.mockResolvedValueOnce(Response.json({ error: 'tailscale_not_connected' }, { status: 503 }));
  await jobs.enqueue('owner', { requestId, prompt: '依頼' });
  f.storage.setAlarm.mockClear();
  await jobs.processOne();
  let [message] = (await jobs.list('owner'))[0].messages;
  expect(message).toMatchObject({ state: 'queued', error: expect.stringContaining('tailscale_not_connected') });
  expect(f.storage.setAlarm).toHaveBeenCalledOnce();
  const delay = (f.storage.setAlarm.mock.calls[0] as unknown as [number])[0] - Date.now();
  expect(delay).toBeGreaterThanOrEqual(5_000);
  await jobs.processOne();
  [message] = (await jobs.list('owner'))[0].messages;
  expect(message).toMatchObject({ state: 'done', reply: 'Museの回答', error: null });
  expect(f.send).toHaveBeenCalledTimes(2);
  f.db.close();
});
it('gives up after 5 attempts while the tailnet stays disconnected, keeping the reason', async () => {
  const f = fixture(); const jobs = f.create();
  f.send.mockImplementation(async () => Response.json({ error: 'tailscale_not_connected' }, { status: 503 }));
  await jobs.enqueue('owner', { requestId, prompt: '依頼' });
  for (let i = 0; i < 6; i++) await jobs.processOne();
  const [message] = (await jobs.list('owner'))[0].messages;
  expect(f.send).toHaveBeenCalledTimes(5);
  expect(message).toMatchObject({ state: 'failed', error: expect.stringContaining('tailscale_not_connected') });
  expect(message.error).toContain('5');
  f.db.close();
});
it('records a thrown delivery as delivery_unknown with its reason and does not resend it', async () => {
  const f = fixture(); const jobs = f.create();
  f.send.mockRejectedValueOnce(new Error('node.fetch failed'));
  await jobs.enqueue('owner', { requestId, prompt: '依頼' });
  await jobs.processOne(); await jobs.processOne();
  const [message] = (await jobs.list('owner'))[0].messages;
  expect(message).toMatchObject({ state: 'delivery_unknown', error: expect.stringContaining('node.fetch failed') });
  expect(f.send).toHaveBeenCalledOnce();
  f.db.close();
});
it('keeps working on a ledger created before the error and attempts columns existed', async () => {
  const f = fixture();
  f.db.exec("CREATE TABLE muse_agent_jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, created_at TEXT NOT NULL)");
  f.db.exec("CREATE TABLE muse_agent_messages (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES muse_agent_jobs(id), owner TEXT NOT NULL, agent TEXT NOT NULL, prompt TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', reply TEXT)");
  f.db.exec("INSERT INTO muse_agent_jobs VALUES ('j','owner','2026-11-10T00:00:00Z')");
  f.db.exec("INSERT INTO muse_agent_messages(id,job_id,owner,agent,prompt) VALUES ('old','j','owner','user','以前の依頼')");
  const jobs = f.create();
  await jobs.processOne();
  expect((await jobs.list('owner'))[0].messages[0]).toMatchObject({ messageId: 'old', state: 'done', error: null });
  f.db.close();
});
