import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import { buildContainerSessions, appendSessionNote, computeMultiContainerDays } from './cfContainerSessions';
const at=(hour:number)=>`2026-10-22T${String(hour).padStart(2,'0')}:00:00.000Z`;
const event=(id:number,action:string,hour:number,result='success')=>({id,action,createdAt:at(hour),result,containerKey:'a',containerLabel:'A',hourlyRateUsd:0.1});
describe('セッション別の稼働時間と作業メモ',()=>{
  it('再起動を区切りにし、連続start・失敗stopで費用を二重計上しない',()=>{
    const r=buildContainerSessions([event(1,'start',10),event(2,'start',11),event(3,'diag:health',11),event(4,'restart',12),event(5,'stop',13,'failure'),event(6,'stop',14)],new Date(at(15)));
    expect(r.sessions.map(s=>s.seconds)).toEqual([7200,7200]);
    expect(r.sessions[0].activities).toEqual({'diag:health':1});
    expect(r.sessions[0].estimatedCostUsd).toBeGreaterThan(0);
    expect(r.sessions[1].endReason).toBe('stop');
  });
  it('複数コンテナの並行稼働を別々に計算し、未分類は混ぜない',()=>{
    const r=buildContainerSessions([event(1,'start',10),{...event(2,'start',11),containerKey:'b',hourlyRateUsd:0.2},{...event(3,'stop',12),containerKey:'b'},event(4,'stop',13),{...event(5,'start',10),containerKey:null}],new Date(at(15)));
    expect(r.sessions.map(s=>[s.containerKey,s.seconds])).toEqual([['a',10800],['b',3600]]);
    expect(r.unattributedEvents).toBe(1);
    expect(r.sessions[0].estimatedCostUsd).toBeCloseTo(0.3);
    expect(r.sessions[1].estimatedCostUsd).toBeCloseTo(0.2);
    expect(buildContainerSessions([{...event(1,'start',10),hourlyRateUsd:null}],new Date(at(11))).sessions[0].estimatedCostUsd).toBeNull();
  });
  it('停止の欠落・未来の記録・未記録の作業を確定済みと扱わない',()=>{
    const r=buildContainerSessions([event(1,'stop',9),event(2,'start',10),event(3,'stop',16)],new Date(at(15)));
    expect(r.unmatchedStops).toBe(1);expect(r.ignoredEvents).toBe(1);
    expect(r.sessions[0].endAt).toBeNull();expect(r.sessions[0].seconds).toBe(18000);
  });
  it('同日利用と同時稼働を分け、日本時間の日付境界を扱う',()=>{
    const r=buildContainerSessions([event(1,'start',10),event(2,'stop',11),{...event(3,'start',12),containerKey:'b'},{...event(4,'stop',13),containerKey:'b'}],new Date(at(14)));
    expect(computeMultiContainerDays(r.sessions).days).toHaveLength(1);
    expect(computeMultiContainerDays(r.sessions).overlaps).toHaveLength(0);
    const overlapping=buildContainerSessions([event(1,'start',14),{...event(2,'start',14),containerKey:'b'},event(3,'stop',16),{...event(4,'stop',16),containerKey:'b'}],new Date(at(17)));
    expect(computeMultiContainerDays(overlapping.sessions).days.map(d=>d.date)).toEqual(['2026-10-22','2026-10-23']);
    expect(computeMultiContainerDays(overlapping.sessions).overlaps).toHaveLength(1);
    expect(computeMultiContainerDays(buildContainerSessions([event(1,'start',10)],new Date(at(11))).sessions).unclosedSessions).toBe(1);
  });
  it('作業メモを履歴として残し、競合更新と不正な起点を拒否する',async()=>{
    const sql=new DatabaseSync(':memory:');
    try {
      sql.exec(readFileSync('migrations/0178_create_cf_container_operation_log.sql','utf8'));
      sql.exec(readFileSync('migrations/0186_create_container_session_notes.sql','utf8'));
      sql.exec("INSERT INTO cf_container_operation_log (id,action,performed_by,result,created_at,container_key) VALUES (1,'start','admin','success','2026-10-22T10:00:00Z','a')");
      const db={prepare:(query:string)=>({bind:(...params:any[])=>({run:async()=>({meta:{changes:sql.prepare(query).run(...params).changes}})})})};
      expect(await appendSessionNote(db as any,1,0,'環境復旧','admin')).toBe(true);
      expect(await appendSessionNote(db as any,1,0,'競合','other')).toBe(false);
      expect(await appendSessionNote(db as any,1,1,'環境復旧・実行確認完了','admin')).toBe(true);
      expect(await appendSessionNote(db as any,99,0,'起点なし','admin')).toBe(false);
      expect(sql.prepare('SELECT content,revision FROM cf_container_session_notes ORDER BY revision').all()).toEqual([{content:'環境復旧',revision:1},{content:'環境復旧・実行確認完了',revision:2}]);
    } finally {sql.close();}
  });
});
