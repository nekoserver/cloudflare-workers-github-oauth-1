import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

// /public-keysで公開鍵を登録した際、その公開鍵のexpires_atと同じ日時を
// countdown_eventsへ「PK期限」として自動登録する結合テスト。
const JWT_SECRET = 'test-secret';
const PUBLIC_KEY_JWK = { kty: 'EC', crv: 'P-256', x: 'test-x', y: 'test-y' };

async function authHeader() {
  return `Bearer ${await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET)}`;
}

function createMockDb(throwOnCountdownInsert = false) {
  const publicKeys: { userId: string; expiresAt: string | null }[] = [];
  const countdownEvents: { userId: string; label: string; targetAt: string }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first() {
              if (sql.includes('user_sessions')) return { revoked_at: null };
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO user_public_keys')) {
                publicKeys.push({ userId: params[1] as string, expiresAt: params[5] as string | null });
              }
              if (sql.includes('INSERT INTO countdown_events')) {
                if (throwOnCountdownInsert) throw new Error('countdown insert failed');
                countdownEvents.push({
                  userId: params[0] as string,
                  label: params[1] as string,
                  targetAt: params[2] as string,
                });
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { db, publicKeys, countdownEvents };
}

async function register(db: ReturnType<typeof createMockDb>['db'], expiresInDays: number | null) {
  return app.request('/api/public-keys', {
    method: 'POST',
    headers: { Authorization: await authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: '自宅PC', publicKeyJwk: PUBLIC_KEY_JWK, expiresInDays }),
  }, { JWT_SECRET, DB: db });
}

describe('POST /api/public-keys: 公開鍵の期限をカウントダウンへ登録する', () => {
  it('期限付き公開鍵のexpires_atをPK期限として登録する', async () => {
    const { db, publicKeys, countdownEvents } = createMockDb();
    const response = await register(db, 30);
    const body = await response.json() as {
      key: { expiresAt: string };
      countdown: { ok: boolean; registered: boolean };
      countdownNotice: string;
    };

    expect(response.status).toBe(201);
    expect(publicKeys).toHaveLength(1);
    expect(countdownEvents).toEqual([{
      userId: 'test-user',
      label: 'PK期限',
      targetAt: publicKeys[0].expiresAt,
    }]);
    expect(body.key.expiresAt).toBe(publicKeys[0].expiresAt);
    expect(body.countdown).toEqual({ ok: true, registered: true });
    expect(body.countdownNotice).toContain('PK期限');
  });

  it('無期限の公開鍵ではカウントダウンを登録しない', async () => {
    const { db, countdownEvents } = createMockDb();
    const response = await register(db, null);
    const body = await response.json() as {
      key: { expiresAt: null };
      countdown: { ok: boolean; registered: boolean; skipReason: string };
    };

    expect(response.status).toBe(201);
    expect(body.key.expiresAt).toBeNull();
    expect(countdownEvents).toHaveLength(0);
    expect(body.countdown).toEqual({ ok: true, registered: false, skipReason: 'no_expiry' });
  });

  it('カウントダウン登録失敗時も公開鍵登録を成功させ、失敗内容を返す', async () => {
    const { db, publicKeys } = createMockDb(true);
    const response = await register(db, 90);
    const body = await response.json() as {
      countdown: { ok: boolean; errorCode: string; detail: string };
      countdownNotice: string;
    };

    expect(response.status).toBe(201);
    expect(publicKeys).toHaveLength(1);
    expect(body.countdown).toEqual({
      ok: false,
      errorCode: 'insert_failed',
      detail: 'countdown insert failed',
    });
    expect(body.countdownNotice).toContain('countdown insert failed');
  });
});
