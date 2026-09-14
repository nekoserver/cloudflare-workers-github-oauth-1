import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  findLatestAiChatShareAnswer,
  type LatestAiChatShareAnswerResult,
} from './utils/aichatQsearchLatest';

// 対象: /neko qsearch の質問IDクリックが呼ぶ
// GET /api/aichat/qsearch/latest-answer?question=&model=
// AI応答過去ログ(ai_chat_shares)を質問文・モデルで検索し、
// 1番新しい回答文だけを返す。
//
// 故障シナリオ:
//   (1) 同じ質問・モデルが複数あるのに古い回答を返す
//   (2) 表の短縮モデル名がフルパスの保存値と一致しない
//   (3) 改行を潰した質問文がDBの改行付き質問と一致しない
//   (4) 削除済み・他ユーザーの行を返す
//   (5) 見つからない・必須パラメータ欠落を空成功にする
//   (6) (モデル不明) を空文字のモデルと突き合わせない

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
      deleted_at TEXT
    );
  `);
  return db;
}

function insertShare(
  db: DatabaseSync,
  row: { id: string; userId?: string; question: string; answer: string; model: string; createdAt: string; deletedAt?: string | null },
) {
  db.prepare(
    `INSERT INTO ai_chat_shares (id, user_id, question, answer, model, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.userId ?? 'user1',
    row.question,
    row.answer,
    row.model,
    row.createdAt,
    row.deletedAt ?? null,
  );
}

function expectOk(result: LatestAiChatShareAnswerResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.detail);
  return result.value;
}

describe('findLatestAiChatShareAnswer', () => {
  it('同じ質問・モデルが複数なら created_at が一番新しい回答だけを返す', async () => {
    const real = setupDb();
    insertShare(real, {
      id: 'old',
      question: '東京駅について',
      answer: '古い回答',
      model: 'gpt-5',
      createdAt: '2026-09-01 00:00:00',
    });
    insertShare(real, {
      id: 'new',
      question: '東京駅について',
      answer: '## 最新\n\n**新しい回答**',
      model: 'gpt-5',
      createdAt: '2026-09-14 12:00:00',
    });
    const value = expectOk(await findLatestAiChatShareAnswer(wrapD1(real), 'user1', '東京駅について', 'gpt-5'));
    expect(value.id).toBe('new');
    expect(value.answer).toBe('## 最新\n\n**新しい回答**');
  });

  it('表の短縮モデル名はフルパスの保存モデルと一致させる', async () => {
    const real = setupDb();
    insertShare(real, {
      id: 's1',
      question: '駅',
      answer: 'llamaの回答',
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      createdAt: '2026-09-14 00:00:00',
    });
    const value = expectOk(await findLatestAiChatShareAnswer(
      wrapD1(real),
      'user1',
      '駅',
      'llama-3.3-70b-instruct-fp8-fast',
    ));
    expect(value.id).toBe('s1');
    expect(value.answer).toBe('llamaの回答');
  });

  it('改行を空白に潰した質問文でも保存側の改行付き質問に当たる', async () => {
    const real = setupDb();
    insertShare(real, {
      id: 's2',
      question: '一行目\n二行目',
      answer: '改行質問の回答',
      model: 'gpt-5',
      createdAt: '2026-09-14 00:00:00',
    });
    const value = expectOk(await findLatestAiChatShareAnswer(wrapD1(real), 'user1', '一行目 二行目', 'gpt-5'));
    expect(value.id).toBe('s2');
  });

  it('削除済みと他ユーザーの行は返さない', async () => {
    const real = setupDb();
    insertShare(real, {
      id: 'del',
      question: '駅',
      answer: '削除済み',
      model: 'gpt-5',
      createdAt: '2026-09-14 12:00:00',
      deletedAt: '2026-09-14 13:00:00',
    });
    insertShare(real, {
      id: 'other',
      userId: 'user2',
      question: '駅',
      answer: '他人',
      model: 'gpt-5',
      createdAt: '2026-09-14 12:01:00',
    });
    const result = await findLatestAiChatShareAnswer(wrapD1(real), 'user1', '駅', 'gpt-5');
    expect(result).toEqual({
      ok: false,
      errorCode: 'not_found',
      detail: '一致する過去ログがありません',
    });
  });

  it('質問文が空なら missing_params を返し空成功にしない', async () => {
    const result = await findLatestAiChatShareAnswer(wrapD1(setupDb()), 'user1', '  ', 'gpt-5');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.errorCode).toBe('missing_params');
  });

  it('(モデル不明) は空のモデル行と突き合わせる', async () => {
    const real = setupDb();
    insertShare(real, {
      id: 'blank',
      question: '駅',
      answer: 'モデルなしの回答',
      model: '   ',
      createdAt: '2026-09-14 00:00:00',
    });
    const value = expectOk(await findLatestAiChatShareAnswer(wrapD1(real), 'user1', '駅', '(モデル不明)'));
    expect(value.id).toBe('blank');
    expect(value.answer).toBe('モデルなしの回答');
  });
});

describe('GET /api/aichat/qsearch/latest-answer の配線', () => {
  it('index.ts が質問文とモデル名で findLatestAiChatShareAnswer を呼ぶ', () => {
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/qsearch/latest-answer'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = src.slice(idx, idx + 900);
    expect(snippet).toContain('findLatestAiChatShareAnswer');
    expect(snippet).toContain("c.req.query('question')");
    expect(snippet).toContain("c.req.query('model')");
    expect(snippet).toContain("errorCode === 'missing_params'");
    expect(src.indexOf("app.get('/api/aichat/shares/:id'")).toBeGreaterThan(idx);
  });
});
