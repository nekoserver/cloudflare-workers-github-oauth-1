import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseBuildTimings, summarizeBuildTimings, storeBuildTimings } from './containerBuildTimings';
describe('Dockerビルド実測', () => {
  it('並列・再表示・キャッシュ・中断を区別する', () => {
    const rows = parseBuildTimings('#1 [stage 1/3] RUN apt-get update\n#2 [stage 2/3] RUN npm install\n#1 DONE 10.2s\n#2 CACHED\n#1 [stage 1/3] RUN apt-get update\n#3 [stage 3/3] RUN check\n#3 ERROR: stopped');
    expect(rows).toHaveLength(3);
    expect(rows[0].seconds).toBe(10.2);
    expect(rows[1].state).toBe('cached'); expect(rows[1].seconds).toBeNull();
    expect(rows[2].state).toBe('error'); expect(rows[2].seconds).toBeNull();
    expect(summarizeBuildTimings(rows)).toEqual({ measuredSeconds:10.2, completed:1, cached:1, incomplete:1 });
  });
  it('ANSI付きログと未完了ステップを扱い、コマンド出力を処理名にしない', () => {
    const rows=parseBuildTimings('\u001b[32m#4 [build 1/2] RUN compile\u001b[0m\n#4 0.123 output\n#4 DONE 2.5s\n#5 exporting to image\n#5 exporting layers 3.0s done');
    expect(rows[0].label).toBe('[build 1/2] RUN compile');
    expect(rows[1].state).toBe('running');
  });
  it('同じステップ番号が別のビルドで再使用されたら推測で合算しない', () => {
    expect(() => parseBuildTimings('#1 [a] RUN a\n#1 DONE 1s\n#1 [b] RUN b')).toThrow();
  });
  it('一つのatomic batchでスナップショットとステップを保存し、再取得でも同じキーになる', async () => {
    const batches: unknown[][]=[];
    const db={prepare:(sql:string)=>({bind:(...values:unknown[])=>({sql,values})}),batch:async(s:unknown[])=>{batches.push(s);}};
    const build={buildUuid:'build-a',status:'success',log:'#1 [x] RUN x\n#1 DONE 2s',logComplete:true,createdOn:'2026-10-22T00:00:00Z'};
    const a=await storeBuildTimings(db as any,build); const b=await storeBuildTimings(db as any,build);
    expect(a.snapshotKey).toBe(b.snapshotKey); expect(batches).toHaveLength(2); expect(batches[0]).toHaveLength(3);
  });
  it('実SQLiteで再取得の重複を除外し、途中失敗のbatchをロールバックする', async () => {
    const batches: any[][]=[];
    const db={prepare:(sql:string)=>({bind:(...values:unknown[])=>({sql,values})}),batch:async(s:any[])=>{batches.push(s);}};
    const build={buildUuid:'build-a',status:'success',log:'#1 [x] RUN x\n#1 DONE 2s',logComplete:true};
    await storeBuildTimings(db as any,build);await storeBuildTimings(db as any,build);
    await storeBuildTimings(db as any,{...build,status:'running',log:'#1 [x] RUN x',logComplete:false});
    batches.push([{sql:"INSERT INTO cf_container_build_measurements (snapshot_key,build_uuid,log_complete,step_count,terminal_count) VALUES ('rollback','other',0,0,0)",values:[]},{sql:'INSERT INTO missing_table VALUES (1)',values:[]}]);
    const script = `import sqlite3,json,sys
p=json.load(sys.stdin);db=sqlite3.connect(':memory:');db.executescript(p['schema'])
failures=0
for batch in p['batches']:
 try:
  with db:
   for s in batch: db.execute(s['sql'],s['values'])
 except sqlite3.Error: failures+=1
print(json.dumps({'snapshots':db.execute('SELECT count(*) FROM cf_container_build_measurements').fetchone()[0],'steps':db.execute('SELECT count(*) FROM cf_container_build_steps').fetchone()[0],'failures':failures,'best':db.execute('SELECT terminal_count FROM cf_container_build_measurements ORDER BY terminal_count DESC,step_count DESC LIMIT 1').fetchone()[0]}))`;
    const output=execFileSync('python3',['-c',script],{input:JSON.stringify({schema:readFileSync('migrations/0184_create_container_build_timings.sql','utf8')+readFileSync('migrations/0185_create_container_image_records.sql','utf8'),batches}),encoding:'utf8'});
    expect(JSON.parse(output)).toEqual({snapshots:2,steps:2,failures:1,best:1});
  });

});
