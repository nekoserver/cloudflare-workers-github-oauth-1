import {expect,it,vi} from 'vitest';
import {createTreeViewConversationStreamRoutes} from './treeViewConversationStream';
import {signWorkerRequest} from '../utils/workerRequestSignature';
const secret='worker-signing-secret';
const prefix='/api/tree-view/conversation-stream-external';
function fixture(login='nekoserver',status='running'){
 const fetch=vi.fn(async(request:Request)=>new Response('stream',{headers:{'Content-Type':'text/event-stream','Set-Cookie':'__Host-conversation-observer=ticket; Path=/lib/; Secure; HttpOnly'}}));
 const authenticate=vi.fn(async()=>({ok:true as const,login}));
 const app=createTreeViewConversationStreamRoutes({getContainer:async()=>({getState:async()=>({status}),fetch}),authenticate});
 async function request(path:string,method='GET',signed=true,headers:Record<string,string>={},body=''){
  const target=new URL('https://internal'+prefix+path);const route=target.pathname+target.search;
  const auth=signed?await signWorkerRequest(secret,'dynamicneko',method,route,body):{};
  return app.request('https://internal'+route,{method,headers:{...auth,'X-Aichat-User-Token':'test-user-token',...headers},...(method==='GET'?{}:{body})},{DYNAMICNEKO_WORKER_HMAC_SECRET:secret} as any);
 }
 return{request,fetch,authenticate};
}
it('requires worker signature and verified administrator before reaching private lib',async()=>{
 const f=fixture();expect((await f.request('/lib/conversation-embed.html','GET',false)).status).toBe(401);expect(f.fetch).not.toHaveBeenCalled();
 const other=fixture('other');expect((await other.request('/lib/conversation-embed.html')).status).toBe(403);expect(other.fetch).not.toHaveBeenCalled();
});
it('streams the allowed path and maps origin without leaking inter-worker credentials',async()=>{
 const f=fixture();const r=await f.request('/lib/api/chat/sse','POST',true,{'Origin':'https://dynamicneko.example','Cookie':'__Host-conversation-observer=ticket','X-Signature':'lib-hmac','X-Timestamp':'123'},'{"type":"observe"}');
 expect(r.status).toBe(200);expect(r.headers.get('Content-Type')).toBe('text/event-stream');expect(r.headers.get('Set-Cookie')).toContain('__Host-conversation-observer');
 const req=f.fetch.mock.calls[0][0];expect(new URL(req.url).pathname).toBe('/lib/api/chat/sse');expect(req.headers.get('Origin')).toBe('https://mygw.nekomaneki.work');expect(req.headers.get('CF-Worker-Signature')).toBeNull();expect(req.headers.get('X-Aichat-User-Token')).toBeNull();expect(await req.text()).toBe('{"type":"observe"}');
});
it('rejects private paths, arbitrary proxies and mutations of static assets',async()=>{
 const f=fixture();for(const p of ['/lib/ops/chat_observer.py','/lib/api/tunnels','/lib/chat/secret.json','/lib/chat/%2e%2e/ops/x.py'])expect((await f.request(p)).status).toBe(404);
 expect((await f.request('/lib/conversation-embed.html','POST',true,{},'x')).status).toBe(405);expect(f.fetch).not.toHaveBeenCalled();
});
it('does not start a stopped container',async()=>{const f=fixture('nekoserver','stopped');expect((await f.request('/lib/conversation-embed.html')).status).toBe(503);expect(f.fetch).not.toHaveBeenCalled();});

it('preserves the WebSocket upgrade and query without buffering its response',async()=>{
 const f=fixture();expect((await f.request('/lib/api/chat/ws?protocol=websocket','GET',true,{'Upgrade':'websocket','Sec-WebSocket-Version':'13'})).status).toBe(200);
 const req=f.fetch.mock.calls[0][0];expect(req.headers.get('Upgrade')).toBe('websocket');expect(new URL(req.url).search).toBe('?protocol=websocket');
});
it('rejects a missing signed user identity',async()=>{const f=fixture();expect((await f.request('/lib/conversation-embed.html','GET',true,{'X-Aichat-User-Token':''})).status).toBe(401);expect(f.authenticate).not.toHaveBeenCalled();expect(f.fetch).not.toHaveBeenCalled();});

it('serves the nested Markdown dependency used by the real lib embed',async()=>{const f=fixture();expect((await f.request('/lib/t/asset-ticket/chat/vendor/markdown-it.mjs')).status).toBe(200);});
