import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { searchAiChatSharesWithImage } from './index';

// 対象: /aichat-image-gallery ページのバックエンド関数 searchAiChatSharesWithImage。
// ai_chat_shares(AIチャットの正式な会話記録)から、画像添付済みの会話だけを
// 質問文・回答文のキーワードで検索する。画像本体は正規化テーブル
// aichat_images(user_id + content_hash でユニーク。同一画像の重複登録を防ぐ)に
// 保存し、ai_chat_shares.image_id で外部キー参照する。移行前の行は
// image_data_url列に直接値が入っているため、image_id経由(aichat_images)を
// 優先しつつ、無ければ旧image_data_url列にフォールバックする。
//
// 故障シナリオ:
//   (1) 画像が添付されていない会話までヒットしてしまう(ギャラリーに画像なし
//       サムネイルが並ぶ・item.image_data_urlがnullでimgタグが壊れる)
//   (2) 論理削除済み(deleted_at != NULL)の会話がヒットしてしまう
//   (3) 他ユーザーの会話がヒットしてしまう
//   (4) 全角/半角中黒の表記ゆれで検索漏れが起きる(searchAiChatSharesと同じ
//       INSTR/REPLACEロジックを使っているか)
//   (5) image_id経由(aichat_images JOIN)で画像URLを正しく解決できない
//   (6) 旧image_data_url列のみを持つ移行前データがimage_id未設定のせいで
//       ギャラリーから消えてしまう(フォールバックの欠落)

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
      user_hash TEXT NOT NULL DEFAULT 'h',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'model-x',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      access_count INTEGER NOT NULL DEFAULT 0,
      question_hash TEXT,
      deleted_at TEXT,
      image_data_url TEXT,
      image_id TEXT
    );
    CREATE TABLE aichat_images (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      image_data_url TEXT NOT NULL,
      byte_length INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function insertImage(db: DatabaseSync, opts: { id: string; userId?: string; imageDataUrl: string; contentHash?: string }) {
  db.prepare(
    `INSERT INTO aichat_images (id, user_id, content_hash, image_data_url, byte_length) VALUES (?, ?, ?, ?, ?)`
  ).run(opts.id, opts.userId ?? 'user1', opts.contentHash ?? opts.id, opts.imageDataUrl, opts.imageDataUrl.length);
}

function insertShare(
  db: DatabaseSync,
  opts: { id: string; userId?: string; question: string; answer?: string; imageDataUrl?: string | null; imageId?: string | null; deletedAt?: string | null },
) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, image_data_url, image_id, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    opts.id,
    opts.userId ?? 'user1',
    opts.question,
    opts.answer ?? '回答本文',
    opts.imageDataUrl ?? null,
    opts.imageId ?? null,
    opts.deletedAt ?? null,
  );
}

describe('searchAiChatSharesWithImage', () => {
  it('画像添付ありでキーワードにヒットする会話だけを返す(正規化テーブル経由)', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', question: '猫が写っている画像', imageId: 'img1' });
    insertShare(db, { id: 's2', question: '猫の生態について', imageId: null });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results.map((r) => r.id)).toEqual(['s1']);
  });

  it('質問文・回答文どちらにヒットしても返す', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', question: '画像1', answer: '猫が写っています', imageId: 'img1' });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results.map((r) => r.id)).toEqual(['s1']);
  });

  it('論理削除済み(deleted_at != NULL)の会話は返さない', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', question: '猫の画像', imageId: 'img1', deletedAt: '2026-08-01T00:00:00Z' });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results).toHaveLength(0);
  });

  it('他ユーザーの会話は返さない', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', userId: 'user2', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', userId: 'user2', question: '猫の画像', imageId: 'img1' });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results).toHaveLength(0);
  });

  it('全角/半角中黒の表記ゆれを吸収する', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', question: '「タージ・マハル」の写真', imageId: 'img1' });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', 'タージ･マハル');
    expect(results).toHaveLength(1);
  });

  it('image_id経由(aichat_imagesとのJOIN)で解決したimage_data_urlを返す', async () => {
    const db = setupDb();
    const dataUrl = 'data:image/png;base64,BBBB';
    insertImage(db, { id: 'img1', imageDataUrl: dataUrl });
    insertShare(db, { id: 's1', question: '猫の画像', imageId: 'img1' });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results[0].image_data_url).toBe(dataUrl);
  });

  it('移行前(image_id未設定・旧image_data_url列のみ)の行もフォールバックでヒットする', async () => {
    const db = setupDb();
    const dataUrl = 'data:image/png;base64,LEGACY';
    insertShare(db, { id: 's1', question: '猫の画像(移行前)', imageDataUrl: dataUrl, imageId: null });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results).toHaveLength(1);
    expect(results[0].image_data_url).toBe(dataUrl);
  });

  it('image_idと旧image_data_url列の両方が無い会話は返さない', async () => {
    const db = setupDb();
    insertShare(db, { id: 's1', question: '猫の生態について(画像なし)', imageDataUrl: null, imageId: null });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results).toHaveLength(0);
  });
});
