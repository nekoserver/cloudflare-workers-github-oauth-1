import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { registerOrGetAichatImage } from './index';

// 対象: registerOrGetAichatImage(src/index.ts)。AIチャットの画像添付投稿を
// 正規化テーブル aichat_images へ登録する処理。同一ユーザー内で内容
// (SHA-256の content_hash)が同じ画像を再登録しようとした場合、新規行を
// 作らず既存行のIDを返す(重複保存防止)ことを検証する。
//
// 故障シナリオ:
//   (1) 同一内容の画像を2回登録すると2行できてしまう(重複登録)
//   (2) 内容が違う画像なのに同じIDを返してしまう(誤った重複判定)
//   (3) 他ユーザーが同じ画像を送った場合に誤って同じ行(ID)を共有してしまう
//       (ユーザー間でデータが混ざる)
//   (4) 2回目以降の呼び出しでisNewがtrueのままになる(呼び出し元が「新規登録
//       された」と誤認識し、通知や集計が二重になる)

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
    CREATE TABLE aichat_images (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      image_data_url TEXT NOT NULL,
      byte_length INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX idx_aichat_images_user_hash ON aichat_images(user_id, content_hash);
  `);
  return db;
}

describe('registerOrGetAichatImage', () => {
  it('同一ユーザーが同一内容の画像を2回登録すると、2回目は既存IDを返し新規行を作らない', async () => {
    const db = setupDb();
    const wrapped = wrapD1(db) as unknown as D1Database;
    const dataUrl = 'data:image/png;base64,AAAA';

    const first = await registerOrGetAichatImage(wrapped, 'user1', dataUrl);
    expect(first.isNew).toBe(true);

    const second = await registerOrGetAichatImage(wrapped, 'user1', dataUrl);
    expect(second.isNew).toBe(false);
    expect(second.id).toBe(first.id);

    const count = db.prepare('SELECT COUNT(*) AS cnt FROM aichat_images').get() as { cnt: number };
    expect(count.cnt).toBe(1);
  });

  it('内容が異なる画像は別IDで登録される', async () => {
    const db = setupDb();
    const wrapped = wrapD1(db) as unknown as D1Database;

    const a = await registerOrGetAichatImage(wrapped, 'user1', 'data:image/png;base64,AAAA');
    const b = await registerOrGetAichatImage(wrapped, 'user1', 'data:image/png;base64,BBBB');
    expect(a.id).not.toBe(b.id);
    expect(a.isNew).toBe(true);
    expect(b.isNew).toBe(true);
  });

  it('別ユーザーが同一内容の画像を登録した場合は別IDになる(ユーザー間でデータを共有しない)', async () => {
    const db = setupDb();
    const wrapped = wrapD1(db) as unknown as D1Database;
    const dataUrl = 'data:image/png;base64,AAAA';

    const a = await registerOrGetAichatImage(wrapped, 'user1', dataUrl);
    const b = await registerOrGetAichatImage(wrapped, 'user2', dataUrl);
    expect(a.id).not.toBe(b.id);
    expect(a.isNew).toBe(true);
    expect(b.isNew).toBe(true);
  });

  it('登録した画像のimage_data_urlをそのまま保持する', async () => {
    const db = setupDb();
    const wrapped = wrapD1(db) as unknown as D1Database;
    const dataUrl = 'data:image/png;base64,CCCC';

    const { id } = await registerOrGetAichatImage(wrapped, 'user1', dataUrl);
    const row = db.prepare('SELECT image_data_url FROM aichat_images WHERE id = ?').get(id) as { image_data_url: string };
    expect(row.image_data_url).toBe(dataUrl);
  });
});
