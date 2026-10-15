/**
 * 対象: POST /api/tree-view-keyword-search-log-external(保存)と
 * 傾向分析ページ(tree_view_keyword_search_log/tree_view_keyword_search_resultsの
 * 時系列集計)のための、DBアクセスを含まない純粋関数(CLAUDE.mdルール15)。
 */

export type KeywordOccurrenceInputRow = { keyword: string; occurrenceCount: number };

/**
 * dynamicnekoから送られてくる「切り出しキー×AIチャット出現回数」の結果を
 * tree_view_keyword_search_resultsへ保存する前の検証・整形。
 *
 * 故障シナリオ:
 * - keywordが空文字・空白のみ(除外しないとUNIQUE制約の無い行が無意味に増える)
 * - occurrenceCountが負値・非整数・NaN(クライアント側の不具合や改ざんされた
 *   リクエストボディをそのまま保存しない)
 * - 同じkeywordが複数行ある(送信側の重複をそのまま保存せず合算する)
 */
export function sanitizeKeywordOccurrenceRowsForSave(
  rows: KeywordOccurrenceInputRow[],
): KeywordOccurrenceInputRow[] {
  const countByKeyword = new Map<string, number>();
  for (const row of rows) {
    const keyword = (row.keyword ?? '').trim();
    if (!keyword) continue;
    const count = Number.isFinite(row.occurrenceCount) && row.occurrenceCount >= 0 ? Math.floor(row.occurrenceCount) : 0;
    countByKeyword.set(keyword, (countByKeyword.get(keyword) ?? 0) + count);
  }
  return Array.from(countByKeyword, ([keyword, occurrenceCount]) => ({ keyword, occurrenceCount }));
}

export type KeywordSearchLogRow = { id: number; repoName: string; query: string; fileCount: number; searchedAt: string };
export type KeywordSearchResultCountRow = { searchLogId: number; resultCount: number; totalOccurrenceCount: number | null };

export type KeywordSearchSnapshot = {
  searchLogId: number;
  searchedAt: string;
  fileCount: number;
  keywordCount: number;
  totalOccurrenceCount: number;
};

export type KeywordSearchGroupKey = { repoName: string; query: string };

/**
 * 検索ログ(logs)と、各search_log_idごとの集計済み結果(resultCounts、
 * SQL側でGROUP BY search_log_idしたCOUNT(*)・SUM(occurrence_count))を
 * 突き合わせ、(repoName, query)ごとに時系列(searched_at昇順)のスナップショット
 * 配列へまとめる。グラフ化(ユーザー要望2026-10-15)で使う想定のため、
 * 差分計算はせず生の時系列データをそのまま返す。キーはrepoNameとqueryの
 * 組で区切る(同じクエリ文字列を別リポジトリで検索したログを混同しない)。
 *
 * 故障シナリオ:
 * - 別リポジトリで同じクエリ文字列を検索したログが同じグループに混ざる
 * - resultCountsにそのsearch_log_idの行が無い(結果0件で保存された)場合に
 *   keywordCount/totalOccurrenceCountが欠落する(0件として扱えない)
 * - searched_atの昇順にならず、グラフの時系列が逆転する
 */
export function buildKeywordSearchSnapshotsByQuery(
  logs: KeywordSearchLogRow[],
  resultCounts: KeywordSearchResultCountRow[],
): Map<string, { key: KeywordSearchGroupKey; snapshots: KeywordSearchSnapshot[] }> {
  const countsByLogId = new Map(resultCounts.map((r) => [r.searchLogId, r]));
  const byGroup = new Map<string, { key: KeywordSearchGroupKey; snapshots: KeywordSearchSnapshot[] }>();

  for (const log of logs) {
    const counts = countsByLogId.get(log.id);
    const snapshot: KeywordSearchSnapshot = {
      searchLogId: log.id,
      searchedAt: log.searchedAt,
      fileCount: log.fileCount,
      keywordCount: counts?.resultCount ?? 0,
      totalOccurrenceCount: counts?.totalOccurrenceCount ?? 0,
    };
    const groupKey = `${log.repoName}\u0000${log.query}`;
    const entry = byGroup.get(groupKey) ?? { key: { repoName: log.repoName, query: log.query }, snapshots: [] };
    entry.snapshots.push(snapshot);
    byGroup.set(groupKey, entry);
  }

  for (const entry of byGroup.values()) {
    entry.snapshots.sort((a, b) => a.searchedAt.localeCompare(b.searchedAt));
  }
  return byGroup;
}
