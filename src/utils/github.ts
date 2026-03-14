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
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  private: boolean;
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
    throw new Error('Failed to get access token from GitHub');
  }

  const data = await response.json<{ access_token: string; error?: string }>();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error}`);
  }

  if (!data.access_token) {
    throw new Error('No access token returned from GitHub');
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
  const url = accessToken
    ? 'https://api.github.com/user/repos?sort=updated&per_page=100'
    : `https://api.github.com/users/${encodeURIComponent(username ?? '')}/repos?sort=updated&per_page=100`;

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

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub repositories: ${response.status}`);
  }

  return await response.json<GitHubRepo[]>();
}

/**
 * GitHub OAuthトークンの付与スコープを取得
 */
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
