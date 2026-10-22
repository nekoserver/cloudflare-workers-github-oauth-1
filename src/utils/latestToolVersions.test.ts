import { describe, it, expect, vi } from 'vitest';
import { fetchLatestToolVersions } from './latestToolVersions';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function routeFetcher(routes: Record<string, () => Response>) {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    const key = Object.keys(routes).sort((a, b) => b.length - a.length).find((k) => url.includes(k));
    if (!key) throw new Error('unexpected ' + url);
    return routes[key]();
  });
}

const allRoutes = (): Record<string, () => Response> => ({
  'nodejs.org/dist/index.json': () => json([
    { version: 'v27.0.0', date: '2026-10-20' },
    { version: 'v26.13.0', date: '2026-10-25' },
    { version: 'v26.12.1', date: '2026-10-21' },
  ]),
  'registry.npmjs.org/@openai/codex': () => json({ 'dist-tags': { latest: '0.164.0' }, time: { '0.164.0': '2026-10-22T01:00:00Z', '0.163.0': '2026-10-15T01:00:00Z' } }),
  'registry.npmjs.org/@anthropic-ai/claude-code': () => json({ 'dist-tags': { latest: '2.1.310' }, time: { '2.1.310': '2026-10-23T00:00:00Z', '2.1.306': '2026-10-20T00:00:00Z' } }),
  'repos/cli/cli/releases/latest': () => json({ tag_name: 'v2.104.0', published_at: '2026-10-24T00:00:00Z' }),
  'repos/cli/cli/releases/tags/v2.103.0': () => json({ tag_name: 'v2.103.0', published_at: '2026-10-21T00:00:00Z' }),
  'repos/cloudflare/cloudflared/releases/latest': () => json({ tag_name: '2026.10.2', published_at: '2026-10-22T00:00:00Z' }),
  'repos/cloudflare/cloudflared/releases/tags/2026.10.1': () => json({ tag_name: '2026.10.1', published_at: '2026-10-15T00:00:00Z' }),
  'repos/tailscale/tailscale/releases/latest': () => json({ tag_name: 'v1.106.0', published_at: '2026-10-22T00:00:00Z' }),
  'repos/tailscale/tailscale/releases/tags/v1.104.1': () => json({ tag_name: 'v1.104.1', published_at: '2026-10-01T00:00:00Z' }),
  'repos/openssl/openssl/releases/latest': () => json({ tag_name: 'openssl-4.0.3', published_at: '2026-09-29T00:00:00Z' }),
  'repos/openssl/openssl/releases/tags/openssl-3.5.5': () => json({ published_at: '2026-04-07T00:00:00Z' }),
  'www.openssh.org/releasenotes.html': () => new Response("<h3><a>OpenSSH 10.6</a>/<a id='10.6p1'>10.6p1</a> (2026-10-06)</h3><h3><a>OpenSSH 10.2</a>/<a id='10.2p1'>10.2p1</a> (2025-10-10)</h3>"),
  'crates.io/api/v1/crates/jj-cli': () => json({ crate: { max_stable_version: '0.47.0' }, versions: [
    { num: '0.47.0', created_at: '2026-10-22T00:00:00Z' }, { num: '0.46.0', created_at: '2026-09-01T00:00:00Z' } ] }),
});

const current = { node: '26.12.1', codex: '0.163.0', claude: '2.1.306', gh: '2.103.0', cloudflared: '2026.10.1', tailscale: '1.104.1', jj: '0.46.0', openssl: '3.5.5', openssh: '10.2p1' };

describe('fetchLatestToolVersions', () => {
  it('各配布元から最新版とそのリリース日、今の版のリリース日を取る(nodeは同じメジャー版の中の最新)', async () => {
    const fetcher = routeFetcher(allRoutes());
    const out = await fetchLatestToolVersions({ nodeMajor: 26, current }, fetcher as unknown as typeof fetch);
    expect(out.node).toMatchObject({ latest: '26.13.0', latestDate: '2026-10-25', currentDate: '2026-10-21' });
    expect(out.codex).toMatchObject({ latest: '0.164.0', latestDate: '2026-10-22', currentDate: '2026-10-15' });
    expect(out.claude).toMatchObject({ latest: '2.1.310', latestDate: '2026-10-23', currentDate: '2026-10-20' });
    expect(out.gh).toMatchObject({ latest: '2.104.0', latestDate: '2026-10-24', currentDate: '2026-10-21' });
    expect(out.cloudflared).toMatchObject({ latest: '2026.10.2', currentDate: '2026-10-15' });
    expect(out.tailscale).toMatchObject({ latest: '1.106.0', currentDate: '2026-10-01' });
    expect(out.jj).toMatchObject({ latest: '0.47.0', latestDate: '2026-10-22', currentDate: '2026-09-01' });
    expect(out.openssl).toMatchObject({ latest: '4.0.3', latestDate: '2026-09-29', currentDate: '2026-04-07' });
    expect(out.openssh).toMatchObject({ latest: '10.6p1', latestDate: '2026-10-06', currentDate: '2025-10-10' });
  });

  it('OpenSSHの配布元が形式変更された場合は版なしのエラーを返す', async () => {
    const routes = allRoutes();
    routes['www.openssh.org/releasenotes.html'] = () => new Response('<h3>Unknown format</h3>');
    const out = await fetchLatestToolVersions({ nodeMajor: 26, current }, routeFetcher(routes) as unknown as typeof fetch);
    expect(out.openssh).toMatchObject({ latest: null, error: '版が見つかりません' });
    expect(out.openssl.latest).toBe('4.0.3');
  });

  it('OpenSSLの今の版の日付が取れなくても最新の版番号は正規化して返す', async () => {
    const routes = allRoutes();
    routes['repos/openssl/openssl/releases/tags/openssl-3.5.5'] = () => json({}, 404);
    const out = await fetchLatestToolVersions({ nodeMajor: 26, current }, routeFetcher(routes) as unknown as typeof fetch);
    expect(out.openssl).toMatchObject({ latest: '4.0.3', currentDate: null });
  });

  it('1つの配布元が失敗しても他は返し、失敗は理由つきで残す(握りつぶさない)', async () => {
    const routes = allRoutes();
    routes['registry.npmjs.org/@openai/codex'] = () => json({ message: 'rate limited' }, 429);
    const out = await fetchLatestToolVersions({ nodeMajor: 26, current }, routeFetcher(routes) as unknown as typeof fetch);
    expect(out.codex.latest).toBeNull();
    expect(out.codex.error).toContain('HTTP 429');
    expect(out.node.latest).toBe('26.13.0');
  });

  it('今の版のリリース日だけ取れなくても最新版は返す', async () => {
    const routes = allRoutes();
    routes['repos/cli/cli/releases/tags/v2.103.0'] = () => json({ message: 'Not Found' }, 404);
    const out = await fetchLatestToolVersions({ nodeMajor: 26, current }, routeFetcher(routes) as unknown as typeof fetch);
    expect(out.gh.latest).toBe('2.104.0');
    expect(out.gh.currentDate).toBeNull();
  });

  it('GitHubのトークンがあればAuthorizationを付ける', async () => {
    const fetcher = routeFetcher(allRoutes());
    await fetchLatestToolVersions({ nodeMajor: 26, githubToken: 'tok', current }, fetcher as unknown as typeof fetch);
    const gh = fetcher.mock.calls.find((c) => String(c[0]).includes('api.github.com'))!;
    expect((gh[1]!.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});
