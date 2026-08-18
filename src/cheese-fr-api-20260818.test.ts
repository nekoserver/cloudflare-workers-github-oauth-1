/**
 * GET /api/cheese-fr の統合テスト
 *
 * 対象: フランスチーズ一覧(cheese_fr)を返すAPI。原材料・生産者・製法・固さ・
 * 備考は自由記述テキストからのヒューリスティック抽出のため、不明な項目は
 * NULLのまま返す(無理に"不明"等の文字列で埋めない)想定。
 *
 * 故障シナリオ:
 *   (1) DB未設定時に例外を投げてページ全体を壊す
 *   (2) DBエラー時に汎用500ではなく実際のエラー内容を返せない(握りつぶし)
 *   (3) 検索クエリqを指定してもLIKE検索の対象カラムを間違え、
 *       名称・読み仮名以外でも一致してしまう/一致しなくなる
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb(rows: Record<string, unknown>[]) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({ results: rows }),
      }),
      first: vi.fn().mockImplementation(() => {
        if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: rows }),
    })),
  };
}

describe('GET /api/cheese-fr', () => {
  it('DB未設定時は503を返す(例外を投げない)', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/cheese-fr',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET }
    );
    expect(res.status).toBe(503);
  });

  it('qを指定しない場合は全件を返す(pairingを含む)', async () => {
    const authHeader = await makeAuthHeader();
    const rows = [
      { seq_no: 1, name_fr: 'Abbaye de Belloc', reading: 'アッベイ・ド・ベルロック', ingredient: '羊乳', producer: 'バスク地方・修道院', method: 'セミハード', hardness: 'セミハード', notes: null, pairing: 'ハム、くるみ、白ワインやフルーティな赤ワイン' },
    ];
    const res = await app.request(
      '/api/cheese-fr',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: createMockDb(rows) }
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[] };
    expect(body.items).toEqual(rows);
  });

  it('qを指定するとname_fr/readingのLIKE検索クエリになる', async () => {
    const authHeader = await makeAuthHeader();
    const db = createMockDb([]);
    await app.request(
      '/api/cheese-fr?q=Brie',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: db }
    );
    const calledSqls = db.prepare.mock.calls.map((c) => c[0] as string);
    const cheeseQuery = calledSqls.find((sql) => sql.includes('FROM cheese_fr'));
    expect(cheeseQuery).toBeDefined();
    expect(cheeseQuery).toContain('name_fr LIKE ?');
    expect(cheeseQuery).toContain('reading LIKE ?');
  });

  it('SELECT句にpairingカラムが含まれる(食材ペアリング検索ページ用)', async () => {
    const authHeader = await makeAuthHeader();
    const db = createMockDb([]);
    await app.request(
      '/api/cheese-fr',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: db }
    );
    const calledSqls = db.prepare.mock.calls.map((c) => c[0] as string);
    const cheeseQuery = calledSqls.find((sql) => sql.includes('FROM cheese_fr'));
    expect(cheeseQuery).toBeDefined();
    expect(cheeseQuery).toContain('pairing');
  });

  it('DBエラー時は実際のエラーメッセージを含んだ500を返す(握りつぶさない)', async () => {
    const authHeader = await makeAuthHeader();
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ revoked_at: null }),
          all: vi.fn().mockRejectedValue(new Error('no such table: cheese_fr')),
        }),
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('user_sessions')) return Promise.resolve({ revoked_at: null });
          return Promise.resolve(null);
        }),
        all: vi.fn().mockRejectedValue(new Error('no such table: cheese_fr')),
      })),
    };
    const res = await app.request(
      '/api/cheese-fr',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('no such table: cheese_fr');
  });
});
