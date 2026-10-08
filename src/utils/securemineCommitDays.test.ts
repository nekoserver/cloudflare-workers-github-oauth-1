import { describe, expect, it, vi } from 'vitest';
import { mergeCommitDays, readWorkspaceCommitDays } from './securemineCommitDays';

describe('Workspace commit calendar aggregation',()=>{
  it('combines daily logs and monthly logs without duplicate highlights or other months',()=>{
    expect(mergeCommitDays(2026,10,['2026-10-08','2026-09-30'],[JSON.stringify({'2026-10-08':3,'2026-10-21':1,'2026-10-22':0,'2026-10-32':1,'2026-11-01':2})])).toEqual([8,21]);
  });
  it('rejects invalid summaries instead of falsely reporting an empty calendar',()=>{
    expect(()=>mergeCommitDays(2026,10,[],['broken'])).toThrow();
    expect(()=>mergeCommitDays(2026,10,[],['[]'])).toThrow();
  });
  it('scopes both sources to the signed-in workspace and the current JST month',async()=>{
    const bindings:unknown[][]=[];
    const db={prepare:vi.fn((sql:string)=>({bind:(...args:unknown[])=>{bindings.push(args);return {all:async()=>({results:sql.includes('commit_list_cache')?[{date:'2027-01-01'}]:[{counts:JSON.stringify({'2027-01-02':1})}]})};}}))};
    const result=await readWorkspaceCommitDays(db as unknown as D1Database,'workspace-a',new Date('2026-12-31T15:00:00Z'));
    expect(bindings).toEqual([['workspace-a','2027-01-%'],['workspace-a',2027,1]]);
    expect(result).toEqual({year:2027,month:1,days:[1,2]});
  });
});
