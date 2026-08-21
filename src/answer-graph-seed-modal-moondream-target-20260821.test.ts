import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { getAichatShareDetail } from './index';

// 対象: GET /api/aichat/shares/:id のバックエンド関数 getAichatShareDetail。
//
// バグ: /answer-graph ページの起点検索で moondream3.1(画像分析結果)を検索対象に
// 指定していても、検索でヒットした質問文リンクをタップして開く応答バブル
// モーダルには常に llama-4 側の回答(ai_chat_shares.answer)が表示されてしまって
// いた。原因: searchAichatMoondreamAnalyses が返す id は ai_chat_shares.id と
// 同じ値(analysis_text は aichat_moondream_analyses 側に別途ある)だが、
// GET /api/aichat/shares/:id は target を一切考慮せず常に ai_chat_shares の
// 内容のみを返していたため。
//
// 故障シナリオ:
//   (1) target=moondream3.1を指定してもai_chat_shares.answerが返ってしまう(本バグ)
//   (2) target未指定/'llama-4'では従来通りai_chat_shares.answer/modelを返す
//       (退行防止)
//   (3) 該当share_idのMoondream分析結果が存在しない場合に行を捏造してしまう
//   (4) 他ユーザーの行を返してしまう

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
      model TEXT NOT NULL DEFAULT 'llama-4',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      access_count INTEGER NOT NULL DEFAULT 0,
      question_hash TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
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

describe('getAichatShareDetail(バックエンド: GET /api/aichat/shares/:id)', () => {
  it('target=moondream3.1のとき、aichat_moondream_analysesのanalysis_text/modelを返す(ai_chat_shares.answerではない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model) VALUES ('s1','u1','これは何?','Llama-4の回答文','llama-4')`
    ).run();
    db.prepare(
      `INSERT INTO aichat_moondream_analyses (share_id, image_id, user_id, model, analysis_text) VALUES ('s1','img1','u1','moondream3.1','猫が写っています')`
    ).run();

    const detail = await getAichatShareDetail(wrapD1(db) as never, 'u1', 's1', 'moondream3.1');

    expect(detail).not.toBeNull();
    expect(detail!.answer).toBe('猫が写っています');
    expect(detail!.model).toBe('moondream3.1');
    expect(detail!.answer).not.toBe('Llama-4の回答文');
  });

  it('target未指定(デフォルト)では従来通りai_chat_shares.answer/modelを返す', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model) VALUES ('s1','u1','これは何?','Llama-4の回答文','llama-4')`
    ).run();
    db.prepare(
      `INSERT INTO aichat_moondream_analyses (share_id, image_id, user_id, model, analysis_text) VALUES ('s1','img1','u1','moondream3.1','猫が写っています')`
    ).run();

    const detail = await getAichatShareDetail(wrapD1(db) as never, 'u1', 's1', '');

    expect(detail).not.toBeNull();
    expect(detail!.answer).toBe('Llama-4の回答文');
    expect(detail!.model).toBe('llama-4');
  });

  it('target=llama-4を明示指定した場合も従来通りai_chat_shares.answer/modelを返す', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model) VALUES ('s1','u1','これは何?','Llama-4の回答文','llama-4')`
    ).run();

    const detail = await getAichatShareDetail(wrapD1(db) as never, 'u1', 's1', 'llama-4');

    expect(detail).not.toBeNull();
    expect(detail!.answer).toBe('Llama-4の回答文');
  });

  it('target=moondream3.1でも該当share_idの分析結果が無ければnullを返す(存在しない行を捏造しない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model) VALUES ('s1','u1','これは何?','Llama-4の回答文','llama-4')`
    ).run();

    const detail = await getAichatShareDetail(wrapD1(db) as never, 'u1', 's1', 'moondream3.1');

    expect(detail).toBeNull();
  });

  it('target=moondream3.1でも他ユーザーのMoondream分析結果は返さない', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO ai_chat_shares (id, user_id, question, answer, model) VALUES ('s1','u2','これは何?','Llama-4の回答文','llama-4')`
    ).run();
    db.prepare(
      `INSERT INTO aichat_moondream_analyses (share_id, image_id, user_id, model, analysis_text) VALUES ('s1','img1','u2','moondream3.1','猫が写っています')`
    ).run();

    const detail = await getAichatShareDetail(wrapD1(db) as never, 'u1', 's1', 'moondream3.1');

    expect(detail).toBeNull();
  });
});
