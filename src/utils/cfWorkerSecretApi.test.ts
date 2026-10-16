import { describe, it, expect, vi } from 'vitest';
import { setWorkerSecret, verifyApiToken, ALLOWED_SECRET_NAMES } from './cfWorkerSecretApi';

describe('setWorkerSecret', () => {
  const credentials = { accountId: 'acc1', apiKey: 'token1' };

  it('正常系: Workers Scripts secrets APIへPUTし、許可リストの名前を受け付ける', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, result: {} }), { status: 200 }));
    await setWorkerSecret(credentials, 'my-script', 'NEKOROOT_TUNNEL_TOKEN', 'secret-value', fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc1/workers/scripts/my-script/secrets');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ name: 'NEKOROOT_TUNNEL_TOKEN', text: 'secret-value', type: 'secret_text' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token1');
  });

  it('許可リストにない名前はAPIを呼ばずに拒否する(任意のsecretを書き換えられる口にしない)', async () => {
    const fetcher = vi.fn();
    await expect(
      setWorkerSecret(credentials, 'my-script', 'JWT_SECRET' as any, 'x', fetcher as unknown as typeof fetch)
    ).rejects.toThrow(/許可されていない/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('異常系: Cloudflare APIがエラーを返したら例外を投げる(握りつぶさない)', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, result: null, errors: [{ message: 'invalid token' }] }), { status: 403 })
    );
    await expect(
      setWorkerSecret(credentials, 'my-script', 'NEKOROOT_TUNNEL_TOKEN', 'x', fetcher as unknown as typeof fetch)
    ).rejects.toThrow('invalid token(code undefined) [HTTP 403]');
  });

  it('ALLOWED_SECRET_NAMESにNEKOROOT_TUNNEL_TOKENとTAILSCALE_AUTHKEYを含む', () => {
    expect(ALLOWED_SECRET_NAMES).toContain('NEKOROOT_TUNNEL_TOKEN');
    expect(ALLOWED_SECRET_NAMES).toContain('TAILSCALE_AUTHKEY');
    expect(ALLOWED_SECRET_NAMES).toContain('CF_CONTAINER_API_TOKEN');
  });
});

describe('verifyApiToken', () => {
  it('Cloudflareのverify結果(エラーコード含む)をuser/account両方について返し、トークン値は含めない', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, result: null, errors: [{ code: 1000, message: 'Invalid API Token' }] }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: { status: 'active' } }), { status: 200 }));
    const out = await verifyApiToken({ accountId: 'acc1', apiKey: 'secret-token' }, fetcher as unknown as typeof fetch);
    expect(out).toBe('user: NG Invalid API Token(code 1000) [HTTP 401] / account: active');
    expect(out).not.toContain('secret-token');
    expect((fetcher.mock.calls[1] as [string])[0]).toBe('https://api.cloudflare.com/client/v4/accounts/acc1/tokens/verify');
  });

  it('fetch自体が失敗しても例外を投げず理由を返す', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const out = await verifyApiToken({ accountId: 'a', apiKey: 'k' }, fetcher as unknown as typeof fetch);
    expect(out).toContain('検証呼び出し失敗 network down');
  });
});
