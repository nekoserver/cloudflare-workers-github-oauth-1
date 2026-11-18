import { prepareImageRecord } from './containerImageRecords';
import { analyzeBuildLog } from './moonbitBuildLog';
import { parseCacheEffects } from './containerBuildCacheEffects';
export interface BuildTimingStep { id: number; label: string; state: 'running' | 'done' | 'cached' | 'error' | 'canceled'; seconds: number | null }
export interface BuildTimingRecord { snapshotKey: string; buildUuid: string; createdOn: string | null; status: string | null; logComplete: boolean; collectedAt: string; steps: BuildTimingStep[] }

/**
 * BuildKit plain progress only. A RUN instruction is one step, including all shell commands inside it.
 * 解析本体はMoonBit(moonbit/buildlog/)。失敗(ステップ番号の再使用・件数超過・想定外の出力)は例外にする。
 */
export function parseBuildTimings(log: string): BuildTimingStep[] {
  const result = analyzeBuildLog(log);
  if (!result.ok) throw new Error(result.detail);
  return result.steps;
}

export function summarizeBuildTimings(steps: BuildTimingStep[]) {
  return { measuredSeconds: steps.reduce((n,s)=>n+(s.state === 'done' ? s.seconds ?? 0 : 0),0),
    completed: steps.filter(s=>s.state === 'done' && s.seconds !== null).length,
    cached: steps.filter(s=>s.state === 'cached').length,
    incomplete: steps.filter(s=>s.state !== 'cached' && (s.state !== 'done' || s.seconds === null)).length };
}

export async function storeBuildTimings(db: D1Database, build: {buildUuid:string;status:string|null;log:string;logComplete?:boolean;createdOn?:string|null}) {
  const steps = parseBuildTimings(build.log);
  // Worker-only/preview builds can have a complete API log without any BuildKit
  // steps. They are not measurements and must not displace useful history.
  if (steps.length === 0) {
    return {snapshotKey:null,stepCount:0,...summarizeBuildTimings(steps),stored:false};
  }
  const complete = build.logComplete === true;
  const bytes = new TextEncoder().encode(JSON.stringify({version:1,build:build.buildUuid,status:build.status,createdOn:build.createdOn ?? null,complete,steps}));
  const snapshotKey = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const statements = [db.prepare(`INSERT OR IGNORE INTO cf_container_build_measurements
    (snapshot_key,build_uuid,build_created_on,build_status,log_complete,step_count,terminal_count) VALUES (?,?,?,?,?,?,?)`)
    .bind(snapshotKey,build.buildUuid,build.createdOn ?? null,build.status,Number(complete),steps.length,steps.filter(s=>s.state !== 'running').length)];
  // ソースからのコンパイル時間とキャッシュからのインストール時間(Dockerfileが出すCACHE_EFFECTの行)。ビルドのたびに記録する。
  for (const effect of parseCacheEffects(build.log)) statements.push(db.prepare(`INSERT OR IGNORE INTO cf_container_build_cache_effects (snapshot_key,build_uuid,package_name,version,compile_seconds,install_seconds,saved_seconds,source_bytes,package_bytes) VALUES (?,?,?,?,?,?,?,?,?)`).bind(snapshotKey,build.buildUuid,effect.packageName,effect.version,effect.compileSeconds,effect.installSeconds,effect.savedSeconds,effect.sourceBytes,effect.packageBytes));
  for (const step of steps) statements.push(db.prepare(`INSERT OR IGNORE INTO cf_container_build_steps (snapshot_key,step_id,label,state,seconds) VALUES (?,?,?,?,?)`).bind(snapshotKey,step.id,step.label,step.state,step.seconds));
  const imageRecord = await prepareImageRecord(db,{
    schemaVersion:1,kind:'build-timing',build:{buildUuid:build.buildUuid,status:build.status,createdOn:build.createdOn ?? null},
    measuredAt:build.createdOn ?? null,
    timingSnapshotKey:snapshotKey,logComplete:complete,steps,summary:summarizeBuildTimings(steps),
    imageBytes:null,buildElapsedSeconds:null,
    note:'BuildKitステップ累計。並列処理を含むため経過時間ではない。サイズは未取得。'
  });
  statements.push(imageRecord.statement);
  await db.batch(statements);
  return {snapshotKey,stepCount:steps.length,...summarizeBuildTimings(steps),stored:true};
}

export async function loadBuildTimings(db: D1Database): Promise<BuildTimingRecord[]> {
  // Rank observations within a build by terminal coverage, so a late partial fetch cannot roll back completed rows.
  const {results} = await db.prepare(`SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY build_uuid ORDER BY terminal_count DESC, step_count DESC, log_complete DESC, collected_at DESC, snapshot_key DESC) AS rank
    FROM cf_container_build_measurements
    WHERE step_count > 0
  ) WHERE rank=1 ORDER BY COALESCE(build_created_on,collected_at) DESC, build_uuid DESC LIMIT 5`).all<{
    snapshot_key:string;build_uuid:string;build_created_on:string|null;build_status:string|null;log_complete:number;collected_at:string;step_count:number;terminal_count:number;
  }>();
  const records: BuildTimingRecord[]=[];
  for (const row of results ?? []) {
    const {results:steps} = await db.prepare('SELECT step_id AS id,label,state,seconds FROM cf_container_build_steps WHERE snapshot_key=? ORDER BY step_id').bind(row.snapshot_key).all<BuildTimingStep>();
    if ((steps ?? []).length !== row.step_count || (steps ?? []).filter(s=>s.state !== 'running').length !== row.terminal_count) throw new Error('ステップ記録が不整合です: ' + row.snapshot_key);
    records.push({snapshotKey:row.snapshot_key,buildUuid:row.build_uuid,createdOn:row.build_created_on,status:row.build_status,logComplete:!!row.log_complete,collectedAt:row.collected_at,steps:steps ?? []});
  }
  return records;
}
