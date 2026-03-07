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

/**
 * GitHub OAuthのアクセストークンを取得
 */
export async function getGitHubAccessToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
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
