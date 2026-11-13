import {Hono} from 'hono';
import type {Bindings} from '../types';
import {verifyTreeViewWorkerRequest} from './treeViewT3Power';
const PREFIX='/api/tree-view/conversation-stream-external';
const cookies=new Set(['__Host-conversation-observer','__Host-conversation-console']);
function allowed(path:string){return path==='/lib/conversation-embed.html'||/^\/lib\/(?:t\/[A-Za-z0-9_-]+\/)?chat\/(?:vendor\/)?[A-Za-z0-9_.-]+\.(?:mjs|js|css)$/.test(path)||/^\/lib\/t\/[A-Za-z0-9_-]+\/conversation-embed\.html$/.test(path)||/^\/lib\/api\/chat\/(?:ws|sse|ndjson|jsonseq|session|console-session|console|spec-eval)$/.test(path);}
type Dependencies={
 getContainer(env:Bindings):Promise<{getState():Promise<{status:string}>;fetch(request:Request):Promise<Response>}|null>;
 authenticate(env:Bindings,token:string):Promise<{ok:true;login:string}|{ok:false;error:string;status:number}>;
};
/** Owner session + worker signature + signed user identity; public Apache stays closed. */
export function createTreeViewConversationStreamRoutes(deps:Dependencies){
 const app=new Hono<{Bindings:Bindings}>();
 app.all(PREFIX+'/*',async c=>{
  c.header('Cache-Control','private, no-store');
  const raw=['GET','HEAD'].includes(c.req.method)?'':await c.req.text();
  if(raw.length>100000)return c.json({error:'request_too_large'},413);
  if(!await verifyTreeViewWorkerRequest(c.req.raw,raw,c.env.DYNAMICNEKO_WORKER_HMAC_SECRET))return c.json({error:'Unauthorized'},401);
  const token=c.req.header('X-Aichat-User-Token');if(!token)return c.json({error:'Unauthorized'},401);
  const auth=await deps.authenticate(c.env,token);
  if(!auth.ok)return c.json({error:auth.error},auth.status as 401|403|503);
  if(auth.login.toLowerCase()!=='nekoserver')return c.json({error:'Forbidden'},403);
  const url=new URL(c.req.url),path=url.pathname.slice(PREFIX.length);
  if(!allowed(path))return c.json({error:'Not found'},404);
  const api=path.startsWith('/lib/api/chat/');
  if(!(['GET','HEAD'].includes(c.req.method)||api&&['POST','DELETE'].includes(c.req.method)))return c.json({error:'method_not_allowed'},405);
  const stub=await deps.getContainer(c.env);if(!stub)return c.json({error:'container_unconfigured'},503);
  try{
   const state=await stub.getState();if(!['running','healthy'].includes(state.status))return c.json({error:'container_not_running'},503);
   const headers=new Headers();
   for(const name of ['Accept','Content-Type','Authorization','X-Timestamp','X-Signature','Upgrade','Sec-WebSocket-Key','Sec-WebSocket-Version','Sec-WebSocket-Protocol']){const value=c.req.header(name);if(value)headers.set(name,value);}
   headers.set('Cookie',(c.req.header('Cookie')??'').split(';').map(x=>x.trim()).filter(x=>cookies.has(x.split('=',1)[0])).join('; '));
   // lib signs canonical /lib paths, and its origin allowlist remains independent.
   headers.set('Origin','https://mygw.nekomaneki.work');
   return await stub.fetch(new Request('https://mygw.nekomaneki.work'+path+url.search,{method:c.req.method,headers,...(raw?{body:raw}:{})}));
  }catch{return c.json({error:'conversation_stream_unreachable'},502);}
 });
 return app;
}
