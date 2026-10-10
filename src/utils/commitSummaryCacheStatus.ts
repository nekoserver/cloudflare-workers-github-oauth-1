const CHUNK_SIZE = 40;

export type CommitSummaryCacheStatus = {
  cached: Set<string>;
  withKeywords: Set<string>;
};

/**
 * 指定コミットshaごとに、要約キャッシュの有無(cached)と、その要約から
 * キーワードまで抽出済みか(withKeywords)を判定する。tree-viewの「要約」
 * ボタンをタップする前の事前色分け(キャッシュ済みかどうか・キー抽出済みか
 * どうか)に使う。withKeywordsはcachedの部分集合。
 */
export async function findCachedCommitHashes(db: D1Database, repoName: string, commitHashes: string[]): Promise<CommitSummaryCacheStatus> {
  const cached = new Set<string>();
  const withKeywords = new Set<string>();
  for (let i = 0; i < commitHashes.length; i += CHUNK_SIZE) {
    const chunk = commitHashes.slice(i, i + CHUNK_SIZE);
    const marks = chunk.map(() => '?').join(',');
    const direct = await db.prepare(
      `SELECT c.commit_sha AS sha, MAX(CASE WHEN k.id IS NOT NULL THEN 1 ELSE 0 END) AS hasKeywords
       FROM commit_agent_log c
       JOIN ai_summary_log l ON l.request_id = c.request_id
       LEFT JOIN ai_summary_keywords k ON k.summary_log_id = l.id
       WHERE c.repo_full_name = ? AND c.commit_sha IN (${marks})
         AND l.summary IS NOT NULL AND l.summary != ''
       GROUP BY c.commit_sha`
    ).bind(repoName, ...chunk).all<{ sha: string; hasKeywords: number }>();
    for (const row of direct.results ?? []) {
      cached.add(row.sha);
      if (row.hasKeywords) withKeywords.add(row.sha);
    }

    const viaMerge = await db.prepare(
      `SELECT i.commit_hash AS sha, MAX(CASE WHEN k.id IS NOT NULL THEN 1 ELSE 0 END) AS hasKeywords
       FROM repo_commit_index i
       JOIN ai_summary_log l ON l.repo_full_name = i.repo_name AND l.pr_number = i.github_pr_number
       LEFT JOIN ai_summary_keywords k ON k.summary_log_id = l.id
       WHERE i.repo_name = ? AND i.commit_hash IN (${marks}) AND i.github_pr_number IS NOT NULL
         AND l.summary IS NOT NULL AND l.summary != ''
       GROUP BY i.commit_hash`
    ).bind(repoName, ...chunk).all<{ sha: string; hasKeywords: number }>();
    for (const row of viaMerge.results ?? []) {
      cached.add(row.sha);
      if (row.hasKeywords) withKeywords.add(row.sha);
    }
  }
  return { cached, withKeywords };
}
