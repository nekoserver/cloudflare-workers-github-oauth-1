import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { getKimiCodeTokenUsage, extractAiRunUsage } from './index';

// 対象: /kimi-codeページ(kimi-k2.7-code、従量課金モデル)のトークン利用量集計。
// POST /api/kimi-code/generate 呼び出しごとに kimi_code_generate_log へ、
// POST /api/kimi-code/gemma-review 呼び出しごとに kimi_gemma_reviews の
// gemma_input_tokens/gemma_output_tokens/gemma_total_tokens へ記録し、
// getKimiCodeTokenUsage が両テーブルをUNION ALLしてモデル別に合算する。
//
// 故障シナリオ:
//   (1) kimi-k2.7-codeとgemma-4-26b-a4b-itのトークン数が合算されず片方しか
//       集計に出てこない(2つのテーブルにまたがっているため)
//   (2) 他ユーザーの利用量が混入する
//   (3) since(集計開始日)より前のデータが混入する
//   (4) トークン数未記録行(NULL。呼び出し失敗時やこの機能追加前の既存データ)が
//       SUMに混ざりCOUNT(*)水増しやNULL汚染を起こす
//   (5) Ai.run()のusageオブジェクトの取り出しに失敗し常にnullになる

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
    CREATE TABLE kimi_code_generate_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE kimi_gemma_reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kimi_prompt TEXT NOT NULL,
      kimi_code TEXT NOT NULL,
      gemma_prompt TEXT NOT NULL,
      gemma_response TEXT NOT NULL,
      gemma_model TEXT NOT NULL,
      gemma_input_tokens INTEGER,
      gemma_output_tokens INTEGER,
      gemma_total_tokens INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function insertGenerateLog(db: DatabaseSync, opts: { userId?: string; model?: string; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; createdAt?: string }) {
  db.prepare(
    `INSERT INTO kimi_code_generate_log (user_id, model, input_tokens, output_tokens, total_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(opts.userId ?? 'user1', opts.model ?? '@cf/moonshotai/kimi-k2.7-code', opts.inputTokens, opts.outputTokens, opts.totalTokens, opts.createdAt ?? '2026-09-01 00:00:00');
}

function insertReview(db: DatabaseSync, opts: { id: string; userId?: string; gemmaInputTokens: number | null; gemmaOutputTokens: number | null; gemmaTotalTokens: number | null; createdAt?: string }) {
  db.prepare(
    `INSERT INTO kimi_gemma_reviews (id, user_id, kimi_prompt, kimi_code, gemma_prompt, gemma_response, gemma_model, gemma_input_tokens, gemma_output_tokens, gemma_total_tokens, created_at)
     VALUES (?, ?, 'p', 'c', 'gp', 'gr', '@cf/google/gemma-4-26b-a4b-it', ?, ?, ?, ?)`
  ).run(opts.id, opts.userId ?? 'user1', opts.gemmaInputTokens, opts.gemmaOutputTokens, opts.gemmaTotalTokens, opts.createdAt ?? '2026-09-01 00:00:00');
}

describe('getKimiCodeTokenUsage', () => {
  it('kimi-k2.7-codeとgemma-4-26b-a4b-itの両方のトークン数がモデル別に合算される', async () => {
    const db = setupDb();
    insertGenerateLog(db, { inputTokens: 100, outputTokens: 200, totalTokens: 300 });
    insertGenerateLog(db, { inputTokens: 50, outputTokens: 60, totalTokens: 110 });
    insertReview(db, { id: 'r1', gemmaInputTokens: 10, gemmaOutputTokens: 20, gemmaTotalTokens: 30 });
    const { rows } = await getKimiCodeTokenUsage(wrapD1(db), 'user1', '2026-01-01');
    const kimiRow = rows.find((r) => r.model === '@cf/moonshotai/kimi-k2.7-code');
    const gemmaRow = rows.find((r) => r.model === '@cf/google/gemma-4-26b-a4b-it');
    expect(kimiRow).toBeDefined();
    expect(kimiRow?.input_tokens).toBe(150);
    expect(kimiRow?.output_tokens).toBe(260);
    expect(kimiRow?.total_tokens).toBe(410);
    expect(kimiRow?.request_count).toBe(2);
    expect(gemmaRow).toBeDefined();
    expect(gemmaRow?.input_tokens).toBe(10);
    expect(gemmaRow?.request_count).toBe(1);
  });

  it('他ユーザーの利用量は合算に含まれない', async () => {
    const db = setupDb();
    insertGenerateLog(db, { userId: 'other', inputTokens: 999, outputTokens: 999, totalTokens: 1998 });
    const { rows } = await getKimiCodeTokenUsage(wrapD1(db), 'user1', '2026-01-01');
    expect(rows).toHaveLength(0);
  });

  it('since(集計開始日)より前のデータは含まれない', async () => {
    const db = setupDb();
    insertGenerateLog(db, { inputTokens: 100, outputTokens: 100, totalTokens: 200, createdAt: '2025-01-01 00:00:00' });
    const { rows } = await getKimiCodeTokenUsage(wrapD1(db), 'user1', '2026-01-01');
    expect(rows).toHaveLength(0);
  });

  it('トークン数未記録(NULL)の行は合算に含まれない', async () => {
    const db = setupDb();
    insertGenerateLog(db, { inputTokens: null, outputTokens: null, totalTokens: null });
    insertReview(db, { id: 'r1', gemmaInputTokens: null, gemmaOutputTokens: null, gemmaTotalTokens: null });
    const { rows } = await getKimiCodeTokenUsage(wrapD1(db), 'user1', '2026-01-01');
    expect(rows).toHaveLength(0);
  });

  it('granularity=dayでは日単位のperiodでグループ化する', async () => {
    const db = setupDb();
    insertGenerateLog(db, { inputTokens: 10, outputTokens: 10, totalTokens: 20, createdAt: '2026-09-01 05:00:00' });
    insertGenerateLog(db, { inputTokens: 20, outputTokens: 20, totalTokens: 40, createdAt: '2026-09-02 05:00:00' });
    const { rows } = await getKimiCodeTokenUsage(wrapD1(db), 'user1', '2026-01-01', 'day');
    expect(rows).toHaveLength(2);
    expect(rows[0].period).toBe('2026-09-01');
    expect(rows[1].period).toBe('2026-09-02');
  });
});

describe('extractAiRunUsage', () => {
  it('usageオブジェクトからトークン数を取り出す', () => {
    const usage = extractAiRunUsage({ usage: { input_tokens: 5, output_tokens: 7, total_tokens: 12 } });
    expect(usage).toEqual({ input_tokens: 5, output_tokens: 7, total_tokens: 12 });
  });

  it('prompt_tokens/completion_tokens形式でも取り出せる', () => {
    const usage = extractAiRunUsage({ usage: { prompt_tokens: 3, completion_tokens: 4 } });
    expect(usage.input_tokens).toBe(3);
    expect(usage.output_tokens).toBe(4);
    expect(usage.total_tokens).toBe(7);
  });

  it('usageが無ければ全てnullを返す', () => {
    expect(extractAiRunUsage({})).toEqual({ input_tokens: null, output_tokens: null, total_tokens: null });
    expect(extractAiRunUsage(null)).toEqual({ input_tokens: null, output_tokens: null, total_tokens: null });
  });
});
