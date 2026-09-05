import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import {
  getOrComputeWineEmbedding,
  rankWines,
  countWineHits,
  bulkRegisterWines,
  getWineDetailById,
  bulkRegisterWineMetadata,
  checkWineSeedConsistency,
  floatsToBlob,
  blobToFloats,
  PLAMO_EMBEDDING_MODEL,
  WINE_DETAIL_COLUMNS,
  type WineSeedRow,
  type WineSearchCandidate,
} from './index';
import type { WineMetadataSeedRow } from './data/wineMetadata';

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
      // 実際のD1はBLOB列をUint8Arrayとして返すため、テストのモックでも
      // ArrayBufferへ変換せずそのまま返す(変換してしまうと、本番でだけ
      // 起きるUint8Array起因の不具合をテストがすり抜けてしまう)。
      const toD1Row = (row: unknown): unknown => row;
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
    CREATE TABLE wine_metadata (
      id INTEGER PRIMARY KEY REFERENCES wine_embeddings(id),
      wine_name TEXT NOT NULL,
      katakana_name TEXT,
      country TEXT,
      production_area TEXT,
      wine_type TEXT,
      grape_or_style TEXT,
      characteristics TEXT,
      pairing_foods TEXT,
      pairing_food_count INTEGER,
      pairing_reasons TEXT,
      food_reason_pairs TEXT,
      source_urls TEXT,
      source_url_count INTEGER,
      source_linked_count INTEGER,
      source_rate REAL,
      metadata_research_url TEXT,
      metadata_status TEXT,
      metadata_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      revoked_at TEXT,
      last_activity_at TEXT
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

// 根本原因: D1のBLOB列は実行環境によってArrayBufferではなくUint8Array
// (バイト列)として返ってくることがある。`new Float32Array(uint8)`は
// 「バイト列を要素配列としてコピーする」オーバーロードを呼んでしまい、
// 本来の要素数(例: 2048)ではなくバイト数(例: 8192 = 2048 * 4)の配列に
// なってしまう。これによりワイン検索でクエリベクトル(2048次元、AI呼び出し
// 直後のnumber[]なのでこの問題を踏まない)と登録済みベクトル(D1から読み
// 出したUint8Array経由で8192次元に化ける)の次元が食い違い、
// cosineSimilarityが常に0を返す不具合が実運用で発生した。
describe('blobToFloats (D1のBLOB列がUint8Arrayで返るケースの回帰テスト)', () => {
  it('ArrayBufferを渡した場合は従来通り正しい要素数で復元できる', () => {
    const vec = [0.1, 0.2, 0.3, 0.4];
    const blob = floatsToBlob(vec);
    expect(blob instanceof ArrayBuffer).toBe(true);
    const restored = blobToFloats(blob);
    expect(restored).toHaveLength(vec.length);
    restored.forEach((v, i) => expect(v).toBeCloseTo(vec[i], 5));
  });

  it('Uint8Array(D1が実際に返す形)を渡してもバイト数ではなく正しい要素数で復元できる', () => {
    const vec = new Array(2048).fill(0).map((_, i) => Math.sin(i));
    const arrayBuffer = floatsToBlob(vec);
    const uint8 = new Uint8Array(arrayBuffer);
    expect(uint8.length).toBe(vec.length * 4);
    const restored = blobToFloats(uint8);
    expect(restored).toHaveLength(vec.length);
    expect(restored).not.toHaveLength(uint8.length);
    restored.forEach((v, i) => expect(v).toBeCloseTo(vec[i], 4));
  });

  it('Uint8Arrayがバッファの一部分だけを指すview(byteOffsetあり)でも正しく復元できる', () => {
    const vec = [1, 2, 3];
    const blob = floatsToBlob(vec);
    const padded = new Uint8Array(4 + blob.byteLength);
    padded.set(new Uint8Array(blob), 4);
    const view = new Uint8Array(padded.buffer, 4, blob.byteLength);
    const restored = blobToFloats(view);
    expect(restored).toEqual(vec);
  });

  it('素のnumber[](JSON経由でシリアライズされたバイト列)で渡ってもバイト数ではなく正しい要素数で復元できる', () => {
    const vec = [1.5, -2.5, 3.5];
    const arrayBuffer = floatsToBlob(vec);
    const plainByteArray = Array.from(new Uint8Array(arrayBuffer));
    expect(plainByteArray.length).toBe(vec.length * 4);
    const restored = blobToFloats(plainByteArray);
    expect(restored).toHaveLength(vec.length);
    restored.forEach((v, i) => expect(v).toBeCloseTo(vec[i], 4));
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

// 対象: 「ヒット件数」= 表示件数(limit)とは独立に、類似度が閾値以上の
// 候補が全体で何件あるかを数える機能。表示件数を絞っても実際に閾値を
// 超えている件数が分かるようにする(「30件表示」と「全体で何件ヒットして
// いるか」の混同を防ぐ)。
describe('countWineHits', () => {
  it('閾値以上の類似度を持つ候補の件数だけをカウントする(表示件数のlimitとは無関係)', () => {
    const candidates: WineSearchCandidate[] = [
      { id: 1, wineName: 'A', vector: [1, 0], details: null },
      { id: 2, wineName: 'B', vector: [0.99, 0.01], details: null },
      { id: 3, wineName: 'C', vector: [0, 1], details: null },
    ];
    expect(countWineHits([1, 0], candidates, 0.5)).toBe(2);
    expect(countWineHits([1, 0], candidates, 0.99999)).toBe(1);
  });

  it('故障シナリオ: 候補が0件、またはクエリベクトルが空の場合は0を返す', () => {
    expect(countWineHits([1, 0], [], 0.5)).toBe(0);
    expect(countWineHits([], [{ id: 1, wineName: 'A', vector: [1, 0], details: null }], 0.5)).toBe(0);
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

  // 対象: 既存616件相当+新規追加分だけがシードに増えた状況(実運用でワイン
  // ベクタデータを追加した場合)で、bulkRegisterWinesが本当に「差分だけ」を
  // 処理することを保証する回帰テスト。succeededWinesで実際に処理した銘柄名を
  // 検証可能にし、既存分に一切触れない(AIを呼ばない)ことも確認する。
  it('故障シナリオ: 大量の既存データ+新規追加分がある状況でも、差分(新規分)だけを処理しsucceededWinesで検証できる', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const existingAi = makeAi([1, 0, 0]);
    const existingSeeds = Array.from({ length: 50 }, (_, i) => seedRow({ wine: `既存ワイン${i}` }));
    for (const s of existingSeeds) {
      await bulkRegisterWines(db, existingAi, [s]);
    }

    const newAi = makeAi([0, 1, 0]);
    const newSeeds = [seedRow({ wine: '新規ワインA' }), seedRow({ wine: '新規ワインB' }), seedRow({ wine: '新規ワインC' })];
    const allSeeds = [...existingSeeds, ...newSeeds];
    const result = await bulkRegisterWines(db, newAi, allSeeds);

    expect(result.alreadyRegistered).toBe(50);
    expect(result.attempted).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.succeededWines).toEqual(['新規ワインA', '新規ワインB', '新規ワインC']);
    expect(newAi.run).toHaveBeenCalledTimes(3);
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

  it('limitを指定すると先頭limit件だけ処理しremainingに残り件数を返す(進捗表示用)', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 2, 3]);
    const seeds = [seedRow({ wine: 'ワインA' }), seedRow({ wine: 'ワインB' }), seedRow({ wine: 'ワインC' })];
    const result1 = await bulkRegisterWines(db, ai, seeds, 2);
    expect(result1.attempted).toBe(2);
    expect(result1.succeeded).toBe(2);
    expect(result1.remaining).toBe(1);

    const result2 = await bulkRegisterWines(db, ai, seeds, 2);
    expect(result2.attempted).toBe(1);
    expect(result2.succeeded).toBe(1);
    expect(result2.remaining).toBe(0);
  });
});

// 対象: 「オリジナルのシード件数(WINE_VECTOR_SEED.length)」と「実際に
// wine_embeddingsへ埋め込みが入っている件数」を突き合わせる機能。
// 一括登録が途中で失敗・中断した場合に、検索対象から漏れているワインが
// 無いかを確認できるようにする(CLAUDE.mdルール12: 推測せずデータで裏を取る)。
describe('checkWineSeedConsistency', () => {
  it('シード件数と埋め込み件数が一致する場合はmatches=trueを返す', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 2, 3]);
    const seeds = [seedRow({ wine: 'ワインA' }), seedRow({ wine: 'ワインB' })];
    await bulkRegisterWines(db, ai, seeds);
    const result = await checkWineSeedConsistency(db, seeds);
    expect(result.seedTotal).toBe(2);
    expect(result.embeddedTotal).toBe(2);
    expect(result.matches).toBe(true);
    expect(result.missingCount).toBe(0);
  });

  it('故障シナリオ: 一部だけ埋め込みが入っている場合はmatches=falseで不足銘柄名を返す', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 2, 3]);
    const seeds = [seedRow({ wine: 'ワインA' }), seedRow({ wine: 'ワインB' }), seedRow({ wine: 'ワインC' })];
    await bulkRegisterWines(db, ai, seeds, 1);
    const result = await checkWineSeedConsistency(db, seeds);
    expect(result.seedTotal).toBe(3);
    expect(result.embeddedTotal).toBe(1);
    expect(result.matches).toBe(false);
    expect(result.missingCount).toBe(2);
    expect(result.missingSample).toEqual(['ワインB', 'ワインC']);
  });

  it('故障シナリオ: wine_embeddingsが0件でもクラッシュせずmatches=falseを返す', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const seeds = [seedRow({ wine: 'ワインA' })];
    const result = await checkWineSeedConsistency(db, seeds);
    expect(result.embeddedTotal).toBe(0);
    expect(result.matches).toBe(false);
  });
});

