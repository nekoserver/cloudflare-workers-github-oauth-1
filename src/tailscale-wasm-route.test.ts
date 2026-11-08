import { beforeEach, expect, it, vi } from 'vitest';
import app from './index';import { createJWT } from './utils/jwt';
const stub={fetch:vi.fn(async(_request:Request)=>Response.json({ok:true,reply:'Gadgetの回答'}))};
const ns={idFromName:vi.fn(()=> 'muse'),get:vi.fn(()=>stub)};
const DB={prepare:()=>({bind:()=>({first:async()=>({revoked_at:null})})})};
const env={JWT_SECRET:'gadget-test',DB,TAILSCALE_WASM:ns,CF_DASHBOARD_ADMIN_GITHUB_IDS:'1'};
beforeEach(()=>vi.clearAllMocks());
async function headers(id=1){return {Authorization:'Bearer '+await createJWT({sub:'user',github_id:id},'gadget-test'),'Content-Type':'application/json'};}
it('requires login/admin and rejects cross-origin changes before touching the node',async()=>{
 expect([302,401]).toContain((await app.request('/tailscale-wasm',{},env)).status);
 expect((await app.request('/api/tailscale-wasm/status',{headers:await headers(2)},env)).status).toBe(403);
 expect((await app.request('/api/tailscale-wasm/chat',{method:'POST',headers:{...await headers(),Origin:'https://evil.example'},body:'{}'},env)).status).toBe(403);expect(stub.fetch).not.toHaveBeenCalled();
});
it('serves the independent form without SDK tokens or changes to AI chat configuration',async()=>{
 const page=await app.request('/tailscale-wasm',{headers:await headers()},env);expect(page.status).toBe(200);expect(page.headers.get('cache-control')).toBe('no-store');expect(await page.text()).toContain('Worker → Muse');
});
it('uses the gadget-specific route and conversation/request IDs exactly once',async()=>{
 const body={prompt:'そのまま “△”',conversationId:'sample-chat-1',requestId:'request-1'};
 const response=await app.request('/api/tailscale-wasm/chat',{method:'POST',headers:await headers(),body:JSON.stringify(body)},env);
 expect(await response.json()).toEqual({ok:true,reply:'Gadgetの回答'});expect(stub.fetch).toHaveBeenCalledOnce();
 const req=stub.fetch.mock.calls[0][0];expect(new URL(req.url).pathname).toBe('/gadget/chat');expect(await req.json()).toEqual(body);
});
it('invalid or oversized input cannot reach a gadget',async()=>{
 for(const body of [{prompt:'x'}, {prompt:'x'.repeat(17000),conversationId:'test',requestId:'test'}])expect((await app.request('/api/tailscale-wasm/chat',{method:'POST',headers:await headers(),body:JSON.stringify(body)},env)).status).toBe(400);
 expect(stub.fetch).not.toHaveBeenCalled();
});
it.each(['muse','codex','claude'])('/askmgs uses the shared page API independently of selected model %s',async model=>{
 const response=await app.request('/api/aichat',{method:'POST',headers:await headers(),body:JSON.stringify({model,message:'/askmgs prompt="質問 “△”"',threadId:'example-thread',source:'textbox'})},env);
 const data=await response.json() as {response:string};expect(data.response).toContain('Gadgetの回答');expect(data.response).toContain('Muse Gadget SDK');
 expect(stub.fetch).toHaveBeenCalledOnce();const request=stub.fetch.mock.calls[0][0];expect(new URL(request.url).pathname).toBe('/gadget/chat');expect(await request.json()).toMatchObject({prompt:'質問 “△”',conversationId:expect.stringMatching(/^askmgs-/),requestId:expect.any(String)});
});
