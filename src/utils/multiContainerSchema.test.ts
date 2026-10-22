import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const at='2026-10-22T00:00:00Z';
function setup(){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  db.exec(readFileSync('migrations/0185_create_container_image_records.sql','utf8'));
  db.exec(readFileSync('migrations/0187_create_multi_container_statistics.sql','utf8'));
  const resource=db.prepare('INSERT INTO cf_container_resources (container_id,provider,account_ref,application_ref,instance_ref,display_name,created_at) VALUES (?,\'cloudflare\',\'account\',\'app\',?,?,?)');
  resource.run('a','instance-a','A',at);resource.run('b','instance-b','B',at);
  return db;
}
function session(db:DatabaseSync,id:string,key:string,start=at,end:string|null='2026-10-22T02:00:00Z'){
  db.prepare('INSERT INTO cf_container_runtime_sessions (session_id,container_id,started_at,ended_at,state,evidence,created_at) VALUES (?,?,?,?,?,\'observed\',?)').run(id,key,start,end,end?'ended':'running',at);
}
function cost(db:DatabaseSync,id:string,revision:number,amount:number|null,basis='estimate'){
  db.prepare(`INSERT INTO cf_container_cost_observations (cost_record_id,session_id,cost_key,revision,category,currency,amount_micros,basis,source,source_ref,measured_at,recorded_by) VALUES (?,'s','cpu',?,'cpu','USD',?,?,'test',?,?,'admin')`).run(id,revision,amount,basis,id,at);
}
describe('複数コンテナ集計のDBスキーマ',()=>{
  it('対象物未入力で並行稼働を記録し、同じコンテナの区間重複を拒否する',()=>{
    const db=setup();try{session(db,'a1','a');session(db,'b1','b');expect(db.prepare('SELECT COUNT(*) AS n FROM cf_container_runtime_sessions').get()?.n).toBe(2);expect(db.prepare('SELECT COUNT(*) AS n FROM cf_container_session_targets').get()?.n).toBe(0);expect(()=>session(db,'a2','a')).toThrow('overlapping');session(db,'a3','a','2026-10-22T02:00:00Z','2026-10-22T03:00:00Z');expect(()=>session(db,'bad','missing')).toThrow();}finally{db.close();}
  });
  it('終了未確認・不正日時・稼働中の重複を区別する',()=>{
    const db=setup();try{session(db,'open','a',at,null);expect(()=>session(db,'open2','a',at,null)).toThrow();expect(()=>session(db,'bad','b','invalid')).toThrow();expect(()=>session(db,'reverse','b','2026-10-22T03:00:00Z','2026-10-22T02:00:00Z')).toThrow();}finally{db.close();}
  });
  it('費用の不明と0を分け、改訂前の概算を二重加算しない',()=>{
    const db=setup();try{session(db,'s','a');cost(db,'c1',1,null,'unknown');expect(db.prepare('SELECT amount_micros FROM cf_container_latest_costs').get()?.amount_micros).toBeNull();cost(db,'c2',2,0,'actual');expect(db.prepare('SELECT amount_micros FROM cf_container_latest_costs').all()).toEqual([{amount_micros:0}]);expect(db.prepare('SELECT COUNT(*) AS n FROM cf_container_cost_observations').get()?.n).toBe(2);expect(()=>cost(db,'bad',3,null,'estimate')).toThrow();expect(()=>db.exec("UPDATE cf_container_cost_observations SET amount_micros=1")).toThrow('append-only');}finally{db.close();}
  });
  it('イベントのコンテナ取り違えと重複取込を拒否し、未分類イベントを保存できる',()=>{
    const db=setup();try{session(db,'s','a');const insert=db.prepare(`INSERT INTO cf_container_runtime_events (event_id,container_id,session_id,source,source_event_id,occurred_at,event_type,result) VALUES (?,?,?,'test',?,?,'start','success')`);expect(()=>insert.run('bad','b','s','bad',at)).toThrow('mismatch');insert.run('legacy',null,null,'legacy',at);expect(()=>insert.run('again',null,null,'legacy',at)).toThrow();}finally{db.close();}
  });
  it('物品未登録でも市場調査と実装を同じセッション内で別集計できる',()=>{
    const db=setup();try{session(db,'s','a');const insert=db.prepare(`INSERT INTO cf_container_runtime_notes (note_id,session_id,entry_key,revision,content,work_category,purpose,tools_json,classification_source,recorded_by,recorded_at) VALUES (?,'s',?,1,?,?,?,?,?,'admin',?)`);
    insert.run('research','research-entry','競合サービスの価格を確認','market-research','相場の把握','["codex","web"]','manual',at);
    insert.run('implementation','implementation-entry','機能を実装','development','操作の自動化','["codex","typescript"]','manual',at);
    expect(db.prepare('SELECT work_category FROM cf_container_latest_runtime_notes ORDER BY work_category').all()).toEqual([{work_category:'development'},{work_category:'market-research'}]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM cf_container_work_targets').get()?.n).toBe(0);
    expect(()=>db.prepare(`INSERT INTO cf_container_runtime_notes (note_id,session_id,revision,content,tools_json,recorded_by,recorded_at) VALUES ('bad','s',1,'bad','{}','admin',?)`).run(at)).toThrow();
    }finally{db.close();}
  });
  it('作業メモの改訂を残し、read-onlyと権限不足を別々に保存する',()=>{
    const db=setup();try{session(db,'s','a');const note=db.prepare("INSERT INTO cf_container_runtime_notes (note_id,session_id,revision,content,recorded_by,recorded_at) VALUES (?,'s',?,?,'admin',?)");note.run('n1',1,'調査',at);note.run('n2',2,'調査完了',at);expect(db.prepare('SELECT content FROM cf_container_latest_runtime_notes').get()?.content).toBe('調査完了');const obs=db.prepare(`INSERT INTO cf_container_filesystem_observations (observation_id,session_id,path,principal,mount_mode,write_status,failure_reason,probe_method,observed_at,source,source_ref) VALUES (?,'s','/usr','app',?,'denied',?,'create_delete',?,'test',?)`);obs.run('ro','ro','read_only',at,'ro');obs.run('permissions','rw','permission',at,'permissions');expect(db.prepare('SELECT COUNT(*) AS n FROM cf_container_filesystem_observations').get()?.n).toBe(2);expect(()=>db.exec('DELETE FROM cf_container_filesystem_observations')).toThrow('append-only');expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);}finally{db.close();}
  });
});
