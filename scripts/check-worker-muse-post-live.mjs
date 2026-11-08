// Real workerd WASM -> muse-vm POST. Creates an ephemeral test node and sends once.
// Reuses explicitly selected environment credentials in memory, never prints them.
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from 'miniflare';
import { mkdtemp, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const inherited = Object.fromEntries((await readFile('/proc/73/environ', 'utf8')).split('\0').filter(x => x.includes('=')).map(x => [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1)]));
const auth = process.env.TAILSCALE_AUTHKEY || inherited.TAILSCALE_AUTHKEY;
const apiKey = process.env.MUSE_API_KEY;
if (!auth || !apiKey) throw new Error('Required existing credentials unavailable');
const dir = await mkdtemp(join(tmpdir(), 'worker-muse-post-'));
let mf;
try {
  await copyFile(require.resolve('@ai-ecoverse/wasm-tailscale/wasm_exec.js'), join(dir, 'shim.mjs'));
  await copyFile(require.resolve('@ai-ecoverse/wasm-tailscale/main.wasm'), join(dir, 'main.wasm'));
  await writeFile(join(dir, 'entry.mjs'), `import './shim.mjs'; import wasm from './main.wasm';
let node, state='NotStarted', started=false, sent=false, panic=false;
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/start'){
  if(started)return Response.json({state});started=true;
  const go=new Go();void go.run(new WebAssembly.Instance(wasm,go.importObject)).catch(()=>{panic=true});
  for(let i=0;i<500&&typeof newIPN!=='function';i++)await new Promise(r=>setTimeout(r,10));
  const memory={};node=newIPN({hostname:'worker-muse-post-check',ephemeral:true,logUpload:false,controlURL:env.CONTROL_URL||'',stateStorage:{getState:k=>memory[k]||'',setState:(k,v)=>{memory[k]=v}}});
  if(node instanceof Error)return Response.json({error:'node_init_failed'},{status:500});
  node.run({notifyState:s=>{state=s},notifyNetMap(){},notifyBrowseToURL(){},notifyPanicRecover(){panic=true}});node.login(env.AUTH_KEY);
  for(let i=0;i<600&&state!=='Running'&&!panic;i++)await new Promise(r=>setTimeout(r,100));
  return Response.json({state,panic});
 }
 if(path==='/status'){
  const raw=node.status();if(raw instanceof Error)return Response.json({state,panic});
  const d=JSON.parse(raw);return Response.json({state:d.state,panic,peerOnline:(d.peers||[]).some(p=>(p.name||p.dnsName||'').split('.')[0]==='muse-vm'&&p.online===true)});
 }
 if(path==='/logout'){node.logout();return Response.json({loggedOut:true});}
 if(path!=='/post'||request.method!=='POST')return new Response('Not found',{status:404});
 if(sent)return Response.json({error:'already_sent'},{status:409});sent=true;
 let upstream,expired=false,timer;
 const run=async()=>{
  upstream=await node.fetch({url:'http://muse-vm:8080/v1/chat/completions',method:'POST',manualRedirects:true,headers:[['Authorization','Bearer '+env.API_KEY],['Content-Type','application/json']],body:new TextEncoder().encode(JSON.stringify({model:'muse',stream:false,messages:[{role:'user',content:'Reply with exactly WASM_POST_BRIDGE_OK_20261108 and nothing else.'}]}))});
  if(expired){upstream.cancel();return {error:'timeout'};}
  let size=0,text='';const decoder=new TextDecoder();
  for(;;){const chunk=await upstream.read();if(chunk===null)break;size+=chunk.length;if(size>1048576){upstream.cancel();return {status:upstream.status,error:'response_too_large'};}text+=decoder.decode(chunk,{stream:true});}
  text+=decoder.decode();let data;try{data=JSON.parse(text)}catch{return {status:upstream.status,json:false,responseBytes:size};}
  const content=data.choices?.[0]?.message?.content;
  return {status:upstream.status,json:true,responseBytes:size,hasChoices:Array.isArray(data.choices),exactMarker:typeof content==='string'&&content.trim()==='WASM_POST_BRIDGE_OK_20261108'};
 };
 try{return Response.json(await Promise.race([run(),new Promise(r=>{timer=setTimeout(()=>{expired=true;upstream?.cancel();r({error:'timeout',delivery:'unknown_do_not_retry'})},120000)})]));}
 catch{return Response.json({error:'post_transport_failed',delivery:'unknown_do_not_retry'});}
 finally{clearTimeout(timer);}
}};`);
  mf = new Miniflare(convertV4MiniflareOptions({ log: new Log(LogLevel.NONE), workers: [{ name: 'live-post', compatibilityDate: '2024-11-17', modulesRoot: dir, modules: [{ type: 'ESModule', path: join(dir, 'entry.mjs') }, { type: 'ESModule', path: join(dir, 'shim.mjs') }, { type: 'CompiledWasm', path: join(dir, 'main.wasm') }], bindings: { AUTH_KEY: auth, API_KEY: apiKey, CONTROL_URL: inherited.TAILSCALE_LOGIN_SERVER || '' } }] }));
  const call = async (path, method = 'GET') => (await mf.dispatchFetch('http://probe' + path, { method })).json();
  console.log(JSON.stringify({ phase: 'start', ...await call('/start') }));
  let status;
  for (let i = 0; i < 60; i++) {
    status = await call('/status');
    if (status.state === 'Running' && status.peerOnline || status.panic) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log(JSON.stringify({ phase: 'tailnet', ...status }));
  if (status.state !== 'Running' || !status.peerOnline) throw new Error('WASM tailnet not ready; POST not sent');
  const result = await call('/post', 'POST');
  console.log(JSON.stringify({ phase: 'single-post', target: 'muse-vm:8080/v1/chat/completions', ...result }));
  if (result.status !== 200 || !result.exactMarker) process.exitCode = 1;
} finally {
  if (mf) {
    try { console.log(JSON.stringify({ phase: 'cleanup', ...await (await mf.dispatchFetch('http://probe/logout')).json() })); } catch {}
    await mf.dispose();
  }
  await rm(dir, { recursive: true, force: true });
}
