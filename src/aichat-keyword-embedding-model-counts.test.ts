import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { getKeywordEmbeddingModelCounts, listKeywordEmbeddingsOverview } from './index';

// 対象: ZTモーダルの📖一覧・📈日次統計モーダルにある「埋め込みモデル別
// 登録済みキーワード率」円グラフが参照する登録件数の集計
// (getKeywordEmbeddingModelCounts)。
//
// 背景: 円グラフは従来 listKeywordEmbeddingsOverview の返り値
// (`ORDER BY updated_at DESC LIMIT 500`)の配列長・フィルタ件数をそのまま
// 分子に使っていた。登録件数が500件を超えている状態で新規キーワードを
// 追加登録すると、新しく updated_at が更新された行が上位500件に入り、
// 更新されていない古い行(plamo/gemmaサブ系列を持つものを含む)が枠外に
// 押し出される。その結果、実際には登録件数が増えているのに画面上の
// モデル別登録件数が「減った」ように見える不具合になっていた。
//
// 故障シナリオ:
//   (1) LIMIT付きの一覧結果を件数計算に使い続け、登録件数がLIMITを
//       超えたときに件数が実態と乖離する
//   (2) 新規登録(=既存行のupdated_at更新)によって、他の登録済みキーワードの
//       集計値が変動してしまう(件数は単調増加でなければならない)
//   (3) plamo_dim/gemma_dimがNULLの行を「登録済み」に誤カウントする
//   (4) 他ユーザーの登録件数を混ぜてカウントしてしまう

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              const row = stmt.get(...(args as never[]));
              return (row as T) ?? null;
            },
            async all<T>(): Promise<{ results?: T[] }> {
              const rows = stmt.all(...(args as never[])) as unknown[];
              return { results: rows as T[] };
            },
            async run(): Promise<{ meta: { changes: number } }> {
              const res = stmt.run(...(args as never[]));
              return { meta: { changes: Number(res.changes) } };
            },
          };
        },
      };
    },
  };
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE aichat_keyword_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      model TEXT NOT NULL,
      dim INTEGER NOT NULL,
      vector BLOB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source TEXT,
      plamo_vector BLOB, plamo_dim INTEGER, plamo_model TEXT, plamo_updated_at TEXT,
      gemma_vector BLOB, gemma_dim INTEGER, gemma_model TEXT, gemma_updated_at TEXT
    );
    CREATE UNIQUE INDEX idx_aichat_keyword_embeddings_user_keyword ON aichat_keyword_embeddings(user_id, keyword);
  `);
  return db;
}

function insertRow(db: DatabaseSync, opts: {
  userId: string; keyword: string; updatedAt: string;
  plamoDim?: number | null; gemmaDim?: number | null;
}) {
  db.prepare(
    `INSERT INTO aichat_keyword_embeddings
       (user_id, keyword, model, dim, vector, created_at, updated_at, plamo_dim, plamo_model, gemma_dim, gemma_model)
     VALUES (?, ?, 'bge-m3', 2, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    opts.userId, opts.keyword, new Uint8Array(new Float32Array([1, 2]).buffer), opts.updatedAt, opts.updatedAt,
    opts.plamoDim ?? null, opts.plamoDim != null ? 'plamo-embedding-1b' : null,
    opts.gemmaDim ?? null, opts.gemmaDim != null ? 'embeddinggemma-300m' : null,
  );
}

