import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { saveAnswerKeywordExtraction } from './answerKeywordExtractionStore';

// 対象:
//   AIチャットの✂️で切り出したキーワード群と、切り出しと同時に得たベクトル分析
//   (本文ベクトル・各キーワードの類似度とベクトル)をD1へ保存する処理。
//   モデル名はaichat_model_namesへ正規化し、回答ID(ai_chat_shares.id)・モデルIDを
//   外部キーとして aichat_answer_keyword_extractions に、キーワード群を
//   aichat_answer_extracted_keywords に保存する(migrations/0192)。
//
// 故障シナリオ:
//   (1) モデル名が切り出しのたびに別行として増える(正規化されていない)
//   (2) 存在しない回答IDでも保存できてしまう(外部キーが効いていない)
//   (3) 同じ回答・同じモデルで切り出し直すと古いキーワードが残り、新旧が混ざる
//   (4) 途中で失敗したとき、切り出し行だけ残ってキーワードが無い半端な状態になる
//   (5) gemma-4へフォールバックした(ベクトルが無い)ときに保存が失敗する、
//       またはフォールバックの理由が残らない
//   (6) 回答を削除しても切り出し結果が残る(ON DELETE CASCADE)
//   (7) ✂️の後続処理でPlaMoが計算した類似度が保存されない、または別モデルの
//       スコアがキーワード表の列に混ざって正規化が崩れる
//   (8) 本文中の出現回数・候補数が残らず、後から切り出しの質を比べられない
//   (9) スコアの計算条件(タスク接頭辞・計算方式)が残らず、将来接頭辞を変えたときに
//       新旧のスコアが同じ列に混ざって区別できなくなる

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../migrations/0192_create_aichat_answer_keyword_extractions.sql'),
  'utf-8',
);

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`CREATE TABLE ai_chat_shares (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, answer TEXT NOT NULL);`);
  db.exec(MIGRATION);
  db.prepare(`INSERT INTO ai_chat_shares (id, user_id, answer) VALUES (?, ?, ?)`).run('s1', 'u1', '量子コンピュータの回答');
  return db;
}

