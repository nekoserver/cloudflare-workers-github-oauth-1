import { formatTreeViaWasm } from './treeWasmServer';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function githubError(response: Response): Promise<string> {
  try {
    const body = await response.clone().json<{ message?: unknown }>();
    if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
  } catch {
    // JSONでないGitHub障害応答はstatusだけを表示する。
  }
  return response.statusText || `HTTP ${response.status}`;
}

export async function fetchRepositoryTreeMarkdown(options: {
  owner: string;
  repo: string;
  accessToken: string;
  depth: number;
  showHidden: boolean;
  fetchImpl?: FetchLike;
}): Promise<string> {
  const { owner, repo, accessToken, depth, showHidden, fetchImpl = fetch } = options;
  const repoFullName = `${owner}/${repo}`;
  const repoApiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
  };

  const repoResponse = await fetchImpl(repoApiUrl, { headers });
  if (!repoResponse.ok) {
    throw new Error(`リポジトリ情報の取得に失敗しました(${repoResponse.status}: ${await githubError(repoResponse)})`);
  }
  const repoBody = await repoResponse.json<{ default_branch?: unknown }>();
  if (typeof repoBody.default_branch !== 'string' || !repoBody.default_branch.trim()) {
    throw new Error('GitHub Repository APIの応答に既定ブランチがありません');
  }

  const treeResponse = await fetchImpl(
    `${repoApiUrl}/git/trees/${encodeURIComponent(repoBody.default_branch)}?recursive=1`,
    { headers }
  );
  if (!treeResponse.ok) {
    throw new Error(`ディレクトリツリーの取得に失敗しました(${treeResponse.status}: ${await githubError(treeResponse)})`);
  }
  const body = await treeResponse.json<{ truncated?: boolean; tree?: Array<{ path?: unknown; type?: unknown }> }>();
  if (!Array.isArray(body.tree)) throw new Error('GitHub Trees APIの応答形式が不正です');
  const entries = body.tree
    .filter((entry): entry is { path: string; type: 'tree' | 'blob' | 'commit' } =>
      typeof entry.path === 'string' && (entry.type === 'tree' || entry.type === 'blob' || entry.type === 'commit'))
    .map((entry) => `${entry.path}\t${entry.type}`)
    .join('\n');
  const tree = formatTreeViaWasm(entries, repoFullName, depth, showHidden);
  return `## ${repoFullName} ディレクトリツリー (${depth}階層)\n\n${tree}${body.truncated ? '\n\n⚠️ GitHub APIの上限により一部のパスは省略されています。' : ''}`;
}
