import {expect,it} from 'vitest';
import {createTreeViewMuseChatRoutes} from './treeViewMuseChat';
import {signWorkerRequest} from '../utils/workerRequestSignature';
import {writeFileSync} from 'node:fs';
it.skipIf(process.env.RUN_TREE_VIEW_MUSE_LIVE !== '1')('local signed route reaches real tailnet muse-vm and returns an exact response',async()=>{
 const path='/api/tree-view/muse-chat-external', secret='local-live-signing';
 const upstreamPaths:string[]=[];
 const container={getState:async()=>({status:'running'}),fetch:async(request:Request)=>{
  const url=new URL(request.url);upstreamPaths.push(url.pathname);
  return fetch(new Request('http://127.0.0.1:8080'+url.pathname,request));
 }};
 const app=createTreeViewMuseChatRoutes({getContainer:async()=>container,authenticate:async()=>({ok:true,login:'nekoserver'})});
 const marker='TREE_VIEW_MUSE_OK_20261109';
 const messages=[{role:'user',content:'Remember this exact token: '+marker},{role:'assistant',content:'I will remember it.'},{role:'user',content:'Reply with only the token from the first message. No tools.'}];
 const body=JSON.stringify({userToken:'local-test-owner',messages});
 const headers=await signWorkerRequest(secret,'dynamicneko','POST',path,body);
 const r=await app.request('https://internal'+path,{method:'POST',headers,body},{DYNAMICNEKO_WORKER_HMAC_SECRET:secret,MUSE_API_KEY:process.env.MUSE_API_KEY} as never);
 const d=await r.json() as {reply?:string;error?:string};
 const result={http:r.status,exactReply:d.reply?.trim()===marker,error:d.error??null,upstreamPaths,realMuse:true,productionAuthTested:false};
 writeFileSync('artifacts/tree-view-muse-20261108/live.json',JSON.stringify(result,null,2));
 expect(result.http).toBe(200);expect(result.exactReply).toBe(true);
},110000);
