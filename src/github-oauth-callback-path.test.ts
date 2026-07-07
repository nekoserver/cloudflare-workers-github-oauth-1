import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const src = fs.readFileSync('src/index.ts', 'utf8');

describe('GitHub OAuth callback path', () => {
  it('uses the GitHub App registered callback path when building authorize URLs', () => {
    expect(src).toContain("const GITHUB_OAUTH_CALLBACK_PATH = '/github/callback'");
    expect(src).toContain('authUrl.searchParams.set(\'redirect_uri\', redirectUri)');
    expect(src).toContain('return `${url.protocol}//${url.host}${GITHUB_OAUTH_CALLBACK_PATH}`');
  });

  it('keeps the old /auth/github/callback URL as a redirect-only compatibility alias', () => {
    expect(src).toContain('app.get(GITHUB_OAUTH_CALLBACK_PATH, handleGitHubOAuthCallback)');
    expect(src).toContain("app.get('/auth/github/callback', (c) =>");
    expect(src).toContain('return c.redirect(`${url.pathname}${url.search}`, 308)');
  });

  it('exchanges the token with the same callback path used during authorization', () => {
    const callbackBlock = src.slice(src.indexOf('async function handleGitHubOAuthCallback'), src.indexOf("app.get('/auth/github/reauthorize'"));
    expect(callbackBlock).toContain('const redirectUri = buildGitHubOAuthRedirectUri(c.req.url)');
    expect(callbackBlock).toContain('getGitHubAccessToken(code, clientId, clientSecret, redirectUri, pkceVerifier)');
  });
});
