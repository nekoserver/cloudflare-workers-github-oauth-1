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
 const r=await request(messages);expect(r.status).toBe(200);expect(await r.json()).toEqual({reply:'Museの回答',model:'muse',keySource:'main'});
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
 const wasm={fetch:vi.fn(async(r:Request)=>{expect(new URL(r.url).pathname).toBe('/muse/v1/chat/completions');expect(await r.json()).toEqual({model:'muse',messages});return Response.json({model:'muse',choices:[{message:{content:'worker reply'}}]});})};
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

// dynamicneko は自分の MUSE_API_KEY を使い、ask_muse と同じ形で送る(ユーザー指定 2026-11-11):
// Authorization: Bearer <鍵>・Content-Type: application/json・ボディ {"model":"muse","messages":[...]}。
// 利用者のトークンと経路はヘッダ(X-Aichat-User-Token・X-Muse-Transport)で届く。本体は受け取った鍵をそのまま muse-vm へ渡す。
async function dynamicnekoRequest(messages:unknown,options:{transport?:string;env?:Record<string,unknown>;authorization?:string}={}){
 const body=JSON.stringify({model:'muse',messages});
 const signed=await signWorkerRequest(secret,'dynamicneko','POST',path,body);
 const headers:Record<string,string>={...signed,'Content-Type':'application/json',Authorization:options.authorization??'Bearer dynamicneko-key','X-Aichat-User-Token':'header-user-token',...(options.transport?{'X-Muse-Transport':options.transport}:{})};
 return createTreeViewMuseChatRoutes(deps).request('https://internal'+path,{method:'POST',body,headers},{DYNAMICNEKO_WORKER_HMAC_SECRET:secret,MUSE_API_KEY:'private-key',...options.env} as never);
}
it('dynamicneko format: container route forwards the dynamicneko key and {model,messages} unchanged',async()=>{
 const messages=[{role:'user',content:'質問'}];
 const r=await dynamicnekoRequest(messages);
 expect(r.status).toBe(200);expect(await r.json()).toMatchObject({reply:'Museの回答',keySource:'dynamicneko'});
 expect(deps.authenticate).toHaveBeenCalledWith(expect.anything(),'header-user-token');
 const sent=stub.fetch.mock.calls.map(([x])=>x as Request)[1];
 expect(sent.headers.get('Authorization')).toBe('Bearer dynamicneko-key');
 expect(sent.headers.get('Content-Type')).toBe('application/json');
 expect(await sent.text()).toBe(JSON.stringify({model:'muse',messages}));
});
it('dynamicneko format: worker route sends the dynamicneko key to muse-vm through the bridge',async()=>{
 const messages=[{role:'user',content:'first'}];
 const send=vi.fn(async(r:{headers:string[][];body:Uint8Array})=>{
  let delivered=false;
  return {status:200,cancel:vi.fn(),read:async()=>{if(delivered)return null;delivered=true;return new TextEncoder().encode(JSON.stringify({model:'muse',choices:[{message:{content:'ok'}}]}));}};
 });
 const bridge=new WasmMuseBridge({status:()=>JSON.stringify({state:'Running',peers:[{name:'muse-vm',online:true}]}),fetch:send} as never,'bridge-key');
 const ns={idFromName:()=> 'muse-id',get:()=>({fetch:(x:Request)=>bridge.fetch(x)})};
 const r=await dynamicnekoRequest(messages,{transport:'worker',env:{TAILSCALE_WASM:ns}});
 expect(r.status).toBe(200);expect(await r.json()).toMatchObject({reply:'ok',transport:'worker',keySource:'dynamicneko'});
 const req=send.mock.calls[0][0];
 expect(req.headers).toEqual([['Authorization','Bearer dynamicneko-key'],['Content-Type','application/json']]);
 expect(new TextDecoder().decode(req.body)).toBe(JSON.stringify({model:'muse',messages}));
 expect(deps.getContainer).not.toHaveBeenCalled();
});
it('dynamicneko format: a malformed Authorization is rejected before any send (no silent switch to the main key)',async()=>{
 for(const authorization of ['Bearer','Basic abc','Bearer a b']){
  const r=await dynamicnekoRequest([{role:'user',content:'x'}],{authorization});
  expect(r.status).toBe(400);
 }
 expect(deps.getContainer).not.toHaveBeenCalled();
});
it('old format (no Authorization) keeps using the main MUSE_API_KEY and says so',async()=>{
 const r=await request();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({keySource:'main'});
});

// tree-view の送信チェック(ユーザー指定 2026-11-12): Museタブを開いたとき・ウィンドウで開くたびに送る。
// 推論は走らせず、muse-vm の /health だけを見る。鍵は送信と同じ(dynamicneko の鍵があればそれ)。
async function connectRequest(options:{transport?:string;env?:Record<string,unknown>;authorization?:string}={}){
 const body=JSON.stringify({action:'connect'});
 const signed=await signWorkerRequest(secret,'dynamicneko','POST',path,body);
 const headers:Record<string,string>={...signed,'Content-Type':'application/json',Authorization:options.authorization??'Bearer dynamicneko-key','X-Aichat-User-Token':'header-user-token',...(options.transport?{'X-Muse-Transport':options.transport}:{})};
 return createTreeViewMuseChatRoutes(deps).request('https://internal'+path,{method:'POST',body,headers},{DYNAMICNEKO_WORKER_HMAC_SECRET:secret,MUSE_API_KEY:'private-key',...options.env} as never);
}
it('connect check (container): healthy when tailnet shows muse-vm and /muse/health is ok, without inference', async()=>{
 stub.fetch.mockImplementation(async(r:Request)=>new URL(r.url).pathname.endsWith('/debug/tailscale-peers')
  ? Response.json({backendState:'Running',peers:[{hostName:'muse-vm',online:true}]})
  : Response.json({status:'ok'}));
 const r=await connectRequest();
 expect(r.status).toBe(200);expect(await r.json()).toEqual({healthy:true,transport:'container',keySource:'dynamicneko'});
 const sent=stub.fetch.mock.calls.map(([x])=>x as Request);
 expect(sent.map(x=>new URL(x.url).pathname)).toEqual(['/debug/tailscale-peers','/muse/health']);
 expect(sent[1].headers.get('Authorization')).toBe('Bearer dynamicneko-key');
});
it('connect check (container): unhealthy when the container is stopped, never starting it', async()=>{
 stub.getState.mockResolvedValue({status:'stopped'});
 const r=await connectRequest();
 expect(r.status).toBe(200);expect(await r.json()).toMatchObject({healthy:false,transport:'container'});
 expect(stub.fetch).not.toHaveBeenCalled();
});
it('connect check (worker): checks /muse/health through the WASM bridge with the dynamicneko key', async()=>{
 const wasm={fetch:vi.fn(async(r:Request)=>{expect(new URL(r.url).pathname).toBe('/muse/health');expect(r.headers.get('Authorization')).toBe('Bearer dynamicneko-key');return Response.json({status:'ok'});})};
 const ns={idFromName:()=> 'muse-id',get:()=>wasm};
 const r=await connectRequest({transport:'worker',env:{TAILSCALE_WASM:ns}});
 expect(await r.json()).toEqual({healthy:true,transport:'worker',keySource:'dynamicneko'});
 expect(wasm.fetch).toHaveBeenCalledOnce();expect(deps.getContainer).not.toHaveBeenCalled();
});
it('connect check still requires the worker signature and the owner', async()=>{
 deps.authenticate.mockResolvedValueOnce({ok:true,login:'other'});
 expect((await connectRequest()).status).toBe(403);
 expect(deps.getContainer).not.toHaveBeenCalled();
});
