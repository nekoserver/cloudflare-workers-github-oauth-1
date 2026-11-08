type Daily = { dimensions: { date: string }; sum: { requests?: number; errors?: number; duration?: number; activeTime?: number; cpuTime?: number; rowsRead?: number; rowsWritten?: number } };
/** Analytics only. Account DO usage is not attributed to this new route or treated as an invoice. */
export async function fetchWorkerMuseCost(account: string, token: string, fetcher: typeof fetch = fetch, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prior = new Date(start.getTime() - 86400000).toISOString().slice(0, 10);
  const query = `query { viewer { accounts(filter: {accountTag: ${JSON.stringify(account)}}) {
    worker: workersInvocationsAdaptive(limit: 31, filter: {datetime_geq: ${JSON.stringify(start.toISOString())}, datetime_leq: ${JSON.stringify(now.toISOString())}, scriptName: "cloudflare-workers-github-oauth-1"}) { dimensions { date } sum { requests errors } }
    objects: durableObjectsPeriodicGroups(filter: {date_gt: ${JSON.stringify(prior)}}, limit: 31) { dimensions { date } sum { duration activeTime cpuTime rowsRead rowsWritten } }
    requests: durableObjectsInvocationsAdaptiveGroups(filter: {date_gt: ${JSON.stringify(prior)}}, limit: 1) { sum { requests } }
  } } }`;
  const response = await fetcher('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Cloudflare Analytics HTTP ' + response.status);
  const data = await response.json() as { errors?: unknown[] | null; data?: { viewer?: { accounts?: { worker: Daily[]; objects: Daily[]; requests: { sum: { requests: number } }[] }[] } } };
  const a = data.data?.viewer?.accounts?.[0];
  if (data.errors?.length || !a || !Array.isArray(a.worker) || !Array.isArray(a.objects) || !Array.isArray(a.requests)) throw new Error('Cloudflare Analyticsの使用量を取得できません（権限または応答を確認してください）');
  const sum = (rows: Daily[], key: keyof Daily['sum']) => rows.reduce((total, row) => total + (typeof row.sum[key] === 'number' && Number.isFinite(row.sum[key]) ? row.sum[key]! : 0), 0);
  const doDurationGBSeconds = sum(a.objects, 'duration');
  const doRequests = a.requests.reduce((total, row) => total + row.sum.requests, 0);
  return { fetchedAt: now.toISOString(), periodStart: start.toISOString(), workerScope: 'cloudflare-workers-github-oauth-1', doScope: 'account', workerRequests: sum(a.worker, 'requests'), workerErrors: sum(a.worker, 'errors'), doRequests, doDurationGBSeconds,
    paidPlanReference: { durationIncludedGBSeconds: 400000, requestsIncluded: 1000000, durationPercent: doDurationGBSeconds / 400000 * 100, additionalComputeEstimateUsd: Math.ceil(Math.max(0, doDurationGBSeconds - 400000) / 1000000) * 12.5, additionalRequestsEstimateUsd: Math.ceil(Math.max(0, doRequests - 1000000) / 1000000) * 0.15 },
    daily: a.objects.map(row => ({ date: row.dimensions.date, durationGBSeconds: row.sum.duration || 0, activeHours: (row.sum.activeTime || 0) / 3_600_000_000, cpuSeconds: (row.sum.cpuTime || 0) / 1_000_000 })).sort((a, b) => a.date.localeCompare(b.date)),
    note: '分析値による有料プラン内包枠との比較です。請求確定額ではありません。Worker基本料金・コンテナ・通信・保存領域・Muse利用料は含みません。' };
}
