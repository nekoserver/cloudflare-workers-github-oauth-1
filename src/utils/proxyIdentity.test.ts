import { describe, it, expect } from 'vitest';
import { buildProxyForwardRequest, PROXY_USER_HEADER } from './proxyIdentity';

// SPEC.cloudflare-workers-github-oauth-1.lib-proxy-identity REQ-LP-001 / AC-LP-001。
// /cf-containers/proxy/* の中継では、ブラウザ由来の X-Forwarded-User を必ず消し、
// ワーカーの認証済みセッションのログイン名(user.sub)に付け替える。

const FORWARD_URL = 'https://example.test/lib/muse/dashboard/index.shtml';

describe('buildProxyForwardRequest', () => {
  it('ブラウザが付けた X-Forwarded-User はログイン名に置き換わる', async () => {
    const raw = new Request('https://example.test/cf-containers/proxy/lib/', {
      headers: { 'X-Forwarded-User': 'mallory', 'X-Other': 'keep' },
    });
    const out = buildProxyForwardRequest(raw, FORWARD_URL, 'octocat');
    expect(out.headers.get(PROXY_USER_HEADER)).toBe('octocat');
    expect(out.headers.get('x-other')).toBe('keep');
    expect(out.url).toBe(FORWARD_URL);
  });

  it('ログインが取れない場合は、ブラウザ由来のヘッダを消すだけで付けない', () => {
    const raw = new Request('https://example.test/cf-containers/proxy/lib/', {
      headers: { 'X-Forwarded-User': 'mallory' },
    });
    const out = buildProxyForwardRequest(raw, FORWARD_URL, null);
    expect(out.headers.get(PROXY_USER_HEADER)).toBeNull();
  });

  it('ログインが空文字の場合も付けない', () => {
    const raw = new Request('https://example.test/cf-containers/proxy/lib/');
    const out = buildProxyForwardRequest(raw, FORWARD_URL, '  ');
    expect(out.headers.get(PROXY_USER_HEADER)).toBeNull();
  });

  it('メソッドとボディはそのまま運ぶ', async () => {
    const raw = new Request('https://example.test/cf-containers/proxy/lib/muse/dashboard/ask.cgi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'prompt=hello',
    });
    const out = buildProxyForwardRequest(raw, FORWARD_URL, 'octocat');
    expect(out.method).toBe('POST');
    expect(await out.text()).toBe('prompt=hello');
    expect(out.headers.get(PROXY_USER_HEADER)).toBe('octocat');
  });
});
