import type { KeywordVectorAnalysis, EmbeddingKeywordErrorCode } from './embeddingKeywordExtraction';

/**
 * AIチャットの✂️で切り出したキーワード群と、切り出しと同時に得たベクトル分析を
 * D1へ保存する(migrations/0192)。
 *   - aichat_model_names: モデル名を正規化した表(1モデル1行)
 *   - aichat_answer_keyword_extractions: 回答ID(ai_chat_shares.id)とモデルIDを
 *     外部キーに持つ切り出しの記録。本文ベクトルとフォールバックの理由を持つ
 *   - aichat_answer_extracted_keywords: 切り出しIDを外部キーに持つキーワード群
 *     (順位・切り出しモデルでの本文との類似度・本文中の出現回数・ベクトル)
 *   - aichat_answer_keyword_scores: 切り出しモデル以外のモデル(✂️の後続処理の
 *     PlaMoなど)で計算した、本文とキーワードの類似度。(切り出しID, 順位)で
 *     キーワード表を、モデルIDでモデル表を参照する
 *
 * 同じ(user_id, share_id, model)で切り出し直したら前回のキーワードを置き換える。
 * すべての文をD1のbatchで実行するため、途中で失敗したら何も残らない。
 * 切り出しIDは、batchの中で(user_id, share_id, モデル名)からサブクエリで引く。
 */

export interface SaveAnswerKeywordExtractionInput {
  userId: string;
  shareId: string;
  /** 実際に切り出しに使ったモデル名 */
  model: string;
  /** 順位(スコア)の計算条件(KEYWORD_EXTRACTION_SCORE_METHODなど) */
  scoreMethod: string;
  /** 保存するキーワード(画面に返すフィルタ後の並び) */
  terms: string[];
  /** EmbeddingGemma 2で切り出したときのベクトル分析。フォールバック時はnull */
  analysis: KeywordVectorAnalysis | null;
  fallback: { errorCode: EmbeddingKeywordErrorCode; detail: string } | null;
  /** 出現回数を数える本文。省略時は0件として保存する */
  answerText?: string;
  /** 切り出しモデル以外で計算した類似度(モデルごとに キーワード→類似度) */
  extraScores?: Array<{ model: string; scoreMethod: string; scores: Record<string, number> }>;
}

/** 本文中にtermが現れる回数(重なりなし) */
export function countOccurrences(text: string, term: string): number {
  if (!text || !term) return 0;
  let count = 0;
  let pos = text.indexOf(term);
  while (pos !== -1) {
    count += 1;
    pos = text.indexOf(term, pos + term.length);
  }
  return count;
}

/**
 * vectorizeAnswerKeywordsがPlaMoなどで計算する、接頭辞なしの本文とキーワードの
 * コサイン類似度の計算条件。aichat_answer_keyword_scores.score_methodに保存する。
 */
export const EMBEDDING_PLAIN_COSINE_SCORE_METHOD = 'cosine;plain;v1';

function toBlob(vec: number[] | undefined | null): ArrayBuffer | null {
  return vec && vec.length > 0 ? new Float32Array(vec).buffer : null;
}

const MODEL_ID_SQL = `(SELECT id FROM aichat_model_names WHERE name = ?)`;
const EXTRACTION_ID_SQL = `(SELECT id FROM aichat_answer_keyword_extractions WHERE user_id = ? AND share_id = ? AND model_id = ${MODEL_ID_SQL})`;

export async function saveAnswerKeywordExtraction(db: D1Database, input: SaveAnswerKeywordExtractionInput): Promise<void> {
  const { userId, shareId, model, scoreMethod, analysis, fallback, answerText = '', extraScores = [] } = input;
  // キーワード表は(extraction_id, keyword)が一意のため、重複があるとbatch全体が失敗する
  const terms = [...new Set(input.terms)];
  const byTerm = new Map((analysis?.keywords ?? []).map((k) => [k.term, k]));
  const documentVector = analysis?.documentVector ?? [];
  const now = new Date().toISOString();

  const stmts: D1PreparedStatement[] = [
    db.prepare(`INSERT OR IGNORE INTO aichat_model_names (name) VALUES (?)`).bind(model),
    ...extraScores.map((e) => db.prepare(`INSERT OR IGNORE INTO aichat_model_names (name) VALUES (?)`).bind(e.model)),
    db.prepare(`DELETE FROM aichat_answer_keyword_scores WHERE extraction_id = ${EXTRACTION_ID_SQL}`)
      .bind(userId, shareId, model),
    db.prepare(`DELETE FROM aichat_answer_extracted_keywords WHERE extraction_id = ${EXTRACTION_ID_SQL}`)
      .bind(userId, shareId, model),
    db.prepare(
      `INSERT INTO aichat_answer_keyword_extractions
         (share_id, user_id, model_id, dim, document_vector, candidate_count, score_method, fallback_error_code, fallback_detail, extracted_at)
       VALUES (?, ?, ${MODEL_ID_SQL}, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, share_id, model_id) DO UPDATE SET
         dim = excluded.dim, document_vector = excluded.document_vector, candidate_count = excluded.candidate_count,
         score_method = excluded.score_method,
         fallback_error_code = excluded.fallback_error_code, fallback_detail = excluded.fallback_detail,
         extracted_at = excluded.extracted_at`
    ).bind(
      shareId, userId, model,
      documentVector.length > 0 ? documentVector.length : null,
      toBlob(documentVector),
      analysis ? analysis.candidateCount : null,
      scoreMethod,
      fallback?.errorCode ?? null,
      fallback?.detail ?? null,
      now,
    ),
  ];
  terms.forEach((term, i) => {
    const k = byTerm.get(term);
    stmts.push(
      db.prepare(
        `INSERT INTO aichat_answer_extracted_keywords (extraction_id, rank, keyword, score, occurrence_count, vector)
         VALUES (${EXTRACTION_ID_SQL}, ?, ?, ?, ?, ?)`
      ).bind(userId, shareId, model, i + 1, term, k ? k.score : null, countOccurrences(answerText, term), toBlob(k?.vector)),
    );
    for (const extra of extraScores) {
      const similarity = extra.scores[term];
      if (typeof similarity !== 'number' || !Number.isFinite(similarity)) continue;
      stmts.push(
        db.prepare(
          `INSERT INTO aichat_answer_keyword_scores (extraction_id, rank, model_id, similarity, score_method)
           VALUES (${EXTRACTION_ID_SQL}, ?, ${MODEL_ID_SQL}, ?, ?)`
        ).bind(userId, shareId, model, i + 1, extra.model, similarity, extra.scoreMethod),
      );
    }
  });
  await db.batch(stmts);
}
