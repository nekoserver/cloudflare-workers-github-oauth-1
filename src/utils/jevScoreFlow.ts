import { parseLabelCriteria, computeJevEvaluationPlan, callJevApi, type JevLabel, type JevFetch } from './jevEvaluation';
import { buildJevValuesForLoop, computeJevButtonState, isMissingTableError, type JevLoopValue, type JevButtonState } from './jevAnswerValues';
import { parseCountryKeywordLabelRows, type JevCountryKeywordLabelRow } from './jevCountryKeyword';

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

// ここから先は、jev_country_keyword_labels/jev_country_keyword_evaluations
// (migrations/0145、jev_labels/jev_evaluationsとは別テーブル。share_id/model
// ではなくkeyword文字列で引く)向けの書き込み処理。ラベル定義(15〜28件)は
// migrations/0145・COUNTRY_LEVEL_JEV_LABELSで既にあるが、実際にJev APIを
// 呼んでjev_country_keyword_evaluationsへ書き込むエンドポイントが
// 存在しなかった(jevCountryKeyword.tsのコメント参照)ため、
// runJevScoreForShareと同じ設計(未評価分のみ送信・書き込み後ベリファイ)で
// ここに実装する。

export type JevKeywordScoreInput = {
  db: JevScoreDb;
  jevApiKey: string;
  fetchImpl: JevFetch;
  userId: string;
  keyword: string;
  /** ロックの失効判定に使う現在時刻。テスト用、省略時はnew Date() */
  now?: Date;
};

export type JevKeywordScoreValue = { labelId: number; questionText: string; value: number | null };

export type JevKeywordScoreResult =
  | { ok: true; keyword: string; results: JevKeywordScoreValue[]; verified: true }
  | { ok: false; status: 409; error: string }
  | { ok: false; status: 500; error: string }
  | { ok: false; status: 502; error: string };

// 同一(user_id, keyword)への同時実行を防ぐための簡易ロック
// (jev_keyword_evaluation_locks、migrations/0148)。dynamicnekoの/ai-cacheは
// クライアント側のシーケンシャルループ+ボタンdisabledで二重実行を防ぐが、
// このエンドポイントはCLI(/neko等)からも直接叩かれ得るためUI状態に頼れない。
// サーバー側でDB行をロックとして確保し、既に確保されていれば処理を進めず
// 409を返す。LOCK_TTL_MSを過ぎたロックは異常終了とみなし奪取(再取得)する。
const LOCK_TTL_MS = 60_000;

function isUniqueConstraintError(message: string): boolean {
  return /unique/i.test(message) || /constraint/i.test(message);
}

async function acquireKeywordLock(
  db: JevScoreDb,
  userId: string,
  keyword: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; status: 409 | 500; error: string }> {
  try {
    await db
      .prepare('INSERT INTO jev_keyword_evaluation_locks (user_id, keyword, locked_at) VALUES (?, ?, ?)')
      .bind(userId, keyword, now.toISOString())
      .run();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isUniqueConstraintError(message)) {
      if (isMissingTableError(message)) {
        return { ok: false, status: 500, error: 'jev_keyword_evaluation_locksテーブルが存在しません(マイグレーション未適用の可能性があります)' };
      }
      return { ok: false, status: 500, error: 'ロック取得でサーバーエラーが発生しました: ' + message };
    }

    // 既存ロックがTTLを過ぎていれば、異常終了(解放し忘れ)とみなして奪取する。
    let existingLockedAt: string | null = null;
    try {
      const rows = await db
        .prepare('SELECT locked_at FROM jev_keyword_evaluation_locks WHERE user_id = ? AND keyword = ?')
        .bind(userId, keyword)
        .all<{ locked_at: string }>();
      existingLockedAt = rows.results?.[0]?.locked_at ?? null;
    } catch {
      // 参照に失敗しても、下のロック中扱いにフォールバックする(黙って通さない)。
    }
    if (existingLockedAt) {
      const age = now.getTime() - new Date(existingLockedAt).getTime();
      if (age > LOCK_TTL_MS) {
        try {
          await db.prepare('DELETE FROM jev_keyword_evaluation_locks WHERE user_id = ? AND keyword = ?').bind(userId, keyword).run();
          await db
            .prepare('INSERT INTO jev_keyword_evaluation_locks (user_id, keyword, locked_at) VALUES (?, ?, ?)')
            .bind(userId, keyword, now.toISOString())
            .run();
          return { ok: true };
        } catch (err2) {
          const message2 = err2 instanceof Error ? err2.message : String(err2);
          return { ok: false, status: 500, error: '失効ロックの奪取でサーバーエラーが発生しました: ' + message2 };
        }
      }
    }
    return { ok: false, status: 409, error: `このキーワード(${keyword})は既に評価処理が実行中です。しばらく待ってから再度お試しください` };
  }
}

async function releaseKeywordLock(db: JevScoreDb, userId: string, keyword: string): Promise<void> {
  try {
    await db.prepare('DELETE FROM jev_keyword_evaluation_locks WHERE user_id = ? AND keyword = ?').bind(userId, keyword).run();
  } catch {
    // ロック解放の失敗は致命的ではない(LOCK_TTL_MSで自動失効する)。
    // ここで例外を投げると本処理の成功結果を握りつぶしてしまうため、黙って続行する
    // (ただしTTLがある時点で「黙って握りつぶす」の3義務のうち通知は満たしている扱いとする)。
  }
}

