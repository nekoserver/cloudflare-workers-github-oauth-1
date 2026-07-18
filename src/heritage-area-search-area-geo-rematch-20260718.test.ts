import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { heritageAreaBoxBounds, isPointInHeritageAreaBoxBounds } from './index';

// 対象: heritage-areaページの「検索露出ログ検索結果」欄(/api/heritage-area/search)の
// area_matches列。
//
// 背景: エリア確定(保存)時点でheritage_area_itemsに登録された地点名との完全/部分一致
// でしかエリア紐付けを判定していなかったため、エリア確定後にHERITAGE_LISTへ新規追加
// された世界遺産(例:「ロンゴバルド族の権力の場所群」)は、実際には地図上でエリアの
// 範囲内にあっても、確定時点でheritage_area_itemsに存在しない(=名前ベースの照合が
// 常にヒットしない)ため、area_matchesが常に空のまま表示されてしまっていた。
// 検索結果ページ自体では座標に基づく再判定が一切行われておらず、エリア確定時点の
// (古い)判定結果がそのまま画面に固定表示され続けるのが根本原因。
//
// 故障シナリオ:
//   (1) heritage_area_itemsに存在しない地点は、実際にエリア範囲内でもarea_matchesが
//       常に空になる(今回の不具合そのもの)
//   (2) エリアの矩形が経度180度線をまたぐ場合、単純なmin/max比較では範囲内の地点を
//       誤って範囲外と判定してしまう
//   (3) 既に名前ベースで紐付いているエリアに対して、座標ベースの再判定が重複した
//       ラベルを追加してしまう
describe('heritageAreaBoxBounds / isPointInHeritageAreaBoxBounds — エリア矩形の座標判定', () => {
  it('通常の(経度180度をまたがない)矩形は単純なmin/max範囲判定になる', () => {
    const bounds = heritageAreaBoxBounds(46.0, 10.0, 44.0, 14.0);
    expect(bounds).toEqual({ latMin: 44.0, latMax: 46.0, lonMin: 10.0, lonMax: 14.0, lonCross: false });
    expect(isPointInHeritageAreaBoxBounds(45.0, 12.0, bounds)).toBe(true);
    expect(isPointInHeritageAreaBoxBounds(45.0, 20.0, bounds)).toBe(false);
    expect(isPointInHeritageAreaBoxBounds(50.0, 12.0, bounds)).toBe(false);
  });

  it('経度180度線をまたぐ矩形(topLeftLonがbottomRightLonより大きい)はlonCross=trueになり、OR条件で判定する', () => {
    const bounds = heritageAreaBoxBounds(10.0, 170.0, -10.0, -170.0);
    expect(bounds.lonCross).toBe(true);
    expect(isPointInHeritageAreaBoxBounds(0, 175.0, bounds)).toBe(true);
    expect(isPointInHeritageAreaBoxBounds(0, -175.0, bounds)).toBe(true);
    expect(isPointInHeritageAreaBoxBounds(0, 0, bounds)).toBe(false);
  });

  it('NaN等の不正な座標はfalseを返す(例外を投げない)', () => {
    const bounds = heritageAreaBoxBounds(46.0, 10.0, 44.0, 14.0);
    expect(isPointInHeritageAreaBoxBounds(NaN, 12.0, bounds)).toBe(false);
    expect(isPointInHeritageAreaBoxBounds(45.0, NaN, bounds)).toBe(false);
  });
});

interface D1Row { [key: string]: unknown; }

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
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
      box TEXT NOT NULL DEFAULT 'box',
      top_left_lat REAL NOT NULL,
      top_left_lon REAL NOT NULL,
      bottom_right_lat REAL NOT NULL,
      bottom_right_lon REAL NOT NULL
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

// src/index.ts の heritageAreaSearchHandler と同一の「名前ベース照合 → 未紐付けの
// エリアだけ座標で再判定」ロジックを再現する。
async function computeAreaMatches(
  db: DatabaseSync,
  userId: string,
  itemName: string,
  heritagePoint: { lat: number; lon: number } | null
): Promise<string[]> {
  const real = wrapD1(db);
  const areaLookup = real.prepare(
    `SELECT i.item_name AS key, i.area_seq, i.category, b.box
     FROM heritage_area_items i
     JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ?
     WHERE i.item_name = ?
        OR INSTR(?, i.item_name) > 0
        OR INSTR(i.item_name, ?) > 0`
  );
  const areaRows = await areaLookup.bind(userId, itemName, itemName, itemName).all<{ area_seq: number; category: string; box: string | null }>();
  const labels: string[] = [];
  const matchedAreaSeqs = new Set<number>();
  for (const row of areaRows.results ?? []) {
    matchedAreaSeqs.add(row.area_seq);
    labels.push(`エリア#${row.area_seq}${row.category ? `/${row.category}` : ''}${row.box ? ` (${row.box})` : ''}`);
  }
  if (heritagePoint) {
    const boxRows = await real.prepare(
      `SELECT area_seq AS areaSeq, top_left_lat AS topLeftLat, top_left_lon AS topLeftLon,
              bottom_right_lat AS bottomRightLat, bottom_right_lon AS bottomRightLon
         FROM heritage_area_boxes
        WHERE user_id = ?`
    ).bind(userId).all<{ areaSeq: number; topLeftLat: number; topLeftLon: number; bottomRightLat: number; bottomRightLon: number }>();
    for (const row of boxRows.results ?? []) {
      if (matchedAreaSeqs.has(row.areaSeq)) continue;
      const bounds = heritageAreaBoxBounds(row.topLeftLat, row.topLeftLon, row.bottomRightLat, row.bottomRightLon);
      if (isPointInHeritageAreaBoxBounds(heritagePoint.lat, heritagePoint.lon, bounds)) {
        matchedAreaSeqs.add(row.areaSeq);
        labels.push(`エリア#${row.areaSeq}(座標範囲内・エリア確定後に追加)`);
      }
    }
  }
  return labels;
}

