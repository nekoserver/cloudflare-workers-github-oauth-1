import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const dir = new URL('../migrations-agent-inquiries/', import.meta.url);
function open(withAudit=true) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const file of ['0001_create_inquiry_tables.sql', '0002_add_key_cost_and_knowledge.sql', '0006_create_inquiry_proposals.sql', '0013_create_inquiry_work_records.sql']) db.exec(readFileSync(new URL(file, dir), 'utf8'));
  db.exec(`INSERT INTO inquiry_cases(id,goal) VALUES ('c','goal'),('other','other');
    INSERT INTO inquiry_entries(id,case_id,seq,clue,asked_by,agent,question) VALUES ('e','c',1,'clue','codex','muse','question');
    INSERT INTO inquiry_keys(id,case_id,kind,text) VALUES ('k','c','unknown','problem'),('other-k','other','unknown','other');
    INSERT INTO inquiry_entry_keys VALUES ('e','k','target');
    INSERT INTO inquiry_work_runs(id,performed_by,request_text,selection_policy,success_criterion,reason_timing,expected_items,expected_groups) VALUES ('r','codex','request','policy','問題の洗い出しや解決が進む','retrospective',1,1);
    INSERT INTO inquiry_work_groups(run_id,entry_id,case_id,group_reason,goal_snapshot) VALUES ('r','e','c','same decision boundary','goal');`);
  if (withAudit) db.exec(`INSERT INTO inquiry_work_audits(id,run_id,entry_id,audit_timing,progress_snapshot_json,duplicate_check_json,conclusion,checked_by) VALUES ('audit','r','e','retrospective','{"cases":1}','{"checked":true}','初回後の照合','codex')`);
  return db;
}
function item(db) { db.exec("INSERT INTO inquiry_work_items(run_id,entry_id,key_id,priority_rank,selection_reason,grouping_reason,title_snapshot) VALUES ('r','e','k',1,'blocks progress','shared decision','problem')"); }
test('選定理由と集約理由を元の問い合わせと別に保存する', () => {
  const db=open(); item(db);
  assert.equal(db.prepare('SELECT selection_reason FROM inquiry_work_items').get().selection_reason,'blocks progress');
  assert.equal(db.prepare("SELECT question FROM inquiry_entries WHERE id='e'").get().question,'question');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiry_work_evaluations').get().n,0);
});
test('別議題・未対応の論点、重複順位、空の理由を拒否する', () => {
  const db=open();
  assert.throws(()=>db.exec("INSERT INTO inquiry_work_items(run_id,entry_id,key_id,priority_rank,selection_reason,grouping_reason,title_snapshot) VALUES ('r','e','other-k',1,'reason','group','other')"),/target|case/);
  assert.throws(()=>db.exec("INSERT INTO inquiry_work_items(run_id,entry_id,key_id,priority_rank,selection_reason,grouping_reason,title_snapshot) VALUES ('r','e','k',1,' ','group','problem')"),/CHECK/);
  item(db); assert.throws(()=>item(db),/UNIQUE|append.only/);
});
test('全件を記録する前は完了記録を作れず、揃っても成果評価は自動生成しない', () => {
  const db=open();
  assert.throws(()=>db.exec("INSERT INTO inquiry_work_completions(run_id,recorded_by) VALUES ('r','codex')"),/count/);
  item(db); db.exec("INSERT INTO inquiry_work_completions(run_id,recorded_by) VALUES ('r','codex')");
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiry_work_evaluations').get().n,0);
});
test('履歴は追記のみで、根拠の物理削除も拒否する', () => {
  const db=open();item(db);
  for (const table of ['inquiry_work_runs','inquiry_work_groups','inquiry_work_items']) {
    assert.throws(()=>db.exec(`DELETE FROM ${table}`),/append.only/);
  }
  assert.throws(()=>db.exec("UPDATE inquiry_work_items SET selection_reason='rewrite'"),/append.only/);
  assert.throws(()=>db.exec("DELETE FROM inquiry_entries WHERE id='e'"),/FOREIGN KEY/);
  assert.throws(()=>db.exec("DELETE FROM inquiry_keys WHERE id='k'"),/FOREIGN KEY/);
});
test('成功・進展の評価には根拠が必要で、失敗や再評価も別行で残る', () => {
  const db=open();item(db);
  const insert=db.prepare('INSERT INTO inquiry_work_evaluations(id,run_id,phase,outcome,reason,evidence_json,assessed_by) VALUES (?,\'r\',\'problem_discovery\',?,?,?,\'codex\')');
  assert.throws(()=>insert.run('v1','success','reason','[]'),/CHECK/);
  insert.run('v1','progress','競合を発見','[{"ref":"entry:e","detail":"受付判定の競合"}]');
  insert.run('v2','failure','追加検証で否定','[{"ref":"test:isolated","detail":"反例"}]');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiry_work_evaluations').get().n,2);
  assert.throws(()=>db.exec("UPDATE inquiry_work_evaluations SET outcome='success'"),/append.only/);
});
test('提案と独立した議題も型を分けて記録し、完了後の追加を拒否する', () => {
  const db=open();
  db.exec("INSERT INTO inquiry_proposals(id,case_id,proposed_by,text) VALUES ('p','c','user','proposal')");
  db.exec("INSERT INTO inquiry_work_items(run_id,entry_id,proposal_id,priority_rank,selection_reason,grouping_reason,title_snapshot) VALUES ('r','e','p',1,'reason','group','proposal')");
  db.exec("INSERT INTO inquiry_work_completions(run_id,recorded_by) VALUES ('r','codex')");
  assert.throws(()=>item(db),/sealed|append.only/);
  assert.throws(()=>db.exec("INSERT INTO inquiry_work_items(run_id,entry_id,source_case_id,priority_rank,selection_reason,grouping_reason,title_snapshot) VALUES ('r','e','c',2,'reason','group','goal')"),/sealed|append.only/);
});

test('REPLACEやUPSERTでも作業履歴を置換できない', () => {
 const db=open();item(db);
 assert.throws(()=>db.exec("INSERT OR REPLACE INTO inquiry_work_runs(id,performed_by,request_text,selection_policy,success_criterion,reason_timing,expected_items,expected_groups) VALUES ('r','x','rewrite','x','x','retrospective',1,1)"),/append.only/);
 assert.throws(()=>db.exec("INSERT INTO inquiry_work_items(run_id,entry_id,key_id,priority_rank,selection_reason,grouping_reason,title_snapshot) VALUES ('r','e','k',2,'rewrite','x','x') ON CONFLICT(run_id,key_id) DO UPDATE SET selection_reason='rewrite'"),/append.only/);
});
test('集約ごとの全体進捗・重複監査が無ければ作業記録を完了にしない', () => {
 const db=open(false);item(db);
 assert.throws(()=>db.exec("INSERT INTO inquiry_work_completions(run_id,recorded_by) VALUES ('r','codex')"),/audit/);
});
