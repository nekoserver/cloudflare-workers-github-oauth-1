// Workerd smoke test of the real published binary and real Durable Object.
// No Docker, authentication keys, tailnet enrollment or inference requests.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const dir = await mkdtemp(join(tmpdir(), 'worker-tailscale-wasm-'));
let mf;
try {
 await build({ entryPoints:['src/durable/tailscaleWasm.ts'],outfile:join(dir,'node.mjs'),bundle:true,format:'esm',platform:'neutral',external:['cloudflare:workers'],plugins:[{name:'wasm-module',setup(b){b.onResolve({filter:/\/main\.wasm$/},()=>({path:'./main.wasm',external:true}));}}] });
 await copyFile(require.resolve('@ai-ecoverse/wasm-tailscale/main.wasm'),join(dir,'main.wasm'));
 await writeFile(join(dir,'entry.mjs'), `export {TailscaleWasm} from './node.mjs';export default {fetch(request,env){return env.TAILSCALE_WASM.get(env.TAILSCALE_WASM.idFromName('muse')).fetch(request)}};`);
 mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'test',compatibilityDate:'2024-11-17',modulesRoot:dir,modules:[{type:'ESModule',path:join(dir,'entry.mjs')},{type:'ESModule',path:join(dir,'node.mjs')},{type:'CompiledWasm',path:join(dir,'main.wasm')}],durableObjects:{TAILSCALE_WASM:{className:'TailscaleWasm',useSQLite:true}}}]}));
 for(let i=0;i<2;i++){
  const response=await mf.dispatchFetch('http://node/status');const data=await response.json();
  if(response.status!==200||data.state!=='NeedsLogin'||data.shieldsUp!==true)throw new Error('Worker node status check failed: '+JSON.stringify(data));
 }
 const response=await mf.dispatchFetch('http://node/proxy?url=http://example.com');
 if(response.status!==404)throw new Error('Unexpected generic proxy');
 console.log('PASS real WASM in workerd Durable Object: NeedsLogin, shieldsUp, repeated requests, fixed routes; no container or auth key');
}finally{if(mf)await mf.dispose();await rm(dir,{recursive:true,force:true});}
