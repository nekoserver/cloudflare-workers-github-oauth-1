import {beforeEach, expect, it, vi} from 'vitest';
import {createTreeViewT3PowerRoutes} from './treeViewT3Power';
import {signWorkerRequest} from '../utils/workerRequestSignature';
const path='/api/tree-view/t3-power-external';
const secret='worker-test-secret';
const stub={getState:vi.fn(),setRunning:vi.fn(),fetch:vi.fn()};
const dependencies={getContainer:vi.fn(async()=>stub),authenticate:vi.fn(async()=>({ok:true as const,login:'nekoserver'})),audit:vi.fn(async()=>true)};
const env={DYNAMICNEKO_WORKER_HMAC_SECRET:secret};
beforeEach(()=>{vi.clearAllMocks();stub.getState.mockResolvedValue({status:'stopped',lastChange:1});stub.setRunning.mockResolvedValue({changed:true,state:{status:'running',lastChange:2}});dependencies.authenticate.mockResolvedValue({ok:true,login:'nekoserver'});});
async function request(action='status',options:{headers?:Record<string,string>;body?:string;timestamp?:number}={}){
 const body=options.body??JSON.stringify({action,userToken:'verified-token'});
 const headers=await signWorkerRequest(secret,'dynamicneko','POST',path,body,options.timestamp);
 return createTreeViewT3PowerRoutes(dependencies).request('https://internal'+path,{method:'POST',headers:{...headers,...options.headers},body},env as never);
}
it('reads stopped state without starting/fetching the container',async()=>{
 const result=await request();expect(result.status).toBe(200);expect(await result.json()).toMatchObject({running:false,status:'stopped'});expect(stub.setRunning).not.toHaveBeenCalled();expect(stub.fetch).not.toHaveBeenCalled();expect(result.headers.get('Cache-Control')).toBe('no-store');
});
it('rejects missing/tampered/expired signatures before reaching the container',async()=>{
 const invalid: Array<{headers?:Record<string,string>;timestamp?:number}> = [{headers:{'CF-Worker-Signature':''}},{headers:{'CF-Worker':'other'}},{timestamp:1},{headers:{'CF-Worker-Signature':'sha256='+'0'.repeat(64)}}];
 for(const options of invalid)expect((await request('start',options)).status).toBe(401);
 expect(dependencies.getContainer).not.toHaveBeenCalled();
});
it('rejects invalid actions and non-owner identities',async()=>{
 expect((await request('restart')).status).toBe(400);
 expect((await request('start',{body:JSON.stringify({action:['start'],userToken:'verified-token'})})).status).toBe(400);
 dependencies.authenticate.mockResolvedValueOnce({ok:true,login:'other'});
 expect((await request('start')).status).toBe(403);expect(stub.setRunning).not.toHaveBeenCalled();
});
it('sets explicit desired state and audits the actual action',async()=>{
 let result=await request('start');expect(result.status).toBe(200);expect(stub.setRunning).toHaveBeenCalledWith(true);expect(dependencies.audit).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({action:'start',performedBy:'nekoserver',result:'success'}));
 stub.setRunning.mockResolvedValueOnce({changed:true,state:{status:'stopped',lastChange:3}});
 result=await request('stop');expect(await result.json()).toMatchObject({running:false,status:'stopped'});expect(stub.setRunning).toHaveBeenLastCalledWith(false);
});
it('does not count already-running operations as new starts',async()=>{
 stub.setRunning.mockResolvedValueOnce({changed:false,state:{status:'healthy',lastChange:2}});
 await request('start');expect(dependencies.audit).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({action:'t3:start:no-op'}));
});
it('keeps stopping pending and reports unknown state/operation failure',async()=>{
 stub.setRunning.mockResolvedValueOnce({changed:true,state:{status:'stopping',lastChange:2}});
 let response=await request('stop');expect(response.status).toBe(202);expect(await response.json()).toMatchObject({pending:true,status:'stopping'});
 expect(dependencies.audit).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({action:'t3:stop:pending'}));
 stub.getState.mockRejectedValueOnce(new Error('unreachable'));expect((await request()).status).toBe(503);
 stub.getState.mockResolvedValueOnce({status:'invalid'});expect((await request()).status).toBe(503);
 stub.setRunning.mockRejectedValueOnce(new Error('別の操作が進行中です'));expect((await request('start')).status).toBe(409);
});
it('does not report audit storage failure as successfully recorded',async()=>{
 dependencies.audit.mockResolvedValueOnce(false);expect(await (await request('start')).json()).toMatchObject({auditRecorded:false,running:true});
});

it('does not call an unconfirmed start successful',async()=>{
 stub.setRunning.mockResolvedValueOnce({changed:true,state:{status:'stopped',lastChange:2}});
 expect((await request('start')).status).toBe(502);
 expect(dependencies.audit).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({action:'start',result:'failure'}));
});

// tree-viewはログイン済みでしか動かないので、そのログインでT3にも自動で入る(トークン入力・承認なし)。
it('pairing: 管理者なら、コンテナでT3のペアリングを作り、開くだけでログインできるURLを返す',async()=>{
 stub.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ok:true,pairUrl:'https://t3.nekomaneki.work/pair#token=ABCDEF123456',expiresAt:'2026-10-31T10:05:00.000Z'}),{status:200}));
 const response=await request('pairing');
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({pairUrl:'https://t3.nekomaneki.work/pair#token=ABCDEF123456',expiresAt:'2026-10-31T10:05:00.000Z'});
 const sent=stub.fetch.mock.calls[0][0] as Request;
 expect(new URL(sent.url).pathname).toBe('/t3/pairing');expect(sent.method).toBe('POST');
 expect(stub.setRunning).not.toHaveBeenCalled();
});
it('pairing: 管理者以外・署名なしには作らない',async()=>{
 dependencies.authenticate.mockResolvedValueOnce({ok:true,login:'other'});
 expect((await request('pairing')).status).toBe(403);
 expect((await request('pairing',{headers:{'CF-Worker-Signature':''}})).status).toBe(401);
 expect(stub.fetch).not.toHaveBeenCalled();
});
it('pairing: コンテナが失敗したら、原因と対処をそのまま返す',async()=>{
 stub.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ok:false,errorCode:'cli_failed',detail:'spawn ENOENT',remedy:'T3が起動していません'}),{status:502}));
 const response=await request('pairing');
 expect(response.status).toBe(502);
 expect(await response.json()).toMatchObject({error:'cli_failed',detail:'spawn ENOENT',remedy:'T3が起動していません'});
 stub.fetch.mockRejectedValueOnce(new Error('container down'));
 expect(await (await request('pairing')).json()).toMatchObject({error:'container_unreachable',detail:'container down'});
});
it('session: 管理者なら、コンテナでtree-view用のBearerトークンを発行して返す',async()=>{
 stub.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ok:true,token:'BEARER-TOKEN-1',expires:1800000000}),{status:200}));
 const response=await request('session');
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({token:'BEARER-TOKEN-1',expires:1800000000});
 expect(new URL((stub.fetch.mock.calls[0][0] as Request).url).pathname).toBe('/t3/session');
 dependencies.authenticate.mockResolvedValueOnce({ok:true,login:'other'});
 expect((await request('session')).status).toBe(403);
 stub.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ok:false,errorCode:'cli_failed',detail:'x',remedy:'y'}),{status:502}));
 expect(await (await request('session')).json()).toMatchObject({error:'cli_failed',detail:'x',remedy:'y'});
});
