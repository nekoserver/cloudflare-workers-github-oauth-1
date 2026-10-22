/**
 * /cf-containersのバージョン表で「新しい版が出ているか」と各版のリリース日を示すため、各ツールの
 * 配布元から最新版・そのリリース日・今入っている版のリリース日を取る。
 * OpenSSH・OpenSSLは上流の版を比較する(Ubuntuの修正バックポートの有無は判定しない)。
 * apache・docker・gitの最新版取得は対象外。
 * 1つの配布元が失敗しても他は返し、失敗はerrorに理由を残す(画面のツールチップで見える)。
 */
export type LatestToolVersion = {
  latest: string | null;
  /** 最新版のリリース日(YYYY-MM-DD) */
  latestDate?: string | null;
  /** 今入っている版のリリース日(YYYY-MM-DD) */
  currentDate?: string | null;
  source: string;
  error?: string;
};
export type ToolName = 'node' | 'codex' | 'claude' | 'gh' | 'cloudflared' | 'tailscale' | 'jj' | 'openssl' | 'openssh';
export type LatestToolVersions = Record<ToolName, LatestToolVersion>;

const UA = 'cloudflare-workers-github-oauth-1 (cf-containers version check)';

async function getJson(url: string, fetcher: typeof fetch, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetcher(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const stripV = (tag: string) => tag.replace(/^v/, '');
const day = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : null);

type Found = { latest: string; latestDate: string | null; currentDate: string | null };

export async function fetchLatestToolVersions(
  options: { nodeMajor: number; githubToken?: string; current?: Partial<Record<ToolName, string | null>> },
  fetcher: typeof fetch = fetch
): Promise<LatestToolVersions> {
  const current = options.current ?? {};
  const gh: Record<string, string> = options.githubToken ? { Authorization: `Bearer ${options.githubToken}` } : {};

  // GitHubのリリース。今の版の日付はタグを指定して取る(取れなくても最新版は返す)。tagPrefixはリポジトリごとの付け方。
  const githubRelease = (repo: string, tagPrefix: string, name: ToolName) => async (): Promise<Found> => {
    const latest = (await getJson(`https://api.github.com/repos/${repo}/releases/latest`, fetcher, gh)) as { tag_name?: string; published_at?: string };
    const cur = current[name];
    let currentDate: string | null = null;
    if (cur) {
      currentDate = await getJson(`https://api.github.com/repos/${repo}/releases/tags/${tagPrefix}${cur}`, fetcher, gh)
        .then((r) => day((r as { published_at?: string }).published_at))
        .catch(() => null);
    }
    const tag = String(latest.tag_name ?? '');
    return { latest: tagPrefix && tag.startsWith(tagPrefix) ? tag.slice(tagPrefix.length) : stripV(tag), latestDate: day(latest.published_at), currentDate };
  };
  // npmはパッケージ情報のtime(版ごとの公開日時)から日付を取る
  const npmPackage = (pkg: string, name: ToolName) => async (): Promise<Found> => {
    const doc = (await getJson(`https://registry.npmjs.org/${pkg}`, fetcher)) as { 'dist-tags'?: { latest?: string }; time?: Record<string, string> };
    const latest = String(doc['dist-tags']?.latest ?? '');
    const cur = current[name];
    return { latest, latestDate: day(doc.time?.[latest]), currentDate: cur ? day(doc.time?.[cur]) : null };
  };

  const sources: Record<ToolName, { source: string; get: () => Promise<Found> }> = {
    node: {
      source: 'nodejs.org',
      // 今使っているメジャー版の中での最新(メジャー版を上げるかは別に判断する)
      get: async () => {
        const list = (await getJson('https://nodejs.org/dist/index.json', fetcher)) as Array<{ version: string; date?: string }>;
        const hit = list.find((r) => stripV(r.version).split('.')[0] === String(options.nodeMajor));
        const cur = current.node;
        const curHit = cur ? list.find((r) => stripV(r.version) === cur) : undefined;
        return { latest: hit ? stripV(hit.version) : '', latestDate: day(hit?.date), currentDate: day(curHit?.date) };
      },
    },
    codex: { source: 'npm', get: npmPackage('@openai/codex', 'codex') },
    claude: { source: 'npm', get: npmPackage('@anthropic-ai/claude-code', 'claude') },
    gh: { source: 'GitHub', get: githubRelease('cli/cli', 'v', 'gh') },
    cloudflared: { source: 'GitHub', get: githubRelease('cloudflare/cloudflared', '', 'cloudflared') },
    tailscale: { source: 'GitHub', get: githubRelease('tailscale/tailscale', 'v', 'tailscale') },
    openssl: { source: 'OpenSSL公式 (GitHub・上流版)', get: githubRelease('openssl/openssl', 'openssl-', 'openssl') },
    openssh: {
      source: 'OpenSSH公式 (上流版)',
      get: async () => {
        const res = await fetcher('https://www.openssh.org/releasenotes.html', { headers: { 'User-Agent': UA, Accept: 'text/html' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        // Portable release identifiers and dates in the official release headings.
        const releases = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)].flatMap((heading) => {
          const version = heading[1].match(/\b(\d+\.\d+p\d+)\b/);
          const date = heading[1].match(/\((\d{4}-\d{2}-\d{2})\)/);
          return version && date ? [{ version: version[1], date: date[1] }] : [];
        });
        return { latest: releases[0]?.version ?? '', latestDate: releases[0]?.date ?? null,
          currentDate: releases.find((r) => r.version === current.openssh)?.date ?? null };
      },
    },
    jj: {
      source: 'crates.io',
      get: async () => {
        const doc = (await getJson('https://crates.io/api/v1/crates/jj-cli', fetcher)) as {
          crate?: { max_stable_version?: string };
          versions?: Array<{ num: string; created_at?: string }>;
        };
        const latest = String(doc.crate?.max_stable_version ?? '');
        const dateOf = (v: string | null | undefined) => (v ? day(doc.versions?.find((x) => x.num === v)?.created_at) : null);
        return { latest, latestDate: dateOf(latest), currentDate: dateOf(current.jj) };
      },
    },
  };

  const entries = await Promise.all(
    (Object.keys(sources) as ToolName[]).map(async (name) => {
      const { source, get } = sources[name];
      try {
        const found = await get();
        return [name, found.latest ? { ...found, source } : { latest: null, source, error: '版が見つかりません' }] as const;
      } catch (err) {
        return [name, { latest: null, source, error: err instanceof Error ? err.message : String(err) }] as const;
      }
    })
  );
  return Object.fromEntries(entries) as LatestToolVersions;
}
