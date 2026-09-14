export type AichatQsearchLatestDb = {
  prepare(sql: string): {
    bind(...args: unknown[]): { all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> };
  };
};

export type LatestAiChatShareAnswer = {
  id: string;
  question: string;
  answer: string;
  model: string;
  created_at: string;
};

export type LatestAiChatShareAnswerResult =
  | { ok: true; value: LatestAiChatShareAnswer }
  | { ok: false; errorCode: 'missing_params' | 'not_found'; detail: string };

export function normalizeAichatQsearchQuestion(question: string): string {
  return question.replace(/\r?\n/g, ' ').trim();
}

export function isAichatQsearchUnknownModel(model: string): boolean {
  return !model.trim() || model.trim() === '(モデル不明)';
}

/**
 * AI応答過去ログを質問文とモデル名で検索し、created_atが一番新しい1件だけを返す。
 * 表に出す短縮モデル名はフルパス保存値の末尾と一致させる。
 */
export async function findLatestAiChatShareAnswer(
  db: AichatQsearchLatestDb,
  userId: string,
  question: string,
  model: string,
): Promise<LatestAiChatShareAnswerResult> {
  const normalizedQuestion = normalizeAichatQsearchQuestion(question);
  if (!normalizedQuestion) {
    return { ok: false, errorCode: 'missing_params', detail: 'question は必須です' };
  }
  const modelParam = (model ?? '').trim();
  const unknownModel = isAichatQsearchUnknownModel(modelParam) ? 1 : 0;
  const rows = await db
    .prepare(
      `SELECT s.id, s.question, s.answer, s.model, s.created_at
       FROM ai_chat_shares s
       WHERE s.user_id = ? AND s.deleted_at IS NULL
         AND REPLACE(REPLACE(TRIM(s.question), CHAR(13), ''), CHAR(10), ' ') = ?
         AND (
           CASE WHEN ? = 1 THEN TRIM(COALESCE(s.model, '')) = ''
           ELSE (s.model = ? OR (INSTR(s.model, '/') > 0 AND s.model LIKE '%/' || ?))
           END
         )
       ORDER BY s.created_at DESC
       LIMIT 1`,
    )
    .bind(userId, normalizedQuestion, unknownModel, modelParam, modelParam)
    .all<LatestAiChatShareAnswer>();
  const row = rows.results?.[0];
  if (!row) {
    return { ok: false, errorCode: 'not_found', detail: '一致する過去ログがありません' };
  }
  return { ok: true, value: row };
}
