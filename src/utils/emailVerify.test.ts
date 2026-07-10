import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyEmailAbstract } from './emailVerify';

describe('verifyEmailAbstract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('正常時はAbstract APIの判定結果をそのまま返す', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: 'a@example.com', deliverability: 'DELIVERABLE' }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await verifyEmailAbstract('key123', 'a@example.com');
    expect(result.ok).toBe(true);
    expect(result.data?.deliverability).toBe('DELIVERABLE');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('api_key=key123');
    expect(url).toContain('email=a%40example.com');
  });

  it('APIがエラーステータスを返した場合はok:falseとエラー内容を返す', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid api_key' }), { status: 401 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await verifyEmailAbstract('bad-key', 'a@example.com');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain('invalid api_key');
  });

  it('ネットワークエラー時もエラー内容を記録してok:falseを返す(握りつぶさない)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await verifyEmailAbstract('key123', 'a@example.com');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('network down');
  });
});
