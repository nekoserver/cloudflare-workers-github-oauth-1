/**
 * GET /legacy-storage-inventory と GET /api/preferences/:key のテスト
 *
 * 対象: ブラウザに現在保存されているCookie/localStorageの値を、どのページの
 * 設定なのか・D1への移行先が既にあるか(パージ可能/復元可能)で一覧表示する
 * ページ(SPEC.cloudflare-workers-github-oauth-1.20260907.user-preferences.md参照)。
 *
 * 故障シナリオ:
 *   (1) レジストリ(LEGACY_STORAGE_ENTRIES)の内容がページに埋め込まれない
 *   (2) GET /api/preferences/:key が許可リスト外のキーを素通りさせる
 *   (3) GET /api/preferences/:key がDB未設定時にエラーの理由が分からなくなる
 *   (4) GET /api/preferences/:key が値未登録時にnullを返さずクラッシュする
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { LEGACY_STORAGE_ENTRIES } from './data/legacyStorageRegistry';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(prefRow: { pref_value: string; updated_at: string } | null = null) {
  const firstMock = vi.fn().mockImplementation(() => Promise.resolve(prefRow));
  const bindMock = vi.fn().mockReturnValue({ first: firstMock, run: vi.fn().mockResolvedValue({ success: true }) });
  const db = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: bindMock,
      first: vi.fn().mockImplementation(() => {
        if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
        return Promise.resolve(prefRow);
      }),
    })),
  };
  return { db, bindMock, firstMock };
}

describe('GET /legacy-storage-inventory', () => {
  it('レジストリの内容(キー・移行先キー)がページHTMLに埋め込まれる', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb();
    const res = await app.request(
      '/legacy-storage-inventory',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const entry of LEGACY_STORAGE_ENTRIES) {
      expect(html).toContain(JSON.stringify(entry.key));
    }
    expect(html).toContain('migratedPrefKey');
    expect(html).toContain('/api/preferences/');
  });

  it('未認証の場合はページを返さない', async () => {
    const { db } = createMockDb();
    const res = await app.request('/legacy-storage-inventory', {}, { JWT_SECRET, DB: db });
    expect(res.status).not.toBe(200);
  });
});

describe('GET /api/preferences/:key', () => {
  it('許可リストに無いキーは400で拒否される', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb();
    const res = await app.request(
      '/api/preferences/unknown_key',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(400);
  });

  it('D1に値が無い場合はvalue: nullを返す(復元可能の判定材料)', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb(null);
    const res = await app.request(
      '/api/preferences/d1_query_catalog_sort',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { key: string; value: string | null };
    expect(body.value).toBeNull();
  });

  it('D1に値がある場合はその値を返す(パージ可能の判定材料)', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb({ pref_value: 'name', updated_at: '2026-09-07 00:00:00' });
    const res = await app.request(
      '/api/preferences/d1_query_catalog_sort',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { key: string; value: string | null };
    expect(body.value).toBe('name');
  });

  it('DB未設定時は500かつ理由が分かるエラーメッセージを返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/preferences/d1_query_catalog_sort',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: undefined }
    );
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });
});