describe('getKeywordEmbeddingModelCounts: 円グラフ用のモデル別登録件数集計', () => {
  it('bge/plamo/gemmaそれぞれの登録件数を正しく数える', async () => {
    const db = setupDb();
    insertRow(db, { userId: 'u1', keyword: 'A', updatedAt: '2026-01-01', plamoDim: 4 });
    insertRow(db, { userId: 'u1', keyword: 'B', updatedAt: '2026-01-02', gemmaDim: 8 });
    insertRow(db, { userId: 'u1', keyword: 'C', updatedAt: '2026-01-03' });

    const counts = await getKeywordEmbeddingModelCounts(wrapD1(db) as never, 'u1');
    expect(counts).toEqual({ bge: 3, plamo: 1, gemma: 1 });
  });

  it('他ユーザーの登録件数は混ざらない', async () => {
    const db = setupDb();
    insertRow(db, { userId: 'u1', keyword: 'A', updatedAt: '2026-01-01', plamoDim: 4 });
    insertRow(db, { userId: 'u2', keyword: 'B', updatedAt: '2026-01-01', plamoDim: 4 });

    const counts = await getKeywordEmbeddingModelCounts(wrapD1(db) as never, 'u1');
    expect(counts).toEqual({ bge: 1, plamo: 1, gemma: 0 });
  });

  it('1件も登録が無いユーザーは全て0を返す(SUMがNULLになってもフォールバックする)', async () => {
    const db = setupDb();
    const counts = await getKeywordEmbeddingModelCounts(wrapD1(db) as never, 'nobody');
    expect(counts).toEqual({ bge: 0, plamo: 0, gemma: 0 });
  });

  it('新規キーワードを追加登録(=既存行のupdated_at更新とは無関係)しても、既存のplamo/gemma登録件数は減らない(登録件数は単調増加する)', async () => {
    const db = setupDb();
    // 先にplamo/gemma付きのキーワードを何件か登録
    insertRow(db, { userId: 'u1', keyword: 'old1', updatedAt: '2026-01-01', plamoDim: 4 });
    insertRow(db, { userId: 'u1', keyword: 'old2', updatedAt: '2026-01-02', gemmaDim: 8 });
    insertRow(db, { userId: 'u1', keyword: 'old3', updatedAt: '2026-01-03', plamoDim: 4, gemmaDim: 8 });

    const before = await getKeywordEmbeddingModelCounts(wrapD1(db) as never, 'u1');
    expect(before).toEqual({ bge: 3, plamo: 2, gemma: 2 });

    // 新しいキーワードをbge-m3のみで追加登録(updated_atは最新)
    insertRow(db, { userId: 'u1', keyword: 'new1', updatedAt: '2026-06-01' });
    insertRow(db, { userId: 'u1', keyword: 'new2', updatedAt: '2026-06-02' });

    const after = await getKeywordEmbeddingModelCounts(wrapD1(db) as never, 'u1');
    // 新規追加分はbgeのみ加算され、plamo/gemmaの既存登録件数は減らない
    expect(after).toEqual({ bge: 5, plamo: 2, gemma: 2 });
  });

  it('listKeywordEmbeddingsOverview(LIMIT付き一覧)の件数と食い違っても、getKeywordEmbeddingModelCountsは実際の全件数を返す', async () => {
    // listKeywordEmbeddingsOverviewはORDER BY updated_at DESC LIMIT 500のため、
    // 登録件数がLIMITを超える状況を smaller scale (LIMIT相当を3件とみなして
    // 検証できないため、ここでは「一覧に出てこない古い行」を作り、それでも
    // getKeywordEmbeddingModelCountsは正しくカウントすることを確認する。
    const db = setupDb();
    insertRow(db, { userId: 'u1', keyword: 'veryOld', updatedAt: '2020-01-01', plamoDim: 4, gemmaDim: 8 });
    for (let i = 0; i < 5; i++) {
      insertRow(db, { userId: 'u1', keyword: 'recent' + i, updatedAt: '2026-01-0' + (i + 1) });
    }

    const overview = await listKeywordEmbeddingsOverview(wrapD1(db) as never, 'u1');
    expect(overview.length).toBe(6);

    const counts = await getKeywordEmbeddingModelCounts(wrapD1(db) as never, 'u1');
    expect(counts).toEqual({ bge: 6, plamo: 1, gemma: 1 });
  });
});
