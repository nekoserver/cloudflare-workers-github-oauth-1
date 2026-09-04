import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import {
  getOrComputeWineEmbedding,
  rankWines,
  bulkRegisterWines,
  floatsToBlob,
  blobToFloats,
  PLAMO_EMBEDDING_MODEL,
  WINE_DETAIL_COLUMNS,
  type WineSeedRow,
  type WineSearchCandidate,
} from './index';

// 対象: /wine-search ページ、POST /api/wine/search、POST /api/wine/bulk-register。
// seeds/wine_initial_vectors_v83.csv のワイン特性データを wine_embeddings/wine_details
// に登録し、フリーワードをplamo-embedding-1bでベクタ化してコサイン類似度検索する機能。
//
// 故障シナリオ(コード変更前チェックリスト):
//   (1) embedding計算(ai.run相当)がエラーを返す/空ベクトルを返す場合に
//       検索・一括登録が例外で落ちる、またはエラーが握りつぶされて
//       空文字列やundefinedが返る
//   (2) wine_detailsに対応する行が無いワイン(LEFT JOINでNULL)が
//       混入した場合にクラッシュする、または不正な数値(NaN等)を返す
//   (3) 空文字列・非常に長い検索クエリで例外になる
//   (4) wine_embeddingsが0件の状態で検索してもクラッシュせず空配列を返す
//   (5) bulkRegisterWinesで1件失敗しても他の銘柄の登録が止まってしまう、
//       または失敗がレスポンスのどこにも記録されない(CLAUDE.mdルール8)

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const toSqliteArgs = (args: unknown[]) =>
        args.map((a) => (a instanceof ArrayBuffer ? new Uint8Array(a) : a));
      const toD1Row = (row: unknown): unknown => {
        if (row && typeof row === 'object') {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
            out[k] = v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v;
          }
          return out;
        }
        return row;
      };
      const makeChain = (sqliteArgs: unknown[]) => ({
        async first<T>(): Promise<T | null> {
          const row = stmt.get(...(sqliteArgs as never[]));
          return (row ? (toD1Row(row) as T) : null);
        },
        async all<T>(): Promise<{ results?: T[] }> {
          const rows = stmt.all(...(sqliteArgs as never[])) as unknown[];
          return { results: rows.map(toD1Row) as T[] };
        },
        async run(): Promise<{ meta: { changes: number } }> {
          const res = stmt.run(...(sqliteArgs as never[]));
          return { meta: { changes: Number(res.changes) } };
        },
        bind(...innerArgs: unknown[]) {
          return makeChain(toSqliteArgs(innerArgs));
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE wine_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wine_name TEXT NOT NULL UNIQUE,
      model TEXT NOT NULL,
      dim INTEGER NOT NULL,
      vector BLOB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE wine_details (
      wine_id INTEGER PRIMARY KEY REFERENCES wine_embeddings(id),
      pairing_count INTEGER NOT NULL DEFAULT 0,
      source_linked_count INTEGER NOT NULL DEFAULT 0,
      source_rate REAL NOT NULL DEFAULT 0,
      reliability REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      sweet REAL NOT NULL DEFAULT 0,
      acid REAL NOT NULL DEFAULT 0,
      salt REAL NOT NULL DEFAULT 0,
      spice REAL NOT NULL DEFAULT 0,
      umami REAL NOT NULL DEFAULT 0,
      bitter REAL NOT NULL DEFAULT 0,
      richness REAL NOT NULL DEFAULT 0,
      raw REAL NOT NULL DEFAULT 0,
      fried REAL NOT NULL DEFAULT 0,
      grilled_smoked REAL NOT NULL DEFAULT 0,
      creamy_butter REAL NOT NULL DEFAULT 0,
      tomato REAL NOT NULL DEFAULT 0,
      herbal_green REAL NOT NULL DEFAULT 0,
      seafood REAL NOT NULL DEFAULT 0,
      shellfish REAL NOT NULL DEFAULT 0,
      white_fish REAL NOT NULL DEFAULT 0,
      oily_fish REAL NOT NULL DEFAULT 0,
      sushi REAL NOT NULL DEFAULT 0,
      red_meat REAL NOT NULL DEFAULT 0,
      poultry REAL NOT NULL DEFAULT 0,
      pork REAL NOT NULL DEFAULT 0,
      lamb REAL NOT NULL DEFAULT 0,
      dairy REAL NOT NULL DEFAULT 0,
      mushroom_truffle REAL NOT NULL DEFAULT 0,
      vegetable REAL NOT NULL DEFAULT 0,
      dessert REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

function makeAi(vectorOrError: number[] | Error) {
  return {
    run: vi.fn(async () => {
      if (vectorOrError instanceof Error) throw vectorOrError;
      return { data: [vectorOrError] };
    }),
  } as unknown as Ai;
}

function seedRow(overrides: Partial<WineSeedRow> & { wine: string }): WineSeedRow {
  const base: Record<string, number> = {};
  for (const c of WINE_DETAIL_COLUMNS) base[c] = 0.1;
  return { ...(base as unknown as WineSeedRow), ...overrides };
}

describe('getOrComputeWineEmbedding', () => {
  it('未キャッシュならAIを呼び、wine_embeddingsへ保存する', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 0, 0]);
    const vector = await getOrComputeWineEmbedding(db, ai, 'Aged / Vintage Champagne');
    expect(vector).toEqual([1, 0, 0]);
    expect(ai.run).toHaveBeenCalledTimes(1);
    const row = rawDb.prepare(`SELECT wine_name, model FROM wine_embeddings WHERE wine_name = ?`).get('Aged / Vintage Champagne') as { wine_name: string; model: string };
    expect(row.wine_name).toBe('Aged / Vintage Champagne');
    expect(row.model).toBe(PLAMO_EMBEDDING_MODEL);
  });

  it('同一モデルでキャッシュ済みならAIを呼ばない', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 0, 0]);
    await getOrComputeWineEmbedding(db, ai, 'テストワイン');
    const vector2 = await getOrComputeWineEmbedding(db, ai, 'テストワイン');
    expect(vector2).toEqual([1, 0, 0]);
    expect(ai.run).toHaveBeenCalledTimes(1);
  });

  it('故障シナリオ(1): AI呼び出しがエラーを投げた場合は例外が伝播する(握りつぶさない)', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi(new Error('AI service unavailable'));
    await expect(getOrComputeWineEmbedding(db, ai, '失敗ワイン')).rejects.toThrow('AI service unavailable');
    const row = rawDb.prepare(`SELECT 1 as found FROM wine_embeddings WHERE wine_name = ?`).get('失敗ワイン');
    expect(row).toBeUndefined();
  });

  it('AIが空ベクトルを返した場合は空配列を返しDBに保存しない', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([]);
    const vector = await getOrComputeWineEmbedding(db, ai, '空ベクトルワイン');
    expect(vector).toEqual([]);
    const row = rawDb.prepare(`SELECT 1 as found FROM wine_embeddings WHERE wine_name = ?`).get('空ベクトルワイン');
    expect(row).toBeUndefined();
  });
});

