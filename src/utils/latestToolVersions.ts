/**
 * /cf-containersのバージョン表で「新しい版が出ているか」を示すため、各ツールの配布元から最新版を取る。
 * aptで入れるもの(apache・openssh・openssl・docker・git)はUbuntuのアーカイブ次第なので対象外。
 * 1つの配布元が失敗しても他は返し、失敗はerrorに理由を残す(画面のツールチップで見える)。
 */
export type LatestToolVersion = { latest: string | null; source: string; error?: string };
export type LatestToolVersions = Record<'node' | 'codex' | 'claude' | 'gh' | 'cloudflared' | 'tailscale' | 'jj', LatestToolVersion>;

const UA = 'cloudflare-workers-github-oauth-1 (cf-containers version check)';

async function getJson(url: string, fetcher: typeof fetch, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetcher(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const stripV = (tag: string) => tag.replace(/^v/, '');

export async function fetchLatestToolVersions(
  options: { nodeMajor: number; githubToken?: string },
  fetcher: typeof fetch = fetch
): Promise<LatestToolVersions> {
  const gh = options.githubToken ? { Authorization: `Bearer ${options.githubToken}` } : {};
  const githubLatest = (repo: string) => async () =>
    stripV(String(((await getJson(`https://api.github.com/repos/${repo}/releases/latest`, fetcher, gh)) as { tag_name?: string }).tag_name ?? ''));
  const npmLatest = (pkg: string) => async () =>
    String(((await getJson(`https://registry.npmjs.org/${pkg}/latest`, fetcher)) as { version?: string }).version ?? '');

  const sources: Record<keyof LatestToolVersions, { source: string; get: () => Promise<string> }> = {
    node: {
      source: 'nodejs.org',
      // 今使っているメジャー版の中での最新(メジャー版を上げるかは別に判断する)
      get: async () => {
        const list = (await getJson('https://nodejs.org/dist/index.json', fetcher)) as Array<{ version: string }>;
        const hit = list.find((r) => stripV(r.version).split('.')[0] === String(options.nodeMajor));
        return hit ? stripV(hit.version) : '';
      },
    },
    codex: { source: 'npm', get: npmLatest('@openai/codex') },
    claude: { source: 'npm', get: npmLatest('@anthropic-ai/claude-code') },
    gh: { source: 'GitHub', get: githubLatest('cli/cli') },
    cloudflared: { source: 'GitHub', get: githubLatest('cloudflare/cloudflared') },
    tailscale: { source: 'GitHub', get: githubLatest('tailscale/tailscale') },
    jj: {
      source: 'crates.io',
      get: async () =>
        String(((await getJson('https://crates.io/api/v1/crates/jj-cli', fetcher)) as { crate?: { max_stable_version?: string } }).crate?.max_stable_version ?? ''),
    },
  };

  const entries = await Promise.all(
    (Object.keys(sources) as Array<keyof LatestToolVersions>).map(async (name) => {
      const { source, get } = sources[name];
      try {
        const latest = await get();
        return [name, latest ? { latest, source } : { latest: null, source, error: '版が見つかりません' }] as const;
      } catch (err) {
        return [name, { latest: null, source, error: err instanceof Error ? err.message : String(err) }] as const;
      }
    })
  );
  return Object.fromEntries(entries) as LatestToolVersions;
}