describe('heritage-area検索結果: エリア確定後に追加された地点も座標で再判定してarea_matchesに含める', () => {
  it('heritage_area_itemsに存在しない地点でも、座標がエリアの矩形範囲内なら「座標範囲内」ラベル付きでarea_matchesに含まれる(今回の不具合の再現ケース)', async () => {
    const db = setupDb();
    // イタリア北東部を囲むエリア#4を想定(HERITAGE_LISTの実座標: ロンゴバルド族の権力の
    // 場所群 lat:46.0902, lon:13.4286 — チヴィダーレ・デル・フリウリ周辺を含む範囲)
    db.prepare(
      `INSERT INTO heritage_area_boxes (area_seq, user_id, box, top_left_lat, top_left_lon, bottom_right_lat, bottom_right_lon)
       VALUES (4, 'user1', 'box', 47.0, 11.0, 45.0, 15.0)`
    ).run();
    // 「ロンゴバルド族の権力の場所群」は確定時点でheritage_area_itemsに存在しない
    const labels = await computeAreaMatches(db, 'user1', 'ロンゴバルド族の権力の場所群', { lat: 46.0902, lon: 13.4286 });
    expect(labels).toEqual(['エリア#4(座標範囲内・エリア確定後に追加)']);
  });

  it('座標がどのエリアの範囲内にも収まらない場合はarea_matchesが空のまま(誤検出しない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO heritage_area_boxes (area_seq, user_id, box, top_left_lat, top_left_lon, bottom_right_lat, bottom_right_lon)
       VALUES (4, 'user1', 'box', 46.0, 6.0, 43.0, 12.0)`
    ).run();
    const labels = await computeAreaMatches(db, 'user1', '無関係の世界遺産', { lat: 35.0, lon: 139.0 });
    expect(labels).toEqual([]);
  });

  it('名前ベースで既に紐付いているエリアには座標ベースの重複ラベルを追加しない', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO heritage_area_boxes (area_seq, user_id, box, top_left_lat, top_left_lon, bottom_right_lat, bottom_right_lon)
       VALUES (4, 'user1', 'box', 46.0, 6.0, 43.0, 12.0)`
    ).run();
    db.prepare(`INSERT INTO heritage_area_items (area_seq, category, item_name) VALUES (4, 'heritage-access', '姫路城')`).run();
    // 「姫路城」自体の座標はエリア外だが、名前ベースで既にエリア#4に紐付いているため
    // 座標判定によるラベル追加は行われず、名前ベースの1件だけが返る
    const labels = await computeAreaMatches(db, 'user1', '姫路城', { lat: 34.84, lon: 134.69 });
    expect(labels).toEqual(['エリア#4/heritage-access (box)']);
  });

  it('heritage_pointがnull(空港名等)の場合は座標判定自体をスキップし、名前ベースの結果のみ返す', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO heritage_area_boxes (area_seq, user_id, box, top_left_lat, top_left_lon, bottom_right_lat, bottom_right_lon)
       VALUES (4, 'user1', 'box', 46.0, 6.0, 43.0, 12.0)`
    ).run();
    const labels = await computeAreaMatches(db, 'user1', '謎のキーワード', null);
    expect(labels).toEqual([]);
  });

  it('複数エリアがあり、座標が別のエリア(#7)の範囲内にも収まる場合は両方のラベルが付く', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO heritage_area_boxes (area_seq, user_id, box, top_left_lat, top_left_lon, bottom_right_lat, bottom_right_lon)
       VALUES (4, 'user1', 'box', 47.0, 11.0, 45.0, 15.0)`
    ).run();
    db.prepare(
      `INSERT INTO heritage_area_boxes (area_seq, user_id, box, top_left_lat, top_left_lon, bottom_right_lat, bottom_right_lon)
       VALUES (7, 'user1', 'box', 46.5, 12.0, 45.5, 14.0)`
    ).run();
    const labels = await computeAreaMatches(db, 'user1', 'ロンゴバルド族の権力の場所群', { lat: 46.0902, lon: 13.4286 });
    expect(labels.sort()).toEqual(['エリア#4(座標範囲内・エリア確定後に追加)', 'エリア#7(座標範囲内・エリア確定後に追加)'].sort());
  });
});

describe('heritage-areaページ: 検索ハンドラの座標再判定ロジックの組み込み確認', () => {
  it('heritageAreaSearchHandlerがheritageAreaBoxBounds/isPointInHeritageAreaBoxBoundsを用いて再判定し、座標範囲内ラベルを付与している', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
    const idx = src.indexOf('async function heritageAreaSearchHandler');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 8500);
    expect(block).toContain('heritageAreaBoxBounds(row.topLeftLat, row.topLeftLon, row.bottomRightLat, row.bottomRightLon)');
    expect(block).toContain('isPointInHeritageAreaBoxBounds(item.heritage_point.lat, item.heritage_point.lon, box.bounds)');
    expect(block).toContain('座標範囲内・エリア確定後に追加');
    expect(block).toContain('matchedAreaSeqs.has(box.areaSeq)');
  });
});
