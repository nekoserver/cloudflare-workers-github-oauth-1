import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  rankSimilarKeywords,
  findSimilarKeywordsGroupedByCategory,
  parseSimilarityThreshold,
  BGE_M3_MODEL,
} from './index';

// 対象: 埋め込みキャッシュモーダルの「🔍分析」ボタンを押したときに表示する
// 「登録済みキーワードの中から似ているものを、分類カテゴリごとにグルーピングして
// 列挙し、近いメタデータ値をハイライトする」機能のバックエンド側ロジック。
//
// 故障シナリオ:
//   (1) 類似度の閾値未満の無関係なキーワードまで列挙してしまう
//   (2) 対象キーワード自身が候補・結果に紛れ込む
//   (3) 複数の中分類に属するキーワードが片方のグループにしか出ない、
//       または一切出ない
//   (4) 中分類に属さないキーワードが結果から消える（未分類グループへの
//       振り分け漏れ）
//   (5) 対象キーワードがキャッシュされていない場合に例外を投げる
//   (6) 他ユーザーのキーワードが候補に混ざる

describe('parseSimilarityThreshold: 類似度閾値スライダーのクエリパラメータ解析', () => {
  it('有効な数値文字列はそのままパースする', () => {
    expect(parseSimilarityThreshold('0.7', 0.85)).toBeCloseTo(0.7, 6);
  });

  it('未指定(undefined)の場合はfallbackを返す', () => {
    expect(parseSimilarityThreshold(undefined, 0.85)).toBe(0.85);
  });

  it('数値として解釈できない文字列はfallbackを返す（握りつぶさず安全側に倒す）', () => {
    expect(parseSimilarityThreshold('abc', 0.85)).toBe(0.85);
    expect(parseSimilarityThreshold('', 0.85)).toBe(0.85);
  });

  it('0未満は0に、1超は1にクランプする', () => {
    expect(parseSimilarityThreshold('-0.5', 0.85)).toBe(0);
    expect(parseSimilarityThreshold('1.5', 0.85)).toBe(1);
  });
});

