import {askMuseWorkerMessages, checkMuseWorkerHealth} from '../utils/museWorkerAsk';
import {Hono} from 'hono';
import type {Bindings} from '../types';
import {verifyTreeViewWorkerRequest} from './treeViewT3Power';
import {parseCompletion, checkMuseHealth, MUSE_DIRECT_PATH, type MuseContainer} from '../utils/museDirectAsk';
import {requireMuseTailscale} from '../utils/museTailscalePreflight';
import {DEFAULT_ASKGK_TIMEOUT_SECONDS, readAskgkTimeoutSetting} from '../utils/askgkTimeoutSettings';

import {parseMuseMessages} from '../utils/museMessages';
export {parseMuseMessages} from '../utils/museMessages';
type Dependencies={
 getContainer(env:Bindings):Promise<MuseContainer|null>;
 authenticate(env:Bindings,token:string):Promise<{ok:true;login:string}|{ok:false;error:string;status:number}>;
};
export function createTreeViewMuseChatRoutes(deps:Dependencies){
 const app=new Hono<{Bindings:Bindings}>();
 app.post('/api/tree-view/muse-chat-external',async c=>{
  c.header('Cache-Control','no-store');
  const raw=await c.req.text();
  if(raw.length>100000||!await verifyTreeViewWorkerRequest(c.req.raw,raw,c.env.DYNAMICNEKO_WORKER_HMAC_SECRET))return c.json({error:'Unauthorized'},401);
  let body:{userToken?:unknown;messages?:unknown;transport?:unknown;action?:unknown}|null;
  try{body=JSON.parse(raw);}catch{return c.json({error:'invalid_request'},400);}
  if(!body||typeof body.userToken!=='string')return c.json({error:'invalid_request'},400);
  const auth=await deps.authenticate(c.env,body.userToken);
  if(!auth.ok)return c.json({error:auth.error},auth.status as 401|403|500|503);
  if(auth.login.toLowerCase()!=='nekoserver')return c.json({error:'Forbidden'},403);
  if(body.transport!==undefined && body.transport!=='worker' && body.transport!=='container')return c.json({error:'invalid_transport'},400);
  if(body.action==='connect'){
   const transport=body.transport??'container';
   if(transport==='worker')return c.json({healthy:await checkMuseWorkerHealth(c.env),transport});
   let healthy=false;
   try{const container=await deps.getContainer(c.env);if(container){await requireMuseTailscale(async()=>container);healthy=await checkMuseHealth(container,c.env.MUSE_API_KEY);}}catch{}
   return c.json({healthy,transport});
  }
  if(body.action!==undefined)return c.json({error:'invalid_action'},400);
  const messages=parseMuseMessages(body.messages);
  if(!messages)return c.json({error:'会話は40件・UTF-8で16KiB以内にしてください'},400);
  if(body.transport==='worker'){
   const result=await askMuseWorkerMessages(c.env,messages,undefined,90);
   if(!result.ok)return c.json({error:result.error,transport:'worker'},result.error==='muse_usage_limit'?429:503);
   return c.json({reply:result.reply,model:result.llmModel,transport:'worker'});
  }
  if(!c.env.MUSE_API_KEY)return c.json({error:'muse_not_authenticated'},503);
  try{
   const container=await deps.getContainer(c.env);
   if(!container)return c.json({error:'container_not_running'},503);
   try{await requireMuseTailscale(async()=>container);}catch{return c.json({error:'Tailscaleのmuse-vmへの接続を確認してください'},503);}
   // No automatic start, fallback or resubmission. Fixed tailnet destination in server.js.
   const timeoutSeconds=c.env.DB? (await readAskgkTimeoutSetting(c.env.DB)).timeoutSeconds : DEFAULT_ASKGK_TIMEOUT_SECONDS;
   const signal=AbortSignal.timeout(timeoutSeconds*1000);
   const response=await container.fetch(new Request('http://container'+MUSE_DIRECT_PATH,{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.env.MUSE_API_KEY},
    body:JSON.stringify({model:'muse',messages}),signal,
   }));
   if(!response.ok)return c.json({error:'muse_request_failed',upstreamStatus:response.status},response.status===429?429:502);
   const result=parseCompletion(await response.text());
   if(!result.ok)return c.json({error:result.error},502);
   return c.json({reply:result.reply,model:result.llmModel});
  }catch(error){
   if(error instanceof Error && error.name==='TimeoutError')return c.json({error:'llm_timeout'},504);
   return c.json({error:'muse_connection_failed'},502);
  }
 });
 return app;
}
