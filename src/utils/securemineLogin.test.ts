import {afterEach, describe, expect, it, vi} from 'vitest';
import {Hono} from 'hono';
import type {Bindings,Variables} from '../types';
import {securemineLogin,securemineSession} from './securemineLogin';
import {decryptCredential,encryptCredential,SECUREMINE_TTL} from './securemineSessionStore';
import {verifyJWT} from './jwt';
import {proxyRedmine} from './redmineProxy';

function fixture(fail=false, row:any=null) {
  const writes:{sql:string;values:any[]}[]=[];
  const db={prepare(sql:string){return {bind(...values:any[]){return {sql,values,first:async()=>row};}};},batch:vi.fn(async(statements:any[])=>{if(fail)throw Error('DB unavailable');writes.push(...statements);return [];})};
  const env={DB:db,JWT_SECRET:'test-secret',REDMINE_HMAC_SECRET:'hmac-secret',REDMINE_HMAC_TARGETS:JSON.stringify({'https://redmine.example':'https://gateway.example/redmine-hmac'})} as unknown as Bindings;
  const app=new Hono<{Bindings:Bindings;Variables:Variables}>();
  app.use('*',async(c,next)=>{c.set('user',{sub:'owner',name:'Owner',iat:1,exp:9999999999});await next();});
  app.post('/api/securemine/login',securemineLogin);app.get('/api/securemine/session',securemineSession);app.get('/api/securemine/redmine',proxyRedmine);
  const login=(origin='https://app.example')=>app.request('https://app.example/api/securemine/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({base:'https://redmine.example',name:'Work',apiKey:'private-redmine-key'})},env);
  return {app,env,db,writes,login};
}
afterEach(()=>vi.unstubAllGlobals());
describe('SecureMine persistent login',()=>{
  it('verifies Redmine, atomically records login and renews secure cookies for seven days',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({user:{id:4,login:'alice',api_key:'must-not-return'}}))));
    const f=fixture();const response=await f.login();expect(response.status).toBe(200);
    const json=await response.json() as any;expect(json.user).toEqual({id:4,login:'alice'});expect(Date.parse(json.expiresAt)-Date.parse(json.loggedInAt)).toBeGreaterThanOrEqual(SECUREMINE_TTL*1000);
    expect(f.db.batch).toHaveBeenCalledTimes(1);expect(f.writes).toHaveLength(4);
    const session=f.writes[1];expect(session.values.join()).not.toContain('private-redmine-key');
    expect(await decryptCredential('test-secret',session.values[4],'owner','https://redmine.example')).toBe('private-redmine-key');
    const cookie=response.headers.get('Set-Cookie')!;expect(cookie).toContain('Max-Age=604800');expect(cookie).toContain('Path=/api/securemine; HttpOnly; Secure; SameSite=Lax');
    const jwt=cookie.match(/auth_token=([^;]+)/)![1];const payload=await verifyJWT(jwt,'test-secret');expect(payload!.exp-payload!.iat).toBe(604800);
    expect(cookie).not.toContain('private-redmine-key');
  });
  it('does not issue success cookies when DB saving fails',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({user:{id:4,login:'alice'}}))));
    const response=await fixture(true).login();expect(response.status).toBe(502);expect(response.headers.has('Set-Cookie')).toBe(false);expect(await response.text()).toContain('Redmine HTTP 502: ログイン情報を保存できません。');
  });
  it('rejects cross-origin login and invalid Redmine credentials without DB writes',async()=>{
    const remote=vi.fn(async()=>new Response('{}',{status:401}));vi.stubGlobal('fetch',remote);
    const f=fixture();expect((await f.login('https://evil.example')).status).toBe(403);expect(remote).not.toHaveBeenCalled();
    expect((await f.login()).status).toBe(401);expect(f.db.batch).not.toHaveBeenCalled();
  });
  it('uses the saved key only for its exact Redmine URL and queries owner and expiry',async()=>{
    const encrypted=await encryptCredential('test-secret','saved-key','owner','https://redmine.example');
    const f=fixture(false,{user_id:'owner',base_url:'https://redmine.example',api_key_encrypted:encrypted});
    const prepare=vi.spyOn(f.env.DB!,'prepare');
    const remote=vi.fn(async()=>new Response('{"projects":[]}'));vi.stubGlobal('fetch',remote);
    const url='https://app.example/api/securemine/redmine?'+new URLSearchParams({base:'https://redmine.example',path:'projects.json'});
    expect((await f.app.request(url,{headers:{Cookie:'securemine_session=opaque'}},f.env)).status).toBe(200);
    expect((remote.mock.calls[0] as unknown as [URL,RequestInit])[1].headers).toMatchObject({'X-Redmine-API-Key':'saved-key'});
    expect(prepare.mock.calls[0][0]).toContain('user_id = ? AND expires_at > ?');
    const missing=fixture();expect((await missing.app.request(url,{headers:{Cookie:'securemine_session=expired'}},missing.env)).status).toBe(400);
  });
  it('cryptographically binds encrypted credentials to owner and Redmine URL',async()=>{
    const encrypted=await encryptCredential('secret','key','owner','https://redmine.example');
    await expect(decryptCredential('secret',encrypted,'another','https://redmine.example')).rejects.toThrow();
    await expect(decryptCredential('secret',encrypted,'owner','https://another.example')).rejects.toThrow();
  });
  it('restores only display metadata and never returns encrypted credentials',async()=>{
    const f=fixture(false,{token_hash:'hash',account_name:'Work',base_url:'https://redmine.example',redmine_user_json:'{"id":4}',api_key_encrypted:'private',logged_in_at:'now',expires_at:'later'});
    const response=await f.app.request('https://app.example/api/securemine/session',{headers:{Cookie:'securemine_session=opaque'}},f.env);
    const text=await response.text();expect(text).toContain('Work');expect(text).not.toContain('private');expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
