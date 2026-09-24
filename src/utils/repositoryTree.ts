const GITHUB_API_BASE = 'https://api.github.com';

export type GithubRepositoryFetchResult = {
  response: Response;
  usedAnonymousFallback: boolean;
};

/**
 * GitHub は、トークンから参照できないリポジトリを 404 として返す。そのため、
 * fine-grained PAT や Organization の制限で対象外になっているトークンを付けると、
 * 公開リポジトリまで 404 になる場合がある。明示的に指定された公開リポジトリに
 * 限り、認証付き取得が 404 のときだけ匿名で再取得する。
 */
export async function fetchGithubRepositoryWithPublicFallback(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<GithubRepositoryFetchResult> {
  const response = await fetchImpl(url, { headers });
  if (response.status !== 404) return { response, usedAnonymousFallback: false };

  const anonymousHeaders = { ...headers };
  delete anonymousHeaders.Authorization;
  const anonymousResponse = await fetchImpl(url, { headers: anonymousHeaders });
  return { response: anonymousResponse, usedAnonymousFallback: anonymousResponse.ok };
}

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