/** D1と同じく、batchはすべて成功するか、すべて取り消されるかのどちらかになる */
function wrapD1(db: DatabaseSync) {
  const toArgs = (args: unknown[]) => args.map((a) => (a instanceof ArrayBuffer ? new Uint8Array(a) : a));
  const prepare = (sql: string) => ({
    sql,
    args: [] as unknown[],
    bind(...args: unknown[]) {
      return { ...this, args };
    },
  });
  return {
    prepare,
    async batch(stmts: Array<{ sql: string; args: unknown[] }>) {
      db.exec('BEGIN');
      try {
        const results = stmts.map((s) => db.prepare(s.sql).run(...(toArgs(s.args) as never[])));
        db.exec('COMMIT');
        return results.map(() => ({ success: true }));
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

function toFloats(blob: Uint8Array | null): number[] | null {
  if (!blob) return null;
  return Array.from(new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4));
}

const EMBED = '@cf/google/embeddinggemma-2';
const PLAMO = '@cf/pfnet/plamo-embedding-1b';
const EMBED_METHOD = 'cosine;doc=title-none;query=search-result;v1';
const LLM_METHOD = 'llm-list;v1';
const PLAIN_METHOD = 'cosine;plain;v1';
const GEMMA4 = '@cf/google/gemma-4-26b-a4b-it';

describe('saveAnswerKeywordExtraction: 切り出し結果とベクトル分析の保存', () => {
  it('モデル名を正規化し、回答ID・モデルIDを外部キーにして本文ベクトルとキーワード群を保存する', async () => {
    const db = setupDb();
    await saveAnswerKeywordExtraction(wrapD1(db) as never, {
      userId: 'u1',
      shareId: 's1',
      model: EMBED, scoreMethod: EMBED_METHOD,
      analysis: {
        documentVector: [1, 0],
        candidateCount: 12,
        keywords: [
          { term: '量子コンピュータ', score: 0.9, vector: [0.5, 0.5] },
          { term: '重ね合わせ', score: 0.4, vector: [0, 1] },
        ],
      },
      terms: ['量子コンピュータ', '重ね合わせ'],
      answerText: '量子コンピュータは重ね合わせを使う。量子コンピュータは速い。',
      fallback: null,
    });

    const models = db.prepare(`SELECT id, name FROM aichat_model_names`).all() as { id: number; name: string }[];
    expect(models).toEqual([{ id: 1, name: EMBED }]);
    const ex = db.prepare(`SELECT id, share_id, user_id, model_id, dim, document_vector, candidate_count, score_method, fallback_error_code FROM aichat_answer_keyword_extractions`).get() as Record<string, unknown>;
    expect(ex.share_id).toBe('s1');
    expect(ex.model_id).toBe(1);
    expect(ex.dim).toBe(2);
    expect(toFloats(ex.document_vector as Uint8Array)).toEqual([1, 0]);
    expect(ex.candidate_count).toBe(12);
    expect(ex.score_method).toBe(EMBED_METHOD);
    expect(ex.fallback_error_code).toBeNull();
    const kws = db.prepare(`SELECT extraction_id, rank, keyword, score, occurrence_count, vector FROM aichat_answer_extracted_keywords ORDER BY rank`).all() as Record<string, unknown>[];
    expect(kws.map((k) => k.occurrence_count)).toEqual([2, 1]);
    expect(kws.map((k) => [k.extraction_id, k.rank, k.keyword])).toEqual([[ex.id, 1, '量子コンピュータ'], [ex.id, 2, '重ね合わせ']]);
    expect(kws[0].score).toBeCloseTo(0.9);
    expect(toFloats(kws[1].vector as Uint8Array)).toEqual([0, 1]);
  });

  it('フィルタ後のtermsに残った語だけを保存し、分析の順位はtermsの並びで振り直す', async () => {
    const db = setupDb();
    await saveAnswerKeywordExtraction(wrapD1(db) as never, {
      userId: 'u1', shareId: 's1', model: EMBED, scoreMethod: EMBED_METHOD,
      analysis: { documentVector: [1, 0], candidateCount: 2, keywords: [{ term: 'API', score: 0.95, vector: [1, 0] }, { term: '量子', score: 0.8, vector: [1, 1] }] },
      terms: ['量子'],
      fallback: null,
    });
    const kws = db.prepare(`SELECT rank, keyword FROM aichat_answer_extracted_keywords`).all();
    expect(kws).toEqual([{ rank: 1, keyword: '量子' }]);
  });

  it('同じ回答・同じモデルで切り出し直すと前回のキーワードを置き換え、モデル名の行は増えない', async () => {
    const db = setupDb();
    const d1 = wrapD1(db) as never;
    const base = { userId: 'u1', shareId: 's1', model: EMBED, scoreMethod: EMBED_METHOD, fallback: null };
    await saveAnswerKeywordExtraction(d1, { ...base, terms: ['古い語'], analysis: { documentVector: [1], candidateCount: 1, keywords: [{ term: '古い語', score: 0.1, vector: [1] }] } });
    await saveAnswerKeywordExtraction(d1, { ...base, terms: ['新しい語'], analysis: { documentVector: [1], candidateCount: 1, keywords: [{ term: '新しい語', score: 0.2, vector: [1] }] } });

    expect((db.prepare(`SELECT COUNT(*) AS n FROM aichat_model_names`).get() as { n: number }).n).toBe(1);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM aichat_answer_keyword_extractions`).get() as { n: number }).n).toBe(1);
    expect(db.prepare(`SELECT keyword FROM aichat_answer_extracted_keywords`).all()).toEqual([{ keyword: '新しい語' }]);
  });

  it('gemma-4へフォールバックしたときは、ベクトルと類似度をNULLにしてフォールバックの理由を残す', async () => {
    const db = setupDb();
    await saveAnswerKeywordExtraction(wrapD1(db) as never, {
      userId: 'u1', shareId: 's1', model: GEMMA4, scoreMethod: LLM_METHOD,
      analysis: null,
      terms: ['量子', '重ね合わせ'],
      fallback: { errorCode: 'AI_ERROR', detail: '5007: model not found' },
    });
    const ex = db.prepare(`SELECT dim, document_vector, score_method, fallback_error_code, fallback_detail FROM aichat_answer_keyword_extractions`).get();
    expect(ex).toEqual({ dim: null, document_vector: null, score_method: LLM_METHOD, fallback_error_code: 'AI_ERROR', fallback_detail: '5007: model not found' });
    expect(db.prepare(`SELECT rank, keyword, score, vector FROM aichat_answer_extracted_keywords ORDER BY rank`).all()).toEqual([
      { rank: 1, keyword: '量子', score: null, vector: null },
      { rank: 2, keyword: '重ね合わせ', score: null, vector: null },
    ]);
    expect(db.prepare(`SELECT name FROM aichat_model_names`).all()).toEqual([{ name: GEMMA4 }]);
  });

  it('存在しない回答IDは外部キー違反で失敗し、何も残らない', async () => {
    const db = setupDb();
    await expect(saveAnswerKeywordExtraction(wrapD1(db) as never, {
      userId: 'u1', shareId: 'no-such-share', model: EMBED, scoreMethod: EMBED_METHOD,
      analysis: { documentVector: [1], candidateCount: 1, keywords: [{ term: '量子', score: 1, vector: [1] }] },
      terms: ['量子'], fallback: null,
    })).rejects.toThrow(/FOREIGN KEY/);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM aichat_answer_keyword_extractions`).get() as { n: number }).n).toBe(0);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM aichat_answer_extracted_keywords`).get() as { n: number }).n).toBe(0);
  });

  it('回答を削除すると切り出し結果とキーワード群も消える', async () => {
    const db = setupDb();
    await saveAnswerKeywordExtraction(wrapD1(db) as never, {
      userId: 'u1', shareId: 's1', model: EMBED, scoreMethod: EMBED_METHOD,
      analysis: { documentVector: [1], candidateCount: 1, keywords: [{ term: '量子', score: 1, vector: [1] }] },
      terms: ['量子'], fallback: null,
    });
    db.prepare(`DELETE FROM ai_chat_shares WHERE id = 's1'`).run();
    expect((db.prepare(`SELECT COUNT(*) AS n FROM aichat_answer_extracted_keywords`).get() as { n: number }).n).toBe(0);
  });

  it('termsに同じ語が重複していても1行にまとめて保存する(一意制約でbatch全体を失敗させない)', async () => {
    const db = setupDb();
    await saveAnswerKeywordExtraction(wrapD1(db) as never, {
      userId: 'u1', shareId: 's1', model: '@cf/google/gemma-4-26b-a4b-it', scoreMethod: LLM_METHOD,
      analysis: null, terms: ['量子', '量子', '計算'], fallback: { errorCode: 'AI_ERROR', detail: 'x' },
    });
    expect(db.prepare(`SELECT rank, keyword FROM aichat_answer_extracted_keywords ORDER BY rank`).all()).toEqual([
      { rank: 1, keyword: '量子' }, { rank: 2, keyword: '計算' },
    ]);
  });

  it('キーワードが0件でも切り出しの記録(本文ベクトル)は保存する', async () => {
    const db = setupDb();
    await saveAnswerKeywordExtraction(wrapD1(db) as never, {
      userId: 'u1', shareId: 's1', model: EMBED, scoreMethod: EMBED_METHOD,
      analysis: { documentVector: [], candidateCount: 0, keywords: [] },
      terms: [], fallback: null,
    });
    expect(db.prepare(`SELECT dim, document_vector FROM aichat_answer_keyword_extractions`).get()).toEqual({ dim: null, document_vector: null });
  });
});

describe('saveAnswerKeywordExtraction: 他モデルのスコアの保存(aichat_answer_keyword_scores)', () => {
  it('PlaMoの類似度を、モデルIDを正規化してキーワードごとに別表へ保存する', async () => {
    const db = setupDb();
    await saveAnswerKeywordExtraction(wrapD1(db) as never, {
      userId: 'u1', shareId: 's1', model: EMBED, scoreMethod: EMBED_METHOD,
      analysis: { documentVector: [1], candidateCount: 2, keywords: [{ term: '量子', score: 0.9, vector: [1] }, { term: '計算', score: 0.5, vector: [1] }] },
      terms: ['量子', '計算'],
      extraScores: [{ model: PLAMO, scoreMethod: PLAIN_METHOD, scores: { '量子': 0.71, '計算': 0.33, '関係ない語': 0.99 } }],
      fallback: null,
    });
    const rows = db.prepare(
      `SELECT k.keyword, m.name AS model, s.similarity, s.score_method
       FROM aichat_answer_keyword_scores s
       JOIN aichat_answer_extracted_keywords k ON k.extraction_id = s.extraction_id AND k.rank = s.rank
       JOIN aichat_model_names m ON m.id = s.model_id
       ORDER BY k.rank`
    ).all() as { keyword: string; model: string; similarity: number; score_method: string }[];
    expect(rows.every((r) => r.score_method === PLAIN_METHOD)).toBe(true);
    expect(rows.map((r) => [r.keyword, r.model])).toEqual([['量子', PLAMO], ['計算', PLAMO]]);
    expect(rows[0].similarity).toBeCloseTo(0.71);
    expect(db.prepare(`SELECT name FROM aichat_model_names ORDER BY id`).all()).toEqual([{ name: EMBED }, { name: PLAMO }]);
  });

  it('スコアが無いキーワード(PlaMoのベクタ化に失敗した語)は行を作らない', async () => {
    const db = setupDb();
    await saveAnswerKeywordExtraction(wrapD1(db) as never, {
      userId: 'u1', shareId: 's1', model: EMBED, scoreMethod: EMBED_METHOD,
      analysis: { documentVector: [1], candidateCount: 2, keywords: [] },
      terms: ['量子', '計算'],
      extraScores: [{ model: PLAMO, scoreMethod: PLAIN_METHOD, scores: { '量子': 0.5 } }],
      fallback: null,
    });
    expect((db.prepare(`SELECT COUNT(*) AS n FROM aichat_answer_keyword_scores`).get() as { n: number }).n).toBe(1);
  });

  it('切り出し直すと前回のスコアも置き換わる', async () => {
    const db = setupDb();
    const d1 = wrapD1(db) as never;
    const base = { userId: 'u1', shareId: 's1', model: EMBED, scoreMethod: EMBED_METHOD, fallback: null, analysis: { documentVector: [1], candidateCount: 1, keywords: [] } };
    await saveAnswerKeywordExtraction(d1, { ...base, terms: ['量子'], extraScores: [{ model: PLAMO, scoreMethod: PLAIN_METHOD, scores: { '量子': 0.1 } }] });
    await saveAnswerKeywordExtraction(d1, { ...base, terms: ['量子'], extraScores: [{ model: PLAMO, scoreMethod: PLAIN_METHOD, scores: { '量子': 0.8 } }] });
    const rows = db.prepare(`SELECT similarity FROM aichat_answer_keyword_scores`).all() as { similarity: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].similarity).toBeCloseTo(0.8);
  });
});
