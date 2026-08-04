import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  registerKeywordEmbeddings,
  listKeywordEmbeddingsOverview,
  resolveKeywordEmbeddingModel,
  getOrComputeKeywordEmbeddingForModel,
  BGE_M3_MODEL,
  PLAMO_EMBEDDING_MODEL,
} from './index';

// 対象:
//   AIチャットのZTモーダル「🗒️ 問い合わせデータ」で、埋め込みモデルを
//   bge-m3 / plamo-embedding-1b(@cf/pfnet/plamo-embedding-1b) から選べるように
//   したドロップダウンが、実際の問い合わせコードを動的に切り替えて実行すること。
//   また選択したモデルのデータが aichat_keyword_embeddings の追加カラム
//   (plamo_vector/plamo_dim/plamo_updated_at)へ書き足されること。
//   さらに📖アイコン(ZTモーダルヘッダ)から開く一覧が、ベクタ化済みキーワードと
//   使用モデル(nullはbge-m3で補完)を列挙すること。
//
// 故障シナリオ:
//   (1) ドロップダウンでplamoを選んでも実際にはbge-m3のコードパスのまま
//       問い合わせてしまう(モデルが動的に切り替わらない)
//   (2) plamoで登録すると既存のbge-m3の列(model/dim/vector)が上書き・破壊される
//   (3) plamoの登録結果がキャッシュされず、毎回AIを呼んでしまう
//   (4) 未対応のモデル名を渡すとエラーになる、または不正なモデルのまま
//       問い合わせてしまう(bge-m3へのフォールバックが効かない)
//   (5) 一覧取得でmodelがnullの行が「bge-m3」に補完されない
//   (6) 一覧にplamoの列が正しく含まれない(あるいはbge-m3しか登録していない
//       行にまでplamo情報が出てしまう)
//   (7) plamo追加カラムに記録されているモデルが、いま要求されたモデルと
//       食い違っている(例: 将来別の第3モデルがこの列を使った後で
//       plamo-embedding-1bが要求された)のに、dim/vectorが入っているというだけで
//       キャッシュ命中とみなして古い・別モデルのベクトルを返してしまう
//   (8) 一覧をsource='zt_manual'だけに絞り込むと、この列の追加より前に
//       登録されていた(source未設定の)実データや、answer-graphの色分け・
//       AI分類提案が自動的にベクタ化したデータまで一覧から消えてしまい、
//       「あるはずのデータが表示されない」regressionになる。一覧はデータを
//       隠さず、sourceの値をそのまま返してクライアント側で判別できることを
//       保証する

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
      updated_at TEXT NOT NULL,
      plamo_vector BLOB,
      plamo_dim INTEGER,
      plamo_model TEXT,
      plamo_updated_at TEXT,
      source TEXT
    );
    CREATE UNIQUE INDEX idx_aichat_keyword_embeddings_user_keyword ON aichat_keyword_embeddings(user_id, keyword);
  `);
  return db;
}

function makeMockAi(vectorByModelAndText: Record<string, Record<string, number[]>>) {
  return {
    run: vi.fn(async (model: unknown, params: { text: string[] }) => {
      const t = params.text[0];
      const byText = vectorByModelAndText[model as string];
      if (!byText || !(t in byText)) throw new Error('unexpected model/text: ' + model + '/' + t);
      const v = byText[t];
      if (!v) return { data: [] };
      return { data: [v] };
    }),
  };
}

describe('resolveKeywordEmbeddingModel: サポート対象モデルの解決', () => {
  it('bge-m3はそのまま返す', () => {
    expect(resolveKeywordEmbeddingModel(BGE_M3_MODEL)).toBe(BGE_M3_MODEL);
  });

  it('plamo-embedding-1bはそのまま返す', () => {
    expect(resolveKeywordEmbeddingModel(PLAMO_EMBEDDING_MODEL)).toBe(PLAMO_EMBEDDING_MODEL);
  });

  it('null/undefined/未対応の文字列はbge-m3にフォールバックする', () => {
    expect(resolveKeywordEmbeddingModel(null)).toBe(BGE_M3_MODEL);
    expect(resolveKeywordEmbeddingModel(undefined)).toBe(BGE_M3_MODEL);
    expect(resolveKeywordEmbeddingModel('@cf/unknown/model')).toBe(BGE_M3_MODEL);
  });
});

describe('getOrComputeKeywordEmbeddingForModel: モデル切り替えによる問い合わせ先の動的変更', () => {
  it('bge-m3を指定すると従来通りmodel/dim/vector列に書き込む', async () => {
    const db = setupDb();
    const ai = makeMockAi({ [BGE_M3_MODEL]: { '駅': [1, 2] } });

    const vector = await getOrComputeKeywordEmbeddingForModel(wrapD1(db) as never, ai as never, 'u1', '駅', BGE_M3_MODEL);

    expect(vector).toEqual([1, 2]);
    const row = db.prepare(`SELECT model, dim, plamo_dim, source FROM aichat_keyword_embeddings WHERE user_id='u1' AND keyword='駅'`).get() as { model: string; dim: number; plamo_dim: number | null; source: string };
    expect(row.model).toBe(BGE_M3_MODEL);
    expect(row.dim).toBe(2);
    expect(row.plamo_dim).toBeNull();
    // ZTモーダル経由の登録であることを一覧側が判定できるよう'zt_manual'を記録する
    expect(row.source).toBe('zt_manual');
  });

  it('plamo-embedding-1bを指定するとplamo_vector/plamo_dim列に書き込み、既存のbge-m3列は破壊しない', async () => {
    const db = setupDb();
    const ai = makeMockAi({
      [BGE_M3_MODEL]: { '駅': [1, 2] },
      [PLAMO_EMBEDDING_MODEL]: { '駅': [9, 8, 7] },
    });

    // 先にbge-m3で登録済み
    await getOrComputeKeywordEmbeddingForModel(wrapD1(db) as never, ai as never, 'u1', '駅', BGE_M3_MODEL);
    const vector = await getOrComputeKeywordEmbeddingForModel(wrapD1(db) as never, ai as never, 'u1', '駅', PLAMO_EMBEDDING_MODEL);

    expect(vector).toEqual([9, 8, 7]);
    const row = db.prepare(`SELECT model, dim, plamo_dim, plamo_model FROM aichat_keyword_embeddings WHERE user_id='u1' AND keyword='駅'`).get() as { model: string; dim: number; plamo_dim: number; plamo_model: string };
    expect(row.model).toBe(BGE_M3_MODEL);
    expect(row.dim).toBe(2);
    expect(row.plamo_dim).toBe(3);
    expect(row.plamo_model).toBe(PLAMO_EMBEDDING_MODEL);
  });

  it('plamoで新規キーワードを登録する場合、bge-m3側の行も自動的に作成される(NOT NULL制約を満たす)', async () => {
    const db = setupDb();
    const ai = makeMockAi({
      [BGE_M3_MODEL]: { '空港': [1, 1] },
      [PLAMO_EMBEDDING_MODEL]: { '空港': [5, 5, 5] },
    });

    const vector = await getOrComputeKeywordEmbeddingForModel(wrapD1(db) as never, ai as never, 'u1', '空港', PLAMO_EMBEDDING_MODEL);

    expect(vector).toEqual([5, 5, 5]);
    const row = db.prepare(`SELECT model, dim, plamo_dim FROM aichat_keyword_embeddings WHERE user_id='u1' AND keyword='空港'`).get() as { model: string; dim: number; plamo_dim: number };
    expect(row.model).toBe(BGE_M3_MODEL);
    expect(row.dim).toBe(2);
    expect(row.plamo_dim).toBe(3);
  });

  it('plamoの結果が要求モデルと一致するキャッシュならAIを呼ばない', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, plamo_vector, plamo_dim, plamo_model, plamo_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now, new Uint8Array(new Float32Array([9, 9, 9]).buffer), 3, PLAMO_EMBEDDING_MODEL, now);
    const ai = makeMockAi({});

    const vector = await getOrComputeKeywordEmbeddingForModel(wrapD1(db) as never, ai as never, 'u1', '駅', PLAMO_EMBEDDING_MODEL);

    expect(vector).toEqual([9, 9, 9]);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('plamoが既にキャッシュ済み(かつ要求モデルと一致)でも、ZTモーダルからの明示登録ならsource列を"zt_manual"に更新する', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, plamo_vector, plamo_dim, plamo_model, plamo_updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now, new Uint8Array(new Float32Array([9, 9, 9]).buffer), 3, PLAMO_EMBEDDING_MODEL, now, 'answer_graph_color');
    const ai = makeMockAi({});

    const vector = await getOrComputeKeywordEmbeddingForModel(wrapD1(db) as never, ai as never, 'u1', '駅', PLAMO_EMBEDDING_MODEL);

    expect(vector).toEqual([9, 9, 9]);
    expect(ai.run).not.toHaveBeenCalled();
    const row = db.prepare(`SELECT source FROM aichat_keyword_embeddings WHERE user_id='u1' AND keyword='駅'`).get() as { source: string };
    expect(row.source).toBe('zt_manual');
  });

  it('plamo追加カラムに記録済みのモデルが要求モデルと食い違う場合はキャッシュを使わず再問い合わせして上書きする', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    // plamo追加カラムに別モデル("旧モデル")の結果が入っている状態を再現する
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, plamo_vector, plamo_dim, plamo_model, plamo_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now, new Uint8Array(new Float32Array([1, 1, 1]).buffer), 3, '@cf/other/old-model', now);
    const ai = makeMockAi({ [PLAMO_EMBEDDING_MODEL]: { '駅': [4, 4, 4, 4] } });

    const vector = await getOrComputeKeywordEmbeddingForModel(wrapD1(db) as never, ai as never, 'u1', '駅', PLAMO_EMBEDDING_MODEL);

    expect(vector).toEqual([4, 4, 4, 4]);
    expect(ai.run).toHaveBeenCalledTimes(1);
    const row = db.prepare(`SELECT plamo_model, plamo_dim FROM aichat_keyword_embeddings WHERE user_id='u1' AND keyword='駅'`).get() as { plamo_model: string; plamo_dim: number };
    expect(row.plamo_model).toBe(PLAMO_EMBEDDING_MODEL);
    expect(row.plamo_dim).toBe(4);
  });
});

describe('registerKeywordEmbeddings: modelパラメータで問い合わせ先が動的に切り替わる', () => {
  it('modelを省略すると従来通りbge-m3で登録される', async () => {
    const db = setupDb();
    const ai = makeMockAi({ [BGE_M3_MODEL]: { '駅': [1, 2] } });

    const result = await registerKeywordEmbeddings(wrapD1(db) as never, ai as never, 'u1', ['駅']);

    expect(result).toEqual({ registered: 1, failed: 0, results: [{ keyword: '駅', ok: true, dim: 2 }] });
  });

  it('model=plamo-embedding-1bを指定すると実際にplamoへ問い合わせる(bge-m3へは問い合わせない)', async () => {
    const db = setupDb();
    const ai = makeMockAi({
      [BGE_M3_MODEL]: { '駅': [1, 2] },
      [PLAMO_EMBEDDING_MODEL]: { '駅': [9, 8, 7] },
    });

    const result = await registerKeywordEmbeddings(wrapD1(db) as never, ai as never, 'u1', ['駅'], PLAMO_EMBEDDING_MODEL);

    expect(result).toEqual({ registered: 1, failed: 0, results: [{ keyword: '駅', ok: true, dim: 3 }] });
    expect(ai.run).toHaveBeenCalledWith(PLAMO_EMBEDDING_MODEL, { text: ['駅'] });
  });
});

describe('listKeywordEmbeddingsOverview: 📖アイコンで開くベクタ化済みデータ一覧', () => {
  it('modelが空文字/未設定相当の行はbge-m3で補完される', async () => {
    // 実テーブルはmodel列がNOT NULLだが、将来の欠損データに備えて
    // listKeywordEmbeddingsOverview側は「値が無ければbge-m3」という
    // 防御的フォールバックを持つ。ここでは空文字で欠損状態を再現する。
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, source) VALUES (?, ?, '', ?, ?, ?, ?, 'zt_manual')`
    ).run('u1', '駅', 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now);

    const items = await listKeywordEmbeddingsOverview(wrapD1(db) as never, 'u1');

    expect(items).toHaveLength(1);
    expect(items[0].model).toBe(BGE_M3_MODEL);
    expect(items[0].plamoModel).toBeNull();
  });

  it('plamo_modelが記録されている行はそのモデル名をそのままplamoModelとして返す(推測しない)', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, plamo_dim, plamo_model, plamo_updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'zt_manual')`
    ).run('u1', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now, 3, PLAMO_EMBEDDING_MODEL, now);

    const items = await listKeywordEmbeddingsOverview(wrapD1(db) as never, 'u1');

    expect(items[0].plamoModel).toBe(PLAMO_EMBEDDING_MODEL);
    expect(items[0].plamoDim).toBe(3);
  });

  it('plamo_dimが無ければplamoModel/plamoDimはnullのまま(混入しない)', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'zt_manual')`
    ).run('u1', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now);

    const items = await listKeywordEmbeddingsOverview(wrapD1(db) as never, 'u1');

    expect(items[0].plamoModel).toBeNull();
    expect(items[0].plamoDim).toBeNull();
  });

  it('plamo_dimはあるがplamo_modelが未設定(欠損データ)の行はplamo-embedding-1bへ防御的にフォールバックする', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, plamo_dim, plamo_updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'zt_manual')`
    ).run('u1', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now, 3, now);

    const items = await listKeywordEmbeddingsOverview(wrapD1(db) as never, 'u1');

    expect(items[0].plamoModel).toBe(PLAMO_EMBEDDING_MODEL);
  });

  it('他ユーザーのデータは一覧に含まれない', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'zt_manual')`
    ).run('u2', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now);

    const items = await listKeywordEmbeddingsOverview(wrapD1(db) as never, 'u1');

    expect(items).toEqual([]);
  });

  it('answer-graphの色分けやキーワード分類のAI推薦など、ZTモーダル以外が自動的にベクタ化した行も一覧に含まれ、sourceでどの経路か判別できる(データを隠さない)', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '実装', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now, 'answer_graph_color');
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '例外', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([3, 4]).buffer), now, now, 'category_suggest');
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', 'Hono', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([5, 6]).buffer), now, now, 'zt_manual');

    const items = await listKeywordEmbeddingsOverview(wrapD1(db) as never, 'u1');

    const bySource = Object.fromEntries(items.map((it) => [it.keyword, it.source]));
    expect(bySource).toEqual({ '実装': 'answer_graph_color', '例外': 'category_suggest', 'Hono': 'zt_manual' });
  });

  it('この機能の移行前(source未設定)の行も一覧から消えず、source="unknown"として返る(実際に登録したデータを隠さない)', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '旧データ', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 2]).buffer), now, now);

    const items = await listKeywordEmbeddingsOverview(wrapD1(db) as never, 'u1');

    expect(items).toHaveLength(1);
    expect(items[0].keyword).toBe('旧データ');
    expect(items[0].source).toBe('unknown');
  });
});