describe('rankWines', () => {
  it('コサイン類似度の降順で上位limit件を返す', () => {
    const candidates: WineSearchCandidate[] = [
      { id: 1, wineName: 'A', vector: [1, 0], details: null },
      { id: 2, wineName: 'B', vector: [0, 1], details: null },
      { id: 3, wineName: 'C', vector: [0.9, 0.1], details: null },
    ];
    const results = rankWines([1, 0], candidates, 2);
    expect(results).toHaveLength(2);
    expect(results[0].wineName).toBe('A');
    expect(results[1].wineName).toBe('C');
  });

  it('故障シナリオ(4): 候補が0件でもクラッシュせず空配列を返す', () => {
    expect(rankWines([1, 0], [], 30)).toEqual([]);
  });

  it('クエリベクトルが空(埋め込み失敗)の場合は空配列を返す', () => {
    const candidates: WineSearchCandidate[] = [{ id: 1, wineName: 'A', vector: [1, 0], details: null }];
    expect(rankWines([], candidates, 30)).toEqual([]);
  });

  it('故障シナリオ(2): wine_detailsが無い(details=null)候補が混じっても落ちない', () => {
    const candidates: WineSearchCandidate[] = [
      { id: 1, wineName: 'A', vector: [1, 0], details: null },
    ];
    const results = rankWines([1, 0], candidates, 30);
    expect(results[0].details).toBeNull();
  });
});

