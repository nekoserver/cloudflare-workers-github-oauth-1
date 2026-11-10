import {expect,it,vi} from 'vitest';
import {withMuseTailscalePreflight} from './museTailscalePreflight';
import {pickMuseNodes} from './museNodeStatus';
import {WasmMuseBridge} from './wasmMuseBridge';
const peers=[{hostName:'muse-vm',dnsName:'muse-vm.example.ts.net.',online:false},{hostName:'muse-vm',dnsName:'muse-vm-2.example.ts.net.',online:true,ip:'100.64.0.2'}];
it('preflight uses the online numeric suffix peer rather than the first stale peer',async()=>{
 const container={getState:async()=>({status:'running'}),fetch:async()=>Response.json({backendState:'Running',peers})};
 const send=vi.fn(async()=>true);
 await expect(withMuseTailscalePreflight(send,async()=>container)('muse_prompt="test"')).resolves.toBe(true);
 expect(pickMuseNodes(peers)[1]).toMatchObject({online:true,ip:'100.64.0.2'});
});
it('WASM sends to the selected online peer actual DNS name',async()=>{
 const fetch=vi.fn(async()=>({status:200,cancel(){},read:async()=>null}));
 const node={status:()=>JSON.stringify({state:'Running',peers:[{name:'muse-vm',online:false},{name:'muse-vm-2',dnsName:'muse-vm-2.example.ts.net.',online:true}]}),fetch};
 const res=await new WasmMuseBridge(node as never,'secret').fetch(new Request('http://tailnet/muse/health'));
 expect(res.status).toBe(200);expect(fetch).toHaveBeenCalledWith(expect.objectContaining({url:'http://muse-vm-2.example.ts.net:8080/health'}));
});
it('never treats a different service or an ambiguous online pair as the Muse destination',async()=>{
 for(const peers of [[{name:'muse-vm-attacker',online:true}],[{name:'muse',online:true}],[{name:'muse-vm-1',online:true},{name:'muse-vm-2',online:true}]]){
  const fetch=vi.fn();const node={status:()=>JSON.stringify({state:'Running',peers}),fetch};
  expect((await new WasmMuseBridge(node as never,'secret').fetch(new Request('http://tailnet/muse/health'))).status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
 }
});
it('Gadget relay uses the online actual main container name without changing configured port',async()=>{
 const {WasmTailnetService}=await import('./wasmTailnetService');
 const fetch=vi.fn(async()=>({status:200,cancel(){},read:async()=>null}));
 const node={status:()=>JSON.stringify({state:'Running',peers:[{name:'cf-demo-container',online:false},{name:'cf-demo-container-2',dnsName:'cf-demo-container-2.example.ts.net.',online:true}]}),fetch};
 const service=new WasmTailnetService(node as never,{MUSE_GADGET_SDK_TOKEN:'mgst_'+'A'.repeat(43),ORIGIN_HMAC_SECRET:'test',MUSE_GADGET_RELAY_URL:'http://cf-demo-container:8766'});
 const response=await service.fetch(new Request('http://tailnet/gadget/status',{method:'POST'}));
 expect(response.status).toBe(200);expect(fetch).toHaveBeenCalledWith(expect.objectContaining({url:'http://cf-demo-container-2.example.ts.net:8766/gadget/status'}));
});
