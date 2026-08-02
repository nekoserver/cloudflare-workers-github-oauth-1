import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  computeCategoryCentroids,
  getOrComputeAnswerCategoryScores,
  enrichGraphWithCategoryColors,
  buildAnswerPropagationGraph,
  BGE_M3_MODEL,
} from './index';

// 対象: /answer-graph のノードを「旅行寄り」「コーディング寄り」のような
// カテゴリ類似度のブレンドで色分けするオーケストレーション層。
//
// 故障シナリオ:
//   (1) 回答ごとのスコア計算を毎回AIに問い合わせてしまう(キャッシュが効かない)
//   (2) キーワードが1つもcentroid計算に使えない中分類を候補に含めてしまう
//   (3) 中分類の数が変わった(新しいカテゴリが増えた)のに古いキャッシュを
//       そのまま返してしまい、新カテゴリが色分けに反映されない
//   (4) キーワードノードは中分類に直接紐付いているのに、わざわざAIで
//       再計算してしまう(不要なコスト)
//   (5) 他ユーザーのカテゴリ・キーワードが混入する

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

function wrapD1ThrowingOn(db: DatabaseSync, sqlSubstring: string) {
  const base = wrapD1(db);
  return {
    prepare(sql: string) {
      if (sql.indexOf(sqlSubstring) !== -1) {
        return {
          bind() {
            return {
              async first() { throw new Error('simulated DB failure: ' + sqlSubstring); },
              async all() { throw new Error('simulated DB failure: ' + sqlSubstring); },
              async run() { throw new Error('simulated DB failure: ' + sqlSubstring); },
            };
          },
        };
      }
      return base.prepare(sql);
    },
  };
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL,
      created_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE aichat_search_log (
      user_id TEXT NOT NULL, keyword TEXT NOT NULL, select_count INTEGER NOT NULL DEFAULT 1, last_searched_at TEXT NOT NULL
    );
    CREATE TABLE aichat_keyword_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE aichat_keyword_category_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, keyword TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE aichat_keyword_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, keyword TEXT NOT NULL, model TEXT NOT NULL,
      dim INTEGER NOT NULL, vector BLOB NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_embeddings_user_keyword ON aichat_keyword_embeddings(user_id, keyword);
    CREATE TABLE aichat_answer_category_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT, share_id TEXT NOT NULL, user_id TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES aichat_keyword_categories(id), score REAL NOT NULL,
      model TEXT NOT NULL, computed_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_answer_scores_unique ON aichat_answer_category_scores(user_id, share_id, category_id);
  `);
  return db;
}

function insertShare(db: DatabaseSync, id: string, userId: string, question: string, answer: string) {
  db.prepare(`INSERT INTO ai_chat_shares (id, user_id, question, answer, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, userId, question, answer, '2026-01-01T00:00:00.000Z');
}
function insertKeyword(db: DatabaseSync, userId: string, keyword: string) {
  db.prepare(`INSERT INTO aichat_search_log (user_id, keyword, select_count, last_searched_at) VALUES (?, ?, 1, ?)`)
    .run(userId, keyword, '2026-01-01T00:00:00.000Z');
}
function insertCategory(db: DatabaseSync, id: number, userId: string, name: string, color: string) {
  db.prepare(`INSERT INTO aichat_keyword_categories (id, user_id, name, color) VALUES (?, ?, ?, ?)`).run(id, userId, name, color);
}
function insertMap(db: DatabaseSync, userId: string, keyword: string, categoryId: number) {
  db.prepare(`INSERT INTO aichat_keyword_category_map (user_id, keyword, category_id) VALUES (?, ?, ?)`).run(userId, keyword, categoryId);
}

function makeMockAi(vectorByText: Record<string, number[]>) {
  return {
    run: vi.fn(async (_model: unknown, params: { text: string[] }) => {
      const t = params.text[0];
      return { data: [vectorByText[t] ?? [0, 0]] };
    }),
  };
}

