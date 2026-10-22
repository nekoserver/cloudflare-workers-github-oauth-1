export interface SessionOperation { id:number; action:string; result:string; createdAt:string;containerKey?:string|null;containerLabel?:string|null;hourlyRateUsd?:number|null }
export interface ContainerWorkSession {
  containerKey:string;containerLabel:string;hourlyRateUsd:number|null;startOperationId:number; startAt:string; endAt:string|null; endReason:'stop'|'restart'|null;
  seconds:number; estimatedCostUsd:number|null; activities:Record<string,number>;
}
export function buildContainerSessions(events:SessionOperation[],now=new Date()) {
  if(!Number.isFinite(now.getTime()))throw new Error('Invalid time');
  let ignoredEvents=0,unmatchedStops=0;
  const valid=events.map(e=>({...e,ts:Date.parse(e.createdAt)})).filter(e=>{
    if(!Number.isFinite(e.ts)||e.ts>now.getTime()){ignoredEvents++;return false;}return true;
  }).sort((a,b)=>a.ts-b.ts||a.id-b.id);
  const sessions:ContainerWorkSession[]=[];
  const open=new Map<string,ContainerWorkSession>();
  let unattributedEvents=0;
  const close=(key:string,at:string,reason:'stop'|'restart')=>{
    const session=open.get(key);if(!session)return;
    session.endAt=at;session.endReason=reason;
    session.seconds=(Date.parse(at)-Date.parse(session.startAt))/1000;
    session.estimatedCostUsd=session.hourlyRateUsd===null?null:session.seconds/3600*session.hourlyRateUsd;open.delete(key);
  };
  for(const e of valid) {
    if(e.result!=='success')continue;
    if(!e.containerKey){unattributedEvents++;continue;}
    const key=e.containerKey;
    if(e.action==='restart')close(key,new Date(e.ts).toISOString(),'restart');
    if(e.action==='start'||e.action==='restart') {
      if(!open.has(key)){
        const rate=typeof e.hourlyRateUsd==='number'&&Number.isFinite(e.hourlyRateUsd)&&e.hourlyRateUsd>=0?e.hourlyRateUsd:null;
        const session:ContainerWorkSession={containerKey:key,containerLabel:e.containerLabel||key,hourlyRateUsd:rate,startOperationId:e.id,startAt:new Date(e.ts).toISOString(),endAt:null,endReason:null,seconds:0,estimatedCostUsd:null,activities:{}};
        open.set(key,session);sessions.push(session);
      }
    } else if(e.action==='stop') {
      if(open.has(key))close(key,new Date(e.ts).toISOString(),'stop');else unmatchedStops++;
    } else {const session=open.get(key);if(session)session.activities[e.action]=(session.activities[e.action]??0)+1;}
  }
  for(const session of open.values()){
    session.seconds=(now.getTime()-Date.parse(session.startAt))/1000;
    session.estimatedCostUsd=session.hourlyRateUsd===null?null:session.seconds/3600*session.hourlyRateUsd;
  }
  sessions.sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)||a.startOperationId-b.startOperationId);
  return {sessions,ignoredEvents,unmatchedStops,unattributedEvents,estimatedAt:now.toISOString()};
}
export async function loadContainerSessions(db:D1Database,containerKey?:string) {
  const {results}=await db.prepare('SELECT id,action,result,created_at AS createdAt,container_key AS containerKey,container_label AS containerLabel,hourly_rate_usd AS hourlyRateUsd FROM cf_container_operation_log ORDER BY created_at,id').all<SessionOperation>();
  const containers=[...new Map((results??[]).filter(e=>e.containerKey).map(e=>[e.containerKey!,{key:e.containerKey!,label:e.containerLabel||e.containerKey!}])).values()];
  const report=buildContainerSessions(containerKey?(results??[]).filter(e=>e.containerKey===containerKey):(results??[]));
  const {results:notes}=await db.prepare(`SELECT n.start_operation_id,n.revision,n.content,n.recorded_by,n.created_at FROM cf_container_session_notes n
    WHERE NOT EXISTS (SELECT 1 FROM cf_container_session_notes newer WHERE newer.start_operation_id=n.start_operation_id AND newer.revision>n.revision)`).all<{start_operation_id:number;revision:number;content:string;recorded_by:string;created_at:string}>();
  const latest=new Map((notes??[]).map(n=>[n.start_operation_id,n]));
  const totals=report.sessions.reduce((all,s)=>({seconds:all.seconds+s.seconds,knownEstimateUsd:all.knownEstimateUsd+(s.estimatedCostUsd??0),unknownCostSessions:all.unknownCostSessions+(s.estimatedCostUsd===null?1:0)}),{seconds:0,knownEstimateUsd:0,unknownCostSessions:0});
  return {...report,totals,containers,multiContainer:computeMultiContainerDays(report.sessions),totalSessions:report.sessions.length,sessions:report.sessions.slice(-100).reverse().map(s=>({...s,note:latest.get(s.startOperationId)??null}))};
}
/** Append-only revisions. A stale editor must reload rather than overwrite another editor's note. */
export async function appendSessionNote(db:D1Database,id:number,expectedRevision:number,content:string,actor:string) {
  if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||typeof content!=='string'||content.length>8000||!actor)throw new Error('Invalid note');
  const result=await db.prepare(`INSERT INTO cf_container_session_notes (start_operation_id,revision,content,recorded_by,created_at)
    SELECT ?,?,?,?,? WHERE COALESCE((SELECT MAX(revision) FROM cf_container_session_notes WHERE start_operation_id=?),0)=?
      AND EXISTS (SELECT 1 FROM cf_container_operation_log WHERE id=? AND action IN ('start','restart') AND result='success' AND container_key IS NOT NULL)`)
    .bind(id,expectedRevision+1,content,actor,new Date().toISOString(),id,expectedRevision,id).run();
  return Number(result.meta?.changes??0)===1;
}

