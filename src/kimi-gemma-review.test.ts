import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  searchKimiGemmaReviews,
  getAichatShareDetail,
  extractChatCompletionText,
  buildGemmaCodeReviewPrompt,
} from './index';

// 対象: /kimi-codeページでkimi-k2.7-codeが生成したコードをgemma-4-26b-a4b-itに
// レビューさせた結果を保存するkimi_gemma_reviewsテーブルと、その検索
// (searchKimiGemmaReviews)・詳細取得(getAichatShareDetail の target='kimi-gemma')。
//
// 故障シナリオ:
//   (1) 他ユーザーの保存済みレビューがヒットしてしまう
//   (2) 全角/半角中黒の表記ゆれで検索漏れが起きる(既存のsearchAiChatSharesと
//       同じINSTR/REPLACEロジックを踏襲しているか)
//   (3) kimi_code列(生成コード本文)がヒット対象から漏れている
//   (4) target='kimi-gemma'指定時にai_chat_sharesとは無関係のid空間で
//       正しく1件取得できない(share_id JOINを前提にした既存分岐に巻き込まれない)
//   (5) チャット補完形式のレスポンス(.responseなし、choices[0].message.content
//       のみ)からテキストを取り出せない

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
            async first<T = D1Row>(): Promise<T | null> {
              const row = stmt.get(...(args as never[])) as unknown as T | undefined;
              return row ?? null;
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
    CREATE TABLE kimi_gemma_reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kimi_prompt TEXT NOT NULL,
      kimi_code TEXT NOT NULL,
      gemma_prompt TEXT NOT NULL,
      gemma_response TEXT NOT NULL,
      gemma_model TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function insertReview(
  db: DatabaseSync,
  opts: { id: string; userId?: string; kimiPrompt: string; kimiCode: string; gemmaResponse: string },
) {
  db.prepare(
    `INSERT INTO kimi_gemma_reviews (id, user_id, kimi_prompt, kimi_code, gemma_prompt, gemma_response, gemma_model)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(opts.id, opts.userId ?? 'user1', opts.kimiPrompt, opts.kimiCode, 'review this code', opts.gemmaResponse, '@cf/google/gemma-4-26b-a4b-it');
}

describe('searchKimiGemmaReviews', () => {
  it('自分のkimi_promptに一致するレビューを返す', async () => {
    const db = setupDb();
    insertReview(db, { id: 'r1', kimiPrompt: 'フィボナッチ関数を書いて', kimiCode: 'function fib(n) {}', gemmaResponse: '問題ありません' });
    const { results } = await searchKimiGemmaReviews(wrapD1(db), 'user1', 'フィボナッチ');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('r1');
    expect(results[0].answer).toBe('問題ありません');
  });

  it('kimi_code(生成コード本文)のキーワードでもヒットする', async () => {
    const db = setupDb();
    insertReview(db, { id: 'r1', kimiPrompt: 'ソートを書いて', kimiCode: 'function quickSortUnique(arr) {}', gemmaResponse: 'OK' });
    const { results } = await searchKimiGemmaReviews(wrapD1(db), 'user1', 'quickSortUnique');
    expect(results).toHaveLength(1);
  });

  it('gemma_response(レビュー結果)のキーワードでもヒットする', async () => {
    const db = setupDb();
    insertReview(db, { id: 'r1', kimiPrompt: 'p', kimiCode: 'c', gemmaResponse: 'nullチェック漏れがあります' });
    const { results } = await searchKimiGemmaReviews(wrapD1(db), 'user1', 'nullチェック');
    expect(results).toHaveLength(1);
  });

  it('他ユーザーのレビューはヒットしない', async () => {
    const db = setupDb();
    insertReview(db, { id: 'r1', userId: 'other', kimiPrompt: '秘密のコード', kimiCode: 'c', gemmaResponse: 'a' });
    const { results } = await searchKimiGemmaReviews(wrapD1(db), 'user1', '秘密');
    expect(results).toHaveLength(0);
  });

  it('全角/半角中黒の表記ゆれを吸収して検索できる', async () => {
    const db = setupDb();
    insertReview(db, { id: 'r1', kimiPrompt: 'A・B・Cを処理する関数', kimiCode: 'c', gemmaResponse: 'a' });
    const { results } = await searchKimiGemmaReviews(wrapD1(db), 'user1', 'A･B･C');
    expect(results).toHaveLength(1);
  });
});

describe('getAichatShareDetail(target=kimi-gemma)', () => {
  it('kimi_gemma_reviewsから1件をAichatShareDetail互換の形で返す', async () => {
    const db = setupDb();
    insertReview(db, { id: 'r1', kimiPrompt: '質問', kimiCode: 'c', gemmaResponse: '回答本文' });
    const detail = await getAichatShareDetail(wrapD1(db) as never, 'user1', 'r1', 'kimi-gemma');
    expect(detail).not.toBeNull();
    expect(detail?.question).toBe('質問');
    expect(detail?.answer).toBe('回答本文');
    expect(detail?.model).toBe('@cf/google/gemma-4-26b-a4b-it');
  });

  it('他ユーザーのidでは取得できない', async () => {
    const db = setupDb();
    insertReview(db, { id: 'r1', userId: 'other', kimiPrompt: 'q', kimiCode: 'c', gemmaResponse: 'a' });
    const detail = await getAichatShareDetail(wrapD1(db) as never, 'user1', 'r1', 'kimi-gemma');
    expect(detail).toBeNull();
  });

  it('存在しないidではnullを返す', async () => {
    const db = setupDb();
    const detail = await getAichatShareDetail(wrapD1(db) as never, 'user1', 'missing', 'kimi-gemma');
    expect(detail).toBeNull();
  });
});

describe('extractChatCompletionText', () => {
  it('.responseがあればそれを返す', () => {
    expect(extractChatCompletionText({ response: 'hello' })).toBe('hello');
  });

  it('.responseが無くchoices[0].message.contentがあればそれを返す', () => {
    expect(extractChatCompletionText({ choices: [{ message: { content: 'from choices' } }] })).toBe('from choices');
  });

  it('どちらも無ければ空文字を返す', () => {
    expect(extractChatCompletionText({})).toBe('');
    expect(extractChatCompletionText(null)).toBe('');
  });
});

describe('buildGemmaCodeReviewPrompt', () => {
  it('コードをコードブロックで囲んだ日本語レビュー指示プロンプトを組み立てる', () => {
    const prompt = buildGemmaCodeReviewPrompt('const x = 1;');
    expect(prompt).toContain('const x = 1;');
    expect(prompt).toContain('```');
    expect(prompt).toContain('レビュー');
  });
});