// 根本原因: GET /api/wine/:id (動的パラメータ)がGET /api/wine/consistency-check
// (固定パス)より先に登録されていたため、後者へのリクエストが
// id="consistency-check"として/api/wine/:idにマッチしてしまい、
// 数値チェックで弾かれて「不正なIDです」が返っていた。実際のHonoアプリ
// (スタブではなく本物のapp)でルーティングを検証し、再発を防ぐ。
describe('GET /api/wine/consistency-check のルーティング(実アプリでの回帰テスト)', () => {
  it('/api/wine/:idに"consistency-check"という文字列がマッチせず、専用ハンドラが呼ばれる', async () => {
    const realApp = (await import('./index')).default;
    const { createJWT } = await import('./utils/jwt');
    const token = await createJWT({ sub: 'test-user', name: 'Test' }, 'test-secret');
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const res = await realApp.request(
      '/api/wine/consistency-check',
      { headers: { Authorization: `Bearer ${token}` } },
      { JWT_SECRET: 'test-secret', DB: db },
    );
    expect(res.status).toBe(200);
    const data = await res.json() as { seedTotal: number; embeddedTotal: number; error?: string };
    expect(data.error).toBeUndefined();
    expect(typeof data.seedTotal).toBe('number');
    expect(typeof data.embeddedTotal).toBe('number');
  });
});

