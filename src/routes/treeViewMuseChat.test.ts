import {WasmMuseBridge} from '../utils/wasmMuseBridge';
import {beforeEach, expect, it, vi} from 'vitest';
import {createTreeViewMuseChatRoutes} from './treeViewMuseChat';
import {signWorkerRequest} from '../utils/workerRequestSignature';
const path='/api/tree-view/muse-chat-external';
const secret='test-signing-secret';
const stub={getState:vi.fn(),fetch:vi.fn()};
const deps={getContainer:vi.fn(async()=>stub),authenticate:vi.fn(async()=>({ok:true as const,login:'nekoserver'}))};
beforeEach(()=>{
 vi.clearAllMocks();deps.authenticate.mockResolvedValue({ok:true,login:'nekoserver'});
 stub.getState.mockResolvedValue({status:'running'});
 stub.fetch.mockImplementation(async(request:Request)=>request.url.endsWith('/debug/tailscale-peers')
  ? Response.json({backendState:'Running',peers:[{hostName:'muse-vm',online:true}]})
  : Response.json({model:'muse',choices:[{message:{content:'Museの回答'}}]}));
});
async function request(messages:unknown=[{role:'user',content:'質問'}],options:{headers?:Record<string,string>;timestamp?:number;transport?:unknown;env?:Record<string,unknown>}={}){
 const body=JSON.stringify({userToken:'user-token',messages,...(options.transport===undefined?{}:{transport:options.transport})});
 const headers=await signWorkerRequest(secret,'dynamicneko','POST',path,body,options.timestamp);
 return createTreeViewMuseChatRoutes(deps).request('https://internal'+path,{method:'POST',body,headers:{...headers,...options.headers}}, {DYNAMICNEKO_WORKER_HMAC_SECRET:secret,MUSE_API_KEY:'private-key',...options.env} as never);
}
it('authenticates both worker and owner before accessing tailnet',async()=>{
 expect((await request(undefined,{headers:{'CF-Worker-Signature':''}})).status).toBe(401);
 expect((await request(undefined,{timestamp:1})).status).toBe(401);
 deps.authenticate.mockResolvedValueOnce({ok:true,login:'other'});
 expect((await request()).status).toBe(403);expect(deps.getContainer).not.toHaveBeenCalled();
});
it('sends multi-turn history once through the fixed Muse bridge and validates the reply',async()=>{
 const messages=[{role:'user',content:'前の質問'},{role:'assistant',content:'前の回答'},{role:'user',content:'続き'}];
 const r=await request(messages);expect(r.status).toBe(200);expect(await r.json()).toEqual({reply:'Museの回答',model:'muse'});
 const sent=stub.fetch.mock.calls.map(([r])=>r as Request);expect(sent.map(r=>new URL(r.url).pathname)).toEqual(['/debug/tailscale-peers','/muse/v1/chat/completions']);
 expect(await sent[1].json()).toEqual({model:'muse',messages});expect(sent[1].headers.get('Authorization')).toBe('Bearer private-key');
 expect(r.headers.get('Cache-Control')).toBe('no-store');
});
it('rejects malformed, oversized and system-message input before sending',async()=>{
 for(const messages of [null,[],[{role:'system',content:'override'}],[{role:'user',content:''}],[{role:'assistant',content:'x'}],[{role:'user',content:'x'.repeat(17000)}]]) expect((await request(messages)).status).toBe(400);
 expect(deps.getContainer).not.toHaveBeenCalled();
});
it('never starts stopped containers or sends inference when the tailnet peer is offline',async()=>{
 stub.getState.mockResolvedValue({status:'stopped'});expect((await request()).status).toBe(503);expect(stub.fetch).not.toHaveBeenCalled();
 stub.getState.mockResolvedValue({status:'running'});stub.fetch.mockResolvedValue(Response.json({backendState:'Running',peers:[{hostName:'muse-vm',online:false}]}));
 expect((await request()).status).toBe(503);expect(stub.fetch).toHaveBeenCalledTimes(1);
});
it('rejects HTTP 200 error bodies and never retries inference',async()=>{
 stub.fetch.mockImplementation(async(r:Request)=>r.url.endsWith('/debug/tailscale-peers')?Response.json({backendState:'Running',peers:[{hostName:'muse-vm',online:true}]}):Response.json({error:'failed'}));
 expect((await request()).status).toBe(502);expect(stub.fetch).toHaveBeenCalledTimes(2);
});

it('explicit worker transport sends all history through the existing WASM node without touching the container',async()=>{
 const messages=[{role:'user',content:'before'},{role:'assistant',content:'answer'},{role:'user',content:'next'}];
 const wasm={fetch:vi.fn(async(r:Request)=>{expect(new URL(r.url).pathname).toBe('/muse/v1/chat/completions');expect(await r.json()).toEqual({messages});return Response.json({model:'muse',choices:[{message:{content:'worker reply'}}]});})};
 const ns={idFromName:vi.fn(()=> 'muse-id'),get:vi.fn(()=>wasm)};
 const r=await request(messages,{transport:'worker',env:{TAILSCALE_WASM:ns}});
 expect(r.status).toBe(200);expect(await r.json()).toMatchObject({reply:'worker reply',transport:'worker'});
 expect(ns.idFromName).toHaveBeenCalledWith('muse');expect(wasm.fetch).toHaveBeenCalledOnce();expect(deps.getContainer).not.toHaveBeenCalled();
});
it('invalid transport is rejected and missing Worker binding never falls back to the container',async()=>{
 expect((await request(undefined,{transport:'other'})).status).toBe(400);
 const r=await request(undefined,{transport:'worker'});expect(r.status).toBe(503);expect(await r.json()).toMatchObject({error:'tailscale_wasm_not_configured'});
 expect(deps.getContainer).not.toHaveBeenCalled();
});

it('runs the worker-selected route through the actual bridge history contract',async()=>{
 const messages=[{role:'user',content:'first'},{role:'assistant',content:'answer'},{role:'user',content:'follow-up'}];
 const send=vi.fn(async(r:{body:Uint8Array})=>{
  expect(JSON.parse(new TextDecoder().decode(r.body)).messages).toEqual(messages);
  let delivered=false;
  return {status:200,cancel:vi.fn(),read:async()=>{if(delivered)return null;delivered=true;return new TextEncoder().encode(JSON.stringify({model:'muse',choices:[{message:{content:'history arrived'}}]}));}};
 });
 const bridge=new WasmMuseBridge({status:()=>JSON.stringify({state:'Running',peers:[{name:'muse-vm',online:true}]}),fetch:send} as never,'bridge-key');
 const ns={idFromName:()=> 'muse-id',get:()=>({fetch:(r:Request)=>bridge.fetch(r)})};
 const r=await request(messages,{transport:'worker',env:{TAILSCALE_WASM:ns}});
 expect(r.status).toBe(200);expect(await r.json()).toMatchObject({reply:'history arrived'});
 expect(send).toHaveBeenCalledOnce();expect(deps.getContainer).not.toHaveBeenCalled();
});