describe('rankSimilarKeywords: 類似度でのランキングと閾値フィルタ', () => {
  it('閾値以上の候補のみを類似度降順で返す', () => {
    const result = rankSimilarKeywords(
      [1, 0],
      [
        { keyword: '空港', vector: [0.99, 0.01] },
        { keyword: '無関係', vector: [0, 1] },
        { keyword: '鉄道', vector: [0.9, 0.1] },
      ],
      0.8,
      10,
    );
    expect(result.map((r) => r.keyword)).toEqual(['空港', '鉄道']);
    expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
  });

  it('limit件数で打ち切る', () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({ keyword: 'kw' + i, vector: [1, 0] }));
    const result = rankSimilarKeywords([1, 0], candidates, 0.5, 3);
    expect(result).toHaveLength(3);
  });

  it('候補が空なら空配列を返す', () => {
    expect(rankSimilarKeywords([1, 0], [], 0.5, 10)).toEqual([]);
  });
});

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
      return {
        bind(...args: unknown[]) {
          const sqliteArgs = toSqliteArgs(args);
          return {
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
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_aichat_keyword_embeddings_user_keyword ON aichat_keyword_embeddings(user_id, keyword);

    CREATE TABLE aichat_keyword_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE aichat_keyword_category_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function insertEmbedding(db: DatabaseSync, userId: string, keyword: string, vec: number[]) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, keyword, BGE_M3_MODEL, vec.length, new Uint8Array(new Float32Array(vec).buffer), now, now);
}

describe('findSimilarKeywordsGroupedByCategory: 分類カテゴリごとに似たキーワードを列挙する', () => {
  it('デフォルト閾値は0.85（短いキーワード単位の埋め込みは異方性で類似度が高く出やすいため無関係な固有名詞同士を誤ってヒットさせないよう高めにしつつ、上げすぎて実際に近いキーワードまでヒットしなくなることも避ける）', async () => {
    const db = setupDb();
    insertEmbedding(db, 'u1', 'フランス', [1, 0]);
    insertEmbedding(db, 'u1', 'サンタ・マリア・ノヴェッラ駅', [0.75, Math.sqrt(1 - 0.75 * 0.75)]);
    insertEmbedding(db, 'u1', '仏国', [0.9, Math.sqrt(1 - 0.9 * 0.9)]);

    const result = await findSimilarKeywordsGroupedByCategory(wrapD1(db) as never, 'u1', 'フランス');

    const keywords = result.groups.flatMap((g) => g.items.map((i) => i.keyword));
    expect(keywords).toEqual(['仏国']);
  });

  it('似たキーワードを、それが属する中分類ごとにグルーピングして返す', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO aichat_keyword_categories (id, user_id, name) VALUES (1, 'u1', 'Travel')`).run();
    insertEmbedding(db, 'u1', '駅', [1, 0]);
    insertEmbedding(db, 'u1', '空港', [0.99, 0.01]);
    insertEmbedding(db, 'u1', '無関係', [0, 1]);
    db.prepare(`INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id) VALUES ('u1', '空港', 1)`).run();

    const result = await findSimilarKeywordsGroupedByCategory(wrapD1(db) as never, 'u1', '駅', 0.8, 10);

    expect(result.target).not.toBeNull();
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].categoryName).toBe('Travel');
    expect(result.groups[0].items.map((i) => i.keyword)).toEqual(['空港']);
    expect(result.groups[0].items[0].analysis.dim).toBe(2);
  });

  it('中分類に属さない似たキーワードは「未分類」グループに入る', async () => {
    const db = setupDb();
    insertEmbedding(db, 'u1', '駅', [1, 0]);
    insertEmbedding(db, 'u1', '停留所', [0.99, 0.01]);

    const result = await findSimilarKeywordsGroupedByCategory(wrapD1(db) as never, 'u1', '駅', 0.8, 10);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].categoryId).toBeNull();
    expect(result.groups[0].categoryName).toBe('未分類');
    expect(result.groups[0].items.map((i) => i.keyword)).toEqual(['停留所']);
  });

  it('複数の中分類に属するキーワードは両方のグループに列挙される', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO aichat_keyword_categories (id, user_id, name) VALUES (1, 'u1', 'Travel')`).run();
    db.prepare(`INSERT INTO aichat_keyword_categories (id, user_id, name) VALUES (2, 'u1', 'Infra')`).run();
    insertEmbedding(db, 'u1', '駅', [1, 0]);
    insertEmbedding(db, 'u1', '空港', [0.99, 0.01]);
    db.prepare(`INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id) VALUES ('u1', '空港', 1)`).run();
    db.prepare(`INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id) VALUES ('u1', '空港', 2)`).run();

    const result = await findSimilarKeywordsGroupedByCategory(wrapD1(db) as never, 'u1', '駅', 0.8, 10);

    const names = result.groups.map((g) => g.categoryName).sort();
    expect(names).toEqual(['Infra', 'Travel']);
  });

  it('対象キーワード自身は結果に含まれない', async () => {
    const db = setupDb();
    insertEmbedding(db, 'u1', '駅', [1, 0]);
    insertEmbedding(db, 'u1', '空港', [0.99, 0.01]);

    const result = await findSimilarKeywordsGroupedByCategory(wrapD1(db) as never, 'u1', '駅', 0.8, 10);
    const allKeywords = result.groups.flatMap((g) => g.items.map((i) => i.keyword));
    expect(allKeywords).not.toContain('駅');
  });

  it('閾値未満の無関係なキーワードは列挙しない', async () => {
    const db = setupDb();
    insertEmbedding(db, 'u1', '駅', [1, 0]);
    insertEmbedding(db, 'u1', '無関係', [0, 1]);

    const result = await findSimilarKeywordsGroupedByCategory(wrapD1(db) as never, 'u1', '駅', 0.8, 10);
    expect(result.groups).toEqual([]);
  });

  it('対象キーワードがキャッシュされていない場合はtarget=null・groups=[]を返す（例外を投げない）', async () => {
    const db = setupDb();
    const result = await findSimilarKeywordsGroupedByCategory(wrapD1(db) as never, 'u1', '未登録', 0.8, 10);
    expect(result.target).toBeNull();
    expect(result.groups).toEqual([]);
  });

  it('他ユーザーのキーワードは候補に混ざらない', async () => {
    const db = setupDb();
    insertEmbedding(db, 'u1', '駅', [1, 0]);
    insertEmbedding(db, 'u2', '空港', [0.99, 0.01]);

    const result = await findSimilarKeywordsGroupedByCategory(wrapD1(db) as never, 'u1', '駅', 0.8, 10);
    const allKeywords = result.groups.flatMap((g) => g.items.map((i) => i.keyword));
    expect(allKeywords).not.toContain('空港');
  });
});
