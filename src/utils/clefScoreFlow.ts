import { computeJevEvaluationPlan } from './jevEvaluation';
import { buildJevValuesForLoop, computeJevButtonState, isMissingTableError, type JevLoopValue, type JevButtonState } from './jevAnswerValues';
import { fetchAllLabels, type JevScoreDb } from './jevScoreFlow';
import { callClefScoreApi, DEFAULT_CLEF_SCORE_MODEL, type ClefScoreAiBinding, type ClefScoreModel } from './clefScoreApi';

// Clefによるラベル評価のオーケストレーション。PLAN.cloudflare-workers-github-oauth-1.
// 20261011.judgment-models.mdのステップ③。runJevScoreForShare(jevScoreFlow.ts)と
// 同じ構造(未評価ラベルだけ問い合わせ→書き込み→ベリファイ)だが、書き込み先が
// clef_evaluations(jev_evaluationsとは別テーブル、migrations/0171)で、
// 呼び出し先がcallClefScoreApi(env.AI.run())になっている。
//
// jev_labels(質問定義)はJevと共有する(fetchAllLabelsをjevScoreFlow.tsから
// 再利用、質問定義を複製しない)。jev_evaluationsには一切書き込まない
// (既存のJevスコアと混ざらない、PLAN・EVALで決めた「追加専用」方針)。

export type ClefScoreFlowInput = {
  db: JevScoreDb;
  ai: ClefScoreAiBinding;
  clefModel?: ClefScoreModel;
  targetType: string;
  userId: string;
  shareId: string;
  model: string | null;
  stateText: string;
};

export type ClefScoreFlowResult =
  | { ok: true; values: JevLoopValue[]; state: JevButtonState; verified: true }
  | { ok: false; status: 500; error: string }
  | { ok: false; status: 502; error: string };

async function fetchClefEvaluatedRows(
  db: JevScoreDb,
  targetType: string,
  userId: string,
  shareId: string,
  model: string | null,
  clefModel: string,
): Promise<{ ok: true; rows: { jev_label_id: number; value: number }[] } | { ok: false; error: string }> {
  try {
    const rows = await db
      .prepare(
        'SELECT jev_label_id, value FROM clef_evaluations WHERE target_type = ? AND user_id = ? AND share_id = ? AND (model = ? OR (model IS NULL AND ? IS NULL)) AND clef_model = ?'
      )
      .bind(targetType, userId, shareId, model, model, clefModel)
      .all<{ jev_label_id: number; value: number }>();
    return { ok: true, rows: rows.results ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingTableError(message)) {
      return { ok: false, error: 'clef_evaluationsテーブルが存在しません(マイグレーション未適用の可能性があります)' };
    }
    return { ok: false, error: 'clef_evaluations取得でサーバーエラーが発生しました: ' + message };
  }
}

/**
 * 未評価ラベルだけをClefへ問い合わせ、clef_evaluationsへ書き込んだ後、
 * 実際にDBから読み戻して全pendingラベルが揃っているか確認(ベリファイ)する。
 * runJevScoreForShareと同じ方針(書き込みSQLの成功reportだけでは信用しない)。
 */
export async function runClefScoreForShare(input: ClefScoreFlowInput): Promise<ClefScoreFlowResult> {
  const { db, ai, targetType, userId, shareId, model, stateText } = input;
  const clefModel = input.clefModel ?? DEFAULT_CLEF_SCORE_MODEL;

  const labelsResult = await fetchAllLabels(db);
  if (!labelsResult.ok) return { ok: false, status: 500, error: labelsResult.error };
  const allLabels = labelsResult.labels;
  if (allLabels.length === 0) {
    return { ok: false, status: 500, error: 'jev_labelsが1件も登録されていません' };
  }

  const evaluatedResult = await fetchClefEvaluatedRows(db, targetType, userId, shareId, model, clefModel);
  if (!evaluatedResult.ok) return { ok: false, status: 500, error: evaluatedResult.error };

  const plan = computeJevEvaluationPlan(allLabels, evaluatedResult.rows);
  if (plan.pending.length > 0) {
    const clefResult = await callClefScoreApi({ ai, state: stateText, labels: plan.pending, model: clefModel });
    if (!clefResult.ok) {
      return { ok: false, status: 502, error: `Clef呼び出しに失敗しました(${clefResult.errorCode}): ${clefResult.detail}` };
    }
    try {
      for (const score of clefResult.scores) {
        await db
          .prepare('INSERT OR IGNORE INTO clef_evaluations (target_type, share_id, user_id, model, jev_label_id, clef_model, value) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(targetType, shareId, userId, model, score.labelId, clefModel, score.value)
          .run();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 500, error: 'clef_evaluations保存でサーバーエラーが発生しました: ' + message };
    }
  }

  // ベリファイ: 書き込んだはずのラベルが実際にDBへ反映されているかを
  // 読み戻して確認する(runJevScoreForShareと同じ方針)。
  const verifyResult = await fetchClefEvaluatedRows(db, targetType, userId, shareId, model, clefModel);
  if (!verifyResult.ok) return { ok: false, status: 500, error: verifyResult.error };
  const verifiedIds = new Set(verifyResult.rows.map((r) => r.jev_label_id));
  const missingAfterWrite = plan.pending.filter((label) => !verifiedIds.has(label.id));
  if (missingAfterWrite.length > 0) {
    return { ok: false, status: 500, error: 'clef_evaluationsへの書き込みをベリファイできませんでした(一部ラベルが未反映です)' };
  }

  const values = buildJevValuesForLoop(verifyResult.rows);
  return { ok: true, values, state: computeJevButtonState(values, false), verified: true };
}
