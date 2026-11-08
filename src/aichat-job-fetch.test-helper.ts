// AIチャットのDOMテスト用の、ジョブAPIの偽の応答。2026-11-07(b49896f)以降、送信は
// POST /api/aichat/jobs で登録し、GET /api/aichat/jobs/:jobId?offset=N で結果を取りに行く。
// 本物のfetchと同じくResponseを返す(ok・status・headersを持つ)。1回目の取得で完了を返す。
export const AICHAT_TEST_JOB_ID = 'job-test';

export function aichatJobResponse(url: string, apiResponse: unknown): Response | null {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url === '/api/aichat/jobs') return json({ jobId: AICHAT_TEST_JOB_ID });
  if (url.startsWith('/api/aichat/jobs/')) return json({ status: 'done', result: apiResponse });
  return null;
}

/** 前のテストで送ったジョブの記録が残ると、ページの読み込み時に「前回の続き」として表示されるので消す。 */
export function clearAichatPendingJobs(): void {
  try { window.localStorage.removeItem('aichat.pendingJobs'); } catch { /* localStorageが無い環境 */ }
}
