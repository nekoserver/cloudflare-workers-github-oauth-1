import {checkMuseWorkerHealth, sendMuseViaWorker} from '../utils/museWorkerAsk';
import {Hono} from 'hono';
import type {Bindings} from '../types';
import {verifyTreeViewWorkerRequest} from './treeViewT3Power';

import {parseMuseMessages} from '../utils/museMessages';
export {parseMuseMessages} from '../utils/museMessages';
type Dependencies={
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
  if(!body)return c.json({error:'invalid_request'},400);
  // dynamicnekoはask_museと同じ形で送る: Authorization: Bearer <dynamicnekoのMUSE_API_KEY>、
  // ボディは{model,messages}だけ。利用者のトークンと経路はヘッダで届く。受け取った鍵をそのままmuse-vmへ渡す。
  // 古い形(ボディにuserToken・transport、Authorization無し)は本体のMUSE_API_KEYを使う。
  const authorization=c.req.header('Authorization');
  let callerKey:string|undefined;
  if(authorization!==undefined){
   const match=/^Bearer (\S+)$/.exec(authorization);
   if(!match)return c.json({error:'invalid_authorization'},400);
   callerKey=match[1];
  }
  const userToken=c.req.header('X-Aichat-User-Token')??body.userToken;
  if(typeof userToken!=='string')return c.json({error:'invalid_request'},400);
  const transport=c.req.header('X-Muse-Transport')??body.transport;
  const apiKey=callerKey??c.env.MUSE_API_KEY;
  const keySource=callerKey?'dynamicneko':'main';
  const auth=await deps.authenticate(c.env,userToken);
  if(!auth.ok)return c.json({error:auth.error},auth.status as 401|403|500|503);
  if(auth.login.toLowerCase()!=='nekoserver')return c.json({error:'Forbidden'},403);
  // MuseタブはWorker内WASMの直通だけ。旧コンテナ指定は拒否し、停止中の本体コンテナも参照しない。
  if(transport!==undefined && transport!=='worker')return c.json({error:'invalid_transport'},400);
  if(body.action!==undefined){
   if(body.action!=='connect')return c.json({error:'invalid_action'},400);
   return c.json({healthy:await checkMuseWorkerHealth({TAILSCALE_WASM:c.env.TAILSCALE_WASM,MUSE_API_KEY:apiKey},apiKey),transport:'worker',keySource});
  }
  const messages=parseMuseMessages(body.messages);
  if(!messages)return c.json({error:'会話は40件・UTF-8で16KiB以内にしてください'},400);
  const result=await sendMuseViaWorker(c.env,messages,{routeId:'treeview-musetab-wasm',apiKey});
  if(!result.ok)return c.json({error:result.error,...(result.diagnosis?{diagnosis:result.diagnosis}:{}),transport:'worker',keySource},result.error==='muse_usage_limit'?429:503);
  return c.json({reply:result.reply,model:result.llmModel,transport:'worker',keySource});
 });
 return app;
}