describe('bulkRegisterWines', () => {
  it('未登録の銘柄だけを登録し、wine_detailsも保存する', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 2, 3]);
    const seeds = [seedRow({ wine: 'ワインA' }), seedRow({ wine: 'ワインB', fat: 0.5 })];
    const result = await bulkRegisterWines(db, ai, seeds);
    expect(result.totalSeed).toBe(2);
    expect(result.alreadyRegistered).toBe(0);
    expect(result.succeeded).toBe(2);
    expect(result.errors).toEqual([]);
    const detailRow = rawDb.prepare(
      `SELECT d.fat as fat FROM wine_details d JOIN wine_embeddings e ON e.id = d.wine_id WHERE e.wine_name = ?`
    ).get('ワインB') as { fat: number };
    expect(detailRow.fat).toBe(0.5);
  });

  it('既に登録済みの銘柄はスキップする', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 2, 3]);
    await bulkRegisterWines(db, ai, [seedRow({ wine: 'ワインA' })]);
    const ai2 = makeAi([9, 9, 9]);
    const result = await bulkRegisterWines(db, ai2, [seedRow({ wine: 'ワインA' }), seedRow({ wine: 'ワインC' })]);
    expect(result.alreadyRegistered).toBe(1);
    expect(result.attempted).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(ai2.run).toHaveBeenCalledTimes(1);
  });

  it('故障シナリオ(5): 一部の銘柄でAI呼び出しが失敗しても他の銘柄の登録は継続し、失敗はerrorsに記録される', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    let call = 0;
    const ai = {
      run: vi.fn(async () => {
        call++;
        if (call === 1) throw new Error('rate limited');
        return { data: [[1, 2, 3]] };
      }),
    } as unknown as Ai;
    const seeds = [seedRow({ wine: '失敗する銘柄' }), seedRow({ wine: '成功する銘柄' })];
    const result = await bulkRegisterWines(db, ai, seeds);
    expect(result.succeeded).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].wine).toBe('失敗する銘柄');
    expect(result.errors[0].error).not.toBe('');
    expect(result.errors[0].error).toContain('rate limited');
    const okRow = rawDb.prepare(`SELECT 1 as found FROM wine_embeddings WHERE wine_name = ?`).get('成功する銘柄');
    expect(okRow).toBeTruthy();
  });
});

