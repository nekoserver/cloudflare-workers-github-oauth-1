// commit-summary-external(ボタン押下時)・PRマージ/pushのWebhook自動要約、
// 3箇所で同じ「要約本文からキーワードを抽出してai_summary_keywordsへ保存する」
// 処理を使うための共通関数。extractPrerequisiteTerms/filterMeaningfulPrerequisiteTerms
// はindex.tsで定義されているため、循環import回避のため関数を引数で受け取る
// (fetchRepoTreeSnapshotのfetchImpl注入と同じ方針)。
// extractTermsの実引数はextractPrerequisiteTerms(ai: Ai, ...)を想定しており、
// Ai型はCloudflare WorkersのグローバルAmbient型なのでここではanyで受ける
// (呼び出し元のindex.ts側で実際の型チェックが効く)。

/**
 * 要約本文からキーワードを抽出する。AI未設定・本文が空・抽出失敗の場合は
 * 空配列を返す(要約本体の保存・返却を妨げないための非ブロッキング設計)。
 * 失敗はonErrorで呼び出し元のloggerへ伝える(握りつぶさない)。
 */
export async function extractSummaryKeywords<TAi>(
  ai: TAi | null | undefined,
  summaryText: string,
  extractTerms: (ai: TAi, text: string) => Promise<string[]>,
  filterTerms: (terms: string[]) => string[],
  onError?: (error: unknown) => void,
): Promise<string[]> {
  if (!ai || !summaryText) return [];
  try {
    return filterTerms(await extractTerms(ai, summaryText));
  } catch (error) {
    onError?.(error);
    return [];
  }
}

/**
 * 抽出済みキーワードをai_summary_keywordsへ保存する。summary_log_idは
 * request_id経由でai_summary_logから引く(呼び出し元はINSERT後のlastRowIdを
 * 持ち歩く必要がない)。keywordsが空なら何もしない。
 */
export async function saveSummaryKeywords(
  db: D1Database,
  requestId: string,
  keywords: string[],
  nowIso: string,
): Promise<void> {
  if (keywords.length === 0) return;
  await db.batch(keywords.map((keyword) => db.prepare(
    `INSERT OR IGNORE INTO ai_summary_keywords (summary_log_id, keyword, created_at)
     SELECT id, ?, ? FROM ai_summary_log WHERE request_id = ?`
  ).bind(keyword, nowIso, requestId)));
}
