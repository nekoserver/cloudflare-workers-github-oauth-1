/**
 * POST /api/preferences/:key のテスト
 *
 * 対象: 個別Cookie乱立を解消するための汎用ユーザー設定書き込みエンドポイント
 * (SPEC.cloudflare-workers-github-oauth-1.20260907.user-preferences.md参照)。
 * USER_PREFERENCE_KEYSの許可リストに基づき、D1(user_preferences)へキー単位で
 * upsertする。
 *
 * 故障シナリオ:
 *   (1) 許可リストに無いキーへの書き込みリクエストが素通りしてしまう
 *   (2) 許可リストにあるキーでも、許容されていない値が素通りしてしまう
 *   (3) 値が文字列以外・空文字のリクエストが素通りしてしまう
 *   (4) DB未設定時にエラーがそのまま伝播し500の理由が分からなくなる
 *   (5) 正常系で実際にON CONFLICT UPSERTのSQLが呼ばれない
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb() {
  const runMock = vi.fn().mockResolvedValue({ success: true });
  const bindMock = vi.fn().mockReturnValue({
    first: vi.fn().mockImplementation(() => Promise.resolve(null)),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: runMock,
  });
  const db = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: bindMock,
      first: vi.fn().mockImplementation(() => {
        if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: runMock,
    })),
  };
  return { db, bindMock, runMock };
}

describe('POST /api/preferences/:key', () => {
  it('許可リストに無いキーは400で拒否される', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb();
    const res = await app.request(
      '/api/preferences/unknown_key',
      { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'x' }) },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('未知の設定キー');
  });

  it('許可リストにあるキーでも許容されていない値は400で拒否される', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb();
    const res = await app.request(
      '/api/preferences/d1_query_catalog_sort',
      { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'bogus' }) },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('不正な値');
  });

  it('値が文字列以外・空文字の場合は400で拒否される', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb();
    const res = await app.request(
      '/api/preferences/d1_query_catalog_sort',
      { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ value: '' }) },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(400);
  });

  it('正常系: 許可された値はD1へON CONFLICT UPSERTされ200が返る', async () => {
    const authHeader = await makeAuthHeader();
    const { db, runMock } = createMockDb();
    const res = await app.request(
      '/api/preferences/d1_query_catalog_sort',
      { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'name' }) },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { key: string; value: string };
    expect(body.key).toBe('d1_query_catalog_sort');
    expect(body.value).toBe('name');
    expect(runMock).toHaveBeenCalled();
    const insertCall = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => (call[0] as string).includes('INSERT INTO user_preferences'));
    expect(insertCall).toBeDefined();
    expect(insertCall![0]).toContain('ON CONFLICT(user_id, pref_key)');
  });

  it('DB未設定時は500かつ理由が分かるエラーメッセージを返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/preferences/d1_query_catalog_sort',
      { method: 'POST', headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'name' }) },
      { JWT_SECRET, DB: undefined }
    );
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });
});
