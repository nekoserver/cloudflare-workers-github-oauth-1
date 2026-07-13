import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

// 対象: GET /api/heritage-area/max-area-seq と GET /api/heritage-area/areas/:areaSeq/items。
// heritage-areaページで「カテゴリ選択…」(未選択)状態でもエリア番号ヘッダをタップすると
// そのエリアに属する世界遺産名ほかを直接一覧表示できるようにするための2つの新規エンドポイント。
// 故障シナリオ:
// (1) 他ユーザーの保存エリアの最大エリア番号・アイテムを誤って参照してしまう
// (2) area_seqが未保存(0件)の場合にMAX()がnullを返しクライアントで数値でなくなる
// (3) 同じitem_nameが複数のエリアに登録されている場合に一部のエリア番号しか返さない

interface D1Row { [key: string]: unknown; }

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

// src/index.ts の GET /api/heritage-area/max-area-seq と同一のロジック
async function getMaxAreaSeq(db: ReturnType<typeof wrapD1>, userId: string) {
  const row = await db.prepare('SELECT MAX(area_seq) AS maxSeq FROM heritage_area_boxes WHERE user_id = ?').bind(userId).first<{ maxSeq: number | null }>();
  return { max: Number(row?.maxSeq ?? 0) || 0 };
}

// src/index.ts の GET /api/heritage-area/areas/:areaSeq/items と同一のロジック
async function getAreaItems(db: ReturnType<typeof wrapD1>, userId: string, areaSeq: number) {
  if (!Number.isInteger(areaSeq) || areaSeq <= 0) return { status: 400 as const };
  const nameRows = await db.prepare(
    `SELECT DISTINCT i.item_name AS item_name
     FROM heritage_area_items i
     JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ?
     WHERE i.area_seq = ?
     ORDER BY i.item_name ASC
     LIMIT 500`
  ).bind(userId, areaSeq).all<{ item_name: string }>();
  const names = (nameRows.results ?? []).map((r) => r.item_name);
  if (!names.length) return { status: 200 as const, items: [] as Array<{ item_name: string; category: string; area_matches: { key: string; areas: string }[] }> };
  const areaLookup = db.prepare(
    `SELECT i.area_seq AS area_seq
     FROM heritage_area_items i
     JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ?
     WHERE i.item_name = ?
     ORDER BY i.area_seq ASC`
  );
  const items: Array<{ item_name: string; category: string; area_matches: { key: string; areas: string }[] }> = [];
  for (const name of names) {
    const areaRows = await areaLookup.bind(userId, name).all<{ area_seq: number }>();
    const labels = Array.from(new Set((areaRows.results ?? []).map((r) => `エリア#${r.area_seq}`)));
    items.push({ item_name: name, category: 'エリア一覧', area_matches: labels.length ? [{ key: name, areas: labels.join(' / ') }] : [] });
  }
  return { status: 200 as const, items };
}

describe('GET /api/heritage-area/max-area-seq', () => {
  it('自分のエリアの最大area_seqを返す', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(`CREATE TABLE heritage_area_boxes (area_seq INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, box TEXT NOT NULL DEFAULT 'box');`);
    raw.prepare(`INSERT INTO heritage_area_boxes (area_seq, user_id, box) VALUES (1, 'user1', 'a')`).run();
    raw.prepare(`INSERT INTO heritage_area_boxes (area_seq, user_id, box) VALUES (5, 'user1', 'b')`).run();
    raw.prepare(`INSERT INTO heritage_area_boxes (area_seq, user_id, box) VALUES (9, 'user2', 'c')`).run();
    const wrapped = wrapD1(raw);
    const result = await getMaxAreaSeq(wrapped, 'user1');
    expect(result.max).toBe(5);
  });

  it('保存済みエリアが1件も無いユーザーはmax=0(nullではなく数値0)を返す', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(`CREATE TABLE heritage_area_boxes (area_seq INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, box TEXT NOT NULL DEFAULT 'box');`);
    const wrapped = wrapD1(raw);
    const result = await getMaxAreaSeq(wrapped, 'user1');
    expect(result.max).toBe(0);
  });
});

describe('GET /api/heritage-area/areas/:areaSeq/items', () => {
  function seed(): DatabaseSync {
    const raw = setupDb();
    raw.prepare(`INSERT INTO heritage_area_boxes (area_seq, user_id, box) VALUES (1, 'user1', 'ミラノエリア')`).run();
    raw.prepare(`INSERT INTO heritage_area_boxes (area_seq, user_id, box) VALUES (2, 'user1', 'ローマエリア')`).run();
    raw.prepare(`INSERT INTO heritage_area_boxes (area_seq, user_id, box) VALUES (9, 'user2', '他人のエリア')`).run();
    raw.prepare(`INSERT INTO heritage_area_items (area_seq, category, item_name) VALUES (1, 'heritage-access', 'ミラノ大聖堂')`).run();
    raw.prepare(`INSERT INTO heritage_area_items (area_seq, category, item_name) VALUES (1, 'airport', 'ミラノ・リナーテ空港')`).run();
    raw.prepare(`INSERT INTO heritage_area_items (area_seq, category, item_name) VALUES (2, 'heritage-access', 'コロッセオ')`).run();
    raw.prepare(`INSERT INTO heritage_area_items (area_seq, category, item_name) VALUES (9, 'heritage-access', '他人の遺産')`).run();
    return raw;
  }

  it('指定エリアに属するアイテム名を全て返す', async () => {
    const raw = seed();
    const db = wrapD1(raw);
    const result = await getAreaItems(db, 'user1', 1);
    expect(result.status).toBe(200);
    if (result.status !== 200) throw new Error('unreachable');
    const names = result.items.map((i) => i.item_name).sort();
    expect(names).toEqual(['ミラノ・リナーテ空港', 'ミラノ大聖堂']);
  });

  it('各アイテムのarea_matchesはareaNumbersOfが解釈できる「エリア#N」形式を持つ', async () => {
    const raw = seed();
    const db = wrapD1(raw);
    const result = await getAreaItems(db, 'user1', 1);
    if (result.status !== 200) throw new Error('unreachable');
    const item = result.items.find((i) => i.item_name === 'ミラノ大聖堂')!;
    expect(item.area_matches[0].areas).toContain('エリア#1');
  });

  it('同一アイテムが複数エリアに登録されている場合は両方のエリア番号を返す', async () => {
    const raw = seed();
    raw.prepare(`INSERT INTO heritage_area_items (area_seq, category, item_name) VALUES (2, 'heritage-access', 'ミラノ大聖堂')`).run();
    const db = wrapD1(raw);
    const result = await getAreaItems(db, 'user1', 1);
    if (result.status !== 200) throw new Error('unreachable');
    const item = result.items.find((i) => i.item_name === 'ミラノ大聖堂')!;
    expect(item.area_matches[0].areas).toContain('エリア#1');
    expect(item.area_matches[0].areas).toContain('エリア#2');
  });

  it('他ユーザーのエリアのアイテムは返さない', async () => {
    const raw = seed();
    const db = wrapD1(raw);
    const result = await getAreaItems(db, 'user1', 9);
    expect(result.status).toBe(200);
    if (result.status !== 200) throw new Error('unreachable');
    expect(result.items).toEqual([]);
  });

  it('area_seqが不正な値の場合は400を返す', async () => {
    const raw = seed();
    const db = wrapD1(raw);
    const result = await getAreaItems(db, 'user1', 0);
    expect(result.status).toBe(400);
  });
});