describe('computeCategoryCentroids: 中分類ごとの代表ベクトル', () => {
  it('カテゴリに紐づくキーワードの埋め込みを平均してcentroidを作る', async () => {
    const db = setupDb();
    insertCategory(db, 1, 'u1', 'Travel', '#3b82f6');
    insertMap(db, 'u1', '駅', 1);
    insertMap(db, 'u1', '空港', 1);
    const ai = makeMockAi({ '駅': [1, 0], '空港': [0, 1] });

    const centroids = await computeCategoryCentroids(wrapD1(db) as never, ai as never, 'u1');

    expect(centroids).toHaveLength(1);
    expect(centroids[0].name).toBe('Travel');
    expect(centroids[0].vector).toEqual([0.5, 0.5]);
  });

  it('キーワードが1件も無い中分類は候補から除外する', async () => {
    const db = setupDb();
    insertCategory(db, 1, 'u1', 'Empty', '#000000');
    const ai = makeMockAi({});

    const centroids = await computeCategoryCentroids(wrapD1(db) as never, ai as never, 'u1');

    expect(centroids).toEqual([]);
  });

  it('他ユーザーのカテゴリ・キーワードは混入しない', async () => {
    const db = setupDb();
    insertCategory(db, 1, 'u2', 'OtherUserCat', '#000000');
    insertMap(db, 'u2', '無関係', 1);
    const ai = makeMockAi({ '無関係': [1, 1] });

    const centroids = await computeCategoryCentroids(wrapD1(db) as never, ai as never, 'u1');

    expect(centroids).toEqual([]);
  });
});

