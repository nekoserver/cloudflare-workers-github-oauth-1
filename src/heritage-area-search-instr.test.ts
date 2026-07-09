import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

// 根本原因:
//   /api/heritage-area/search のキーワード検索はLIKE('%pattern%')を使っていたが、
//   Cloudflare D1は(ワイルドカードの有無に関わらず)LIKEパターンが約50バイトを
//   超えると "D1_ERROR: LIKE or GLOB pattern too complex: SQLITE_ERROR" で
//   失敗することを実機(wrangler dev)で確認した。標準のnode:sqliteにはこの制限が
//   無いため、通常のvitestテストではこの回帰を検出できない
//   (node:sqliteでは49バイトのLIKEパターンが問題なく成功することを別途確認済み)。
//   16文字を超える日本語キーワード(世界遺産名や質問文の引用キーは容易に
//   超える長さ)で検索するたびに本番で500エラーになっていた。
// 対策: LIKEをやめてINSTR(長さ制限なし)による部分一致に切り替え、中黒の
//   全角/半角表記ゆれはLIKEのワイルドカードではなくREPLACEでの正規化で吸収する。
// 本テストは実SQLite(node:sqlite)で、実際にsrc/index.tsのPOST /api/heritage-area/search
// と同一のWHERE句構築ロジックを再現し、(1)長いキーワードでもエラーにならず
// 正しくヒットすること、(2)中黒の表記ゆれが引き続き吸収されることを検証する。

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
    CREATE TABLE ai_chat_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      deleted_at TEXT
    );
  `);
  return db;
}

// src/index.ts の POST /api/heritage-area/search と同一のkeywordWhere構築ロジック
async function findByKeyword(db: DatabaseSync, keyword: string) {
  const real = wrapD1(db);
  const normalized = keyword.replace(/[・･]/g, '・');
  const rows = await real.prepare(
    `SELECT question FROM ai_chat_shares
     WHERE (INSTR(REPLACE(question, '･', '・'), ?) > 0 OR INSTR(REPLACE(answer, '･', '・'), ?) > 0)`
  ).bind(normalized, normalized).all<{ question: string }>();
  return rows.results ?? [];
}

function insertShare(db: DatabaseSync, id: string, question: string) {
  db.prepare(`INSERT INTO ai_chat_shares (id, user_id, question, answer) VALUES (?, ?, ?, ?)`)
    .run(id, 'user1', question, '回答本文');
}

describe('heritage-area検索: LIKEの代わりにINSTRで長いキーワードのD1エラーを回避する', () => {
  it('49文字(D1でLIKEなら確実に失敗する長さ)のキーワードでもエラーにならず正しくヒットする', async () => {
    const db = setupDb();
    const longName = 'サンタ・マリア・デッレ・グラツィエ教会（レオナルドの最後の晩餐）'; // 30文字超の実在の引用キー例
    insertShare(db, 's1', `「${longName}」の「見どころ」について説明してください`);
    const results = await findByKeyword(db, longName);
    expect(results).toHaveLength(1);
  });

  it('全角中黒(・)を含むキーワードで検索すると半角中黒(･)表記の質問もヒットする', async () => {
    const db = setupDb();
    insertShare(db, 's1', '「タージ･マハル」の「見どころ」について説明してください');
    const results = await findByKeyword(db, 'タージ・マハル');
    expect(results).toHaveLength(1);
  });

  it('半角中黒(･)を含むキーワードで検索すると全角中黒(・)表記の質問もヒットする', async () => {
    const db = setupDb();
    insertShare(db, 's1', '「タージ・マハル」の「見どころ」について説明してください');
    const results = await findByKeyword(db, 'タージ･マハル');
    expect(results).toHaveLength(1);
  });

  it('通常の短いキーワードでも正しくヒットする(回帰確認)', async () => {
    const db = setupDb();
    insertShare(db, 's1', '「姫路城」の「見どころ」について説明してください');
    insertShare(db, 's2', '「大阪城」の「見どころ」について説明してください');
    const results = await findByKeyword(db, '姫路城');
    expect(results).toHaveLength(1);
    expect(results[0].question).toContain('姫路城');
  });
});

// src/index.ts の areaLookup(引用キー→登録済みエリア照合)も、動的に組み立てる
// LIKEパターン(`? LIKE '%' || i.item_name || '%'` / `i.item_name LIKE '%' || ? || '%'`)
// が同じくD1の約50バイト制限に引っかかっていた。質問文から抽出される引用キーは
// 長い世界遺産名になりやすく、実際に本番でこの経路のエラーが再現した。
describe('heritage-area検索: areaLookup(引用キー→エリア照合)も長い引用キーでエラーにならない', () => {
  function setupAreaDb(): DatabaseSync {
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

  async function lookupArea(db: DatabaseSync, userId: string, quoteKey: string) {
    const real = wrapD1(db);
    const rows = await real.prepare(
      `SELECT i.item_name AS key, i.area_seq, i.category, b.box
       FROM heritage_area_items i
       JOIN heritage_area_boxes b ON b.area_seq = i.area_seq AND b.user_id = ?
       WHERE i.item_name = ?
          OR INSTR(?, i.item_name) > 0
          OR INSTR(i.item_name, ?) > 0`
    ).bind(userId, quoteKey, quoteKey, quoteKey).all<{ key: string; area_seq: number; category: string; box: string }>();
    return rows.results ?? [];
  }

  it('49文字(D1でLIKEなら確実に失敗する長さ)の引用キーでもエラーにならず登録済みエリアを見つける', async () => {
    const db = setupAreaDb();
    const longName = 'サンタ・マリア・デッレ・グラツィエ教会（レオナルドの最後の晩餐）';
    db.prepare(`INSERT INTO heritage_area_boxes (area_seq, user_id, box) VALUES (1, 'user1', 'ミラノエリア')`).run();
    db.prepare(`INSERT INTO heritage_area_items (area_seq, category, item_name) VALUES (1, 'heritage-access', ?)`).run(longName);
    const results = await lookupArea(db, 'user1', longName);
    expect(results).toHaveLength(1);
    expect(results[0].box).toBe('ミラノエリア');
  });

  it('未登録の引用キーはエラーにならず空配列を返す(回帰確認)', async () => {
    const db = setupAreaDb();
    const results = await lookupArea(db, 'user1', '未登録の場所');
    expect(results).toHaveLength(0);
  });
});
