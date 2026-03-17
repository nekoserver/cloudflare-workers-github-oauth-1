/**
 * GitHub OAuth認証のヘルパー関数
 */

export interface GitHubUser {
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  id: number;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export interface GitHubRepo {
  name: string;
  html_url: string;
  full_name?: string;
  owner?: {
    login?: string;
  };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  private: boolean;
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
}

export interface GitHubTokenInfo {
  scopes: string[];
}

export class GitHubTokenScopesError extends Error {
  status: number;
  apiMessage?: string;

  constructor(status: number, apiMessage?: string) {
    const message = apiMessage
      ? `Failed to fetch GitHub token info: ${status} (${apiMessage})`
      : `Failed to fetch GitHub token info: ${status}`;
    super(message);
    this.name = 'GitHubTokenScopesError';
    this.status = status;
    this.apiMessage = apiMessage;
  }
}

/**
 * GitHub OAuthのアクセストークンを取得
 */
export async function getGitHubAccessToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<string> {
  const payload: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  };

  if (codeVerifier) {
    payload.code_verifier = codeVerifier;
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable)');
    throw new Error(`Failed to get access token from GitHub: HTTP ${response.status} - ${body}`);
  }

  const data = await response.json<{
    access_token?: string;
    error?: string;
    error_description?: string;
    error_uri?: string;
  }>();

  if (data.error) {
    const desc = data.error_description ? ` - ${data.error_description}` : '';
    throw new Error(`GitHub OAuth error: ${data.error}${desc}`);
  }

  if (!data.access_token) {
    throw new Error('No access token returned from GitHub (response had no error field either)');
  }

  return data.access_token;
}

/**
 * GitHubユーザー情報を取得
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info from GitHub');
  }

  return await response.json<GitHubUser>();
}

/**
 * GitHubのメールアドレスを取得（プライマリメールを優先）
 */
export async function getGitHubUserEmail(accessToken: string): Promise<string | null> {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
    },
  });

  if (!response.ok) {
    return null;
  }

  const emails = await response.json<GitHubEmail[]>();

  // プライマリかつ検証済みのメールを優先
  const primaryEmail = emails.find(e => e.primary && e.verified);
  if (primaryEmail) {
    return primaryEmail.email;
  }

  // 検証済みのメールを次に優先
  const verifiedEmail = emails.find(e => e.verified);
  if (verifiedEmail) {
    return verifiedEmail.email;
  }

  // 最初のメールを返す
  return emails[0]?.email || null;
}

/**
 * GitHubユーザーの公開リポジトリ一覧を取得
 */
export async function getGitHubUserRepos(params: { username?: string; accessToken?: string }): Promise<GitHubRepo[]> {
  const { username, accessToken } = params;

  if (!accessToken && !username) {
    throw new Error('Username is required when access token is not provided');
  }

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const buildBaseUrl = () => {
    if (accessToken) {
      const url = new URL('https://api.github.com/user/repos');
      url.searchParams.set('sort', 'updated');
      url.searchParams.set('per_page', '100');
      url.searchParams.set('visibility', 'all');
      url.searchParams.set('affiliation', 'owner,collaborator,organization_member');
      return url;
    }
    const url = new URL(`https://api.github.com/users/${encodeURIComponent(username ?? '')}/repos`);
    url.searchParams.set('sort', 'updated');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('type', 'all');
    return url;
  };

  const repos: GitHubRepo[] = [];
  let nextUrl: string | null = buildBaseUrl().toString();

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub repositories: ${response.status}`);
    }

    const pageRepos = await response.json<GitHubRepo[]>();
    repos.push(...pageRepos);

    const linkHeader = response.headers.get('Link');
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return repos;
}

/**
 * GitHubリポジトリの最新コミットを取得
 */
export async function getGitHubLatestCommit(params: {
  owner: string;
  repo: string;
  accessToken?: string;
}): Promise<GitHubCommit | null> {
  const { owner, repo, accessToken } = params;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=1`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }

  const commits = await response.json<{ sha?: string; html_url?: string }[]>();
  const latest = commits[0];
  if (!latest?.sha || !latest?.html_url) {
    return null;
  }

  return { sha: latest.sha, html_url: latest.html_url };
}

