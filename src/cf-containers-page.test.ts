/**
 * /cf-containers・/api/cf-containers/* のテスト。
 *
 * 対象: Cloudflare Containersのデモ用管理ページ(管理者限定)。
 * @cloudflare/containersはcloudflare:workers(workerdのみに存在する組み込み
 * モジュール)を読み込むため、プレーンNode環境のこのテストでは
 * vi.mock('@cloudflare/containers', ...)で実体を差し替える(dynamic import
 * もvi.mockの対象になる)。
 *
 * 故障シナリオ:
 *   (1) 未ログイン・管理者以外がstatus/action/proxyへ到達してしまう
 *   (2) actionに不正な値(typo等)を渡しても受け付けてしまう
 *   (3) DEMO_CONTAINERバインディング未設定時にエラーにならず握りつぶす
 *   (4) restartがstop/startの両方を正しく呼ばない
 *   (5) getState()が例外を投げた場合に「停止済み」等と誤って表示してしまう
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJWT } from './utils/jwt';

const stubMethods = {
  getState: vi.fn(),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn(),
};

vi.mock('@cloudflare/containers', () => ({
  getContainer: vi.fn(() => stubMethods),
}));

import app from './index';

const JWT_SECRET = 'test-secret';
const ADMIN_GITHUB_ID = 85157166;
const BASE_ENV = {
  GITHUB_CLIENT_ID: 'test',
  GITHUB_CLIENT_SECRET: 'test',
  CF_DASHBOARD_ADMIN_GITHUB_IDS: String(ADMIN_GITHUB_ID),
};

function makeDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({}),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    }),
  };
}

async function adminToken(): Promise<string> {
  return createJWT({ sub: 'admin-user', name: 'Admin', github_id: ADMIN_GITHUB_ID }, JWT_SECRET);
}

async function nonAdminToken(): Promise<string> {
  return createJWT({ sub: 'other-user', name: 'Other', github_id: 1 }, JWT_SECRET);
}

function envWithContainer(demoContainer: unknown = {}) {
  return { ...BASE_ENV, DB: makeDb(), JWT_SECRET, DEMO_CONTAINER: demoContainer };
}

beforeEach(() => {
  vi.clearAllMocks();
  stubMethods.start.mockResolvedValue(undefined);
  stubMethods.stop.mockResolvedValue(undefined);
});

describe('GET /api/cf-containers/status', () => {
  it('未ログインは401', async () => {
    const res = await app.request('/api/cf-containers/status', {}, envWithContainer());
    expect(res.status).toBe(401);
  });

  it('管理者以外は403', async () => {
    const token = await nonAdminToken();
    const res = await app.request(
      '/api/cf-containers/status',
      { headers: { Authorization: `Bearer ${token}` } },
      envWithContainer()
    );
    expect(res.status).toBe(403);
  });

  it('DEMO_CONTAINERバインディングが未設定ならエラー内容を返す(握りつぶさない)', async () => {
    const token = await adminToken();
    const env = { ...BASE_ENV, DB: makeDb(), JWT_SECRET };
    const res = await app.request('/api/cf-containers/status', { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { error?: string; running: boolean };
    expect(body.error).toBeTruthy();
    expect(body.running).toBe(false);
  });

  it('正常系: getState()の結果を日本語ラベルに変換して返す', async () => {
    stubMethods.getState.mockResolvedValue({ lastChange: 0, status: 'running' });
    const token = await adminToken();
    const res = await app.request('/api/cf-containers/status', { headers: { Authorization: `Bearer ${token}` } }, envWithContainer());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { label: string; running: boolean; status: string };
    expect(body.label).toBe('起動中');
    expect(body.running).toBe(true);
    expect(body.status).toBe('running');
  });

  it('getState()が例外を投げた場合は「未起動または状態不明」として返す(停止済みと誤認させない)', async () => {
    stubMethods.getState.mockRejectedValue(new Error('container not found'));
    const token = await adminToken();
    const res = await app.request('/api/cf-containers/status', { headers: { Authorization: `Bearer ${token}` } }, envWithContainer());
    const body = (await res.json()) as { label: string; running: boolean; error?: string };
    expect(body.label).toBe('未起動または状態不明');
    expect(body.running).toBe(false);
    expect(body.error).toContain('container not found');
  });
});

describe('POST /api/cf-containers/action', () => {
  async function postAction(action: string, env: Record<string, unknown> = envWithContainer()): Promise<Response> {
    const token = await adminToken();
    return app.request(
      '/api/cf-containers/action',
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) },
      env
    );
  }

  it('未ログインは401', async () => {
    const res = await app.request(
      '/api/cf-containers/action',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) },
      envWithContainer()
    );
    expect(res.status).toBe(401);
  });

  it('不正なactionは400で拒否され、start/stopは一切呼ばれない', async () => {
    const res = await postAction('strat');
    expect(res.status).toBe(400);
    expect(stubMethods.start).not.toHaveBeenCalled();
    expect(stubMethods.stop).not.toHaveBeenCalled();
  });

  it('startはContainer.start()だけを呼ぶ', async () => {
    stubMethods.getState.mockResolvedValue({ lastChange: 0, status: 'running' });
    const res = await postAction('start');
    expect(res.status).toBe(200);
    expect(stubMethods.start).toHaveBeenCalledTimes(1);
    expect(stubMethods.stop).not.toHaveBeenCalled();
  });

  it('stopはContainer.stop()だけを呼ぶ', async () => {
    stubMethods.getState.mockResolvedValue({ lastChange: 0, status: 'stopped' });
    const res = await postAction('stop');
    expect(res.status).toBe(200);
    expect(stubMethods.stop).toHaveBeenCalledTimes(1);
    expect(stubMethods.start).not.toHaveBeenCalled();
  });

  it('restartはstop()→start()の順で両方呼ぶ', async () => {
    stubMethods.getState.mockResolvedValue({ lastChange: 0, status: 'running' });
    const callOrder: string[] = [];
    stubMethods.stop.mockImplementation(async () => { callOrder.push('stop'); });
    stubMethods.start.mockImplementation(async () => { callOrder.push('start'); });
    const res = await postAction('restart');
    expect(res.status).toBe(200);
    expect(callOrder).toEqual(['stop', 'start']);
  });

  it('DEMO_CONTAINERバインディングが未設定なら503', async () => {
    const env = { ...BASE_ENV, DB: makeDb(), JWT_SECRET };
    const res = await postAction('start', env);
    expect(res.status).toBe(503);
  });
});

describe('ALL /cf-containers/proxy/*', () => {
  it('未ログインは401', async () => {
    const res = await app.request('/cf-containers/proxy/', {}, envWithContainer());
    expect(res.status).toBe(401);
  });

  it('管理者はコンテナのfetchへ転送される', async () => {
    stubMethods.fetch.mockResolvedValue(new Response('ok from container'));
    const token = await adminToken();
    const res = await app.request(
      '/cf-containers/proxy/hello',
      { headers: { Authorization: `Bearer ${token}` } },
      envWithContainer()
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok from container');
    expect(stubMethods.fetch).toHaveBeenCalledTimes(1);
    const forwardedRequest = stubMethods.fetch.mock.calls[0][0] as Request;
    expect(new URL(forwardedRequest.url).pathname).toBe('/hello');
  });
});
