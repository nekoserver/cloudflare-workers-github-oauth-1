import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { getOrComputeKeywordEmbedding, BGE_M3_MODEL } from './index';

// 対象: getOrComputeKeywordEmbedding（aichat_keyword_embeddingsの読み書き）。
// 「実際の問い合わせとキャッシュの有無による挙動の変化」を吸収し、呼び出し側
// からはキャッシュヒットかどうかを意識させない設計にする、という方針の実装。
//
// 故障シナリオ:
//   (1) キャッシュ済みなのに毎回AIを呼んでしまう（コスト増・レイテンシ増）
//   (2) モデルバージョンが変わったのに古いベクトルを使い続けてしまう
//   (3) 新規キーワードでAI呼び出しが失敗した際に例外を伝播させず、
//       握りつぶして空配列などにフォールバックできない
//   (4) 他ユーザー・他キーワードのキャッシュを誤って参照/上書きする

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
  `);
  return db;
}

function makeMockAi(vector: number[]) {
  return { run: vi.fn().mockResolvedValue({ data: [vector] }) };
}

describe('getOrComputeKeywordEmbedding: bge-m3埋め込みのキャッシュ', () => {
  it('未キャッシュの場合はAIを呼び、結果をDBへ保存して返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([1, 2, 3]);

    const vector = await getOrComputeKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', '駅');

    expect(vector).toEqual([1, 2, 3]);
    expect(ai.run).toHaveBeenCalledTimes(1);
    const row = db.prepare('SELECT model, dim FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ?').get('u1', '駅') as { model: string; dim: number };
    expect(row.model).toBe(BGE_M3_MODEL);
    expect(row.dim).toBe(3);
  });

  it('同一モデルでキャッシュ済みの場合はAIを呼ばずキャッシュを返す', async () => {
    const db = setupDb();
    const ai = makeMockAi([9, 9, 9]);

    await getOrComputeKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', '駅');
    ai.run.mockClear();
    const vector = await getOrComputeKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', '駅');

    expect(vector).toEqual([9, 9, 9]);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('モデルが変わっていた場合は強制的に再計算し、既存行を上書きする（重複行を作らない）', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '駅', '@cf/baai/old-model', 2, new Uint8Array(new Float32Array([0, 0]).buffer), now, now);
    const ai = makeMockAi([5, 6]);

    const vector = await getOrComputeKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', '駅');

    expect(vector).toEqual([5, 6]);
    expect(ai.run).toHaveBeenCalledTimes(1);
    const rows = db.prepare('SELECT model FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ?').all('u1', '駅') as { model: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].model).toBe(BGE_M3_MODEL);
  });

  it('他ユーザー・他キーワードのキャッシュは参照しない', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('u2', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 1]).buffer), now, now);
    const ai = makeMockAi([7, 7]);

    const vector = await getOrComputeKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', '駅');

    expect(vector).toEqual([7, 7]);
    expect(ai.run).toHaveBeenCalledTimes(1);
  });

  it('AIが空配列を返した場合は空配列を返し、DBへは保存しない（不正な0次元ベクトルを永続化しない）', async () => {
    const db = setupDb();
    const ai = { run: vi.fn().mockResolvedValue({ data: [] }) };

    const vector = await getOrComputeKeywordEmbedding(wrapD1(db) as never, ai as never, 'u1', '駅');

    expect(vector).toEqual([]);
    const row = db.prepare('SELECT * FROM aichat_keyword_embeddings WHERE user_id = ? AND keyword = ?').get('u1', '駅');
    expect(row).toBeUndefined();
  });
});