/**
 * GitHubリポジトリのオープンIssue/PR数を取得
 */
export async function getGitHubRepoOpenIssuesCount(params: {
  owner: string;
  repo: string;
  accessToken?: string;
}): Promise<number | null> {
  const { owner, repo, accessToken } = params;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }

  const data = await response.json<{ open_issues_count?: number }>();
  return typeof data.open_issues_count === 'number' ? data.open_issues_count : null;
}

/**
 * GitHub OAuthトークンの付与スコープを取得
 */
/**
 * GitHub App インストール情報
 */
export interface GitHubInstallation {
  id: number;
  app_id: number;
  app_slug?: string;
  permissions: Record<string, string>; // e.g. { contents: "read", issues: "write" }
  repository_selection: 'all' | 'selected';
}

/**
 * GitHub App インストールに紐づくリポジトリ情報
 */
export interface GitHubInstallationRepo {
  name: string;
  full_name: string;
  private: boolean;
}

/**
 * リポジトリごとのインストール権限情報
 */
export interface RepoInstallationPermissions {
  installationId: number;
  permissions: Record<string, string>;
  repositorySelection: 'all' | 'selected';
}

/**
 * GitHub API 共通ヘッダー
 */
function githubApiHeaders(accessToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * インストールAPI呼び出し結果（診断情報付き）
 */
export interface InstallationApiDiag {
  status: number;
  error?: string;
  totalCount?: number;
  installationCount?: number;
  installations?: GitHubInstallation[];
}

/**
 * ユーザーがアクセス可能な GitHub App インストール一覧を取得
 */
export async function getGitHubUserInstallations(accessToken: string): Promise<GitHubInstallation[]> {
  const diag = await getGitHubUserInstallationsWithDiag(accessToken);
  return diag.installations ?? [];
}

/**
 * 診断情報付きでインストール一覧を取得
 */
export async function getGitHubUserInstallationsWithDiag(accessToken: string): Promise<InstallationApiDiag> {
  const response = await fetch('https://api.github.com/user/installations', {
    headers: githubApiHeaders(accessToken),
  });

  if (!response.ok) {
    let errorMsg: string | undefined;
    try {
      const body = await response.json<{ message?: string }>();
      errorMsg = body?.message;
    } catch { /* ignore */ }
    return { status: response.status, error: errorMsg || response.statusText };
  }

  const data = await response.json<{ total_count?: number; installations: GitHubInstallation[] }>();
  const installations = Array.isArray(data.installations) ? data.installations : [];
  return {
    status: response.status,
    totalCount: data.total_count,
    installationCount: installations.length,
    installations,
  };
}

/**
 * 指定インストールに紐づくリポジトリ一覧を取得
 */
export async function getGitHubInstallationRepos(
  accessToken: string,
  installationId: number
): Promise<GitHubInstallationRepo[]> {
  const repos: GitHubInstallationRepo[] = [];
  let nextUrl: string | null = `https://api.github.com/user/installations/${installationId}/repositories?per_page=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: githubApiHeaders(accessToken),
    });

    if (!response.ok) {
      break;
    }

    const data = await response.json<{ repositories: GitHubInstallationRepo[] }>();
    if (Array.isArray(data.repositories)) {
      repos.push(...data.repositories);
    }

    const linkHeader = response.headers.get('Link');
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return repos;
}

/**
 * リポジトリ名 → インストール権限のマップを構築
 * GitHub App がインストールされているリポジトリごとに、そのインストールの権限を返す
 */
export async function buildRepoInstallationPermissionsMap(
  accessToken: string
): Promise<Map<string, RepoInstallationPermissions>> {
  const map = new Map<string, RepoInstallationPermissions>();

  const installations = await getGitHubUserInstallations(accessToken);
  if (installations.length === 0) {
    return map;
  }

  await Promise.all(installations.map(async (installation) => {
    if (installation.repository_selection === 'all') {
      // "All repositories" の場合は個別にリポジトリを取得しない
      // 後で全リポジトリに対してこのインストールの権限を適用する
      map.set('__all__' + installation.id, {
        installationId: installation.id,
        permissions: installation.permissions,
        repositorySelection: 'all',
      });
      return;
    }

    const repos = await getGitHubInstallationRepos(accessToken, installation.id);
    for (const repo of repos) {
      map.set(repo.name, {
        installationId: installation.id,
        permissions: installation.permissions,
        repositorySelection: installation.repository_selection,
      });
    }
  }));

  return map;
}

export async function getGitHubTokenScopes(params: {
  accessToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<string[]> {
  const { accessToken, clientId, clientSecret } = params;
  const response = await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ access_token: accessToken }),
  });

  if (!response.ok) {
    let apiMessage: string | undefined;
    try {
      const errorData = await response.json<{ message?: string }>();
      if (typeof errorData?.message === 'string') {
        apiMessage = errorData.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new GitHubTokenScopesError(response.status, apiMessage);
  }

  const data = await response.json<GitHubTokenInfo>();
  return Array.isArray(data.scopes) ? data.scopes : [];
}

/** Cloudflare のデプロイ用 GitHub App の既知の app_slug 一覧 */
export const CLOUDFLARE_DEPLOY_SLUGS = ['cloudflare-pages', 'cloudflare-workers-and-pages'];

/** Vercel のデプロイ用 GitHub App の既知の app_slug 一覧 */
export const VERCEL_DEPLOY_SLUGS = ['vercel'];

/** Slack Webhook の送信先として使われる既知のホスト名一覧 */
export const SLACK_WEBHOOK_HOSTS = ['hooks.slack.com'];

/**
 * インストール一覧から、指定した app_slug リスト（完全一致）に合致するインストールを返す。
 * includes による部分一致では cloudflare-bot 等の非デプロイ用 App に誤マッチするため、
 * 既知のデプロイ用 slug のみ完全一致で判定する。
 */
export function findInstallationByExactSlugs(
  installations: GitHubInstallation[],
  slugs: string[]
): GitHubInstallation | undefined {
  const slugSet = new Set(slugs.map((s) => s.toLowerCase()));
  return installations.find(
    (inst) => inst.app_slug != null && slugSet.has(inst.app_slug.toLowerCase())
  );
}

/**
 * 指定した app_slug リスト（完全一致）に合致する GitHub App がインストールされているリポジトリ名の Set を返す。
 * repository_selection === 'all' の場合は誤検知防止のため空セットを返す。
 */
async function getLinkedReposByAppSlugs(
  accessToken: string,
  slugs: string[],
  installations: GitHubInstallation[]
): Promise<{ repos: Set<string>; appSlug: string | null; isAllRepos: boolean }> {
  const matched = findInstallationByExactSlugs(installations, slugs);

  if (!matched) {
    return { repos: new Set(), appSlug: null, isAllRepos: false };
  }

  // repository_selection === 'all' の場合、GitHub App が全リポジトリにアクセス権を持っているだけで
  // 実際にサービス連携（デプロイ等）が存在するとは限らない。
  // 誤検知を防ぐため、'selected' で明示的に選択されたリポジトリのみを連携済みと判定する。
  if (matched.repository_selection === 'all') {
    return { repos: new Set(), appSlug: matched.app_slug ?? null, isAllRepos: false };
  }

  const installRepos = await getGitHubInstallationRepos(accessToken, matched.id);
  const repoNames = new Set(installRepos.map((r) => r.name));
  return { repos: repoNames, appSlug: matched.app_slug ?? null, isAllRepos: false };
}

/**
 * Cloudflare デプロイ用 GitHub App がインストールされているリポジトリ名の Set を返す
 * 既知の Cloudflare デプロイ用 app_slug に完全一致するインストールのみを判定する
 */
export async function getCloudflareLinkedRepos(
  accessToken: string
): Promise<{ repos: Set<string>; appSlug: string | null; isAllRepos: boolean }> {
  const installations = await getGitHubUserInstallations(accessToken);
  return getLinkedReposByAppSlugs(accessToken, CLOUDFLARE_DEPLOY_SLUGS, installations);
}

/**
 * Vercel デプロイ用 GitHub App がインストールされているリポジトリ名の Set を返す
 * 既知の Vercel デプロイ用 app_slug に完全一致するインストールのみを判定する
 */
export async function getVercelLinkedRepos(
  accessToken: string
): Promise<{ repos: Set<string>; appSlug: string | null; isAllRepos: boolean }> {
  const installations = await getGitHubUserInstallations(accessToken);
  return getLinkedReposByAppSlugs(accessToken, VERCEL_DEPLOY_SLUGS, installations);
}

/**
 * Cloudflare と Vercel の連携状況をまとめて取得する（API呼び出しを1回に最適化）
 */
export async function getExternalServiceLinkedRepos(
  accessToken: string
): Promise<{
  cloudflare: { repos: Set<string>; appSlug: string | null; isAllRepos: boolean };
  vercel: { repos: Set<string>; appSlug: string | null; isAllRepos: boolean };
}> {
  const installations = await getGitHubUserInstallations(accessToken);
  const [cloudflare, vercel] = await Promise.all([
    getLinkedReposByAppSlugs(accessToken, CLOUDFLARE_DEPLOY_SLUGS, installations),
    getLinkedReposByAppSlugs(accessToken, VERCEL_DEPLOY_SLUGS, installations),
  ]);
  return { cloudflare, vercel };
}

// =====================================================
// Webhook URL ベースの外部サービス連携判定
// =====================================================

/** GitHub リポジトリの Webhook 情報 */
interface GitHubRepoHook {
  id: number;
  config: {
    url?: string;
    content_type?: string;
  };
  active: boolean;
}

/**
 * 指定リポジトリの Webhook 一覧を取得する。
 * admin:repo_hook 権限がない場合や 404 の場合は空配列を返す。
 */
async function getRepoWebhooks(
  accessToken: string,
  owner: string,
  repo: string
): Promise<GitHubRepoHook[]> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks?per_page=100`;
  const response = await fetch(url, { headers: githubApiHeaders(accessToken) });
  if (!response.ok) {
    return [];
  }
  return response.json<GitHubRepoHook[]>();
}

/**
 * Webhook の送信先 URL が指定ホスト名リストに含まれるか判定する。
 */
export function isWebhookUrlMatchingHosts(webhookUrl: string, hosts: string[]): boolean {
  try {
    const parsed = new URL(webhookUrl);
    return hosts.some((h) => parsed.hostname.toLowerCase() === h.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * 複数リポジトリの Webhook を調べ、Slack 連携しているリポジトリ名の Set を返す。
 * 各リポジトリの Webhook 送信先 URL に hooks.slack.com が含まれるかで判定する。
 */
export async function getSlackLinkedReposByWebhooks(
  accessToken: string,
  owner: string,
  repoNames: string[]
): Promise<Set<string>> {
  const results = await Promise.all(
    repoNames.map(async (repoName) => {
      const hooks = await getRepoWebhooks(accessToken, owner, repoName);
      const hasSlack = hooks.some(
        (hook) => hook.config.url != null && isWebhookUrlMatchingHosts(hook.config.url, SLACK_WEBHOOK_HOSTS)
      );
      return { repoName, hasSlack };
    })
  );
  const linked = new Set<string>();
  for (const r of results) {
    if (r.hasSlack) {
      linked.add(r.repoName);
    }
  }
  return linked;
}
