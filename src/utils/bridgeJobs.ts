/**
 * Museへの要望を、D1 agent-inquiriesのbridge_jobsへ積む(依頼した側の登録)と、その一覧。
 * 仕様は SPEC.cloudflare-workers-github-oauth-1.20261107.bridge-job-queue.md の12章。
 * 片付けるのは本体コンテナのCLI(nekoserver/libのclaude/ops/bridge_jobs.py run-once)で、Workerは積むだけ。
 * スキーマは migrations-agent-inquiries/0009_create_bridge_jobs.sql(2026-11-08に本番へ適用済み)。
 */

/** 要望の本文の上限(文字数)。D1の1行に収め、CLIへ渡す標準入力も短く保つ。 */
export const BRIDGE_JOB_REQUEST_MAX = 8000;
const LIST_REQUEST_MAX = 500;
const LIST_RESULT_MAX = 4000;

export type BridgeJobRegisterInput = {
  requestText: string;
  createdBy: string;
  origin: string;
  /** PR作成など外部へ書き込む要望。試行は1回だけにする(SPEC 12章)。 */
  externalWrite: boolean;
};

export type BridgeJobRegisterResult =
  | { ok: true; jobId: string }
  | { ok: false; errorCode: 'empty_request' | 'request_too_long' | 'db_error'; detail: string };

function randomJobId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** bridge_jobsとbridge_job_locksの行を1つのbatchで作る(片方だけ残さない)。履歴のqueuedはロックの表のトリガーが書く。 */
export async function registerBridgeJob(db: D1Database, input: BridgeJobRegisterInput, newJobId: () => string = randomJobId): Promise<BridgeJobRegisterResult> {
  const requestText = input.requestText.trim();
  if (!requestText) return { ok: false, errorCode: 'empty_request', detail: '要望が空です' };
  if (requestText.length > BRIDGE_JOB_REQUEST_MAX) {
    return { ok: false, errorCode: 'request_too_long', detail: `要望は${BRIDGE_JOB_REQUEST_MAX}文字以内にしてください(${requestText.length}文字)` };
  }
  const jobId = newJobId();
  try {
    await db.batch([
      db.prepare('INSERT INTO bridge_jobs (job_id, origin, created_by, external_write, request_text) VALUES (?, ?, ?, ?, ?)')
        .bind(jobId, input.origin, input.createdBy, input.externalWrite ? 1 : 0, requestText),
      db.prepare('INSERT INTO bridge_job_locks (job_id, created_by, max_attempts) VALUES (?, ?, ?)')
        .bind(jobId, input.createdBy, input.externalWrite ? 1 : 3),
    ]);
  } catch (error) {
    return { ok: false, errorCode: 'db_error', detail: error instanceof Error ? error.message : String(error) };
  }
  return { ok: true, jobId };
}

export type BridgeJobListItem = {
  jobId: string;
  createdAt: number;
  requestText: string;
  externalWrite: boolean;
  status: string;
  attempts: number;
  maxAttempts: number;
  claimedBy: string | null;
  lastError: string | null;
  resultText: string | null;
  resultTruncated: boolean;
  exitCode: number | null;
};

type ListRow = {
  job_id: string; created_at: number; request_text: string; external_write: number;
  status: string; attempts: number; max_attempts: number; claimed_by: string | null; last_error: string | null;
  result_text: string | null; exit_code: number | null;
};

/** 依頼者のジョブを新しい順に返す。結果は完了にしたロックのresult_path(bridge_job_results:<claim_token>)が指す行。 */
export async function listBridgeJobs(db: D1Database, createdBy: string, limit = 20): Promise<BridgeJobListItem[]> {
  const { results } = await db.prepare(
    `SELECT j.job_id, j.created_at, j.request_text, j.external_write,
            l.status, l.attempts, l.max_attempts, l.claimed_by, l.last_error,
            r.result_text, r.exit_code
       FROM bridge_jobs j
       JOIN bridge_job_locks l ON l.job_id = j.job_id
       LEFT JOIN bridge_job_results r ON r.job_id = j.job_id AND l.result_path = 'bridge_job_results:' || r.claim_token
      WHERE j.created_by = ?
      ORDER BY j.created_at DESC, j.rowid DESC
      LIMIT ?`
  ).bind(createdBy, limit).all<ListRow>();
  return (results ?? []).map((row) => ({
    jobId: row.job_id,
    createdAt: row.created_at,
    requestText: row.request_text.slice(0, LIST_REQUEST_MAX),
    externalWrite: row.external_write === 1,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    claimedBy: row.claimed_by,
    lastError: row.last_error,
    resultText: row.result_text === null ? null : row.result_text.slice(0, LIST_RESULT_MAX),
    resultTruncated: row.result_text !== null && row.result_text.length > LIST_RESULT_MAX,
    exitCode: row.exit_code,
  }));
}