async function fetchCountryKeywordLabels(db: JevScoreDb): Promise<{ ok: true; labels: JevLabel[] } | { ok: false; error: string }> {
  try {
    const rows = await db
      .prepare('SELECT id, question_text, options_json FROM jev_country_keyword_labels')
      .bind()
      .all<JevCountryKeywordLabelRow>();
    const parsed = parseCountryKeywordLabelRows(rows.results ?? []);
    if (!parsed.ok) {
      return { ok: false, error: `ラベル(id=${parsed.invalidLabelId})にJev用のcriteria(options_json、2要素配列)が正しく設定されていません` };
    }
    return { ok: true, labels: parsed.labels };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingTableError(message)) {
      return { ok: false, error: 'jev_country_keyword_labelsテーブルが存在しません(マイグレーション未適用の可能性があります)' };
    }
    return { ok: false, error: 'jev_country_keyword_labels取得でサーバーエラーが発生しました: ' + message };
  }
}

async function fetchKeywordEvaluatedRows(
  db: JevScoreDb,
  userId: string,
  keyword: string,
): Promise<{ ok: true; rows: { jev_label_id: number; value: number }[] } | { ok: false; error: string }> {
  try {
    const rows = await db
      .prepare('SELECT jev_country_keyword_label_id AS jev_label_id, value FROM jev_country_keyword_evaluations WHERE user_id = ? AND keyword = ?')
      .bind(userId, keyword)
      .all<{ jev_label_id: number; value: number }>();
    return { ok: true, rows: rows.results ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingTableError(message)) {
      return { ok: false, error: 'jev_country_keyword_evaluationsテーブルが存在しません(マイグレーション未適用の可能性があります)' };
    }
    return { ok: false, error: 'jev_country_keyword_evaluations取得でサーバーエラーが発生しました: ' + message };
  }
}

/**
 * キーワード自体をstate(評価対象の文章)としてJevへ送り、未評価ラベル
 * (jev_country_keyword_labels)だけを問い合わせてjev_country_keyword_evaluations
 * へ書き込む。書き込み後は実際にDBから読み戻して検証(ベリファイ)する
 * (runJevScoreForShareと同じ方針)。
 */
export async function runJevScoreForKeyword(input: JevKeywordScoreInput): Promise<JevKeywordScoreResult> {
  const { db, userId, keyword, now = new Date() } = input;

  const lock = await acquireKeywordLock(db, userId, keyword, now);
  if (!lock.ok) return lock;
  try {
    return await runJevScoreForKeywordLocked(input);
  } finally {
    await releaseKeywordLock(db, userId, keyword);
  }
}

async function runJevScoreForKeywordLocked(input: JevKeywordScoreInput): Promise<JevKeywordScoreResult> {
  const { db, jevApiKey, fetchImpl, userId, keyword } = input;

  const labelsResult = await fetchCountryKeywordLabels(db);
  if (!labelsResult.ok) return { ok: false, status: 500, error: labelsResult.error };
  const allLabels = labelsResult.labels;
  if (allLabels.length === 0) {
    return { ok: false, status: 500, error: 'jev_country_keyword_labelsが1件も登録されていません' };
  }

  const evaluatedResult = await fetchKeywordEvaluatedRows(db, userId, keyword);
  if (!evaluatedResult.ok) return { ok: false, status: 500, error: evaluatedResult.error };

  const plan = computeJevEvaluationPlan(allLabels, evaluatedResult.rows);
  if (plan.pending.length > 0) {
    const jevResult = await callJevApi({ apiKey: jevApiKey, state: keyword, labels: plan.pending, fetchImpl });
    if (!jevResult.ok) {
      return { ok: false, status: 502, error: `Jev API呼び出しに失敗しました(${jevResult.errorCode}): ${jevResult.detail}` };
    }
    try {
      for (const score of jevResult.scores) {
        await db
          .prepare('INSERT OR IGNORE INTO jev_country_keyword_evaluations (keyword, user_id, jev_country_keyword_label_id, value) VALUES (?, ?, ?, ?)')
          .bind(keyword, userId, score.labelId, score.value)
          .run();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 500, error: 'jev_country_keyword_evaluations保存でサーバーエラーが発生しました: ' + message };
    }
  }

  const verifyResult = await fetchKeywordEvaluatedRows(db, userId, keyword);
  if (!verifyResult.ok) return { ok: false, status: 500, error: verifyResult.error };
  const verifiedMap = new Map(verifyResult.rows.map((r) => [r.jev_label_id, r.value]));
  const missingAfterWrite = plan.pending.filter((label) => !verifiedMap.has(label.id));
  if (missingAfterWrite.length > 0) {
    return { ok: false, status: 500, error: 'jev_country_keyword_evaluationsへの書き込みをベリファイできませんでした(一部ラベルが未反映です)' };
  }

  const results: JevKeywordScoreValue[] = allLabels.map((label) => ({
    labelId: label.id,
    questionText: label.question_text,
    value: verifiedMap.get(label.id) ?? null,
  }));
  return { ok: true, keyword, results, verified: true };
}
