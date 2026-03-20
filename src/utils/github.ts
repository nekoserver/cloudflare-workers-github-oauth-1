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

export interface GitHubCommitHistoryEntry {
  sha: string;
  message: string;
  htmlUrl: string;
  authorName: string | null;
  authorLogin: string | null;
  authoredDate: string | null;
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

function parseLinkHeaderForLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) {
    return null;
  }
  const segments = linkHeader.split(',');
  for (const segment of segments) {
    const match = segment.match(/<([^>]+)>;\s*rel="last"/);
    if (!match) {
      continue;
    }
    try {
      const parsedUrl = new URL(match[1]);
      const pageParam = parsedUrl.searchParams.get('page');
      if (!pageParam) {
        continue;
      }
      const pageNumber = Number(pageParam);
      if (!Number.isNaN(pageNumber)) {
        return pageNumber;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

export async function getGitHubCommitCount(params: {
  owner: string;
  repo: string;
  accessToken?: string;
}): Promise<{ total: number | null; status: number }> {
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
    return { total: null, status: response.status };
  }

  const commits = await response.json<any[]>();
  const lastPage = parseLinkHeaderForLastPage(response.headers.get('Link'));
  if (lastPage !== null) {
    return { total: lastPage, status: response.status };
  }

  return { total: commits.length, status: response.status };
}

export async function getGitHubCommits(params: {
  owner: string;
  repo: string;
  perPage: number;
  page?: number;
  accessToken?: string;
}): Promise<{ commits: GitHubCommitHistoryEntry[]; status: number }> {
  const { owner, repo, perPage, page = 1, accessToken } = params;
  const url = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`);
  url.searchParams.set('per_page', perPage.toString());
  url.searchParams.set('page', page.toString());
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    return { commits: [], status: response.status };
  }

  const data = await response.json<any[]>();
  if (!Array.isArray(data)) {
    return { commits: [], status: response.status };
  }

  const entries = data.map((entry) => {
    const commitInfo = entry?.commit ?? {};
    const authorInfo = commitInfo.author;
    return {
      sha: entry?.sha ?? '',
      htmlUrl: entry?.html_url ?? '',
      message: typeof commitInfo.message === 'string' ? commitInfo.message : entry?.sha ?? '',
      authorName: typeof authorInfo?.name === 'string' ? authorInfo.name : null,
      authorLogin: entry?.author?.login ?? null,
      authoredDate: typeof authorInfo?.date === 'string' ? authorInfo.date : null,
    };
  }).filter((entry) => entry.sha && entry.htmlUrl);

  return { commits: entries, status: response.status };
}

/**
 * GitHubリポジトリのオープンIssue/PR数を取得
 */
export async function getGitHubRepoOpenIssuesCount(params: {
  owner: string;
  repo: string;
  accessToken?: string;
}): Promise<{ count: number | null; status: number | null }> {
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
    return { count: null, status: response.status };
  }

  const data = await response.json<{ open_issues_count?: number }>();
  return {
    count: typeof data.open_issues_count === 'number' ? data.open_issues_count : null,
    status: response.status,
  };
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

/**
 * 指定リポジトリの指定月のコミットを日別に集計する
 * @returns 日付文字列 (YYYY-MM-DD) → コミット数 のマップ
 */
/** getGitHubRepoCommitsByMonth の戻り値 */
export interface MonthlyCommitsResult {
  counts: Record<string, number>;
  /** 日付ごとのコミット詳細（カレンダー取得時に同時にキャッシュ保存するため） */
  commitsByDate: Record<string, CommitDetail[]>;
}

function formatJstDateKey(dateInput: string | Date): string | null {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'day') day = part.value;
  }
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function getJstMonthRange(year: number, month: number): { since: Date; until: Date } {
  return {
    since: new Date(Date.UTC(year, month - 1, 1, -9, 0, 0)),
    until: new Date(Date.UTC(year, month, 1, -9, 0, 0)),
  };
}

function getJstDayRange(date: string): { since: Date; until: Date } {
  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const since = new Date(Date.UTC(year, month - 1, day, -9, 0, 0));
  const until = new Date(since.getTime() + 24 * 60 * 60 * 1000);
  return { since, until };
}

export async function getGitHubRepoCommitsByMonth(params: {
  owner: string;
  repo: string;
  year: number;
  month: number; // 1-12
  accessToken?: string;
}): Promise<MonthlyCommitsResult> {
  const { owner, repo, year, month, accessToken } = params;

  const { since, until } = getJstMonthRange(year, month);

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const counts: Record<string, number> = {};
  const commitsByDate: Record<string, CommitDetail[]> = {};
  let nextUrl: string | null = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?since=${since.toISOString()}&until=${until.toISOString()}&per_page=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers });
    if (!response.ok) {
      break;
    }

    const commits = await response.json<{
      sha?: string;
      html_url?: string;
      commit?: {
        message?: string;
        author?: { name?: string; date?: string };
      };
      author?: { login?: string; avatar_url?: string };
    }[]>();
    for (const c of commits) {
      const dateStr = c.commit?.author?.date;
      if (dateStr) {
        const day = formatJstDateKey(dateStr);
        if (!day) continue;
        counts[day] = (counts[day] || 0) + 1;

        // コミット詳細も同時に収集
        if (!commitsByDate[day]) {
          commitsByDate[day] = [];
        }
        commitsByDate[day].push({
          sha: c.sha ?? '',
          message: c.commit?.message ?? '',
          authorName: c.commit?.author?.name ?? '',
          authorLogin: c.author?.login ?? '',
          authorAvatarUrl: c.author?.avatar_url ?? '',
          date: dateStr,
          url: c.html_url ?? '',
        });
      }
    }

    const linkHeader = response.headers.get('Link');
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return { counts, commitsByDate };
}

/** 特定日のコミット詳細情報 */
export interface CommitDetail {
  sha: string;
  message: string;
  authorName: string;
  authorLogin: string;
  authorAvatarUrl: string;
  date: string;
  url: string;
}

/**
 * 指定リポジトリの特定日のコミット一覧を取得する
 * @returns コミット詳細の配列
 */
export async function getGitHubRepoCommitsByDate(params: {
  owner: string;
  repo: string;
  date: string; // YYYY-MM-DD
  accessToken?: string;
}): Promise<CommitDetail[]> {
  const { owner, repo, date, accessToken } = params;

  const { since, until } = getJstDayRange(date);

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const commits: CommitDetail[] = [];
  let nextUrl: string | null = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?since=${since.toISOString()}&until=${until.toISOString()}&per_page=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers });
    if (!response.ok) {
      break;
    }

    const data = await response.json<{
      sha?: string;
      html_url?: string;
      commit?: {
        message?: string;
        author?: { name?: string; date?: string };
      };
      author?: { login?: string; avatar_url?: string };
    }[]>();

    for (const c of data) {
      const authorDate = c.commit?.author?.date;
      if (!authorDate) continue;
      const day = formatJstDateKey(authorDate);
      if (day !== date) continue;

      commits.push({
        sha: c.sha ?? '',
        message: c.commit?.message ?? '',
        authorName: c.commit?.author?.name ?? '',
        authorLogin: c.author?.login ?? '',
        authorAvatarUrl: c.author?.avatar_url ?? '',
        date: authorDate,
        url: c.html_url ?? '',
      });
    }

    const linkHeader = response.headers.get('Link');
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return commits;
}

/**
 * 直近のコミットを取得する（更新のない日を含まず、limit件まで）
 * GitHub API の /commits を新しい順に取得し、limit件に達するまでページングする
 */
export async function getGitHubRepoRecentCommits(params: {
  owner: string;
  repo: string;
  limit: number;
  page?: number;
  accessToken?: string;
}): Promise<CommitDetail[]> {
  const { owner, repo, limit, page, accessToken } = params;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const commits: CommitDetail[] = [];
  const perPage = Math.min(limit, 100);
  const pageParam = page && page > 1 ? `&page=${page}` : '';
  let nextUrl: string | null = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${perPage}${pageParam}`;

  while (nextUrl && commits.length < limit) {
    const response = await fetch(nextUrl, { headers });
    if (!response.ok) {
      break;
    }

    const data = await response.json<{
      sha?: string;
      html_url?: string;
      commit?: {
        message?: string;
        author?: { name?: string; date?: string };
      };
      author?: { login?: string; avatar_url?: string };
    }[]>();

    for (const c of data) {
      if (commits.length >= limit) break;
      commits.push({
        sha: c.sha ?? '',
        message: c.commit?.message ?? '',
        authorName: c.commit?.author?.name ?? '',
        authorLogin: c.author?.login ?? '',
        authorAvatarUrl: c.author?.avatar_url ?? '',
        date: c.commit?.author?.date ?? '',
        url: c.html_url ?? '',
      });
    }

    const linkHeader = response.headers.get('Link');
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return commits;
}

/**
 * リポジトリの総コミット数を取得する
 * per_page=1 でリクエストし、Link ヘッダーの last ページ番号から推定する
 */
export async function getGitHubRepoTotalCommitCount(params: {
  owner: string;
  repo: string;
  accessToken?: string;
}): Promise<number | null> {
  const { owner, repo, accessToken } = params;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Cloudflare-Workers-GitHub-OAuth',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=1`;
  const response = await fetch(url, { headers });
  if (!response.ok) return null;

  const linkHeader = response.headers.get('Link');
  if (!linkHeader) {
    // Link ヘッダーがない場合は1ページ分（0 or 1件）
    const data = await response.json<unknown[]>();
    return Array.isArray(data) ? data.length : null;
  }

  const lastMatch = linkHeader.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (lastMatch) {
    return parseInt(lastMatch[1], 10);
  }

  return null;
}
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