/** Closed intervals only: a missing stop is not evidence of uninterrupted historic runtime. JST days. */
export function computeMultiContainerDays(sessions:ContainerWorkSession[]) {
  const dayMs=86400000,offset=9*3600000;
  const days=new Map<string,Set<string>>();
  const boundaries:{at:number;key:string;delta:number}[]=[];
  let unclosedSessions=0;
  for(const s of sessions){
    if(s.endAt===null){unclosedSessions++;continue;}
    const start=Date.parse(s.startAt),end=Date.parse(s.endAt);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
    boundaries.push({at:start,key:s.containerKey,delta:1},{at:end,key:s.containerKey,delta:-1});
    for(let day=Math.floor((start+offset)/dayMs);day<=Math.floor((end-1+offset)/dayMs);day++){
      const date=new Date(day*dayMs).toISOString().slice(0,10);
      if(!days.has(date))days.set(date,new Set());days.get(date)!.add(s.containerKey);
    }
  }
  boundaries.sort((a,b)=>a.at-b.at);
  const active=new Map<string,number>();
  const overlaps:{startAt:string;endAt:string;containerKeys:string[]}[]=[];
  for(let i=0;i<boundaries.length;){
    const at=boundaries[i].at;
    while(i<boundaries.length&&boundaries[i].at===at){const b=boundaries[i++];active.set(b.key,(active.get(b.key)??0)+b.delta);}
    const keys=[...active.entries()].filter(([,n])=>n>0).map(([key])=>key).sort();
    const next=boundaries[i]?.at;
    if(keys.length>=2&&next!==undefined&&next>at){
      const previous=overlaps[overlaps.length-1];
      if(previous&&previous.endAt===new Date(at).toISOString()&&previous.containerKeys.join('\n')===keys.join('\n'))previous.endAt=new Date(next).toISOString();
      else overlaps.push({startAt:new Date(at).toISOString(),endAt:new Date(next).toISOString(),containerKeys:keys});
    }
  }
  return {timezone:'Asia/Tokyo',unclosedSessions,days:[...days.entries()].filter(([,keys])=>keys.size>=2).sort(([a],[b])=>a.localeCompare(b)).map(([date,keys])=>({date,containerKeys:[...keys].sort()})),overlaps};
}
