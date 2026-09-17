/**
 * jev_evaluationsテーブルの質問ID別出現回数を集計し、多い順に並べる
 * (/jev-rev-viewerページの純粋ロジック部分)。
 */

export type JevEvaluationRow = { jev_label_id: number };
export type JevLabelRow = { id: number; question_text: string };

export type JevQuestionCount = {
  questionId: number;
  questionText: string;
  count: number;
};

const UNKNOWN_QUESTION_TEXT = '(不明な質問)';

/**
 * jev_evaluationsの全行から、質問ID(jev_label_id)ごとに重複を除いた
 * 出現回数を数える(この中間集計がいわゆる変数A)。jev_labelsに対応する
 * 行が無いID(削除済み等)は黙って除外せず「(不明な質問)」として残す。
 * 出現回数の多い順、同数なら質問IDの昇順で安定的に並べる。
 */
export function computeJevQuestionCounts(
  evaluations: JevEvaluationRow[],
  labels: JevLabelRow[],
): JevQuestionCount[] {
  const counts = new Map<number, number>();
  for (const row of evaluations) {
    counts.set(row.jev_label_id, (counts.get(row.jev_label_id) ?? 0) + 1);
  }

  const labelTextById = new Map(labels.map((l) => [l.id, l.question_text]));

  const result: JevQuestionCount[] = [];
  for (const [questionId, count] of counts) {
    result.push({
      questionId,
      count,
      questionText: labelTextById.get(questionId) ?? UNKNOWN_QUESTION_TEXT,
    });
  }

  result.sort((a, b) => b.count - a.count || a.questionId - b.questionId);
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 「出現回数/質問ID/質問文」を1行ずつ書き出したプレーンテキストを
 * <meta charset=utf-8><pre>...</pre>で囲んで返す。
 */
export function renderJevRevViewerPage(counts: JevQuestionCount[]): string {
  const lines = counts.map((c) => `${c.count}/${c.questionId}/${escapeHtml(c.questionText)}`);
  return `<meta charset=utf-8><pre>${lines.join('\n')}</pre>`;
}
