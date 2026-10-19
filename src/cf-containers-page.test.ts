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
  // DemoContainer.restart()は同一DOインスタンス内でstop→startをロック付きで
  // 実行する(排他制御)。route側はstub.restart()だけを呼ぶため、ここでも
  // 実際にstop/startを順に呼ぶ実装で模倣する。
  restart: vi.fn().mockImplementation(async function (this: typeof stubMethods) {
    await this.stop();
    await this.start();
  }),
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

// instanceId算出(DEMO_CONTAINER.idFromName('demo').toString())のため、
// テストのDEMO_CONTAINERモックには最低限idFromNameが必要。
const defaultDemoContainerBinding = { idFromName: vi.fn().mockReturnValue({ toString: () => 'fake-instance-id' }) };

function envWithContainer(demoContainer: unknown = defaultDemoContainerBinding) {
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

  it('wrangler containers sshで使うinstanceIdを、DEMO_CONTAINER.idFromNameから返す(コンテナが起動していなくても計算できる)', async () => {
    stubMethods.getState.mockRejectedValue(new Error('not running'));
    const token = await adminToken();
    const res = await app.request('/api/cf-containers/status', { headers: { Authorization: `Bearer ${token}` } }, envWithContainer());
    const body = (await res.json()) as { instanceId: string | null };
    expect(body.instanceId).toBe('fake-instance-id');
  });

  it('DEMO_CONTAINERバインディング未設定時はinstanceIdをnullで返す', async () => {
    const token = await adminToken();
    const env = { ...BASE_ENV, DB: makeDb(), JWT_SECRET };
    const res = await app.request('/api/cf-containers/status', { headers: { Authorization: `Bearer ${token}` } }, env);
    const body = (await res.json()) as { instanceId: string | null };
    expect(body.instanceId).toBeNull();
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

  // authMiddlewareはBearerトークンでも`.prepare(sql).bind(userId).first()`で
  // revokeチェックを行うため、usage集計用の`.prepare(sql).first()`(bind無し)
  // と両方満たすdbモックが必要。
  function makeUsageDb(firstImpl: () => Promise<unknown>) {
    return {
      prepare: vi.fn().mockReturnValue({
        first: firstImpl,
        bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ revoked_at: null }) }),
      }),
    };
  }

  it('D1のcf_container_operation_logから累計起動回数・直近起動からの経過時間を返す', async () => {
    stubMethods.getState.mockResolvedValue({ lastChange: 0, status: 'running' });
    const db = makeUsageDb(() =>
      Promise.resolve({ cnt: 4, last_started_at: new Date(Date.now() - 65 * 60000).toISOString() })
    );
    const token = await adminToken();
    const res = await app.request(
      '/api/cf-containers/status',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...BASE_ENV, DB: db, JWT_SECRET, DEMO_CONTAINER: defaultDemoContainerBinding }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { usage: { totalStartCount: number; lastStartedAt: string; elapsedSinceLastStart: string } };
    expect(body.usage.totalStartCount).toBe(4);
    expect(body.usage.elapsedSinceLastStart).toBe('1時間5分');
  });

  it('D1クエリが失敗してもstatus本体の応答は返す(usageは付かないが握りつぶさずログに残す)', async () => {
    stubMethods.getState.mockResolvedValue({ lastChange: 0, status: 'running' });
    const db = makeUsageDb(() => Promise.reject(new Error('d1 read failed')));
    const token = await adminToken();
    const res = await app.request(
      '/api/cf-containers/status',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...BASE_ENV, DB: db, JWT_SECRET, DEMO_CONTAINER: defaultDemoContainerBinding }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { running: boolean; usage?: unknown };
    expect(body.running).toBe(true);
    expect(body.usage).toBeUndefined();
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

describe('POST /api/cf-containers/secrets', () => {
  // authMiddlewareのrevokeチェック(.bind().first())・recordContainerOperation
  // のINSERT(.bind().run())の両方を満たすdbモック。
  function makeSecretsDb() {
    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ revoked_at: null }),
          run: vi.fn().mockResolvedValue({}),
        }),
      }),
    };
  }

  function envWithCfApi(extra: Record<string, unknown> = {}) {
    return {
      ...BASE_ENV,
      DB: makeSecretsDb(),
      JWT_SECRET,
      DEMO_CONTAINER: defaultDemoContainerBinding,
      CLOUDFLARE_API_KEY: 'cf-key',
      CLOUDFLARE_ACCOUNT_ID: 'cf-account',
      ...extra,
    };
  }

  async function postSecret(name: string, value: string, env = envWithCfApi()) {
    const token = await adminToken();
    return app.request(
      '/api/cf-containers/secrets',
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, value }) },
      env
    );
  }

  it('未ログインは401', async () => {
    const res = await app.request(
      '/api/cf-containers/secrets',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'NEKOROOT_TUNNEL_TOKEN', value: 'x' }) },
      envWithCfApi()
    );
    expect(res.status).toBe(401);
  });

  it('許可リストにないnameは400で拒否され、fetchは一切呼ばれない', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const res = await postSecret('JWT_SECRET', 'x');
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('valueが空なら400で拒否する', async () => {
    const res = await postSecret('NEKOROOT_TUNNEL_TOKEN', '   ');
    expect(res.status).toBe(400);
  });

  it('CLOUDFLARE_API_KEY未設定なら503', async () => {
    const res = await postSecret('NEKOROOT_TUNNEL_TOKEN', 'x', envWithCfApi({ CLOUDFLARE_API_KEY: undefined }));
    expect(res.status).toBe(503);
  });

  it('正常系: secret設定APIを呼んだ後、コンテナをstop→startし、D1に記録する', async () => {
    stubMethods.getState.mockResolvedValue({ lastChange: 0, status: 'running' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: {} }), { status: 200 })
    );
    const callOrder: string[] = [];
    stubMethods.stop.mockImplementation(async () => { callOrder.push('stop'); });
    stubMethods.start.mockImplementation(async () => { callOrder.push('start'); });

    const res = await postSecret('NEKOROOT_TUNNEL_TOKEN', 'tok_abc123');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(callOrder).toEqual(['stop', 'start']);

    const [url, init] = fetchSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('/secrets')
    ) as [string, RequestInit];
    expect(url).toContain('/accounts/cf-account/workers/scripts/cloudflare-workers-github-oauth-1/secrets');
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toEqual({ name: 'NEKOROOT_TUNNEL_TOKEN', text: 'tok_abc123', type: 'secret_text' });
    fetchSpy.mockRestore();
  });

  it.each(['expired-token', undefined])('旧トークンが%sでも入力した新トークンで更新し、再起動へ渡す', async (oldToken) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: {} }), { status: 200 })
    );
    try {
      const res = await postSecret('CF_CONTAINER_API_TOKEN', '  new-token  ', envWithCfApi({
        CF_CONTAINER_API_TOKEN: oldToken, CLOUDFLARE_API_KEY: undefined,
      }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      const [, init] = fetchSpy.mock.calls[0];
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer new-token');
      expect(JSON.parse(init?.body as string).text).toBe('new-token');
      expect(stubMethods.restart).toHaveBeenCalledWith({ name: 'CF_CONTAINER_API_TOKEN', value: 'new-token' });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('新トークンが拒否されたら更新失敗を返し再起動せず、値も返さない', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ success: false, result: null, errors: [{ message: 'rejected new-token' }] }), { status: 401 })
    );
    try {
      const res = await postSecret('CF_CONTAINER_API_TOKEN', 'new-token', envWithCfApi({ CF_CONTAINER_API_TOKEN: 'expired-token' }));
      expect(res.status).toBe(502);
      expect(await res.text()).not.toContain('new-token');
      expect(stubMethods.restart).not.toHaveBeenCalled();
      for (const [, init] of fetchSpy.mock.calls) {
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer new-token');
      }
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('保存後の再起動が失敗した場合は保存済みの警告を返す', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: {} }), { status: 200 })
    );
    stubMethods.restart.mockRejectedValueOnce(new Error('restart failed'));
    try {
      const res = await postSecret('CF_CONTAINER_API_TOKEN', 'new-token');
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, warning: expect.stringContaining('保存しましたが') });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('Cloudflare API呼び出しが失敗したら502を返し、コンテナは再起動しない', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, result: null, errors: [{ message: 'bad token' }] }), { status: 403 })
    );
    const res = await postSecret('NEKOROOT_TUNNEL_TOKEN', 'x');
    expect(res.status).toBe(502);
    expect(stubMethods.stop).not.toHaveBeenCalled();
    expect(stubMethods.start).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
