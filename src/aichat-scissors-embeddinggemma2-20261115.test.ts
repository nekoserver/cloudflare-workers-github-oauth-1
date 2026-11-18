/**
 * POST /api/aichat/vectorize-answer(AIチャットの✂️)のキーワード切り出し
 *
 * 対象: 予備知識キーワードの切り出しをgemma-4-26b-a4b-itからEmbeddingGemma 2
 * (@cf/google/embeddinggemma-2)へ置き換え、失敗時だけgemma-4へフォールバックする変更と、
 * 切り出し結果・ベクトル分析・各スコアのD1保存(migrations/0192)。
 *
 * 故障シナリオ:
 *   (1) ✂️がまだgemma-4で切り出している(EmbeddingGemma 2を呼ばない)
 *   (2) EmbeddingGemma 2が失敗したときにgemma-4へフォールバックせず、キーワードが空になる
 *   (3) フォールバックしたことが応答から分からない
 *   (4) 切り出し結果がD1へ保存されない、またはPlaMoの類似度が保存対象に入らない
 *   (5) 保存に失敗すると✂️全体が500になる(保存は付随処理なので、応答は返して警告で伝える)
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { PLAMO_EMBEDDING_MODEL, ANSWER_PREREQUISITE_TERMS_MODEL } from './index';
import { KEYWORD_EXTRACTION_EMBEDDING_MODEL } from './utils/embeddingKeywordExtraction';

const JWT_SECRET = 'test-secret';
const ANSWER = '量子コンピュータは重ね合わせ状態を利用して計算します。';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

type Bound = { sql: string; args: unknown[] };

function makeDb(opts: { batchFails?: boolean } = {}) {
  const batches: Bound[][] = [];
  const db = {
    prepare: vi.fn().mockImplementation((sql: string) => {
      const stmt = {
        sql,
        args: [] as unknown[],
        bind: (...args: unknown[]) => ({
          sql,
          args,
          first: vi.fn().mockResolvedValue(
            sql.includes('SELECT id, answer FROM ai_chat_shares') ? { id: 's1', answer: ANSWER } : null,
          ),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      };
      return stmt;
    }),
    batch: vi.fn().mockImplementation(async (stmts: Bound[]) => {
      if (opts.batchFails) throw new Error('D1_ERROR: no such table: aichat_model_names');
      batches.push(stmts);
      return stmts.map(() => ({ success: true }));
    }),
  };
  return { db, batches };
}

function plamoVector(text: string): number[] {
  return text.includes('量子') ? [1, 0] : [0.6, 0.8];
}

function makeAi(opts: { embedFails?: boolean } = {}) {
  return {
    run: vi.fn().mockImplementation(async (model: string, params: { text?: string[]; input?: string[] }) => {
      if (model === PLAMO_EMBEDDING_MODEL) return { data: [plamoVector(params.text?.[0] ?? '')] };
      if (model === KEYWORD_EXTRACTION_EMBEDDING_MODEL) {
        if (opts.embedFails) throw new Error('5007: No such model');
        return {
          data: (params.input ?? []).map((t, i) => ({
            index: i,
            embedding: t.startsWith('title:') ? [1, 0, 0] : t.includes('量子') ? [0.9, 0.1, 0] : [0.1, 0.9, 0],
          })),
        };
      }
      if (model === ANSWER_PREREQUISITE_TERMS_MODEL) return { response: '量子力学\n重ね合わせ' };
      throw new Error('unexpected model ' + model);
    }),
  };
}

async function callScissors(db: unknown, ai: unknown) {
  const res = await app.request('/api/aichat/vectorize-answer', {
    method: 'POST',
    headers: { Authorization: await makeAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ shareId: 's1', forcePlamo: true }),
  }, { DB: db, AI: ai, JWT_SECRET });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

describe('✂️: EmbeddingGemma 2でキーワードを切り出す', () => {
  it('EmbeddingGemma 2で切り出し、gemma-4は呼ばない。応答に使ったモデルを返す', async () => {
    const { db } = makeDb();
    const ai = makeAi();
    const { status, body } = await callScissors(db, ai);

    expect(status).toBe(200);
    expect(body.keywordsModel).toBe(KEYWORD_EXTRACTION_EMBEDDING_MODEL);
    expect(body._keywordsFallback).toBeNull();
    expect((body.keywords as string[])[0]).toBe('量子コンピュータ');
    const models = ai.run.mock.calls.map((c) => c[0]);
    expect(models).toContain(KEYWORD_EXTRACTION_EMBEDDING_MODEL);
    expect(models).not.toContain(ANSWER_PREREQUISITE_TERMS_MODEL);
  });

  it('EmbeddingGemma 2が失敗したらgemma-4で切り出し、フォールバックの理由を応答に入れる', async () => {
    const { db } = makeDb();
    const { status, body } = await callScissors(db, makeAi({ embedFails: true }));

    expect(status).toBe(200);
    expect(body.keywordsModel).toBe(ANSWER_PREREQUISITE_TERMS_MODEL);
    expect(body.keywords).toEqual(['量子力学', '重ね合わせ']);
    expect(body._keywordsFallback).toEqual({ errorCode: 'AI_ERROR', detail: '5007: No such model' });
    expect(body._keywordsWarning).toBeNull();
  });
});

describe('✂️: 切り出し結果とスコアのD1保存', () => {
  it('切り出しモデル名・回答ID・キーワード群・PlaMoの類似度を1回のbatchで保存する', async () => {
    const { db, batches } = makeDb();
    const { body } = await callScissors(db, makeAi());

    expect(body._extractionSaveWarning).toBeNull();
    expect(batches).toHaveLength(1);
    const sqls = batches[0].map((s) => s.sql);
    expect(batches[0][0].args).toEqual([KEYWORD_EXTRACTION_EMBEDDING_MODEL]);
    expect(batches[0][1].args).toEqual([PLAMO_EMBEDDING_MODEL]);
    const extraction = batches[0].find((s) => s.sql.includes('INSERT INTO aichat_answer_keyword_extractions'))!;
    expect(extraction.args.slice(0, 3)).toEqual(['s1', 'test-user', KEYWORD_EXTRACTION_EMBEDDING_MODEL]);
    expect(extraction.args[6]).toBe('cosine;doc=title-none;query=search-result;v1');
    const keywordRows = batches[0].filter((s) => s.sql.includes('INSERT INTO aichat_answer_extracted_keywords'));
    expect(keywordRows.map((s) => s.args[4])).toEqual(body.keywords);
    const scoreRows = batches[0].filter((s) => s.sql.includes('INSERT INTO aichat_answer_keyword_scores'));
    expect(scoreRows.length).toBe((body.keywords as string[]).length);
    expect(scoreRows.every((s) => s.args[4] === PLAMO_EMBEDDING_MODEL && s.args[6] === 'cosine;plain;v1')).toBe(true);
    expect(sqls.some((q) => q.includes('DELETE FROM aichat_answer_keyword_scores'))).toBe(true);
  });

  it('保存に失敗しても✂️は200で返し、_extractionSaveWarningに理由を入れる', async () => {
    const { db } = makeDb({ batchFails: true });
    const { status, body } = await callScissors(db, makeAi());

    expect(status).toBe(200);
    expect(body.vectorized).toBe(true);
    expect((body.keywords as string[]).length).toBeGreaterThan(0);
    expect(body._extractionSaveWarning).toContain('no such table: aichat_model_names');
  });
});
