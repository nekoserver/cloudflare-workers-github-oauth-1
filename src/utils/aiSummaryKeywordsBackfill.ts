// 既存のai_summary_log(要約済みでキーワード未抽出の行)に、後から
// キーワードを付けるためのバックフィル処理。単位は「ai_summary_logの1行」
// (PR要約・push要約はそのまとまり単位、要約ボタン生成分は1コミット単位)。
// 1回のAI呼び出しがコミットされる前提で、呼び出し元がlimitで1回の処理件数を
// 絞れるようにする(Workerのリクエストタイムアウトを避けるため)。

export type BackfillTargetRow = { id: number; requestId: string; summary: string };

export type BackfillFilter = {
  repoName?: string;
  /** event_date(YYYY-MM-DD)の下限。以上を対象とする。 */
  eventDateFrom?: string;
  /** event_date(YYYY-MM-DD)の上限。以下を対象とする。 */
  eventDateTo?: string;
};

export async function findSummaryKeywordBackfillTargets(
  db: D1Database,
  limit: number,
  filter: BackfillFilter = {},
): Promise<BackfillTargetRow[]> {
  const conditions = ["l.summary IS NOT NULL", "l.summary != ''", 'k.id IS NULL'];
  const params: unknown[] = [];
  if (filter.repoName) {
    conditions.push('l.repo_full_name = ?');
    params.push(filter.repoName);
  }
  if (filter.eventDateFrom) {
    conditions.push('l.event_date >= ?');
    params.push(filter.eventDateFrom);
  }
  if (filter.eventDateTo) {
    conditions.push('l.event_date <= ?');
    params.push(filter.eventDateTo);
  }
  params.push(limit);

  const rows = await db.prepare(
    `SELECT l.id, l.request_id, l.summary FROM ai_summary_log l
     LEFT JOIN ai_summary_keywords k ON k.summary_log_id = l.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY l.id
     ORDER BY l.id ASC
     LIMIT ?`
  ).bind(...params).all<{ id: number; request_id: string; summary: string }>();
  return (rows.results ?? []).map((row) => ({ id: row.id, requestId: row.request_id, summary: row.summary }));
}

export type BackfillOutcome = {
  processed: number;
  succeeded: number;
  failed: { id: number; requestId: string; error: string }[];
};

/**
 * 対象行ごとにextractKeywords(呼び出し元がextractSummaryKeywordsを渡す想定)で
 * キーワードを抽出し、saveKeywords(saveSummaryKeywords)で保存する。1件の
 * 失敗が他の行の処理を止めないよう、継続してログに残す(握りつぶさない)。
 */
export async function runSummaryKeywordBackfill(
  targets: BackfillTargetRow[],
  extractKeywords: (summary: string) => Promise<string[]>,
  saveKeywords: (requestId: string, keywords: string[]) => Promise<void>,
): Promise<BackfillOutcome> {
  const failed: { id: number; requestId: string; error: string }[] = [];
  let succeeded = 0;
  for (const target of targets) {
    try {
      const keywords = await extractKeywords(target.summary);
      await saveKeywords(target.requestId, keywords);
      succeeded++;
    } catch (error) {
      failed.push({ id: target.id, requestId: target.requestId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { processed: targets.length, succeeded, failed };
}
