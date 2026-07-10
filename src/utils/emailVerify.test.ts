import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendTestEmailResend, sendLoginConfirmEmail } from './emailVerify';

describe('sendTestEmailResend', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('正常時はok:trueを返す', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'abc123' }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendTestEmailResend('key123', 'a@example.com');
    expect(result.ok).toBe(true);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opts.headers.Authorization).toBe('Bearer key123');
    const body = JSON.parse(opts.body);
    expect(body.to).toBe('a@example.com');
  });

  it('APIがエラーステータスを返した場合はok:falseとエラー内容を返す', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'invalid api key' }), { status: 401 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendTestEmailResend('bad-key', 'a@example.com');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain('invalid api key');
  });

  it('ネットワークエラー時もエラー内容を記録してok:falseを返す(握りつぶさない)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendTestEmailResend('key123', 'a@example.com');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('network down');
  });
});

describe('sendLoginConfirmEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('本文に確認用リンクを含めて送信する', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'abc123' }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendLoginConfirmEmail('key123', 'a@example.com', 'https://example.com/auth/email-confirm?token=xyz');
    expect(result.ok).toBe(true);

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.to).toBe('a@example.com');
    expect(body.subject).toBe('ログイン確認メール');
    expect(body.text).toContain('https://example.com/auth/email-confirm?token=xyz');
  });

  it('APIエラー時はok:falseとエラー内容を返す(握りつぶさない)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'invalid api key' }), { status: 401 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendLoginConfirmEmail('bad-key', 'a@example.com', 'https://example.com/auth/email-confirm?token=xyz');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('invalid api key');
  });
});