// 対象: wine_embeddings.id(連番インデックス)を指定して1銘柄ぶんの
// 全詳細(銘柄名・モデル・次元数・特性値)を取得する機能(GET /api/wine/:id)。
// 一覧表示ではマスクされている特性値も、個別詳細では常にすべて返す。
describe('getWineDetailById', () => {
  it('存在するIDを指定すると銘柄名・モデル・特性値を含む詳細を返す', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 2, 3]);
    await bulkRegisterWines(db, ai, [seedRow({ wine: 'ワインA', fat: 0.42 })]);
    const idRow = rawDb.prepare(`SELECT id FROM wine_embeddings WHERE wine_name = ?`).get('ワインA') as { id: number };
    const detail = await getWineDetailById(db, idRow.id);
    expect(detail).not.toBeNull();
    expect(detail!.wineName).toBe('ワインA');
    expect(detail!.model).toBe(PLAMO_EMBEDDING_MODEL);
    expect(detail!.details!.fat).toBeCloseTo(0.42, 5);
  });

  it('故障シナリオ: 存在しないIDの場合はnullを返す(例外を投げない)', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const detail = await getWineDetailById(db, 999999);
    expect(detail).toBeNull();
  });

  it('wine_metadataに行がある場合は産地・特徴などの個別詳細も含めて返す', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 2, 3]);
    await bulkRegisterWines(db, ai, [seedRow({ wine: 'ワインA' })]);
    const idRow = rawDb.prepare(`SELECT id FROM wine_embeddings WHERE wine_name = ?`).get('ワインA') as { id: number };
    const now = new Date().toISOString();
    rawDb.prepare(
      `INSERT INTO wine_metadata (id, wine_name, country, characteristics, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(idRow.id, 'ワインA', '日本', '柑橘香が強い', now, now);
    const detail = await getWineDetailById(db, idRow.id);
    expect(detail!.metadata).not.toBeNull();
    expect(detail!.metadata!.country).toBe('日本');
    expect(detail!.metadata!.characteristics).toBe('柑橘香が強い');
  });

  it('故障シナリオ: wine_metadataに行が無い場合はmetadataがnullになる(details=nullと同様に落ちない)', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 2, 3]);
    await bulkRegisterWines(db, ai, [seedRow({ wine: 'ワインA' })]);
    const idRow = rawDb.prepare(`SELECT id FROM wine_embeddings WHERE wine_name = ?`).get('ワインA') as { id: number };
    rawDb.prepare(`DELETE FROM wine_details WHERE wine_id = ?`).run(idRow.id);
    const detail = await getWineDetailById(db, idRow.id);
    expect(detail).not.toBeNull();
    expect(detail!.metadata).toBeNull();
  });
});

function metadataRow(overrides: Partial<WineMetadataSeedRow> = {}): WineMetadataSeedRow {
  return {
    wine_name: 'ワインA',
    katakana_name: null,
    country: null,
    production_area: null,
    wine_type: null,
    grape_or_style: null,
    characteristics: null,
    pairing_foods: null,
    pairing_food_count: null,
    pairing_reasons: null,
    food_reason_pairs: null,
    source_urls: null,
    source_url_count: null,
    source_linked_count: null,
    source_rate: null,
    metadata_research_url: null,
    metadata_status: null,
    metadata_note: null,
    ...overrides,
  };
}

// 対象: wine_616_individual_metadata_researched_v2.csv由来のシード(WINE_METADATA_SEED)を
// wine_metadataへ一括登録する機能(POST /api/wine/bulk-register-metadata)。
// wine_nameでwine_embeddingsと突き合わせてidを解決するため、対応する埋め込みが
// 未登録の銘柄をエラーではなくskippedとして扱えるかがポイント(過去のゴミ行
// 混入バグ(#1631)と同じ問題を作らないため)。
describe('bulkRegisterWineMetadata', () => {
  it('wine_embeddingsに存在する銘柄はwine_metadataへ登録される', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const ai = makeAi([1, 2, 3]);
    await bulkRegisterWines(db, ai, [seedRow({ wine: 'ワインA' })]);
    const result = await bulkRegisterWineMetadata(db, [metadataRow({ wine_name: 'ワインA', country: '日本' })]);
    expect(result.succeeded).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    const row = rawDb.prepare(`SELECT country FROM wine_metadata WHERE wine_name = ?`).get('ワインA') as { country: string };
    expect(row.country).toBe('日本');
  });

  it('故障シナリオ: wine_embeddingsに未登録の銘柄はエラーにせずskippedとして扱う', async () => {
    const rawDb = setupDb();
    const db = wrapD1(rawDb) as unknown as D1Database;
    const result = await bulkRegisterWineMetadata(db, [metadataRow({ wine_name: '未登録ワイン' })]);
    expect(result.succeeded).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([]);
    const row = rawDb.prepare(`SELECT COUNT(*) AS c FROM wine_metadata`).get() as { c: number };
    expect(row.c).toBe(0);
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

// 対象: /wine-searchページに置いた「ワイン埋め込み一括登録」ボタンと診断情報表示
// (デバッグ用の運用UI、curlでPOST /api/wine/bulk-registerを叩く手間を省く・
// D1のBLOB型不整合のような不具合を再調査する際に使う)。通常時は誤操作や
// 情報漏えいを避けるため`hidden`属性で隠し、URLに`?debug=1`を付けた場合
// のみJSで表示する。
// 故障シナリオ: テンプレートリテラルのエスケープ崩れ(ルール29)でページ全体が白紙になる。
describe('getWineSearchPage のデバッグモード用UI', () => {
  it('一括登録ボタン・診断情報表示は通常時hiddenで、エスケープ崩れの無いスクリプトを含む', async () => {
    const { getWineSearchPage } = await import('./views/wineSearch');
    const html = getWineSearchPage('tester');
    expect(html).toContain('id="tempAdminBox" hidden');
    expect(html).toContain('id="bulkRegisterBtn"');
    expect(html).toContain('id="bulkRegisterResult"');
    expect(html).toContain("fetch('/api/wine/bulk-register'");
    expect(html).toContain('allSucceededWines');
    expect(html).toContain('新規登録:');
    expect(html).toContain('id="bulkRegisterMetadataBtn"');
    expect(html).toContain("fetch('/api/wine/bulk-register-metadata'");
    expect(html).toContain('id="consistencyCheckBtn"');
    expect(html).toContain("fetch('/api/wine/consistency-check'");
    expect(html).toContain("get('debug') === '1'");
    expect(html).toContain('debugQueryDim');
    expect(html).not.toContain("\\'");
    expect(html).not.toContain('&#39;&#39;');
  });
});

// 対象: 出力件数の選択(20/30/50/100)、特性列のマスク表示(デフォルト非表示・
// トグルで表示切替)、ワイン名クリックによる個別詳細モーダル(GET /api/wine/:id)。
// 故障シナリオ: テンプレートリテラルのエスケープ崩れでページ全体が白紙になる。
describe('getWineSearchPage の件数選択・マスク・個別詳細モーダル', () => {
  it('出力件数の選択肢(20/30/50/100)を含み、検索時にlimitとして送信する', async () => {
    const { getWineSearchPage } = await import('./views/wineSearch');
    const html = getWineSearchPage('tester');
    expect(html).toContain('id="limitSelect"');
    expect(html).toContain('value="20"');
    expect(html).toContain('value="30" selected');
    expect(html).toContain('value="50"');
    expect(html).toContain('value="100"');
    expect(html).toContain('limit: limit');
  });

  it('特性列はデフォルトでマスクされ、トグルボタンで表示/非表示を切り替えられる', async () => {
    const { getWineSearchPage } = await import('./views/wineSearch');
    const html = getWineSearchPage('tester');
    expect(html).toContain('id="maskToggleBtn"');
    expect(html).toContain('var isMasked = true;');
    expect(html).toContain("'<td class=\"masked\">");
  });

  it('ヒット件数(閾値以上の件数)を表示件数(limit)とは別に表示する', async () => {
    const { getWineSearchPage } = await import('./views/wineSearch');
    const html = getWineSearchPage('tester');
    expect(html).toContain('ヒット件数');
    expect(html).toContain('res.data.hitCount');
  });

  it('行(任意のセル)クリックで個別詳細モーダルを開きGET /api/wine/:idを呼び、動的z-index(getNextZ)を使う', async () => {
    const { getWineSearchPage } = await import('./views/wineSearch');
    const html = getWineSearchPage('tester');
    expect(html).toContain('id="detailModalOverlay"');
    expect(html).toContain('id="detailModalTitle"');
    expect(html).toContain("fetch('/api/wine/' + encodeURIComponent(id)");
    expect(html).toContain('class="wine-row"');
    expect(html).toContain("closest('.wine-row')");
    expect(html).toContain('function getNextZ()');
    expect(html).toContain('detailModalOverlay.style.zIndex = String(getNextZ())');
    expect(html).not.toContain("\\'");
    expect(html).not.toContain('&#39;&#39;');
  });
});
