export type FleetInstance = { id: string; name: string; state: string; updatedAt: string | null; startedAt: string | null; region: string | null; exitCode: number | null };
export type FleetApplication = { id: string; name: string; instances: FleetInstance[]; complete: boolean; error: string | null };
type Credentials = { accountId: string; apiToken: string };
type Envelope = { success?: boolean; result?: unknown; result_info?: { next_page_token?: string } };

/** Reads lifecycle metadata only. Never contacts a container or starts one. */
export async function collectContainerFleet(credentials: Credentials, fetcher: typeof fetch = fetch) {
  const deadline = Date.now() + 25_000;
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/containers/applications`;
  async function pages(url: string): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = []; const seen = new Set<string>(); let cursor = '';
    for (let page = 0; page < 100; page++) {
      if (Date.now() >= deadline) throw new Error('状態取得の待ち時間上限に達しました');
      const endpoint = new URL(url); endpoint.searchParams.set('per_page', '100');
      if (cursor) endpoint.searchParams.set('page_token', cursor);
      const res = await fetcher(endpoint, { headers: { Authorization: `Bearer ${credentials.apiToken}` }, signal: AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - Date.now()))) });
      if (!res.ok) throw new Error(`Cloudflare API HTTP ${res.status}`);
      const data = await res.json() as Envelope;
      if (!data.success || !Array.isArray(data.result) || data.result.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Cloudflare APIの一覧形式が不正です');
      rows.push(...data.result);
      const next = data.result_info?.next_page_token;
      if (!next) return rows;
      if (typeof next !== 'string' || seen.has(next)) throw new Error('Cloudflare APIのページ送りが循環しました');
      seen.add(next); cursor = next;
    }
    throw new Error('Cloudflare APIのページ数上限を超えました');
  }
  const applications = await pages(base);
  const results: FleetApplication[] = new Array(applications.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < applications.length) {
      const index = nextIndex++; const app = applications[index];
      const id = typeof app.id === 'string' ? app.id : '';
      const name = typeof app.name === 'string' ? app.name : id;
      try {
        if (!id) throw new Error('application IDがありません');
        const rows = await pages(`${base}/${encodeURIComponent(id)}/instances-v2`);
        results[index] = { id, name, complete: true, error: null, instances: rows.map(row => {
          const status = row.status && typeof row.status === 'object' ? row.status as Record<string, unknown> : {};
          const location = row.location && typeof row.location === 'object' ? row.location as Record<string, unknown> : {};
          return { id: typeof row.id === 'string' ? row.id : '', name: typeof row.name === 'string' ? row.name : '',
            state: typeof status.state === 'string' ? status.state : 'unknown', updatedAt: typeof status.updated_at === 'string' ? status.updated_at : null,
            startedAt: typeof row.started_at === 'string' ? row.started_at : null, region: typeof location.region === 'string' ? location.region : null,
            exitCode: typeof status.exit_code === 'number' ? status.exit_code : null };
        }) };
      } catch (error) {
        results[index] = { id, name, instances: [], complete: false, error: error instanceof Error ? error.message : '一覧取得失敗' };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, applications.length) }, () => worker()));
  return { fetchedAt: new Date().toISOString(), complete: results.every(app => app.complete), applications: results };
}
