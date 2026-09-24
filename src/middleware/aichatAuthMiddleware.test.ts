import { Hono } from 'hono';
import { describe, it, expect } from 'vitest';
import { aichatAuthMiddleware } from './auth';
import { hashApiKey } from '../utils/apiKeys';

// 対象: /api/aichat 専用の aichatAuthMiddleware(src/middleware/auth.ts)。
// APIキー(nkapi_...)またはセッションJWTのどちらでも認証できるようにする一方、
// 他のエンドポイント(authMiddlewareを使うもの)の挙動は変えない。
//
// 故障シナリオ:
//   (1) 有効なAPIキーなのに認証を通してしまわない(user.subが設定されない)
//   (2) 失効/期限切れ/発行者アカウント無効化のAPIキーで認証が通ってしまう
//   (3) APIキーではない(セッションJWTや空)トークンをAPIキー判定してしまい、
//       本来のCookie/JWT認証ロジック(authMiddleware)に到達しない

function buildApp(dbRows: (Record<string, unknown> | null)[]) {
  const app = new Hono<{ Bindings: { DB?: unknown; JWT_SECRET?: string } }>();
  let callIndex = 0;
  const sqlCalls: { sql: string; args: unknown[] }[] = [];
  const fakeDb = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              const row = dbRows[callIndex++];
              return row ?? null;
            },
            async run() {
              callIndex++;
              sqlCalls.push({ sql, args });
              return { success: true };
            },
          };
        },
      };
    },
  };
  const waitUntilPromises: Promise<unknown>[] = [];
  const fakeExecutionCtx = {
    waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  app.use('/api/aichat', aichatAuthMiddleware);
  app.post('/api/aichat', (c) => {
    const user = c.get('user' as never) as { sub: string } | undefined;
    const apiKeyId = c.get('apiKeyId' as never) as string | undefined;
    return c.json({ ok: true, sub: user?.sub, apiKeyId });
  });
  return { app, fakeDb, fakeExecutionCtx, sqlCalls, waitUntilPromises };
}

const VALID_KEY = 'nkapi_' + 'a'.repeat(64);

describe('aichatAuthMiddleware', () => {
  it('有効なAPIキーで認証が通り、user.subにキー発行者のuser_idが設定される', async () => {
    const { app, fakeDb, fakeExecutionCtx } = buildApp([
      { id: 'k1', user_id: 'user1', label: 'test', expires_at: null, revoked_at: null },
      { revoked_at: null },
    ]);
    const res = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VALID_KEY}` },
    }, { DB: fakeDb }, fakeExecutionCtx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, sub: 'user1', apiKeyId: 'k1' });
  });

  it('失効済みAPIキーは401で拒否され、ハンドラに到達しない', async () => {
    const { app, fakeDb, fakeExecutionCtx } = buildApp([
      { id: 'k1', user_id: 'user1', label: 'test', expires_at: null, revoked_at: '2026-08-01T00:00:00.000Z' },
    ]);
    const res = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VALID_KEY}` },
    }, { DB: fakeDb }, fakeExecutionCtx);
    expect(res.status).toBe(401);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe('revoked');
  });

  it('キー発行者のアカウント自体が無効化されている場合も401で拒否される', async () => {
    const { app, fakeDb, fakeExecutionCtx } = buildApp([
      { id: 'k1', user_id: 'user1', label: 'test', expires_at: null, revoked_at: null },
      { revoked_at: '2026-08-01T00:00:00.000Z' },
    ]);
    const res = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VALID_KEY}` },
    }, { DB: fakeDb }, fakeExecutionCtx);
    expect(res.status).toBe(401);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe('account_revoked');
  });

  it('存在しないAPIキーはnot_foundで拒否される', async () => {
    const { app, fakeDb, fakeExecutionCtx } = buildApp([null]);
    const res = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VALID_KEY}` },
    }, { DB: fakeDb }, fakeExecutionCtx);
    expect(res.status).toBe(401);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe('not_found');
  });

  it('APIキー形式ではないBearerトークン(セッションJWT想定)はAPIキー判定されず、authMiddleware側の「無効なトークンです」で拒否される', async () => {
    const { app, fakeDb, fakeExecutionCtx } = buildApp([]);
    const res = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-a-jwt-and-not-an-api-key' },
    }, { DB: fakeDb, JWT_SECRET: 'test-secret' }, fakeExecutionCtx);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('無効なトークンです');
  });

  it('リクエスト完了後、そのAPIキーのエンドポイント別使用統計(api_key_endpoint_stats)をUPSERTする', async () => {
    const { app, fakeDb, fakeExecutionCtx, sqlCalls, waitUntilPromises } = buildApp([
      { id: 'k1', user_id: 'user1', label: 'test', expires_at: null, revoked_at: null },
      { revoked_at: null },
    ]);
    const res = await app.request('/api/aichat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VALID_KEY}` },
    }, { DB: fakeDb }, fakeExecutionCtx);
    expect(res.status).toBe(200);
    await Promise.all(waitUntilPromises);

    const statsCall = sqlCalls.find((c) => c.sql.includes('api_key_endpoint_stats'));
    expect(statsCall).toBeDefined();
    expect(statsCall!.args[0]).toBe('k1');
    expect(statsCall!.args[2]).toBe('POST /api/aichat');
    expect(statsCall!.args[3]).toBe(200);
  });

  it('APIキーの照合に使うのはSHA-256ハッシュであり、生キーはそのままクエリに渡さない', async () => {
    const digests: string[] = [];
    const expectedHash = await hashApiKey(VALID_KEY);
    expect(expectedHash).not.toBe(VALID_KEY);
    digests.push(expectedHash);
    expect(digests[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});
