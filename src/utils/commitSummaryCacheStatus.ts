const CHUNK_SIZE = 40;

export async function findCachedCommitHashes(db: D1Database, repoName: string, commitHashes: string[]): Promise<Set<string>> {
  const cached = new Set<string>();
  for (let i = 0; i < commitHashes.length; i += CHUNK_SIZE) {
    const chunk = commitHashes.slice(i, i + CHUNK_SIZE);
    const marks = chunk.map(() => '?').join(',');
    const direct = await db.prepare(
      `SELECT DISTINCT c.commit_sha AS sha FROM commit_agent_log c
       JOIN ai_summary_log l ON l.request_id = c.request_id
       WHERE c.repo_full_name = ? AND c.commit_sha IN (${marks})
         AND l.summary IS NOT NULL AND l.summary != ''`
    ).bind(repoName, ...chunk).all<{ sha: string }>();
    for (const row of direct.results ?? []) cached.add(row.sha);

    const viaMerge = await db.prepare(
      `SELECT DISTINCT i.commit_hash AS sha FROM repo_commit_index i
       JOIN ai_summary_log l ON l.repo_full_name = i.repo_name AND l.pr_number = i.github_pr_number
       WHERE i.repo_name = ? AND i.commit_hash IN (${marks}) AND i.github_pr_number IS NOT NULL
         AND l.summary IS NOT NULL AND l.summary != ''`
    ).bind(repoName, ...chunk).all<{ sha: string }>();
    for (const row of viaMerge.results ?? []) cached.add(row.sha);
  }
  return cached;
}
