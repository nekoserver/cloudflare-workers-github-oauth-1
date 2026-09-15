import { describe, it, expect } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getApiKeysPage } from './views/apiKeys';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 対象: POST /api/api-keys でキー発行したあと、発行した有効期限日時を
// /countdown の countdown_events へ label='Key期限' で新規予約する処理。
//
// 故障シナリオ:
//   (1) 30日/90日キー発行後に countdown_events へ行が作られない
//   (2) 予約の target_at が api_keys.expires_at とずれる
//   (3) 無期限キーなのに不正な日時で予約が入る
//   (4) カウントダウン INSERT 失敗でキー発行自体が 500 になる
//   (5) INSERT 失敗を空の詳細で握りつぶし、画面にも出ない
//   (6) 発行モーダルが countdownNotice を表示せず、登録成否に気づけない

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createApiKeyIssueMockDb(opts?: { throwOnCountdownInsert?: boolean }) {
  const apiKeys: { id: string; user_id: string; expires_at: string | null }[] = [];
  const countdownEvents: { user_id: string; label: string; target_at: string }[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first() {
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO api_keys')) {
                apiKeys.push({
                  id: params[0] as string,
                  user_id: params[1] as string,
                  expires_at: (params[6] as string | null) ?? null,
                });
                return { success: true };
              }
              if (sql.includes('INSERT INTO countdown_events')) {
                if (opts?.throwOnCountdownInsert) {
                  throw new Error('countdown table missing');
                }
                countdownEvents.push({
                  user_id: params[0] as string,
                  label: params[1] as string,
                  target_at: params[2] as string,
                });
                return { success: true, meta: { last_row_id: countdownEvents.length } };
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { db, apiKeys, countdownEvents };
}

describe('POST /api/api-keys: 発行後に Key期限 カウントダウンを予約する', () => {
  it('30日キー発行後、expires_at と同じ日時で label=Key期限 の新規行を入れる', async () => {
    const { db, apiKeys, countdownEvents } = createApiKeyIssueMockDb();
    const res = await app.request(
      '/api/api-keys',
      {
        method: 'POST',
        headers: { Authorization: await makeAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '監視用', expiresInDays: 30 }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(201);
    const body = await res.json() as {
      key: { expiresAt: string };
      countdown: { ok: boolean; registered?: boolean };
      countdownNotice: string;
    };
    expect(apiKeys).toHaveLength(1);
    expect(countdownEvents).toHaveLength(1);
    expect(countdownEvents[0].label).toBe('Key期限');
    expect(countdownEvents[0].user_id).toBe('test-user');
    expect(countdownEvents[0].target_at).toBe(apiKeys[0].expires_at);
    expect(countdownEvents[0].target_at).toBe(body.key.expiresAt);
    expect(body.countdown).toEqual({ ok: true, registered: true });
    expect(body.countdownNotice).toContain('Key期限');
  });

  it('90日キー発行後も、キーの expires_at をそのまま予約日時にする', async () => {
    const { db, apiKeys, countdownEvents } = createApiKeyIssueMockDb();
    const res = await app.request(
      '/api/api-keys',
      {
        method: 'POST',
        headers: { Authorization: await makeAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '長期', expiresInDays: 90 }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { key: { expiresAt: string } };
    expect(countdownEvents[0].target_at).toBe(apiKeys[0].expires_at);
    expect(countdownEvents[0].target_at).toBe(body.key.expiresAt);
    const issued = new Date(body.key.expiresAt).getTime();
    const created = new Date(apiKeys[0].expires_at as string).getTime();
    expect(issued).toBe(created);
  });

  it('無期限キーでは countdown_events へINSERTしない', async () => {
    const { db, countdownEvents } = createApiKeyIssueMockDb();
    const res = await app.request(
      '/api/api-keys',
      {
        method: 'POST',
        headers: { Authorization: await makeAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '永久', expiresInDays: null }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(201);
    const body = await res.json() as {
      key: { expiresAt: string | null };
      countdown: { ok: boolean; registered?: boolean; skipReason?: string };
    };
    expect(body.key.expiresAt).toBeNull();
    expect(countdownEvents).toHaveLength(0);
    expect(body.countdown).toEqual({ ok: true, registered: false, skipReason: 'no_expiry' });
  });

  it('2回発行したら Key期限 が2行増える(既存行の上書きではない)', async () => {
    const { db, countdownEvents } = createApiKeyIssueMockDb();
    const headers = {
      Authorization: await makeAuthHeader(),
      'Content-Type': 'application/json',
    };
    const first = await app.request(
      '/api/api-keys',
      { method: 'POST', headers, body: JSON.stringify({ label: 'A', expiresInDays: 30 }) },
      { JWT_SECRET, DB: db }
    );
    const second = await app.request(
      '/api/api-keys',
      { method: 'POST', headers, body: JSON.stringify({ label: 'B', expiresInDays: 90 }) },
      { JWT_SECRET, DB: db }
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(countdownEvents).toHaveLength(2);
    expect(countdownEvents.map((row) => row.label)).toEqual(['Key期限', 'Key期限']);
    expect(countdownEvents[0].target_at).not.toBe(countdownEvents[1].target_at);
  });

  it('カウントダウンINSERT失敗でもキー発行は201で成功し、失敗詳細が空にならない', async () => {
    const { db, apiKeys, countdownEvents } = createApiKeyIssueMockDb({ throwOnCountdownInsert: true });
    const res = await app.request(
      '/api/api-keys',
      {
        method: 'POST',
        headers: { Authorization: await makeAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '監視用', expiresInDays: 30 }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(201);
    expect(apiKeys).toHaveLength(1);
    expect(countdownEvents).toHaveLength(0);
    const body = await res.json() as {
      rawKey: string;
      countdown: { ok: boolean; errorCode?: string; detail?: string };
      countdownNotice: string;
    };
    expect(body.rawKey.startsWith('nkapi_')).toBe(true);
    expect(body.countdown.ok).toBe(false);
    expect(body.countdown.errorCode).toBe('insert_failed');
    expect(body.countdown.detail).toBe('countdown table missing');
    expect(body.countdownNotice).toContain('countdown table missing');
  });
});

describe('🔑キー管理ページ: 発行モーダルにカウントダウン登録結果を出す', () => {
  const html = getApiKeysPage({ name: 'テストユーザー', username: 'testuser' });

  it('発行成功時に countdownNotice をモーダルへ渡す', () => {
    expect(html).toContain('showRawKeyModal(res.data.rawKey, res.data.countdownNotice');
    expect(html).toContain('id="countdownNotice"');
  });

  it('POST /api/api-keys ハンドラが insertApiKeyDeadlineCountdown を呼ぶ', () => {
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.post('/api/api-keys', authMiddleware,");
    const block = src.slice(idx, idx + 2500);
    expect(block).toContain('insertApiKeyDeadlineCountdown(');
    expect(block).toContain('formatApiKeyDeadlineCountdownNotice(');
    expect(block).toContain('countdownNotice');
  });
});
