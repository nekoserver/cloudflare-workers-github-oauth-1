import { describe, it, expect, vi } from 'vitest';
import { pingDynamicWorker } from './dynamicWorkerPing';

function makeFetcher(fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return { fetch: vi.fn(fetchImpl) };
}

describe('pingDynamicWorker', () => {
  it('replyフィールドをそのまま返す', async () => {
    const fetcher = makeFetcher(async () => new Response(JSON.stringify({ ok: true, reply: 'world' }), { status: 200 }));
    const reply = await pingDynamicWorker(fetcher, 'secret');
    expect(reply).toBe('world');
  });

  it('Service Bindingのfetch()にAuthorizationヘッダーとcmd=helloパスを渡す(公開fetchは使わない)', async () => {
    const fetcher = makeFetcher(async (input, init) => {
      expect(String(input)).toContain('/api/ping?cmd=hello');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret');
      return new Response(JSON.stringify({ ok: true, reply: 'world' }), { status: 200 });
    });
    await pingDynamicWorker(fetcher, 'secret');
  });

  it('HTTPエラー(非2xx)は握りつぶさずエラーを投げる', async () => {
    const fetcher = makeFetcher(async () => new Response('Unauthorized', { status: 401 }));
    await expect(pingDynamicWorker(fetcher, 'wrong-secret')).rejects.toThrow(/HTTP 401/);
  });

  it('応答がJSONでない場合はエラーを投げる', async () => {
    const fetcher = makeFetcher(async () => new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }));
    await expect(pingDynamicWorker(fetcher, 'secret')).rejects.toThrow(/JSON/);
  });

  it('replyフィールドが無い場合はエラーを投げる(空文字を握りつぶさない)', async () => {
    const fetcher = makeFetcher(async () => new Response(JSON.stringify({ ok: false, error: 'unknown command' }), { status: 200 }));
    await expect(pingDynamicWorker(fetcher, 'secret')).rejects.toThrow(/reply/);
  });
});
