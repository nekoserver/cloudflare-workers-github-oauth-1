import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { BRIDGE_JOB_REQUEST_MAX, listBridgeJobs, registerBridgeJob } from './bridgeJobs';

// 対象: /muse-wasm-testから要望をD1 agent-inquiriesのbridge_jobsへ積む処理(SPEC bridge-job-queue 12章)。
// 本番に適用済みのスキーマ(migrations-agent-inquiries/0009)をSQLiteへ流し、本番と同じSQLで確かめる。
// 故障想定: 片方の表だけに行が残る / 外部へ書き込む要望の試行回数が1にならない / 空・長すぎる要望を積む /
// 他人のジョブが一覧に出る / 結果の本文が一覧に出ない。

const databases: DatabaseSync[] = [];
afterEach(() => { databases.splice(0).forEach((db) => db.close()); });

type Bound = { query: string; args: unknown[] };
function setup() {
  const sql = new DatabaseSync(':memory:');
  databases.push(sql);
  sql.exec(readFileSync('migrations-agent-inquiries/0009_create_bridge_jobs.sql', 'utf8'));
  const bind = (query: string, args: unknown[]) => ({
    query, args,
    all: async () => ({ results: sql.prepare(query).all(...(args as never[])) }),
    first: async () => sql.prepare(query).get(...(args as never[])) ?? null,
    run: async () => ({ meta: { changes: Number(sql.prepare(query).run(...(args as never[])).changes) } }),
  });
  const db = {
    prepare: (query: string) => ({ ...bind(query, []), bind: (...args: unknown[]) => bind(query, args) }),
    // D1のbatchと同じく、全部成功するか全部取り消す
    batch: async (statements: Bound[]) => {
      sql.exec('BEGIN');
      try {
        const results = statements.map(({ query, args }) => ({ meta: { changes: Number(sql.prepare(query).run(...(args as never[])).changes) } }));
        sql.exec('COMMIT');
        return results;
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sql, db: db as unknown as D1Database };
}
const ids = (...values: string[]) => () => values.shift()!;

describe('registerBridgeJob', () => {
  it('bridge_jobsとbridge_job_locksに同じjob_idで1行ずつ作り、履歴にqueuedが残る', async () => {
    const { sql, db } = setup();
    const result = await registerBridgeJob(db, { requestText: '  READMEの誤字を直して  ', createdBy: 'neko', origin: 'muse-wasm-test', externalWrite: false }, ids('a'.repeat(32)));
    expect(result).toEqual({ ok: true, jobId: 'a'.repeat(32) });
    expect(sql.prepare('SELECT job_id, origin, created_by, external_write, request_text FROM bridge_jobs').all()).toEqual([
      { job_id: 'a'.repeat(32), origin: 'muse-wasm-test', created_by: 'neko', external_write: 0, request_text: 'READMEの誤字を直して' },
    ]);
    expect(sql.prepare('SELECT job_id, created_by, status, attempts, max_attempts FROM bridge_job_locks').all()).toEqual([
      { job_id: 'a'.repeat(32), created_by: 'neko', status: 'queued', attempts: 0, max_attempts: 3 },
    ]);
    expect(sql.prepare('SELECT kind, actor FROM bridge_job_events').all()).toEqual([{ kind: 'queued', actor: 'neko' }]);
  });

  it('外部へ書き込む要望は試行回数を1回にする', async () => {
    const { sql, db } = setup();
    await registerBridgeJob(db, { requestText: 'PRを作って', createdBy: 'neko', origin: 'muse-wasm-test', externalWrite: true }, ids('b'.repeat(32)));
    expect(sql.prepare('SELECT external_write FROM bridge_jobs').get()).toEqual({ external_write: 1 });
    expect(sql.prepare('SELECT max_attempts FROM bridge_job_locks').get()).toEqual({ max_attempts: 1 });
  });

  it.each([['', 'empty_request'], ['   \n ', 'empty_request'], ['あ'.repeat(BRIDGE_JOB_REQUEST_MAX + 1), 'request_too_long']])('不正な要望(%#)は積まない', async (text, code) => {
    const { sql, db } = setup();
    const result = await registerBridgeJob(db, { requestText: text, createdBy: 'neko', origin: 'muse-wasm-test', externalWrite: false });
    expect(result).toMatchObject({ ok: false, errorCode: code });
    expect(sql.prepare('SELECT COUNT(*) AS n FROM bridge_jobs').get()).toEqual({ n: 0 });
  });

  it('上限ちょうどの長さは積める', async () => {
    const { db } = setup();
    expect((await registerBridgeJob(db, { requestText: 'a'.repeat(BRIDGE_JOB_REQUEST_MAX), createdBy: 'neko', origin: 'muse-wasm-test', externalWrite: false })).ok).toBe(true);
  });

  it('2つ目の文が失敗したら1つ目も残さず、理由を返す', async () => {
    const { sql, db } = setup();
    sql.exec("CREATE TRIGGER fail_lock BEFORE INSERT ON bridge_job_locks BEGIN SELECT RAISE(ABORT, 'lock insert failed'); END;");
    const result = await registerBridgeJob(db, { requestText: '要望', createdBy: 'neko', origin: 'muse-wasm-test', externalWrite: false });
    expect(result).toMatchObject({ ok: false, errorCode: 'db_error' });
    expect(result.ok ? '' : result.detail).toContain('lock insert failed');
    expect(sql.prepare('SELECT COUNT(*) AS n FROM bridge_jobs').get()).toEqual({ n: 0 });
  });

  it('既定のjob_idは32桁の16進', async () => {
    const { db } = setup();
    const result = await registerBridgeJob(db, { requestText: '要望', createdBy: 'neko', origin: 'muse-wasm-test', externalWrite: false });
    expect(result.ok && result.jobId).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('listBridgeJobs', () => {
  it('自分のジョブだけを新しい順に返し、状態と結果の本文を添える', async () => {
    const { sql, db } = setup();
    await registerBridgeJob(db, { requestText: '古い要望', createdBy: 'neko', origin: 'muse-wasm-test', externalWrite: false }, ids('1'.repeat(32)));
    await registerBridgeJob(db, { requestText: '他人の要望', createdBy: 'other', origin: 'muse-wasm-test', externalWrite: false }, ids('2'.repeat(32)));
    await registerBridgeJob(db, { requestText: '新しい要望', createdBy: 'neko', origin: 'muse-wasm-test', externalWrite: true }, ids('3'.repeat(32)));
    sql.exec(`UPDATE bridge_jobs SET created_at = 100 WHERE job_id = '${'1'.repeat(32)}'`);
    sql.exec(`UPDATE bridge_jobs SET created_at = 200 WHERE job_id = '${'3'.repeat(32)}'`);
    // 1件目を本体コンテナのCLIが片付けた状態にする(bridge_jobs.pyと同じ書き方)
    sql.exec(`INSERT INTO bridge_job_results (job_id, claim_token, result_text, result_sha256, exit_code) VALUES ('${'1'.repeat(32)}', 'tok', '直しました', 'h', 0)`);
    sql.exec(`UPDATE bridge_job_locks SET status = 'done', claim_token = 'tok', claimed_by = 'codex@cf-demo-container-1', attempts = 1, result_path = 'bridge_job_results:tok' WHERE job_id = '${'1'.repeat(32)}'`);

    const rows = await listBridgeJobs(db, 'neko');
    expect(rows.map((row) => row.jobId)).toEqual(['3'.repeat(32), '1'.repeat(32)]);
    expect(rows[0]).toMatchObject({ requestText: '新しい要望', status: 'queued', attempts: 0, maxAttempts: 1, externalWrite: true, resultText: null });
    expect(rows[1]).toMatchObject({ requestText: '古い要望', status: 'done', attempts: 1, claimedBy: 'codex@cf-demo-container-1', resultText: '直しました', exitCode: 0, createdAt: 100 });
  });

  it('長い要望と結果は一覧用に切り詰める', async () => {
    const { sql, db } = setup();
    await registerBridgeJob(db, { requestText: 'r'.repeat(1000), createdBy: 'neko', origin: 'muse-wasm-test', externalWrite: false }, ids('4'.repeat(32)));
    sql.exec(`INSERT INTO bridge_job_results (job_id, claim_token, result_text, result_sha256) VALUES ('${'4'.repeat(32)}', 't', '${'x'.repeat(5000)}', 'h')`);
    sql.exec(`UPDATE bridge_job_locks SET status = 'done', claim_token = 't', result_path = 'bridge_job_results:t' WHERE job_id = '${'4'.repeat(32)}'`);
    const [row] = await listBridgeJobs(db, 'neko');
    expect(row.requestText.length).toBe(500);
    expect(row.resultText!.length).toBe(4000);
    expect(row.resultTruncated).toBe(true);
  });
});
