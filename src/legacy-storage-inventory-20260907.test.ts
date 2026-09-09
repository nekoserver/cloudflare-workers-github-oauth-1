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

describe('LEGACY_STORAGE_ENTRIES', () => {
  // airline_network_* は個別キーを1つずつ登録するのではなく、前方一致(isPrefix)の
  // 1エントリで/airline-network由来のキーを網羅的に拾う。今後 /airline-network
  // 側に新しいCookie/localStorageキーが増えても、このレジストリへの追加登録なしに
  // 正しいページとして判定できることを保証する。
  it.each([
    ['airline_network_dest_flags', 'cookie'],
    ['airline_network_dest_airports', 'cookie'],
    ['airline_network_country_hubs', 'cookie'],
    ['airline_network_display_mode', 'cookie'],
    ['airline_network_country_hubs_v2', 'localStorage'],
    ['airline_network_some_future_key', 'cookie'],
  ] as const)('%s(%s)は前方一致で/airline-networkページと判定される', (key, storage) => {
    const matched = LEGACY_STORAGE_ENTRIES.find((e) => {
      if (e.storage !== storage) return false;
      return e.isPrefix ? key.indexOf(e.key) === 0 : e.key === key;
    });
    expect(matched).toBeDefined();
    expect(matched?.page).toBe('/airline-network');
  });

  it('airline_networkのprefixエントリはcookie/localStorageの両方に存在する', () => {
    const cookieEntry = LEGACY_STORAGE_ENTRIES.find((e) => e.key === 'airline_network_' && e.storage === 'cookie' && e.isPrefix);
    const lsEntry = LEGACY_STORAGE_ENTRIES.find((e) => e.key === 'airline_network_' && e.storage === 'localStorage' && e.isPrefix);
    expect(cookieEntry).toBeDefined();
    expect(lsEntry).toBeDefined();
  });
});

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

  it('ページ別ストレージ占有量グラフの描画先コンテナと集計関数が含まれる', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb();
    const res = await app.request(
      '/legacy-storage-inventory',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: db }
    );
    const html = await res.text();
    expect(html).toContain('id="cookieCapacityChart"');
    expect(html).toContain('id="localStorageCapacityChart"');
    expect(html).toContain('function computePageUsage');
    expect(html).toContain('function renderCapacityChart');
  });

  it('合計行の使用率(%)には100を掛けた値が使われる(0〜1の比率のまま表示しない)', async () => {
    const authHeader = await makeAuthHeader();
    const { db } = createMockDb();
    const res = await app.request(
      '/legacy-storage-inventory',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: db }
    );
    const html = await res.text();
    // 合計行を追加する箇所で、比率(0〜1)に対して明示的に100を掛けていることを
    // ソース上で確認する(掛け忘れると0.001のような値がそのまま%表示され、
    // 実際の使用率よりも大幅に小さく見えてしまう)。
    expect(html).toContain('gaugePctRatio * 100');
    expect(html).toContain('capacity-rank-row-total');
    expect(html).toContain('>合計<');
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
