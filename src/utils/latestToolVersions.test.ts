import { describe, it, expect, vi } from 'vitest';
import { fetchLatestToolVersions } from './latestToolVersions';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function routeFetcher(routes: Record<string, () => Response>) {
  return vi.fn(async (url: string) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error('unexpected ' + url);
    return routes[key]();
  });
}

describe('fetchLatestToolVersions', () => {
  it('各配布元から最新版を取り、nodeは今と同じメジャー版の中の最新にする', async () => {
    const fetcher = routeFetcher({
      'nodejs.org/dist/index.json': () => json([{ version: 'v27.0.0' }, { version: 'v26.13.0' }, { version: 'v26.12.1' }]),
      '@openai/codex/latest': () => json({ version: '0.164.0' }),
      '@anthropic-ai/claude-code/latest': () => json({ version: '2.1.310' }),
      'repos/cli/cli/releases/latest': () => json({ tag_name: 'v2.104.0' }),
      'repos/cloudflare/cloudflared/releases/latest': () => json({ tag_name: '2026.10.2' }),
      'repos/tailscale/tailscale/releases/latest': () => json({ tag_name: 'v1.106.0' }),
      'crates.io/api/v1/crates/jj-cli': () => json({ crate: { max_stable_version: '0.47.0' } }),
    });
    const out = await fetchLatestToolVersions({ nodeMajor: 26 }, fetcher as unknown as typeof fetch);
    expect(out.node.latest).toBe('26.13.0');
    expect(out.codex.latest).toBe('0.164.0');
    expect(out.claude.latest).toBe('2.1.310');
    expect(out.gh.latest).toBe('2.104.0');
    expect(out.cloudflared.latest).toBe('2026.10.2');
    expect(out.tailscale.latest).toBe('1.106.0');
    expect(out.jj.latest).toBe('0.47.0');
  });

  it('1つの配布元が失敗しても他は返し、失敗は理由つきで残す(握りつぶさない)', async () => {
    const fetcher = routeFetcher({
      'nodejs.org/dist/index.json': () => json([{ version: 'v26.12.1' }]),
      '@openai/codex/latest': () => json({ message: 'rate limited' }, 429),
      '@anthropic-ai/claude-code/latest': () => json({ version: '2.1.306' }),
      'repos/cli/cli/releases/latest': () => json({ tag_name: 'v2.103.0' }),
      'repos/cloudflare/cloudflared/releases/latest': () => json({ tag_name: '2026.10.1' }),
      'repos/tailscale/tailscale/releases/latest': () => json({ tag_name: 'v1.104.1' }),
      'crates.io/api/v1/crates/jj-cli': () => json({ crate: { max_stable_version: '0.46.0' } }),
    });
    const out = await fetchLatestToolVersions({ nodeMajor: 26 }, fetcher as unknown as typeof fetch);
    expect(out.codex.latest).toBeNull();
    expect(out.codex.error).toContain('HTTP 429');
    expect(out.node.latest).toBe('26.12.1');
  });

  it('GitHubのトークンがあればAuthorizationを付ける', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => json({ tag_name: 'v1.0.0', version: '1.0.0', crate: { max_stable_version: '1.0.0' } }));
    await fetchLatestToolVersions({ nodeMajor: 26, githubToken: 'tok' }, fetcher as unknown as typeof fetch);
    const gh = fetcher.mock.calls.find((c) => String(c[0]).includes('api.github.com')) as unknown as [string, RequestInit];
    expect((gh[1].headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});
