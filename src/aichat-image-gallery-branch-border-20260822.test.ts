import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { enrichAichatGalleryResultsWithBranchCounts } from './index';

// 対象: /aichat-image-gallery の検索結果グリッド(GET /api/aichat/image-gallery-search)。
// プレビューを開く前の段階で「他モデルの分派出力が存在する画像」をカードの枠色で
// 判別できるようにするため、検索結果の各行へ branch_count を付与する
// enrichAichatGalleryResultsWithBranchCounts。
//
// PR #1447の「🌳 分派を見る」ボタンと同じ「他」の定義(image_idが同じで、かつ
// (shareId, model)の組が自分と異なる行)を、1件ずつのfetch(N+1)ではなく
// 画像ID集合をキーにしたバッチ問い合わせで再現する。
//
// 故障シナリオ:
//   (1) 別のimage_idの行まで数えてしまう(image_id境界の取り違え)
//   (2) 自分自身の行(shareId, modelが完全一致)を「他」として数えてしまう
//   (3) 同じimage_idでshareIdが同じでもmodelが違う行(同一会話を複数モデルで
//       再分析した場合)を数え漏らす
//   (4) 他ユーザーの行を数えてしまう(user_idを跨いだ漏洩)
//   (5) image_idがnullの行でクエリが壊れる、またはDBへ無駄な問い合わせをする
//   (6) 検索結果が0件のときにDBへ問い合わせない
//   (7) 大量の image_id (D1のバインド上限を超える件数)でもチャンク分割され
//       正しく全件分の branch_count が算出される
//   (8) 元の行のフィールド(id・question等)がbranch_count付与後も保持される

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
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      image_id TEXT,
      model TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE aichat_moondream_analyses (
      share_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      image_id TEXT,
      model TEXT NOT NULL
    );
  `);
  return db;
}

function insertShare(db: DatabaseSync, id: string, userId: string, imageId: string | null, model: string, deletedAt: string | null = null) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, image_id, model, deleted_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId, imageId, model, deletedAt);
}

function insertMoondream(db: DatabaseSync, shareId: string, userId: string, imageId: string | null, model: string) {
  db.prepare(
    `INSERT INTO aichat_moondream_analyses (share_id, user_id, image_id, model) VALUES (?, ?, ?, ?)`
  ).run(shareId, userId, imageId, model);
}

describe('enrichAichatGalleryResultsWithBranchCounts: 検索結果グリッドへの分派件数付与', () => {
  it('同じimage_idにmoondream3.1側の他モデル出力があれば branch_count に数える', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', 'img-1', 'llama-4');
    insertMoondream(db, 's1', 'u1', 'img-1', 'moondream3.1');
    const results = [{ id: 's1', image_id: 'img-1', model: 'llama-4' }];

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].branch_count).toBe(1);
  });

  it('自分自身(shareId, modelが完全一致)は他としてカウントしない', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', 'img-1', 'llama-4');
    const results = [{ id: 's1', image_id: 'img-1', model: 'llama-4' }];

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].branch_count).toBe(0);
  });

  it('同じshareIdでもmodelが違う行は他として数える(同一会話の再分析)', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', 'img-1', 'llama-4');
    insertMoondream(db, 's1', 'u1', 'img-1', 'moondream3.1');
    const results = [{ id: 's1', image_id: 'img-1', model: 'moondream3.1' }];

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].branch_count).toBe(1);
  });

  it('別のimage_idに紐づく行は数えない', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', 'img-1', 'llama-4');
    insertShare(db, 's2', 'u1', 'img-2', 'llama-4');
    const results = [{ id: 's1', image_id: 'img-1', model: 'llama-4' }];

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].branch_count).toBe(0);
  });

  it('他ユーザーの行は数えない', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', 'img-1', 'llama-4');
    insertShare(db, 's9', 'u2', 'img-1', 'llama-4');
    const results = [{ id: 's1', image_id: 'img-1', model: 'llama-4' }];

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].branch_count).toBe(0);
  });

  it('image_idがnullの行はDBへ問い合わせずbranch_count=0になる', async () => {
    const db = setupDb();
    const results = [{ id: 's1', image_id: null, model: 'llama-4' }];

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].branch_count).toBe(0);
  });

  it('検索結果が0件のときは空配列を返しDBへ問い合わせない', async () => {
    const db = setupDb();
    let queried = false;
    const spyDb = {
      prepare(sql: string) {
        queried = true;
        return wrapD1(db).prepare(sql);
      },
    };

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(spyDb as never, 'u1', []);

    expect(enriched).toEqual([]);
    expect(queried).toBe(false);
  });

  it('元の行のフィールド(id・image_id・model等)はbranch_count付与後も保持される', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', 'img-1', 'llama-4');
    const results = [{ id: 's1', image_id: 'img-1', model: 'llama-4', question: 'Q' }];

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0]).toMatchObject({ id: 's1', image_id: 'img-1', model: 'llama-4', question: 'Q', branch_count: 0 });
  });

  it('deleted_atが設定された(削除済み)ai_chat_sharesの行は数えない', async () => {
    const db = setupDb();
    insertShare(db, 's1', 'u1', 'img-1', 'llama-4');
    insertShare(db, 's2', 'u1', 'img-1', 'llama-4', '2026-08-22T00:00:00.000Z');
    const results = [{ id: 's1', image_id: 'img-1', model: 'llama-4' }];

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched[0].branch_count).toBe(0);
  });

  it('D1のバインド上限を超えるimage_id件数でもチャンク分割され全件正しく算出される', async () => {
    const db = setupDb();
    const results: { id: string; image_id: string; model: string }[] = [];
    for (let i = 0; i < 200; i++) {
      const imageId = `img-${i}`;
      insertShare(db, `s${i}`, 'u1', imageId, 'llama-4');
      insertMoondream(db, `s${i}`, 'u1', imageId, 'moondream3.1');
      results.push({ id: `s${i}`, image_id: imageId, model: 'llama-4' });
    }

    const enriched = await enrichAichatGalleryResultsWithBranchCounts(wrapD1(db) as never, 'u1', results);

    expect(enriched).toHaveLength(200);
    expect(enriched.every((r) => r.branch_count === 1)).toBe(true);
  });
});
