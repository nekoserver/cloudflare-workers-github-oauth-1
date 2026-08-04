import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { registerKeywordEmbeddings, lookupKeywordEmbedding, BGE_M3_MODEL } from './index';

// 対象:
//   (1) bge-m3問い合わせデータモーダルの「登録する」ボタンが呼ぶ
//       registerKeywordEmbeddings（実際にbge-m3へ問い合わせてDBへ保存する）
//   (2) Zanzibarツリーの検索窓で入力したキーワードのキャッシュ有無を返す
//       lookupKeywordEmbedding（📖アイコンの表示判定・キャッシュ内容表示に使う）
//
// 故障シナリオ:
//   (1) texts配列に重複や空文字が混ざっていて、同じキーワードに何度もAIを呼ぶ
//   (2) 1件のAI呼び出し失敗が他の正常なキーワードの登録まで巻き込んで止める
//   (3) lookupで他ユーザーのキャッシュを誤って参照する
//   (4) lookupの結果にベクトル全体をそのまま返し、レスポンスが肥大化する
//       （プレビューのみ返すべき）

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
      source TEXT
    );
    CREATE UNIQUE INDEX idx_aichat_keyword_embeddings_user_keyword ON aichat_keyword_embeddings(user_id, keyword);
  `);
  return db;
}

function makeMockAi(vectorByText: Record<string, number[]>) {
  return {
    run: vi.fn(async (_model: unknown, params: { text: string[] }) => {
      const t = params.text[0];
      if (!(t in vectorByText)) throw new Error('unexpected text: ' + t);
      const v = vectorByText[t];
      if (!v) return { data: [] };
      return { data: [v] };
    }),
  };
}

describe('registerKeywordEmbeddings: bge-m3問い合わせデータの「登録する」ボタン', () => {
  it('未登録のtextsをすべてAIへ問い合わせてDBへ保存する', async () => {
    const db = setupDb();
    const ai = makeMockAi({ '駅': [1, 2], '空港': [3, 4] });

    const result = await registerKeywordEmbeddings(wrapD1(db) as never, ai as never, 'u1', ['駅', '空港']);

    expect(result).toEqual({ registered: 2, failed: 0, results: [
      { keyword: '駅', ok: true, dim: 2 },
      { keyword: '空港', ok: true, dim: 2 },
    ] });
    expect(ai.run).toHaveBeenCalledTimes(2);
  });

  it('重複・空文字は1回に正規化してから処理する', async () => {
    const db = setupDb();
    const ai = makeMockAi({ '駅': [1, 2] });

    const result = await registerKeywordEmbeddings(wrapD1(db) as never, ai as never, 'u1', ['駅', '駅', '  ', '']);

    expect(result.results).toEqual([{ keyword: '駅', ok: true, dim: 2 }]);
    expect(ai.run).toHaveBeenCalledTimes(1);
  });

  it('既にキャッシュ済みのキーワードはAIを呼ばずスキップしてokを返す', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([9, 9]).buffer), now, now);
    const ai = makeMockAi({});

    const result = await registerKeywordEmbeddings(wrapD1(db) as never, ai as never, 'u1', ['駅']);

    expect(result).toEqual({ registered: 1, failed: 0, results: [{ keyword: '駅', ok: true, dim: 2 }] });
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('1件のAI失敗が他の正常なキーワードの登録を止めない', async () => {
    const db = setupDb();
    const ai = makeMockAi({ '駅': [], '空港': [3, 4] });

    const result = await registerKeywordEmbeddings(wrapD1(db) as never, ai as never, 'u1', ['駅', '空港']);

    expect(result).toEqual({ registered: 1, failed: 1, results: [
      { keyword: '駅', ok: false, dim: 0 },
      { keyword: '空港', ok: true, dim: 2 },
    ] });
  });
});

describe('lookupKeywordEmbedding: Zanzibarツリー検索窓のキャッシュ有無判定', () => {
  it('キャッシュがあれば keyword/model/dim/日時/プレビュー/分析結果を返す', async () => {
    const db = setupDb();
    const now = '2026-08-01T00:00:00.000Z';
    const vec = [0.1, 0.2, 0.3, 0.4];
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '駅', BGE_M3_MODEL, 4, new Uint8Array(new Float32Array(vec).buffer), now, now);

    const info = await lookupKeywordEmbedding(wrapD1(db) as never, 'u1', '駅');

    expect(info).not.toBeNull();
    expect(info!.keyword).toBe('駅');
    expect(info!.model).toBe(BGE_M3_MODEL);
    expect(info!.dim).toBe(4);
    expect(info!.createdAt).toBe(now);
    expect(info!.updatedAt).toBe(now);
    info!.preview.forEach((v, i) => expect(v).toBeCloseTo(vec[i], 5));
    expect(info!.analysis.dim).toBe(4);
    expect(info!.analysis.min).toBeCloseTo(0.1, 5);
    expect(info!.analysis.max).toBeCloseTo(0.4, 5);
  });

  it('プレビューは先頭12件までに切り詰める（レスポンス肥大化防止）', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    const vec = Array.from({ length: 1024 }, (_, i) => i);
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('u1', '駅', BGE_M3_MODEL, 1024, new Uint8Array(new Float32Array(vec).buffer), now, now);

    const info = await lookupKeywordEmbedding(wrapD1(db) as never, 'u1', '駅');

    expect(info!.preview).toHaveLength(12);
    expect(info!.dim).toBe(1024);
  });

  it('キャッシュが無ければ null を返す', async () => {
    const db = setupDb();
    const info = await lookupKeywordEmbedding(wrapD1(db) as never, 'u1', '駅');
    expect(info).toBeNull();
  });

  it('他ユーザーのキャッシュは参照しない', async () => {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO aichat_keyword_embeddings (user_id, keyword, model, dim, vector, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('u2', '駅', BGE_M3_MODEL, 2, new Uint8Array(new Float32Array([1, 1]).buffer), now, now);

    const info = await lookupKeywordEmbedding(wrapD1(db) as never, 'u1', '駅');
    expect(info).toBeNull();
  });
});
