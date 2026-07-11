import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

// 対象: DELETE /api/heritage-area-boxes/:areaSeq
// 世界遺産ページのエリアタブで、保存済みエリアの行を右にスワイプして
// 表示される赤い削除ボタンをタップした際に呼ばれるエンドポイント。
// 故障シナリオ: (1) 他ユーザーのエリアを誤って削除できてしまう,
// (2) heritage_area_items(子テーブル)だけ消えてheritage_area_boxes(親)が
// 残る/その逆になる(SQLiteのFK ON DELETE CASCADEはPRAGMA未設定だと
// 効かないため、コード側で明示的に両方消す必要がある),
// (3) 存在しないarea_seqを指定してもエラーにならず404を返す。

interface D1Row {
  [key: string]: unknown;
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T = D1Row>(): Promise<T | null> {
              const row = stmt.get(...(args as never[])) as unknown as T | undefined;
              return row ?? null;
            },
            async all<T = D1Row>(): Promise<{ results?: T[] }> {
              const rows = stmt.all(...(args as never[])) as unknown as T[];
              return { results: rows };
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
    CREATE TABLE heritage_area_boxes (
      area_seq INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      box TEXT NOT NULL DEFAULT 'box'
    );
    CREATE TABLE heritage_area_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area_seq INTEGER NOT NULL,
      category TEXT NOT NULL,
      item_name TEXT NOT NULL
    );
  `);
  return db;
}

// src/index.ts の DELETE /api/heritage-area-boxes/:areaSeq と同一のロジック
async function deleteAreaBox(db: DatabaseSync, userId: string, areaSeq: number) {
  const real = wrapD1(db);
  if (!Number.isInteger(areaSeq) || areaSeq <= 0) return { status: 400 };
  const row = await real.prepare(
    'SELECT area_seq FROM heritage_area_boxes WHERE area_seq = ? AND user_id = ?'
  ).bind(areaSeq, userId).first<{ area_seq: number }>();
  if (!row) return { status: 404 };
  await real.prepare('DELETE FROM heritage_area_items WHERE area_seq = ?').bind(areaSeq).run();
  await real.prepare('DELETE FROM heritage_area_boxes WHERE area_seq = ? AND user_id = ?').bind(areaSeq, userId).run();
  return { status: 200 };
}

describe('DELETE /api/heritage-area-boxes/:areaSeq', () => {
  it('自分のエリアを削除するとheritage_area_boxesとheritage_area_itemsの両方から消える', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO heritage_area_boxes (area_seq, user_id, box) VALUES (1, 'user1', 'ミラノエリア')`).run();
    db.prepare(`INSERT INTO heritage_area_items (area_seq, category, item_name) VALUES (1, 'heritage-access', 'ミラノ大聖堂')`).run();

    const result = await deleteAreaBox(db, 'user1', 1);
    expect(result.status).toBe(200);

    const box = db.prepare('SELECT * FROM heritage_area_boxes WHERE area_seq = 1').get();
    const items = db.prepare('SELECT * FROM heritage_area_items WHERE area_seq = 1').all();
    expect(box).toBeUndefined();
    expect(items).toHaveLength(0);
  });

  it('他ユーザーのエリアは削除できない(404)しデータも残る', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO heritage_area_boxes (area_seq, user_id, box) VALUES (1, 'user1', 'ミラノエリア')`).run();

    const result = await deleteAreaBox(db, 'user2', 1);
    expect(result.status).toBe(404);

    const box = db.prepare('SELECT * FROM heritage_area_boxes WHERE area_seq = 1').get();
    expect(box).toBeDefined();
  });

  it('存在しないarea_seqを指定してもエラーにならず404を返す', async () => {
    const db = setupDb();
    const result = await deleteAreaBox(db, 'user1', 999);
    expect(result.status).toBe(404);
  });

  it('area_seqが不正な値(0以下)の場合は400を返す', async () => {
    const db = setupDb();
    const result = await deleteAreaBox(db, 'user1', 0);
    expect(result.status).toBe(400);
  });
});