describe('getOrComputeAnswerCategoryScores: 回答ごとのカテゴリスコア(キャッシュ付き)', () => {
  it('回答文に含まれるキーワードからスコアを計算しキャッシュへ保存する', async () => {
    const db = setupDb();
    insertCategory(db, 1, 'u1', 'Travel', '#3b82f6');
    const ai = makeMockAi({ '駅': [1, 0] });
    const centroids = [{ categoryId: 1, name: 'Travel', color: '#3b82f6', vector: [1, 0] }];

    const scores = await getOrComputeAnswerCategoryScores(
      wrapD1(db) as never, ai as never, 'u1', 's1', '駅について教えて', centroids, ['駅']
    );

    expect(scores).toHaveLength(1);
    expect(scores[0].score).toBeCloseTo(1, 6);
    const row = db.prepare('SELECT score, model FROM aichat_answer_category_scores WHERE user_id = ? AND share_id = ?').get('u1', 's1') as { score: number; model: string };
    expect(row.score).toBeCloseTo(1, 6);
    expect(row.model).toBe(BGE_M3_MODEL);
  });

  it('同一カテゴリ数でキャッシュ済みなら再計算せずキャッシュを返す', async () => {
    const db = setupDb();
    insertCategory(db, 1, 'u1', 'Travel', '#3b82f6');
    const ai = makeMockAi({ '駅': [1, 0] });
    const centroids = [{ categoryId: 1, name: 'Travel', color: '#3b82f6', vector: [1, 0] }];

    await getOrComputeAnswerCategoryScores(wrapD1(db) as never, ai as never, 'u1', 's1', '駅について', centroids, ['駅']);
    ai.run.mockClear();
    const scores = await getOrComputeAnswerCategoryScores(wrapD1(db) as never, ai as never, 'u1', 's1', '駅について', centroids, ['駅']);

    expect(scores).toHaveLength(1);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('中分類の数が変わっていたら(新カテゴリ追加等)キャッシュを使わず再計算する', async () => {
    const db = setupDb();
    insertCategory(db, 1, 'u1', 'Travel', '#3b82f6');
    insertCategory(db, 2, 'u1', 'Coding', '#22c55e');
    const ai = makeMockAi({ '駅': [1, 0] });
    const centroids1 = [{ categoryId: 1, name: 'Travel', color: '#3b82f6', vector: [1, 0] }];
    await getOrComputeAnswerCategoryScores(wrapD1(db) as never, ai as never, 'u1', 's1', '駅について', centroids1, ['駅']);

    const centroids2 = [
      { categoryId: 1, name: 'Travel', color: '#3b82f6', vector: [1, 0] },
      { categoryId: 2, name: 'Coding', color: '#22c55e', vector: [0, 1] },
    ];
    const scores = await getOrComputeAnswerCategoryScores(wrapD1(db) as never, ai as never, 'u1', 's1', '駅について', centroids2, ['駅']);

    expect(scores).toHaveLength(2);
  });

  it('回答文に登録済みキーワードが含まれなければ空配列を返す(AIを呼ばない)', async () => {
    const db = setupDb();
    const ai = makeMockAi({});
    const scores = await getOrComputeAnswerCategoryScores(wrapD1(db) as never, ai as never, 'u1', 's1', '無関係な文章', [], ['駅']);
    expect(scores).toEqual([]);
    expect(ai.run).not.toHaveBeenCalled();
  });
});

describe('enrichGraphWithCategoryColors: グラフノードへの色付け', () => {
  it('キーワードノードは既存の分類マップから直接色を得て、回答ノードはスコアブレンド色を得る', async () => {
    const db = setupDb();
    insertCategory(db, 1, 'u1', 'Travel', '#3b82f6');
    insertMap(db, 'u1', '駅', 1);
    insertKeyword(db, 'u1', '駅');
    insertShare(db, 's1', 'u1', '駅について', '駅の話です');
    insertShare(db, 's2', 'u1', '駅の近く', '駅周辺の話です');
    const ai = makeMockAi({ '駅': [1, 0] });

    const graph = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');
    expect(graph).not.toBeNull();

    const enriched = await enrichGraphWithCategoryColors(wrapD1(db) as never, ai as never, 'u1', graph!);

    const kwNode = enriched.nodes.find((n) => n.type === 'keyword')!;
    expect(kwNode.color).toBe('#3b82f6');
    expect(kwNode.dominantCategory).toBe('Travel');

    const answerNode = enriched.nodes.find((n) => n.id === 'a:s2')!;
    expect(answerNode.color).toBe('#3b82f6');
    expect(answerNode.dominantCategory).toBe('Travel');
  });

  it('回帰: 埋め込み計算が全て失敗しcentroidsが空になっても、キーワードノードの色付けは独立して行われる', async () => {
    const db = setupDb();
    insertCategory(db, 1, 'u1', 'Travel', '#3b82f6');
    insertMap(db, 'u1', '駅', 1);
    insertKeyword(db, 'u1', '駅');
    insertShare(db, 's1', 'u1', '駅について', '駅の話です');
    insertShare(db, 's2', 'u1', '駅の近く', '駅周辺の話です');
    // 埋め込み計算が全て失敗する状況を再現(bge-m3が空データを返す)
    const ai = { run: vi.fn(async () => ({ data: [] })) };

    const graph = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');
    const enriched = await enrichGraphWithCategoryColors(wrapD1(db) as never, ai as never, 'u1', graph!);

    const kwNode = enriched.nodes.find((n) => n.type === 'keyword')!;
    expect(kwNode.color).toBe('#3b82f6');
    expect(kwNode.dominantCategory).toBe('Travel');

    const answerNode = enriched.nodes.find((n) => n.id === 'a:s2')!;
    expect(answerNode.color).toBeUndefined();
  });

  it('回帰: computeCategoryCentroidsが例外を投げても(DB異常等)、キーワードノードの色付けは独立して行われる', async () => {
    const db = setupDb();
    insertCategory(db, 1, 'u1', 'Travel', '#3b82f6');
    insertMap(db, 'u1', '駅', 1);
    insertKeyword(db, 'u1', '駅');
    insertShare(db, 's1', 'u1', '駅について', '駅の話です');
    const ai = makeMockAi({ '駅': [1, 0] });

    const graph = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');
    // computeCategoryCentroids の最初のクエリ(中分類一覧取得)だけを失敗させる
    const throwingDb = wrapD1ThrowingOn(db, 'SELECT id, name, color FROM aichat_keyword_categories');
    const enriched = await enrichGraphWithCategoryColors(throwingDb as never, ai as never, 'u1', graph!);

    const kwNode = enriched.nodes.find((n) => n.type === 'keyword')!;
    expect(kwNode.color).toBe('#3b82f6');
    expect(kwNode.dominantCategory).toBe('Travel');
  });

  it('中分類が1件も無ければ色を付けずグラフをそのまま返す', async () => {
    const db = setupDb();
    insertKeyword(db, 'u1', '駅');
    insertShare(db, 's1', 'u1', '駅について', '駅の話です');
    const ai = makeMockAi({ '駅': [1, 0] });

    const graph = await buildAnswerPropagationGraph(wrapD1(db) as never, 'u1', 's1');
    const enriched = await enrichGraphWithCategoryColors(wrapD1(db) as never, ai as never, 'u1', graph!);

    expect(enriched).toEqual(graph);
  });
});