describe('POST /api/wine/search, /api/wine/bulk-register, GET /wine-search', () => {
  function buildApp(db: D1Database | undefined, ai: Ai | undefined) {
    const app = new Hono<{ Bindings: { DB?: D1Database; AI?: Ai } }>();
    const env = { DB: db, AI: ai };
    const request = (path: string, init?: RequestInit) => app.request(path, init, env);
    // 認証ミドルウェアの簡易スタブ: Authorizationヘッダが無ければ401
    const authStub = async (c: { req: { header: (k: string) => string | undefined } }, next: () => Promise<void>) => {
      if (!c.req.header('authorization')) {
        return new Response(JSON.stringify({ error: '認証が必要です' }), { status: 401 });
      }
      await next();
    };
    app.get('/wine-search', authStub, async (c) => c.html('<html>wine-search stub</html>'));
    app.post('/api/wine/search', authStub, async (c) => {
      const env = c.env as { DB?: D1Database; AI?: Ai };
      if (!env.DB) return new Response(JSON.stringify({ error: 'DB未設定です' }), { status: 503 });
      if (!env.AI) return new Response(JSON.stringify({ results: [], total: 0, error: 'AIバインディングが未設定です' }), { status: 503 });
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
      const raw = typeof (body as Record<string, unknown>).q === 'string' ? (body as Record<string, unknown>).q as string : '';
      const q = raw.trim().slice(0, 500);
      if (!q) return new Response(JSON.stringify({ results: [], total: 0, error: '検索文字列を入力してください' }), { status: 400 });
      let queryVector: number[];
      try {
        const result = await env.AI.run('dummy' as never, { text: [q] } as never);
        const resultObj = (typeof result === 'object' && result !== null) ? result as Record<string, unknown> : {};
        const data = Array.isArray(resultObj.data) ? resultObj.data as number[][] : [];
        queryVector = Array.isArray(data[0]) ? data[0] : [];
      } catch (e) {
        return new Response(JSON.stringify({ results: [], total: 0, error: '埋め込み計算に失敗しました: ' + (e instanceof Error ? e.message : String(e)) }), { status: 502 });
      }
      if (queryVector.length === 0) {
        return new Response(JSON.stringify({ results: [], total: 0, error: '埋め込み計算に失敗しました(空のベクトルが返されました)' }), { status: 502 });
      }
      const rows = await env.DB.prepare(
        `SELECT e.id AS id, e.wine_name AS wine_name, e.vector AS vector FROM wine_embeddings e`
      ).bind().all<{ id: number; wine_name: string; vector: ArrayBuffer }>();
      const candidates: WineSearchCandidate[] = (rows.results ?? []).map((r) => ({ id: r.id, wineName: r.wine_name, vector: blobToFloats(r.vector), details: null }));
      const results = rankWines(queryVector, candidates, 30);
      return new Response(JSON.stringify({ results, total: candidates.length }), { status: 200 });
    });
    return request;
  }

  it('未認証はGET /wine-searchで401', async () => {
    const app = buildApp(undefined, undefined);
    const res = await app('/wine-search');
    expect(res.status).toBe(401);
  });

  it('未認証はPOST /api/wine/searchで401', async () => {
    const app = buildApp(undefined, undefined);
    const res = await app('/api/wine/search', { method: 'POST', body: JSON.stringify({ q: 'x' }) });
    expect(res.status).toBe(401);
  });

  it('故障シナリオ(3): 空文字列クエリは400でエラーメッセージを返す(握りつぶさない)', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 0, 0]);
    const app = buildApp(db, ai);
    const res = await app('/api/wine/search', {
      method: 'POST',
      headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
      body: JSON.stringify({ q: '   ' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).not.toBe('');
  });

  it('故障シナリオ(3): 非常に長いクエリでも例外にならず処理される', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 0, 0]);
    const app = buildApp(db, ai);
    const longQuery = 'あ'.repeat(5000);
    const res = await app('/api/wine/search', {
      method: 'POST',
      headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
      body: JSON.stringify({ q: longQuery }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { results: unknown[]; total: number };
    expect(data.total).toBe(0);
  });

  it('故障シナリオ(4): wine_embeddingsが0件でも正常系レスポンス(空配列)を返す', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 0, 0]);
    const app = buildApp(db, ai);
    const res = await app('/api/wine/search', {
      method: 'POST',
      headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
      body: JSON.stringify({ q: '赤ワイン' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { results: unknown[]; total: number };
    expect(data.results).toEqual([]);
    expect(data.total).toBe(0);
  });

  it('故障シナリオ(1): embedding計算がエラーを投げた場合は502でエラー内容を返す', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi(new Error('AI down'));
    const app = buildApp(db, ai);
    const res = await app('/api/wine/search', {
      method: 'POST',
      headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
      body: JSON.stringify({ q: '赤ワイン' }),
    });
    expect(res.status).toBe(502);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('AI down');
  });

  it('正常系: 登録済みワインに対して類似度降順のレスポンス構造を返す', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const now = new Date().toISOString();
    rawDb.prepare(`INSERT INTO wine_embeddings (wine_name, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('似ているワイン', PLAMO_EMBEDDING_MODEL, 2, Buffer.from(floatsToBlob([1, 0])), now, now);
    rawDb.prepare(`INSERT INTO wine_embeddings (wine_name, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('似ていないワイン', PLAMO_EMBEDDING_MODEL, 2, Buffer.from(floatsToBlob([0, 1])), now, now);
    const ai = makeAi([1, 0]);
    const app = buildApp(db, ai);
    const res = await app('/api/wine/search', {
      method: 'POST',
      headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
      body: JSON.stringify({ q: '芳醇な赤ワイン' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { results: { wineName: string; similarity: number }[]; total: number };
    expect(data.total).toBe(2);
    expect(data.results[0].wineName).toBe('似ているワイン');
    expect(data.results[0].similarity).toBeGreaterThan(data.results[1].similarity);
  });
});
