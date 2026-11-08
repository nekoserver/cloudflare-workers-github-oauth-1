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
