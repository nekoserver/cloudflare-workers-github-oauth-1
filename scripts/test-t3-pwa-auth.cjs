'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { createPwaAuth, injectBootstrap, SCOPES } = require('../containers/demo/t3-pwa-auth.cjs');
const origin = 'https://t3.nekomaneki.work';
async function fixture(options={}) {
 let time=Math.floor(Date.now()/1000), count=0;
 const tokens=new Map(), revoked=[];
 const owner={authenticated:true,sessionMethod:'browser-session-cookie',auth:{sessionCookieName:'t3_session_test'},scopes:SCOPES};
 const app=createPwaAuth({dbPath:':memory:',key:crypto.randomBytes(32),now:()=>time,generation:()=>'test-generation',readConfig:()=>({enabled:true,developmentOnly:true,generation:'test-config'}),
  verifySession:async headers=>headers.cookie?.includes('t3_session_test=owner')?owner:tokens.has(headers.authorization?.slice(7))?{authenticated:true,sessionMethod:'bearer-access-token'}:{authenticated:false},
  issueSession:async(id,scopes)=>{count++;await new Promise(r=>setTimeout(r,5));const value={sessionId:'session-'+count,token:'native-bearer-'+count,method:'bearer-access-token',scopes,expiresAt:new Date((time+86400)*1000).toISOString(),client:{label:'tree-view-pwa:'+id}};tokens.set(value.token,value);return value;},
  revokeSession:async id=>{revoked.push(id);for(const [key,value] of tokens)if(value.sessionId===id)tokens.delete(key);},
  listSessions:async()=>Array.from(tokens.values()),...options});
 const server=http.createServer(async(req,res)=>{if(!(await app.handle(req,res))){res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const request=(path,method='POST',data={},headers={})=>fetch(base+'/_t3/pwa'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(data)}:{})});
 async function create(){const secret=crypto.randomBytes(32).toString('hex');const r=await request('/create','POST',{secret});assert.equal(r.status,201);return {...await r.json(),secret};}
 async function approve(row){const response=await request('/approval/'+row.id,'GET',null,{Cookie:'t3_session_test=owner; cf=old'});assert.equal(response.status,200);const info=await response.json();const result=await request('/approval/'+row.id,'POST',{decision:'approve'},{Cookie:'t3_session_test=owner; cf=new','X-CSRF-Token':info.csrf});assert.equal(result.status,200);return info;}
 return {app,request,create,approve,tokens,revoked,count:()=>count,advance:n=>{time+=n;},close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));app.close();}};
}
async function run(t,options){const f=await fixture(options);t.after(()=>f.close());return f;}
test('create→native owner approval→one-time native bearer claim→verified, with no Cookie issuance',async t=>{
 const f=await run(t),row=await f.create();await f.approve(row);
 const claimed=await f.request('/claim','POST',row);assert.equal(claimed.status,200);assert.equal(claimed.headers.get('set-cookie'),null);
 const grant=await claimed.json();assert.equal(grant.expires>0,true);assert.equal(f.count(),1);
 const before=f.app.db.prepare('SELECT first_verified FROM sessions').get();assert.equal(before.first_verified,null);
 const verified=await f.request('/verified','POST',{}, {Authorization:'Bearer '+grant.token});assert.equal(verified.status,200);assert.deepEqual(await verified.json(),{verified:true});
 assert.ok(f.app.db.prepare('SELECT first_verified FROM sessions').get().first_verified);
 assert.equal((await f.request('/claim','POST',row)).status,409);
 assert.equal(f.app.db.prepare('SELECT count(*) n FROM sessions').get().n,1);
 const serialized=JSON.stringify(f.app.db.prepare('SELECT * FROM handoffs').all())+JSON.stringify(f.app.db.prepare('SELECT * FROM sessions').all())+JSON.stringify(f.app.db.prepare('SELECT * FROM events').all());
 assert.ok(!serialized.includes(grant.token));assert.ok(!serialized.includes(row.secret));
});
test('wrong/missing Origin and altered device secret are rejected',async t=>{
 const f=await run(t),row=await f.create();
 assert.equal((await f.request('/create','POST',{secret:row.secret},{Origin:'https://evil.invalid'})).status,403);
 assert.equal((await f.request('/status','POST',{...row,secret:'f'.repeat(64)})).status,404);
 assert.equal((await f.request('/claim','POST',row)).status,409);assert.equal(f.count(),0);
});
test('approval requires native browser login, CSRF and an explicit POST',async t=>{
 const f=await run(t),row=await f.create();assert.equal((await f.request('/approval/'+row.id,'GET')).status,401);
 const get=await f.request('/approval/'+row.id,'GET',null,{Cookie:'t3_session_test=owner'});assert.equal(get.status,200);
 assert.equal(f.app.db.prepare('SELECT state FROM handoffs').get().state,'pending');
 assert.equal((await f.request('/approval/'+row.id,'POST',{decision:'approve'},{Cookie:'t3_session_test=owner','X-CSRF-Token':'bad'})).status,403);assert.equal(f.count(),0);
});
test('two simultaneous claims issue exactly one native session',async t=>{
 const f=await run(t),row=await f.create();await f.approve(row);
 const responses=await Promise.all([f.request('/claim','POST',row),f.request('/claim','POST',row)]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(f.count(),1);
});
test('expired approval cannot issue a native session',async t=>{
 const f=await run(t),row=await f.create();await f.approve(row);f.advance(301);
 assert.equal((await f.request('/claim','POST',row)).status,409);assert.equal(f.count(),0);assert.equal(f.app.db.prepare('SELECT state FROM handoffs').get().state,'expired');
});
test('audit failure rolls back completion and revokes the issued native session',async t=>{
 const f=await run(t),row=await f.create();await f.approve(row);
 f.app.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON events WHEN NEW.event='consumed' BEGIN SELECT RAISE(ABORT,'simulated audit failure'); END;");
 assert.equal((await f.request('/claim','POST',row)).status,503);assert.equal(f.app.db.prepare('SELECT count(*) n FROM sessions').get().n,0);assert.deepEqual(f.revoked,['session-1']);assert.equal(f.app.db.prepare('SELECT state FROM handoffs').get().state,'failed');
});
test('native scope escalation is rejected and revoked',async t=>{
 const f=await run(t,{issueSession:async()=>({sessionId:'escalated',token:'bad',method:'bearer-access-token',scopes:[...SCOPES,'access:write'],expiresAt:new Date(Date.now()+86400000).toISOString()})});
 const row=await f.create();await f.approve(row);assert.equal((await f.request('/claim','POST',row)).status,503);assert.deepEqual(f.revoked,['escalated']);
});
test('native verification failure cannot mark the PWA as verified',async t=>{
 const f=await run(t),row=await f.create();await f.approve(row);const grant=await(await f.request('/claim','POST',row)).json();f.tokens.clear();
 assert.equal((await f.request('/verified','POST',{}, {Authorization:'Bearer '+grant.token})).status,401);assert.equal(f.app.db.prepare('SELECT first_verified FROM sessions').get().first_verified,null);
});
test('recovery revokes an issued session never verified by the PWA',async t=>{
 const f=await run(t),row=await f.create();await f.approve(row);assert.equal((await f.request('/claim','POST',row)).status,200);f.advance(301);await f.app.recover();assert.deepEqual(f.revoked,['session-1']);assert.ok(f.app.db.prepare('SELECT revoked FROM sessions').get().revoked);
});
test('unknown CLI completion stays redeeming and recovery fails it without reissuing',async t=>{
 const f=await run(t,{issueSession:async()=>{throw new Error('lost CLI stdout');}});const row=await f.create();await f.approve(row);assert.equal((await f.request('/claim','POST',row)).status,503);
 assert.equal(f.app.db.prepare('SELECT state FROM handoffs').get().state,'redeeming');f.advance(61);await f.app.recover();assert.equal(f.app.db.prepare('SELECT state FROM handoffs').get().state,'failed');
});
test('bootstrap only replaces the native module entry, never external script origins',()=>{
 const html='<script type="module" crossorigin src="/assets/index-ABcd_12.js"></script><script type="module" src="https://example.com/other.js"></script>';
 const result=injectBootstrap(html);assert.match(result,/\/_t3\/pwa\/bootstrap\/index-ABcd_12.js/);assert.match(result,/https:\/\/example.com\/other.js/);assert.ok(!result.includes('src="/assets/index-ABcd_12.js"'));
});

test('environment replacement invalidates a previously approved request',async t=>{
 let generation='first';const f=await run(t,{generation:()=>generation});const row=await f.create();await f.approve(row);generation='replacement';
 assert.equal((await f.request('/claim','POST',row)).status,409);assert.equal(f.count(),0);assert.equal(f.app.db.prepare('SELECT state FROM handoffs').get().state,'expired');
});

test('OFF prevents issuance and invalidates already approved requests',async t=>{
 const config={enabled:true,developmentOnly:true,generation:'first'};const f=await run(t,{readConfig:()=>config});const row=await f.create();await f.approve(row);config.enabled=false;
 assert.equal((await f.request('/claim','POST',row)).status,503);assert.equal(f.count(),0);assert.equal(f.app.db.prepare('SELECT state FROM handoffs').get().state,'expired');
 config.enabled=true;config.generation='replacement';assert.equal((await f.request('/claim','POST',row)).status,409);assert.equal(f.count(),0);
});

test('read-only browser sessions cannot delegate new PWA credentials',async t=>{
 const f=await run(t,{verifySession:async()=>({authenticated:true,sessionMethod:'browser-session-cookie',auth:{sessionCookieName:'t3_session_test'},scopes:['orchestration:read','diagnostics:read']})});
 const row=await f.create();assert.equal((await f.request('/approval/'+row.id,'GET',null,{Cookie:'t3_session_test=owner'})).status,401);assert.equal(f.count(),0);
});
test('missing explicit development-only opt-in prevents a new request',async t=>{
 const f=await run(t,{readConfig:()=>({enabled:true,generation:'missing-development-opt-in'})});
 assert.equal((await f.request('/create','POST',{secret:'a'.repeat(64)})).status,503);assert.equal(f.count(),0);
});

test('bootstrap is served from a path without depending on query forwarding',async t=>{
 const f=await run(t);const response=await f.request('/bootstrap/index-ABcd_12.js','GET');assert.equal(response.status,200);assert.match(await response.text(),/start\("\/assets\/index-ABcd_12.js"\)/);
});
