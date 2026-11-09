// Explicit live check: signed tree-view route -> actual DO/WASM -> real muse-vm.
// Uses a temporary ephemeral node; no production user authentication or deployment.
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,copyFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID,webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url);
const output=resolve('artifacts/chat-retest-20261109');await mkdir(output,{recursive:true});
const inherited=Object.fromEntries((await readFile('/proc/82/environ','utf8')).split('\0').filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const tailnetKey=process.env.TAILSCALE_WASM_AUTHKEY||process.env.TAILSCALE_AUTHKEY||inherited.TAILSCALE_WASM_AUTHKEY||inherited.TAILSCALE_AUTHKEY;
const museKey=process.env.MUSE_API_KEY||inherited.MUSE_API_KEY;
if(!tailnetKey||!museKey)throw new Error('Existing credentials unavailable');
const secret=randomUUID(),host='treeview-check-'+Date.now(),dir=await mkdtemp(join(tmpdir(),'treeview-muse-'));
let mf;
const result={runtime:'local workerd',actualRoute:true,actualDurableObject:true,ephemeralTestNode:true,productionUserAuthTested:false,health:false,inferencePosts:0,exactReply:false};
try{
 const entry=join(dir,'entry.ts');
 await writeFile(entry,`
 import {createTreeViewMuseChatRoutes} from ${JSON.stringify(resolve('src/routes/treeViewMuseChat.ts'))};
 export {TailscaleWasm} from ${JSON.stringify(resolve('src/durable/tailscaleWasm.ts'))};
 console.log=console.warn=console.error=()=>{};
 const app=createTreeViewMuseChatRoutes({getContainer:async()=>{throw new Error('No container fallback allowed')},authenticate:async(_,token)=>token==='local-owner'?{ok:true,login:'nekoserver'}:{ok:false,error:'Unauthorized',status:401}});
 export default {fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/test-health'||path==='/test-logout'||path==='/test-status')return env.TAILSCALE_WASM.get(env.TAILSCALE_WASM.idFromName('muse')).fetch(new Request('http://node'+(path==='/test-health'?'/muse/health':path==='/test-status'?'/status':'/logout'),{method:path==='/test-logout'?'POST':'GET'}));
  return app.fetch(request,env);
 }};`);
 await build({entryPoints:[entry],outfile:join(dir,'worker.mjs'),bundle:true,format:'esm',platform:'neutral',external:['cloudflare:workers'],plugins:[{name:'test-node-and-wasm',setup(b){
  b.onResolve({filter:/\/main\.wasm$/},()=>({path:'./main.wasm',external:true}));
  b.onLoad({filter:/\/src\/durable\/tailscaleWasm\.ts$/},async args=>{
   const source=await readFile(args.path,'utf8');const contents=source.replace("hostname: 'main-worker-muse', ephemeral: false",`hostname: '${host}', ephemeral: true`);
   if(contents===source)throw new Error('Test node isolation contract changed');
   return {contents,loader:'ts',resolveDir:dirname(args.path)};
  });
 }}]});
 await copyFile(require.resolve('@ai-ecoverse/wasm-tailscale/main.wasm'),join(dir,'main.wasm'));
 mf=new Miniflare(convertV4MiniflareOptions({log:new Log(LogLevel.NONE),workers:[{name:'treeview-check',compatibilityDate:'2024-11-17',modulesRoot:dir,modules:[{type:'ESModule',path:join(dir,'worker.mjs')},{type:'CompiledWasm',path:join(dir,'main.wasm')}],durableObjects:{TAILSCALE_WASM:{className:'TailscaleWasm',useSQLite:true}},bindings:{TAILSCALE_WASM_AUTHKEY:tailnetKey,MUSE_API_KEY:museKey,DYNAMICNEKO_WORKER_HMAC_SECRET:secret}}]}));
 result.healthChecks=[];
 for(let attempt=0;attempt<6;attempt++){
  const health=await mf.dispatchFetch('http://test/test-health');
  const state=await health.json();result.health=health.status===200&&state.status==='ok';result.healthHttp=health.status;
  const statusResponse=await mf.dispatchFetch('http://test/test-status');const status=await statusResponse.json();
  result.healthChecks.push({http:health.status,error:state.error??null,state:status.state??null,statusError:status.error??null,museVmOnline:Array.isArray(status.peers)&&status.peers.some(p=>(p.name||p.dnsName||'').split('.')[0]==='muse-vm'&&p.online===true)});
  if(result.health||state.error==='tailscale_wasm_unavailable')break;
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(!result.health)throw new Error('Worker tailnet health unavailable; no inference submitted');
 const marker='TREEVIEW_RUNTIME_'+randomUUID().replaceAll('-','').slice(0,10);
 const messages=[{role:'user',content:'Remember this exact token: '+marker},{role:'assistant',content:'I will remember it.'},{role:'user',content:'Reply with only the token from the first message. No tools.'}];
 const path='/api/tree-view/muse-chat-external',body=JSON.stringify({userToken:'local-owner',transport:'worker',messages}),timestamp=String(Math.floor(Date.now()/1000));
 const key=await webcrypto.subtle.importKey('raw',Buffer.from(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await webcrypto.subtle.sign('HMAC',key,Buffer.from(['dynamicneko',timestamp,'POST',path,body].join('\n')))).toString('hex');
 result.inferencePosts=1;
 const response=await mf.dispatchFetch('http://test'+path,{method:'POST',body,headers:{'Content-Type':'application/json','CF-Worker':'dynamicneko','CF-Worker-Timestamp':timestamp,'CF-Worker-Signature':'sha256='+signature}});
 const answer=await response.json();result.http=response.status;result.exactReply=answer.reply?.trim()===marker;result.error=answer.error??null;
 if(response.status!==200||!result.exactReply)process.exitCode=1;
}catch(error){result.failure=error instanceof Error?error.message:'runtime failure';process.exitCode=1;}
finally{
 if(mf){try{const r=await mf.dispatchFetch('http://test/test-logout');result.logoutHttp=r.status;}catch{result.logoutHttp=null;}await mf.dispose();}
 await rm(dir,{recursive:true,force:true});
 await writeFile(join(output,'worker-runtime.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
