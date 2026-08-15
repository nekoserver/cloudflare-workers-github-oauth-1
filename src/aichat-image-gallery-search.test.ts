import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { searchAiChatSharesWithImage, searchAichatMoondreamAnalyses } from './index';

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
    CREATE TABLE aichat_moondream_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id TEXT NOT NULL,
      image_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT NOT NULL,
      analysis_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function insertMoondreamAnalysis(
  db: DatabaseSync,
  opts: { shareId: string; imageId: string; userId?: string; model?: string; analysisText: string },
) {
  db.prepare(
    `INSERT INTO aichat_moondream_analyses (share_id, image_id, user_id, model, analysis_text) VALUES (?, ?, ?, ?, ?)`
  ).run(opts.shareId, opts.imageId, opts.userId ?? 'user1', opts.model ?? 'moondream3.1', opts.analysisText);
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

// 対象: /aichat-image-gallery ページの検索対象ドロップダウンで「moondream3.1」を
// 選んだ場合に呼ばれる searchAichatMoondreamAnalyses。質問文・回答文ではなく
// aichat_moondream_analyses.analysis_text(Moondreamの画像分析結果)を検索する。
//
// 故障シナリオ:
//   (1) 質問文・回答文にしか含まれないキーワードでヒットしてしまう(検索対象の
//       取り違え)
//   (2) analysis_textにしか含まれないキーワードでヒットしない
//   (3) 他ユーザーのMoondream分析結果がヒットしてしまう
//   (4) 論理削除済みのai_chat_shares行に紐づく分析結果がヒットしてしまう
//   (5) ヒットした行の質問・回答・画像がプレビューモーダル用に正しく返らない
describe('searchAichatMoondreamAnalyses', () => {
  it('analysis_textにヒットするキーワードで検索できる', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', question: 'これは何?', answer: '説明します', imageId: 'img1' });
    insertMoondreamAnalysis(db, { shareId: 's1', imageId: 'img1', analysisText: '猫が写っています' });
    const { results } = await searchAichatMoondreamAnalyses(wrapD1(db), 'user1', '猫');
    expect(results.map((r) => r.id)).toEqual(['s1']);
  });

  it('質問文・回答文にしかキーワードが無い場合はヒットしない(検索対象が analysis_text のみであることの確認)', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', question: '猫について教えて', answer: '猫は哺乳類です', imageId: 'img1' });
    insertMoondreamAnalysis(db, { shareId: 's1', imageId: 'img1', analysisText: '犬が写っています' });
    const { results } = await searchAichatMoondreamAnalyses(wrapD1(db), 'user1', '猫');
    expect(results).toHaveLength(0);
  });

  it('他ユーザーのMoondream分析結果は返さない', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', userId: 'user2', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', userId: 'user2', question: 'これは何?', imageId: 'img1' });
    insertMoondreamAnalysis(db, { shareId: 's1', imageId: 'img1', userId: 'user2', analysisText: '猫が写っています' });
    const { results } = await searchAichatMoondreamAnalyses(wrapD1(db), 'user1', '猫');
    expect(results).toHaveLength(0);
  });

  it('論理削除済みのai_chat_shares行に紐づく分析結果は返さない', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', question: 'これは何?', imageId: 'img1', deletedAt: '2026-08-01T00:00:00Z' });
    insertMoondreamAnalysis(db, { shareId: 's1', imageId: 'img1', analysisText: '猫が写っています' });
    const { results } = await searchAichatMoondreamAnalyses(wrapD1(db), 'user1', '猫');
    expect(results).toHaveLength(0);
  });

  it('ヒットした行は質問文・画像は元のai_chat_sharesから、回答文はMoondreamのanalysis_textを返す(プレビューモーダルに実際の画像分析結果を表示するため)', async () => {
    const db = setupDb();
    const dataUrl = 'data:image/png;base64,CCCC';
    insertImage(db, { id: 'img1', imageDataUrl: dataUrl });
    insertShare(db, { id: 's1', question: 'これは何の画像?', answer: 'これは猫の画像です', imageId: 'img1' });
    insertMoondreamAnalysis(db, { shareId: 's1', imageId: 'img1', analysisText: '猫が写っています' });
    const { results } = await searchAichatMoondreamAnalyses(wrapD1(db), 'user1', '猫');
    expect(results[0].question).toBe('これは何の画像?');
    expect(results[0].answer).toBe('猫が写っています');
    expect(results[0].answer).not.toBe('これは猫の画像です');
    expect(results[0].image_data_url).toBe(dataUrl);
  });

  it('全角/半角中黒の表記ゆれを吸収する', async () => {
    const db = setupDb();
    insertImage(db, { id: 'img1', imageDataUrl: 'data:image/png;base64,AAAA' });
    insertShare(db, { id: 's1', question: '写真', imageId: 'img1' });
    insertMoondreamAnalysis(db, { shareId: 's1', imageId: 'img1', analysisText: '「タージ・マハル」が写っています' });
    const { results } = await searchAichatMoondreamAnalyses(wrapD1(db), 'user1', 'タージ･マハル');
    expect(results).toHaveLength(1);
  });
});
