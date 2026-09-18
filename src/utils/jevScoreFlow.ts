import { parseLabelCriteria, computeJevEvaluationPlan, callJevApi, type JevLabel, type JevFetch } from './jevEvaluation';
import { buildJevValuesForLoop, computeJevButtonState, isMissingTableError, type JevLoopValue, type JevButtonState } from './jevAnswerValues';

// AIチャット詳細プレビューモーダルの📔ボタン(アイコン設置→状態判定→
// 「追加しますか」モーダル→Jev問い合わせ→jev_evaluations書き込み→
// ベリファイ)のうち、「Jev問い合わせからDB書き込み・ベリファイまで」を
// 1関数にまとめたもの。POST /api/aichat/jev-scoreハンドラから呼ぶほか、
// 将来ai_chat_shares以外の対象(国名キーワード等)にも使えるよう、
// 評価対象のテキスト(stateText)は呼び出し元が解決して渡す設計にしている
// (ai_chat_sharesへの依存をこの関数に持ち込まない)。

export type JevScoreDb = {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all<T>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
  };
};

export type JevScoreFlowInput = {
  db: JevScoreDb;
  jevApiKey: string;
  fetchImpl: JevFetch;
  targetType: string;
  userId: string;
  shareId: string;
  model: string | null;
  stateText: string;
};

export type JevScoreFlowResult =
  | { ok: true; values: JevLoopValue[]; state: JevButtonState; verified: true }
  | { ok: false; status: 500; error: string }
  | { ok: false; status: 502; error: string };

async function fetchAllLabels(db: JevScoreDb): Promise<{ ok: true; labels: JevLabel[] } | { ok: false; error: string }> {
  try {
    const rows = await db
      .prepare('SELECT id, question_text, options_json FROM jev_labels')
      .bind()
      .all<{ id: number; question_text: string; options_json: string | null }>();
    const labels: JevLabel[] = [];
    for (const r of rows.results ?? []) {
      const criteria = parseLabelCriteria(r.options_json);
      if (!criteria) {
        return { ok: false, error: `ラベル(id=${r.id})にJev用のcriteria(options_json、2要素配列)が正しく設定されていません` };
      }
      labels.push({ id: r.id, question_text: r.question_text, criteria });
    }
    return { ok: true, labels };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingTableError(message)) {
      return { ok: false, error: 'jev_labelsテーブルが存在しません(マイグレーション未適用の可能性があります)' };
    }
    return { ok: false, error: 'jev_labels取得でサーバーエラーが発生しました: ' + message };
  }
}

async function fetchEvaluatedRows(
  db: JevScoreDb,
  targetType: string,
  userId: string,
  shareId: string,
  model: string | null,
): Promise<{ ok: true; rows: { jev_label_id: number; value: number }[] } | { ok: false; error: string }> {
  try {
    const rows = await db
      .prepare(
        'SELECT jev_label_id, value FROM jev_evaluations WHERE target_type = ? AND user_id = ? AND share_id = ? AND (model = ? OR (model IS NULL AND ? IS NULL))'
      )
      .bind(targetType, userId, shareId, model, model)
      .all<{ jev_label_id: number; value: number }>();
    return { ok: true, rows: rows.results ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingTableError(message)) {
      return { ok: false, error: 'jev_evaluationsテーブルが存在しません(マイグレーション未適用の可能性があります)' };
    }
    return { ok: false, error: 'jev_evaluations取得でサーバーエラーが発生しました: ' + message };
  }
}

/**
 * 未評価ラベルだけをJevへ問い合わせ、jev_evaluationsへ書き込んだ後、
 * 実際にDBから読み戻して全pendingラベルが揃っているか確認(ベリファイ)する。
 * 書き込みSQLの成功reportだけでは信用しない。
 */
export async function runJevScoreForShare(input: JevScoreFlowInput): Promise<JevScoreFlowResult> {
  const { db, jevApiKey, fetchImpl, targetType, userId, shareId, model, stateText } = input;

  const labelsResult = await fetchAllLabels(db);
  if (!labelsResult.ok) return { ok: false, status: 500, error: labelsResult.error };
  const allLabels = labelsResult.labels;
  if (allLabels.length === 0) {
    return { ok: false, status: 500, error: 'jev_labelsが1件も登録されていません' };
  }

  const evaluatedResult = await fetchEvaluatedRows(db, targetType, userId, shareId, model);
  if (!evaluatedResult.ok) return { ok: false, status: 500, error: evaluatedResult.error };

  const plan = computeJevEvaluationPlan(allLabels, evaluatedResult.rows);
  if (plan.pending.length > 0) {
    const jevResult = await callJevApi({ apiKey: jevApiKey, state: stateText, labels: plan.pending, fetchImpl });
    if (!jevResult.ok) {
      return { ok: false, status: 502, error: `Jev API呼び出しに失敗しました(${jevResult.errorCode}): ${jevResult.detail}` };
    }
    try {
      for (const score of jevResult.scores) {
        await db
          .prepare('INSERT OR IGNORE INTO jev_evaluations (target_type, share_id, user_id, model, jev_label_id, value) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(targetType, shareId, userId, model, score.labelId, score.value)
          .run();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 500, error: 'jev_evaluations保存でサーバーエラーが発生しました: ' + message };
    }
  }

  // ベリファイ: 書き込んだはずのラベルが実際にDBへ反映されているかを
  // 読み戻して確認する。
  const verifyResult = await fetchEvaluatedRows(db, targetType, userId, shareId, model);
  if (!verifyResult.ok) return { ok: false, status: 500, error: verifyResult.error };
  const verifiedIds = new Set(verifyResult.rows.map((r) => r.jev_label_id));
  const missingAfterWrite = plan.pending.filter((label) => !verifiedIds.has(label.id));
  if (missingAfterWrite.length > 0) {
    return { ok: false, status: 500, error: 'jev_evaluationsへの書き込みをベリファイできませんでした(一部ラベルが未反映です)' };
  }

  const values = buildJevValuesForLoop(verifyResult.rows);
  return { ok: true, values, state: computeJevButtonState(values, false), verified: true };
}
