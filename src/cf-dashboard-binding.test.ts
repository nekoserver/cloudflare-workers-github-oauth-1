import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { listD1TableNames, loadCfDashboardTables } from './utils/cfDashboardD1';

// 対象: /cf-dashboardページ(GET /api/cf-dashboard/d1, GET /api/cf-dashboard/d1/:dbId/tables)。
// 以前はCloudflare REST API(CLOUDFLARE_API_TOKEN必須)経由で「アカウント全体の
// D1データベース一覧」を取得していたが、トークンの権限不足で401エラーが頻発した
// ため、このWorker自身のD1バインディング(c.env.DB、トークン不要)経由に切り替えた。
//
// 故障シナリオ:
//   (1) sqlite_master由来の内部テーブル(sqlite_%, _cf_%)を一覧に含めてしまう
//   (2) 1つのテーブルの行数取得が失敗した場合に、他の正常なテーブルの結果まで
//       巻き込んで全体がエラーになる(握りつぶさず、そのテーブルだけnullにする)
//   (3) c.env.DB未設定時にconfigured:falseを返さずクラッシュする
//   (4) ルートハンドラがCLOUDFLARE_API_TOKENの有無をチェックしてしまい、
//       トークン未設定でも動作すべきところが動かない

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function makeEnv(db: unknown) {
  return {
    DB: db,
    GITHUB_CLIENT_ID: 'test',
    GITHUB_CLIENT_SECRET: 'test',
    JWT_SECRET,
    ANALYTICS: undefined,
  };
}

function makeSessionPassthroughDb(tableRows: { name: string }[], countByTable: Record<string, number | 'throw'>) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('user_sessions')) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
          }),
        };
      }
      if (sql.includes('sqlite_master')) {
        return {
          all: vi.fn().mockResolvedValue({ results: tableRows }),
        };
      }
      const match = sql.match(/FROM "([^"]+)"/);
      const tableName = match ? match[1] : '';
      const count = countByTable[tableName];
      return {
        all: vi.fn().mockImplementation(() => {
          if (count === 'throw') return Promise.reject(new Error('no such table: ' + tableName));
          return Promise.resolve({ results: [{ cnt: count }] });
        }),
      };
    }),
  };
}

describe('listD1TableNames', () => {
  it('sqlite_master由来の内部テーブル(sqlite_%, _cf_%)は除外済みのSQLで取得する(クエリ結果をそのまま返す)', async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [{ name: 'users' }, { name: 'posts' }] }),
      }),
    };
    const names = await listD1TableNames(db as unknown as D1Database);
    expect(names).toEqual(['users', 'posts']);
    const sql = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sql).toContain("NOT LIKE 'sqlite_%'");
    expect(sql).toContain("NOT LIKE '_cf_%'");
  });
});

describe('loadCfDashboardTables', () => {
  it('各テーブルの行数を取得して返す', async () => {
    const db = makeSessionPassthroughDb(
      [{ name: 'users' }, { name: 'posts' }],
      { users: 3, posts: 10 }
    );
    const tables = await loadCfDashboardTables(db as unknown as D1Database);
    expect(tables).toEqual([
      { name: 'users', row_count: 3 },
      { name: 'posts', row_count: 10 },
    ]);
  });

  it('1つのテーブルの行数取得が失敗しても、他のテーブルの結果は正常に返す(巻き込まれない)', async () => {
    const db = makeSessionPassthroughDb(
      [{ name: 'broken' }, { name: 'ok' }],
      { broken: 'throw', ok: 5 }
    );
    const tables = await loadCfDashboardTables(db as unknown as D1Database);
    expect(tables).toEqual([
      { name: 'broken', row_count: null },
      { name: 'ok', row_count: 5 },
    ]);
  });
});

describe('GET /api/cf-dashboard/d1', () => {
  it('DBバインディング経由でconfigured:trueとテーブル数を返す(CLOUDFLARE_API_TOKEN不要)', async () => {
    const db = makeSessionPassthroughDb([{ name: 'a' }, { name: 'b' }, { name: 'c' }], {});
    const res = await app.request(
      '/api/cf-dashboard/d1',
      { headers: { Authorization: await makeAuthHeader() } },
      makeEnv(db)
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { configured: boolean; databases: Array<{ num_tables: number }> };
    expect(body.configured).toBe(true);
    expect(body.databases).toHaveLength(1);
    expect(body.databases[0].num_tables).toBe(3);
  });

  it('c.env.DB未設定の場合はconfigured:falseを返す', async () => {
    const res = await app.request(
      '/api/cf-dashboard/d1',
      { headers: { Authorization: await makeAuthHeader() } },
      makeEnv(undefined)
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { configured: boolean };
    expect(body.configured).toBe(false);
  });
});

describe('GET /api/cf-dashboard/d1/:dbId/tables', () => {
  it('dbIdの値に関わらず、このWorkerのD1のテーブル一覧・行数を返す', async () => {
    const db = makeSessionPassthroughDb([{ name: 'x' }], { x: 7 });
    const res = await app.request(
      '/api/cf-dashboard/d1/anything/tables',
      { headers: { Authorization: await makeAuthHeader() } },
      makeEnv(db)
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { tables: Array<{ name: string; row_count: number | null }> };
    expect(body.tables).toEqual([{ name: 'x', row_count: 7 }]);
  });
});
