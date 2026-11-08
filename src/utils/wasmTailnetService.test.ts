import { expect, it, vi } from 'vitest';
import type { IPN } from '@ai-ecoverse/wasm-tailscale';
import { WasmTailnetService } from './wasmTailnetService';
const TOKEN='mgst_'+'A'.repeat(43);
function fixture(state='Running',timeout=300000) {
 const cancel=vi.fn(),read=vi.fn().mockResolvedValueOnce(new TextEncoder().encode('{"ready":true}')).mockResolvedValue(null);
 const node={status:vi.fn(()=>JSON.stringify({state,peers:[{name:'relay',online:true}]})),login:vi.fn(),logout:vi.fn(),fetch:vi.fn(async(_req:unknown)=>({status:200,read,cancel}))};
 return {node,cancel,read,service:new WasmTailnetService(node as unknown as IPN,{MUSE_GADGET_SDK_TOKEN:TOKEN,ORIGIN_HMAC_SECRET:'test',MUSE_GADGET_RELAY_URL:'http://relay:8766'},{status:timeout,chat:timeout})};
}
const chat=()=>new Request('http://tailnet/gadget/chat',{method:'POST',body:JSON.stringify({prompt:'質問 “△”',conversationId:'chat-1',requestId:'request-1'})});
it('signs the fixed Gadget route, uses SDK token server-side, and sends the original text once',async()=>{
 const f=fixture();expect((await f.service.fetch(chat())).status).toBe(200);expect(f.node.fetch).toHaveBeenCalledOnce();
 const req=f.node.fetch.mock.calls[0][0] as {url:string;body:Uint8Array;headers:string[][];manualRedirects:boolean};
 expect(req.url).toBe('http://relay:8766/gadget/chat');expect(req.manualRedirects).toBe(true);expect(req.headers.find(h=>h[0]==='X-Signature')?.[1]).toMatch(/^[0-9a-f]{64}$/);
 expect(JSON.parse(new TextDecoder().decode(req.body))).toEqual({prompt:'質問 “△”',conversationId:'chat-1',requestId:'request-1',sdkToken:TOKEN});
});
it('unconnected and offline cannot submit',async()=>{
 const f=fixture('NeedsLogin');expect((await f.service.fetch(chat())).status).toBe(503);
 f.node.status.mockReturnValue(JSON.stringify({state:'Running',peers:[{name:'relay',online:false}]}));expect((await f.service.fetch(chat())).status).toBe(503);expect(f.node.fetch).not.toHaveBeenCalled();
});
it('status exposes only token presence/format, never a claim of validity or the token',async()=>{
 const f=fixture();const response=await f.service.fetch(new Request('http://tailnet/status'));const text=await response.text();expect(text).not.toContain(TOKEN);expect(JSON.parse(text)).toMatchObject({sdkTokenConfigured:true,sdkTokenFormatValid:true});expect(JSON.parse(text)).not.toHaveProperty('sdkTokenValid');
});
it('refuses the previous direct Muse API and arbitrary proxies',async()=>{
 const f=fixture();for(const path of ['/muse/v1/chat/completions','/proxy?url=http://evil'])expect((await f.service.fetch(new Request('http://tailnet'+path,{method:'POST'}))).status).toBe(404);expect(f.node.fetch).not.toHaveBeenCalled();
});
it('bounds response memory and cancels without retry',async()=>{
 const f=fixture();f.read.mockReset().mockResolvedValue(new Uint8Array(1048577));expect((await f.service.fetch(chat())).status).toBe(502);expect(f.cancel).toHaveBeenCalledOnce();expect(f.node.fetch).toHaveBeenCalledOnce();
});
it('late upstream after timeout is cancelled and never retried',async()=>{
 const f=fixture('Running',20);let resolve!:(v:unknown)=>void;f.node.fetch.mockImplementation(()=>new Promise(r=>{resolve=r}) as never);
 const pending=f.service.fetch(chat());expect((await pending).status).toBe(504);resolve({status:200,read:f.read,cancel:f.cancel});await Promise.resolve();await Promise.resolve();expect(f.cancel).toHaveBeenCalled();expect(f.read).not.toHaveBeenCalled();expect(f.node.fetch).toHaveBeenCalledOnce();
});
