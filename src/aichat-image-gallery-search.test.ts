import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { searchAiChatSharesWithImage } from './index';

// 対象: /aichat-image-gallery ページのバックエンド関数 searchAiChatSharesWithImage。
// ai_chat_shares(AIチャットの正式な会話記録)から、画像添付済み(image_data_url
// が非NULL)の会話だけを質問文・回答文のキーワードで検索する。新規テーブルは
// 作らず、既存の ai_chat_shares を検索対象にする方針の検証。
//
// 故障シナリオ:
//   (1) 画像が添付されていない会話までヒットしてしまう(ギャラリーに画像なし
//       サムネイルが並ぶ・item.image_data_urlがnullでimgタグが壊れる)
//   (2) 論理削除済み(deleted_at != NULL)の会話がヒットしてしまう
//   (3) 他ユーザーの会話がヒットしてしまう
//   (4) 全角/半角中黒の表記ゆれで検索漏れが起きる(searchAiChatSharesと同じ
//       INSTR/REPLACEロジックを使っているか)

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
      image_data_url TEXT
    );
  `);
  return db;
}

function insertShare(
  db: DatabaseSync,
  opts: { id: string; userId?: string; question: string; answer?: string; imageDataUrl?: string | null; deletedAt?: string | null },
) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, image_data_url, deleted_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    opts.id,
    opts.userId ?? 'user1',
    opts.question,
    opts.answer ?? '回答本文',
    opts.imageDataUrl ?? null,
    opts.deletedAt ?? null,
  );
}

describe('searchAiChatSharesWithImage', () => {
  it('画像添付ありでキーワードにヒットする会話だけを返す', async () => {
    const db = setupDb();
    insertShare(db, { id: 's1', question: '猫が写っている画像', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's2', question: '猫の生態について', imageDataUrl: null });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results.map((r) => r.id)).toEqual(['s1']);
  });

  it('質問文・回答文どちらにヒットしても返す', async () => {
    const db = setupDb();
    insertShare(db, { id: 's1', question: '画像1', answer: '猫が写っています', imageDataUrl: 'data:image/png;base64,AAAA' });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results.map((r) => r.id)).toEqual(['s1']);
  });

  it('論理削除済み(deleted_at != NULL)の会話は返さない', async () => {
    const db = setupDb();
    insertShare(db, { id: 's1', question: '猫の画像', imageDataUrl: 'data:image/png;base64,AAAA', deletedAt: '2026-08-01T00:00:00Z' });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results).toHaveLength(0);
  });

  it('他ユーザーの会話は返さない', async () => {
    const db = setupDb();
    insertShare(db, { id: 's1', userId: 'user2', question: '猫の画像', imageDataUrl: 'data:image/png;base64,AAAA' });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results).toHaveLength(0);
  });

  it('全角/半角中黒の表記ゆれを吸収する', async () => {
    const db = setupDb();
    insertShare(db, { id: 's1', question: '「タージ・マハル」の写真', imageDataUrl: 'data:image/png;base64,AAAA' });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', 'タージ･マハル');
    expect(results).toHaveLength(1);
  });

  it('返却するimage_data_urlが実際の値と一致する(サムネイル・プレビュー描画の前提)', async () => {
    const db = setupDb();
    const dataUrl = 'data:image/png;base64,BBBB';
    insertShare(db, { id: 's1', question: '猫の画像', imageDataUrl: dataUrl });
    const { results } = await searchAiChatSharesWithImage(wrapD1(db), 'user1', '猫');
    expect(results[0].image_data_url).toBe(dataUrl);
  });
});
