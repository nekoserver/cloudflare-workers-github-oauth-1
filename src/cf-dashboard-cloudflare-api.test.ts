import { describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { listCloudflareD1Databases, listCloudflareD1Tables } from './utils/cloudflareD1Api';
import { getCfDashboardPage } from './views/cf-dashboard';

const credentials = { accountId: 'account/id', apiKey: 'secret-token' };
const response = (result: unknown) => new Response(JSON.stringify({ success: true, result }));
const jwtSecret = 'test-secret';

function makeBindingDb(tableNames: string[]) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('user_sessions')) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
          }),
        };
      }
      return {
        all: vi.fn().mockResolvedValue({ results: tableNames.map((name) => ({ name })) }),
      };
    }),
  };
}

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

  it('Cloudflare API secretsがなくてもDBバインディングから一覧を返す', async () => {
    const token = await createJWT({ sub: 'test-user', name: 'Test', github_id: 12345 }, jwtSecret);
    const res = await app.request(
      '/api/cf-dashboard/d1',
      { headers: { Authorization: `Bearer ${token}` } },
      {
        DB: makeBindingDb(['users', 'posts']),
        GITHUB_CLIENT_ID: 'test',
        GITHUB_CLIENT_SECRET: 'test',
        JWT_SECRET: jwtSecret,
        CF_DASHBOARD_ADMIN_GITHUB_IDS: '12345',
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      configured: true,
      provider: 'd1-binding',
      databases: [{ uuid: 'this', num_tables: 2 }],
    });
  });

  it('DBバインディングへのフォールバック時もテーブル一覧を返す', async () => {
    const token = await createJWT({ sub: 'test-user', name: 'Test', github_id: 12345 }, jwtSecret);
    const res = await app.request(
      '/api/cf-dashboard/d1/this/tables',
      { headers: { Authorization: `Bearer ${token}` } },
      {
        DB: makeBindingDb(['users']),
        GITHUB_CLIENT_ID: 'test',
        GITHUB_CLIENT_SECRET: 'test',
        JWT_SECRET: jwtSecret,
        CF_DASHBOARD_ADMIN_GITHUB_IDS: '12345',
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      provider: 'd1-binding',
      tables: [{ name: 'users', row_count: null }],
    });
  });

  it('管理者以外にはD1 APIを公開しない', async () => {
    const token = await createJWT({ sub: 'regular-user', github_id: 99999 }, jwtSecret);
    const db = makeBindingDb(['users']);
    const res = await app.request(
      '/api/cf-dashboard/d1',
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: db, JWT_SECRET: jwtSecret, CF_DASHBOARD_ADMIN_GITHUB_IDS: '12345, 67890' }
    );

    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual({ error: 'この操作には管理者権限が必要です' });
    expect(db.prepare).toHaveBeenCalledTimes(1);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('user_sessions'));
  });

  it('管理者設定がない場合はfail closedで拒否する', async () => {
    const token = await createJWT({ sub: 'user', github_id: 12345 }, jwtSecret);
    const res = await app.request(
      '/cf-dashboard',
      { headers: { Authorization: `Bearer ${token}`, Accept: 'text/html' } },
      { DB: makeBindingDb([]), JWT_SECRET: jwtSecret }
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: '管理者設定が未構成です' });
  });

  it('login名が一致してもnumeric IDがなければ拒否する', async () => {
    const token = await createJWT({ sub: '12345' }, jwtSecret);
    const res = await app.request(
      '/api/cf-dashboard/d1/this/tables',
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: makeBindingDb([]), JWT_SECRET: jwtSecret, CF_DASHBOARD_ADMIN_GITHUB_IDS: '12345' }
    );

    expect(res.status).toBe(403);
  });
});
