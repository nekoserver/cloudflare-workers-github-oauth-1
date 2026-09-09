import { describe, it, expect, vi } from 'vitest';
import { pingDynamicWorker } from './dynamicWorkerPing';

describe('pingDynamicWorker', () => {
  it('replyフィールドをそのまま返す', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, reply: 'world' }), { status: 200 }));
    const reply = await pingDynamicWorker('https://dynamicneko.example.workers.dev', 'secret', fetchImpl as unknown as typeof fetch);
    expect(reply).toBe('world');
  });

  it('Authorizationヘッダーにsecretを付与し、cmd=helloを送る', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://dynamicneko.example.workers.dev/api/ping?cmd=hello');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret');
      return new Response(JSON.stringify({ ok: true, reply: 'world' }), { status: 200 });
    });
    await pingDynamicWorker('https://dynamicneko.example.workers.dev', 'secret', fetchImpl as unknown as typeof fetch);
  });

  it('末尾スラッシュ付きのbaseUrlでも二重スラッシュにならない', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://dynamicneko.example.workers.dev/api/ping?cmd=hello');
      return new Response(JSON.stringify({ ok: true, reply: 'world' }), { status: 200 });
    });
    await pingDynamicWorker('https://dynamicneko.example.workers.dev/', 'secret', fetchImpl as unknown as typeof fetch);
  });

  it('HTTPエラー(非2xx)は握りつぶさずエラーを投げる', async () => {
    const fetchImpl = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
    await expect(
      pingDynamicWorker('https://dynamicneko.example.workers.dev', 'wrong-secret', fetchImpl as unknown as typeof fetch)
    ).rejects.toThrow(/HTTP 401/);
  });

  it('応答がJSONでない場合はエラーを投げる', async () => {
    const fetchImpl = vi.fn(async () => new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }));
    await expect(
      pingDynamicWorker('https://dynamicneko.example.workers.dev', 'secret', fetchImpl as unknown as typeof fetch)
    ).rejects.toThrow(/JSON/);
  });

  it('replyフィールドが無い場合はエラーを投げる(空文字を握りつぶさない)', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'unknown command' }), { status: 200 }));
    await expect(
      pingDynamicWorker('https://dynamicneko.example.workers.dev', 'secret', fetchImpl as unknown as typeof fetch)
    ).rejects.toThrow(/reply/);
  });
});
