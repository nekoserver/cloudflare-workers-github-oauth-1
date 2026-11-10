import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const dir=new URL('../migrations-agent-inquiries/',import.meta.url);
function open(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0001_create_inquiry_tables.sql','0002_add_key_cost_and_knowledge.sql','0006_create_inquiry_proposals.sql','0013_create_inquiry_work_records.sql','0014_create_inquiry_improvement_events.sql'])db.exec(readFileSync(new URL(file,dir),'utf8'));
 db.exec(`INSERT INTO inquiry_cases(id,goal) VALUES ('c','goal');
 INSERT INTO inquiry_entries(id,case_id,seq,clue,asked_by,agent,question) VALUES ('e','c',1,'clue','codex','muse','question');
 INSERT INTO inquiry_proposals(id,case_id,proposed_by,text) VALUES ('old','c','muse','old'),('p','c','muse','new'),('p2','c','muse','second');
 INSERT INTO inquiry_work_runs(id,performed_by,request_text,selection_policy,success_criterion,reason_timing,expected_items,expected_groups,progress_snapshot_json) VALUES ('r','codex','request','policy','progress','retrospective',1,1,'{"proposals":[{"id":"old"}]}');
 INSERT INTO inquiry_work_groups(run_id,entry_id,case_id,group_reason,goal_snapshot) VALUES ('r','e','c','group','goal');`);return db;
}
function add(db,id='v1',previous=null,feasibility='unverified',evidence='[]'){
 db.prepare(`INSERT INTO inquiry_improvement_events(event_id,proposal_id,work_run_id,source_entry_id,previous_event_id,classification,feasibility,delivery,reason,evidence_json,recorded_by,proposal_text_snapshot) VALUES (?,'p','r','e',?,'new',?,'not_implemented','reason',?,'codex','new')`).run(id,previous,feasibility,evidence);
}
test('改善案数と成立確認済み案数を分け、再評価で二重計上しない',()=>{
 const db=open();add(db);let row=db.prepare('SELECT * FROM inquiry_improvement_summary').get();assert.equal(row.new_independent,1);assert.equal(row.confirmed_feasible,0);
 add(db,'v2','v1','confirmed','[{"ref":"test:isolated"}]');row=db.prepare('SELECT * FROM inquiry_improvement_summary').get();assert.equal(row.new_independent,1);assert.equal(row.confirmed_feasible,1);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiry_improvement_events').get().n,2);
});
test('既存案を新案に数えず、条件付きと実現性確認を混ぜない',()=>{
 const db=open();assert.throws(()=>db.exec(`INSERT INTO inquiry_improvement_events(event_id,proposal_id,work_run_id,source_entry_id,classification,feasibility,delivery,reason,evidence_json,recorded_by,proposal_text_snapshot) VALUES ('x','old','r','e','new','unverified','not_implemented','reason','[]','codex','old')`),/baseline/);
 add(db,'v1',null,'conditional');assert.equal(db.prepare('SELECT conditional FROM inquiry_improvement_summary').get().conditional,1);
});
test('根拠のない実現性確認、上書き、履歴分岐を拒否する',()=>{
 const db=open();assert.throws(()=>add(db,'v1',null,'confirmed'),/CHECK/);add(db);
 assert.throws(()=>db.exec(`UPDATE inquiry_improvement_events SET reason='rewrite'`),/append.only/);
 assert.throws(()=>db.exec(`DELETE FROM inquiry_improvement_events`),/append.only/);
 add(db,'v2','v1');assert.throws(()=>add(db,'v3','v1'),/append.only|UNIQUE/);
 assert.throws(()=>add(db,'v1'),/append.only|UNIQUE/);
});
test('重複と判明した候補は独立案数から外し、過去イベントを残す',()=>{
 const db=open();add(db);
 db.exec(`INSERT INTO inquiry_improvement_events(event_id,proposal_id,work_run_id,source_entry_id,previous_event_id,classification,duplicate_of_proposal_id,feasibility,delivery,reason,evidence_json,recorded_by,proposal_text_snapshot) VALUES ('v2','p','r','e','v1','duplicate','old','unverified','not_implemented','same plan','[]','codex','new')`);
 const row=db.prepare('SELECT * FROM inquiry_improvement_summary').get();assert.equal(row.new_independent,0);assert.equal(row.duplicates,1);
});
test('制約・不確実性・依存関係を分け、共通条件と影響案を別々に数える',()=>{
 const db=open();
 const context=JSON.stringify({fixed_constraints:[{id:'cpu',state:'confirmed'}],policy_constraints:[{id:'no-build',state:'confirmed'}],uncertainties:[{id:'weather',kind:'weather',state:'unobserved'}],dependencies:[{id:'a-before-b',predecessor:'a',successor:'b',relation:'finish_to_start',gate:'all',state:'unmet'}],note:'metadata'});
 db.prepare(`INSERT INTO inquiry_improvement_events(event_id,proposal_id,work_run_id,source_entry_id,classification,feasibility,delivery,reason,evidence_json,recorded_by,proposal_text_snapshot,context_json) VALUES ('v1','p','r','e','new','conditional','not_implemented','reason','[]','codex','new',?)`).run(context);
 const rows=db.prepare('SELECT category,context_count,affected_plans FROM inquiry_context_summary ORDER BY category').all();assert.equal(rows.length,4);assert.ok(rows.every(r=>r.context_count===1 && r.affected_plans===1));
 assert.throws(()=>db.exec(`INSERT INTO inquiry_improvement_events(event_id,proposal_id,work_run_id,source_entry_id,classification,feasibility,delivery,reason,evidence_json,recorded_by,proposal_text_snapshot,context_json) VALUES ('bad','p2','r','e','new','unverified','not_implemented','reason','[]','codex','second','{"uncertainties":[{"state":"unknown"}]}')`),/context/);
});
test('既存案を後続イベントで新案へ洗い替えできない',()=>{
 const db=open();
 db.exec(`INSERT INTO inquiry_improvement_events(event_id,proposal_id,work_run_id,source_entry_id,classification,duplicate_of_proposal_id,feasibility,delivery,reason,evidence_json,recorded_by,proposal_text_snapshot) VALUES ('v1','old','r','e','duplicate','p','unverified','not_implemented','reason','[]','codex','old')`);
 assert.throws(()=>db.exec(`INSERT INTO inquiry_improvement_events(event_id,proposal_id,work_run_id,source_entry_id,previous_event_id,classification,feasibility,delivery,reason,evidence_json,recorded_by,proposal_text_snapshot) VALUES ('v2','old','r','e','v1','new','unverified','not_implemented','reason','[]','codex','old')`),/baseline/);
});
test('別run経由でも初回baselineを使って既存案の新案化を拒否する',()=>{
 const db=open();
 db.exec(`INSERT INTO inquiry_improvement_events(event_id,proposal_id,work_run_id,source_entry_id,classification,duplicate_of_proposal_id,feasibility,delivery,reason,evidence_json,recorded_by,proposal_text_snapshot) VALUES ('v1','old','r','e','duplicate','p','unverified','not_implemented','reason','[]','codex','old');
 INSERT INTO inquiry_work_runs(id,performed_by,request_text,selection_policy,success_criterion,reason_timing,expected_items,expected_groups,progress_snapshot_json) VALUES ('r2','codex','request','policy','progress','retrospective',1,1,'{"proposals":[]}');
 INSERT INTO inquiry_work_groups(run_id,entry_id,case_id,group_reason,goal_snapshot) VALUES ('r2','e','c','group','goal');`);
 assert.throws(()=>db.exec(`INSERT INTO inquiry_improvement_events(event_id,proposal_id,work_run_id,source_entry_id,previous_event_id,classification,feasibility,delivery,reason,evidence_json,recorded_by,proposal_text_snapshot) VALUES ('v2','old','r2','e','v1','new','unverified','not_implemented','reason','[]','codex','old')`),/baseline/);
});
