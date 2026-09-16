const GITHUB_API_BASE = 'https://api.github.com';

/** GitHub Trees APIで使う既定ブランチをRepository APIの応答から取り出す。 */
export function parseDefaultBranch(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const defaultBranch = (body as { default_branch?: unknown }).default_branch;
  return typeof defaultBranch === 'string' && defaultBranch.length > 0 ? defaultBranch : null;
}

/** owner・repoをパス要素としてエンコードしたRepository API URLを返す。 */
export function buildGithubRepositoryApiUrl(owner: string, repo: string): string {
  return `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

/**
 * Trees APIはGitの疑似参照 `HEAD` を常に解決するとは限らないため、Repository
 * APIから取得した実際の既定ブランチ名をtree_shaとして指定する。
 */
export function buildGithubTreeApiUrl(owner: string, repo: string, defaultBranch: string): string {
  return `${buildGithubRepositoryApiUrl(owner, repo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`;
}
