/**
 * 対象: POST /api/tree-view-keyword-occurrence-externalのための集計ロジック。
 * tree-viewの検索窓にヒットしたファイル群から集めた「切り出しキー」
 * (ai_summary_keywordsに保存済みのコミット要約キーワード)ごとに、
 * AIチャット(aichat_search_log.select_count)での出現回数を付けて返す。
 * CLAUDE.mdルール15に従い、DBアクセスを含まない純粋関数として
 * ここに切り出す(呼び出し元のDBクエリ結果を受け取るだけにする)。
 */

export type KeywordOccurrenceRow = { keyword: string; cnt: number | null };
export type KeywordOccurrenceResult = { keyword: string; occurrenceCount: number };

/**
 * ai_summary_keywordsからJOINで取れたキーワード行(重複・前後空白を含み得る)
 * から、重複を除いた表示用キーワード一覧を作る。空文字列は除外する。
 */
export function dedupeKeywords(rows: { keyword: string }[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const trimmed = (row.keyword ?? '').trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
}

/**
 * 抽出済みキーワード(extractedKeywords、ファイル群に含まれる切り出しキー)
 * の1件1件に、AIチャットでの出現回数(countRows、aichat_search_logの
 * SUM(select_count)をkeyword別に集計した行)を突き合わせて返す。
 *
 * 故障シナリオ:
 * - 抽出キーワードがaichat_search_logに1件も無い(AIチャットで検索された
 *   ことが無い)場合、黙って除外せず出現回数0として出力する
 * - countRowsに同じkeywordの行が複数あっても(本来GROUP BYで1行のはずだが
 *   防御的に)合算する
 * - 出現回数の多い順に並べ、同数の場合はキーワードの文字コード順で
 *   安定的に並べる(表示が実行ごとにばらつかないようにする)
 */
export function buildKeywordOccurrenceResults(
  extractedKeywords: string[],
  countRows: KeywordOccurrenceRow[],
): KeywordOccurrenceResult[] {
  const countByKeyword = new Map<string, number>();
  for (const row of countRows) {
    const prev = countByKeyword.get(row.keyword) ?? 0;
    countByKeyword.set(row.keyword, prev + (row.cnt ?? 0));
  }

  const uniqueKeywords = Array.from(new Set(extractedKeywords.map((k) => k.trim()).filter((k) => k.length > 0)));

  return uniqueKeywords
    .map((keyword) => ({ keyword, occurrenceCount: countByKeyword.get(keyword) ?? 0 }))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.keyword.localeCompare(b.keyword));
}
