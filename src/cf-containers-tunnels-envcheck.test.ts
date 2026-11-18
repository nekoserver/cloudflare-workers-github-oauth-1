import { afterEach, describe, expect, it, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

// /cf-containers の Tunnel一覧: 実行のたびに環境変数(CLOUDFLARE_ACCOUNT_ID と
// APIトークン)を確認し、設定有無・トークンの検証結果を応答と画面に出す。
const JWT_SECRET = 'tunnels-envcheck-test-secret';
const ACCOUNT_ID = 'acct-1234567890abcdef';

async function adminToken() {
  return createJWT({ sub: 'admin-user', name: 'Admin', github_id: 4242 }, JWT_SECRET);
}

function cfFetch(opts: { verifyOk: boolean; tunnels?: unknown[] }) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('/tokens/verify')) {
      return new Response(JSON.stringify(opts.verifyOk
        ? { success: true, result: { status: 'active' } }
        : { success: false, errors: [{ message: 'Invalid access token', code: 1000 }] }));
    }
    if (u.includes('/cfd_tunnel')) {
      return new Response(JSON.stringify({ success: true, result: opts.tunnels ?? [] }));
    }
    throw new Error('unexpected fetch: ' + u);
  });
}

async function getTunnels(env: Record<string, unknown>) {
  const token = await adminToken();
  return app.request('/api/cf-containers/tunnels',
    { headers: { Authorization: `Bearer ${token}` } },
    { JWT_SECRET, CF_DASHBOARD_ADMIN_GITHUB_IDS: '4242', ...env });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Tunnel一覧の環境変数確認', () => {
  it('設定済みなら、トークン検証結果つきで一覧を返す', async () => {
    vi.stubGlobal('fetch', cfFetch({ verifyOk: true, tunnels: [{ id: 't1', name: 'nekoroot', connections: [{}] }] }));
    const res = await getTunnels({ CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, CF_CONTAINER_API_TOKEN: 'tok' });
    expect(res.status).toBe(200);
    const data = await res.json() as { tunnels: unknown[]; envCheck: { accountIdSet: boolean; tokenSource: string | null; tokenVerify: string | null; containerApiToken: { set: boolean; verify: string | null } } };
    expect(data.tunnels).toHaveLength(1);
    expect(data.envCheck.accountIdSet).toBe(true);
    expect(data.envCheck.tokenSource).toBe('CF_CONTAINER_API_TOKEN');
    expect(data.envCheck.tokenVerify).toContain('active');
    expect(data.envCheck.containerApiToken.set).toBe(true);
    expect(data.envCheck.containerApiToken.verify).toContain('active');
  });

  it('CF_CONTAINER_API_TOKEN が無くフォールバックで動いていても、そのことが分かる', async () => {
    vi.stubGlobal('fetch', cfFetch({ verifyOk: true, tunnels: [] }));
    const res = await getTunnels({ CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, CLOUDFLARE_API_TOKEN: 'fallback-tok' });
    const data = await res.json() as { envCheck: { tokenSource: string | null; containerApiToken: { set: boolean; verify: string | null } } };
    expect(data.envCheck.tokenSource).toBe('CLOUDFLARE_API_TOKEN');
    expect(data.envCheck.containerApiToken.set).toBe(false);
    expect(data.envCheck.containerApiToken.verify).toBeNull();
  });

  it('トークンが無効なら、検証結果のNGが envCheck に出る(一覧の成否と切り分ける)', async () => {
    vi.stubGlobal('fetch', cfFetch({ verifyOk: false, tunnels: [] }));
    const res = await getTunnels({ CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, CF_CONTAINER_API_TOKEN: 'bad-tok' });
    const data = await res.json() as { envCheck: { tokenVerify: string | null } };
    expect(data.envCheck.tokenVerify).toContain('NG');
  });

  it('環境変数が未設定なら、エラーと一緒に envCheck で未設定が分かる', async () => {
    vi.stubGlobal('fetch', cfFetch({ verifyOk: true }));
    const res = await getTunnels({});
    const data = await res.json() as { error?: string; envCheck: { accountIdSet: boolean; tokenSource: string | null; tokenVerify: string | null; containerApiToken: { set: boolean; verify: string | null } } };
    expect(data.error).toContain('未設定');
    expect(data.envCheck.accountIdSet).toBe(false);
    expect(data.envCheck.tokenSource).toBeNull();
    expect(data.envCheck.tokenVerify).toBeNull();
    expect(data.envCheck.containerApiToken.set).toBe(false);
  });

  it('画面のスクリプトが envCheck を表示する', async () => {
    const { readFileSync } = await import('node:fs');
    const view = readFileSync('src/views/cfContainers.ts', 'utf8');
    expect(view).toContain('envCheck');
    expect(view).toContain('containerApiToken');
    expect(view).toContain('CF_CONTAINER_API_TOKEN=');
  });
});
