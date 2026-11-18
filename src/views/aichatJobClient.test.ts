import { describe, it, expect, vi } from 'vitest';
import { AICHAT_JOB_CLIENT_SCRIPT } from './aichatJobClient';

// ユーザー指定(2026-11-07): AIチャットの応答を、タブを閉じたり別ウィンドウへ移ったりしても途切れさせない。
// ブラウザは送信をジョブとして登録し、途中経過を取りに行くだけにする。開き直したら残っているジョブを続きから表示する。

type Job = { jobId: string; question: string; model: string; createdAt: number };
type Deps = { fetch: (url: string, init?: RequestInit) => Promise<Response>; storage: Storage | null; now: () => number; sleep: (ms: number) => Promise<void> };
type Client = {
  AICHAT_PENDING_JOBS_KEY: string;
  AICHAT_PENDING_JOB_MAX_AGE_MS: number;
  startAichatJob(deps: Deps, payload: unknown, info: { question: string; model: string }): Promise<string>;
  pollAichatJob(deps: Deps, jobId: string, onDelta: (text: string, meta: Record<string, unknown>) => void): Promise<Record<string, unknown>>;
  readPendingAichatJobs(deps: Deps): Job[];
};
const client = new Function(`${AICHAT_JOB_CLIENT_SCRIPT}\nreturn { AICHAT_PENDING_JOBS_KEY, AICHAT_PENDING_JOB_MAX_AGE_MS, startAichatJob, pollAichatJob, readPendingAichatJobs };`)() as Client;

class MemoryStorage {
  items = new Map<string, string>();
  get length() { return this.items.size; }
  key(i: number) { return [...this.items.keys()][i] ?? null; }
  getItem(k: string) { return this.items.get(k) ?? null; }
  setItem(k: string, v: string) { this.items.set(k, String(v)); }
  removeItem(k: string) { this.items.delete(k); }
  clear() { this.items.clear(); }
}

function deps(responses: Array<Response | Error>, storage = new MemoryStorage()) {
  let now = 1_000_000;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const d: Deps = {
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error('unexpected fetch ' + url);
      if (next instanceof Error) throw next;
      return next;
    }),
    storage: storage as unknown as Storage,
    now: () => now,
    sleep: async (ms: number) => { now += ms; },
  };
  return { d, calls, storage };
}
const json = (body: unknown, status = 200) => Response.json(body, { status });

describe('AIチャットのジョブ(ブラウザ側)', () => {
  it('送信をジョブとして登録し、ジョブIDと質問をlocalStorageに残す', async () => {
    const { d, calls, storage } = deps([json({ jobId: 'j1' }, 202)]);
    const jobId = await client.startAichatJob(d, { message: 'hi', model: 'm1' }, { question: 'hi', model: 'm1' });
    expect(jobId).toBe('j1');
    expect(calls[0].url).toBe('/api/aichat/jobs');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ message: 'hi', model: 'm1' });
    expect(JSON.parse(storage.getItem(client.AICHAT_PENDING_JOBS_KEY)!)).toEqual([{ jobId: 'j1', question: 'hi', model: 'm1', createdAt: 1_000_000 }]);
  });

  it('登録に失敗したらサーバーの理由で失敗し、何も残さない', async () => {
    const { d, storage } = deps([json({ error: 'AIチャットのジョブを使えません' }, 503)]);
    await expect(client.startAichatJob(d, {}, { question: 'q', model: 'm' })).rejects.toThrow('AIチャットのジョブを使えません');
    expect(storage.getItem(client.AICHAT_PENDING_JOBS_KEY)).toBeNull();
  });

  it('途中経過を続きの位置(offset)から取り、完了したら結果を返して記録を消す', async () => {
    const storage = new MemoryStorage();
    storage.setItem('aichat.pendingJobs', JSON.stringify([{ jobId: 'j1', question: 'q', model: 'm', createdAt: 1_000_000 }]));
    const { d, calls } = deps([
      json({ status: 'pending', text: '', textLength: 0 }),
      json({ status: 'running', text: 'こん', textLength: 2, start: { usedModel: 'm1' } }),
      new Error('network down'),
      json({ status: 'running', text: 'にち', textLength: 4, start: { usedModel: 'm1' } }),
      json({ status: 'done', text: 'は', textLength: 5, result: { response: 'こんにちは', usedModel: 'm1', shareId: 's1' } }),
    ], storage);
    const deltas: string[] = [];
    const data = await client.pollAichatJob(d, 'j1', (text, meta) => { deltas.push(text); expect(meta.usedModel).toBe('m1'); });
    expect(deltas).toEqual(['こん', 'にち', 'は']);
    expect(calls.map((c) => c.url)).toEqual([
      '/api/aichat/jobs/j1?offset=0', '/api/aichat/jobs/j1?offset=0', '/api/aichat/jobs/j1?offset=2', '/api/aichat/jobs/j1?offset=2', '/api/aichat/jobs/j1?offset=4',
    ]);
    expect(data).toMatchObject({ response: 'こんにちは', shareId: 's1' });
    expect(JSON.parse(storage.getItem('aichat.pendingJobs')!)).toEqual([]);
  });

  it('失敗したジョブと、期限切れで見つからないジョブは理由付きで失敗し、記録を消す', async () => {
    const storage = new MemoryStorage();
    storage.setItem('aichat.pendingJobs', JSON.stringify([{ jobId: 'j1', question: 'q', model: 'm', createdAt: 1_000_000 }]));
    const a = deps([json({ status: 'failed', error: 'boom', text: '', textLength: 0 })], storage);
    await expect(client.pollAichatJob(a.d, 'j1', () => {})).rejects.toThrow('boom');
    expect(JSON.parse(storage.getItem('aichat.pendingJobs')!)).toEqual([]);
    const b = deps([json({ error: 'not_found' }, 404)]);
    await expect(client.pollAichatJob(b.d, 'j2', () => {})).rejects.toThrow('見つかりません');
  });

  it('通信できない状態が続いても20分で諦める(ジョブ自体は最長15分)', async () => {
    const errors = Array.from({ length: 2000 }, () => new Error('offline'));
    const { d } = deps(errors);
    await expect(client.pollAichatJob(d, 'j1', () => {})).rejects.toThrow('応答を待てませんでした');
  });

  it('開き直したときに続けるジョブは、保持期間内のものだけ', () => {
    const storage = new MemoryStorage();
    const { d } = deps([], storage);
    storage.setItem('aichat.pendingJobs', JSON.stringify([
      { jobId: 'old', question: 'q', model: 'm', createdAt: 1_000_000 - client.AICHAT_PENDING_JOB_MAX_AGE_MS - 1 },
      { jobId: 'new', question: 'q', model: 'm', createdAt: 999_000 },
    ]));
    expect(client.readPendingAichatJobs(d).map((j) => j.jobId)).toEqual(['new']);
    storage.setItem('aichat.pendingJobs', '{broken');
    expect(client.readPendingAichatJobs(d)).toEqual([]);
    expect(client.readPendingAichatJobs({ ...d, storage: null })).toEqual([]);
  });
});
