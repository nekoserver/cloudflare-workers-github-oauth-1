import { describe, it, expect, vi } from 'vitest';
import { listCloudflareTunnels, summarizeTunnelStatus } from './cloudflareTunnelApi';

describe('summarizeTunnelStatus', () => {
  it('connections配列が1件以上あればhealthyとみなす', () => {
    expect(summarizeTunnelStatus({ id: 't1', name: 'nekoroot', connections: [{ colo_name: 'NRT' }] })).toBe('healthy');
  });

  it('connections配列が空ならdownとみなす', () => {
    expect(summarizeTunnelStatus({ id: 't1', name: 'nekoroot', connections: [] })).toBe('down');
  });

  it('connectionsが無い(未定義)場合もdownとみなす(壊れたレスポンスを誤ってhealthy扱いしない)', () => {
    expect(summarizeTunnelStatus({ id: 't1', name: 'nekoroot' })).toBe('down');
  });
});

describe('listCloudflareTunnels', () => {
  const credentials = { accountId: 'acc1', apiKey: 'token1' };

  it('正常系: Cloudflare APIのトンネル一覧を名前・状態・接続数に整形して返す', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [
            { id: 't1', name: 'nekoroot', connections: [{ colo_name: 'NRT' }, { colo_name: 'KIX' }] },
            { id: 't2', name: 'mynw-web', connections: [] },
          ],
        }),
        { status: 200 }
      )
    );
    const tunnels = await listCloudflareTunnels(credentials, fetcher as unknown as typeof fetch);
    expect(tunnels).toEqual([
      { id: 't1', name: 'nekoroot', status: 'healthy', connectionCount: 2 },
      { id: 't2', name: 'mynw-web', status: 'down', connectionCount: 0 },
    ]);
    const calledUrl = fetcher.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/accounts/acc1/cfd_tunnel');
    const calledInit = fetcher.mock.calls[0][1] as RequestInit;
    expect((calledInit.headers as Record<string, string>).Authorization).toBe('Bearer token1');
  });

  it('異常系: Cloudflare APIがエラーを返したら例外を投げる(握りつぶさない)', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, result: null, errors: [{ message: 'invalid token' }] }), { status: 403 })
    );
    await expect(listCloudflareTunnels(credentials, fetcher as unknown as typeof fetch)).rejects.toThrow('invalid token');
  });
});
