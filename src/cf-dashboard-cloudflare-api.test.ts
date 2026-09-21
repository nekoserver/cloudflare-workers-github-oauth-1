import { describe, expect, it, vi } from 'vitest';
import { listCloudflareD1Databases, listCloudflareD1Tables } from './utils/cloudflareD1Api';
import { getCfDashboardPage } from './views/cf-dashboard';

const credentials = { accountId: 'account/id', apiKey: 'secret-token' };
const response = (result: unknown) => new Response(JSON.stringify({ success: true, result }));

describe('Cloudflare D1 API client', () => {
  it('Bearer認証でD1一覧を取得する', async () => {
    const fetcher = vi.fn().mockResolvedValue(response([{ uuid: 'db-1', name: 'main' }]));
    await expect(listCloudflareD1Databases(credentials, fetcher)).resolves.toEqual([{ uuid: 'db-1', name: 'main' }]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account%2Fid/d1/database?per_page=100',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }) })
    );
  });

  it('内部テーブルを除外するSQLをD1 query APIへ送る', async () => {
    const fetcher = vi.fn().mockResolvedValue(response([{ results: [{ name: 'users' }] }]));
    await expect(listCloudflareD1Tables(credentials, 'db/id', fetcher)).resolves.toEqual([{ name: 'users' }]);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain('/database/db%2Fid/query');
    expect(JSON.parse(init.body).sql).toContain("NOT LIKE 'sqlite_%'");
    expect(JSON.parse(init.body).sql).toContain("NOT LIKE '_cf_%'");
  });

  it('Global API KeyではメールとX-Auth-Keyを使う', async () => {
    const fetcher = vi.fn().mockResolvedValue(response([]));
    await listCloudflareD1Databases({ ...credentials, apiEmail: 'admin@example.com' }, fetcher);
    const headers = fetcher.mock.calls[0][1].headers;
    expect(headers).toMatchObject({ 'X-Auth-Email': 'admin@example.com', 'X-Auth-Key': 'secret-token' });
    expect(headers).not.toHaveProperty('Authorization');
  });
});

describe('/cf-dashboard page', () => {
  it('Cloudflare APIとWrangler BLAKE3/WASMの設定を表示する', () => {
    const html = getCfDashboardPage();
    expect(html).toContain('CLOUDFLARE_API_KEY');
    expect(html).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(html).toContain('Wrangler BLAKE3/WASM');
    expect(html).not.toContain('secret-token');
  });
});
