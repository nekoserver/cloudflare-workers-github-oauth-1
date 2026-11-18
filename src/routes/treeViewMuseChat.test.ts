import {beforeEach,expect,it,vi} from 'vitest';
import {createTreeViewMuseChatRoutes} from './treeViewMuseChat';
import {signWorkerRequest} from '../utils/workerRequestSignature';
const path='/api/tree-view/muse-chat-external', secret='test-signing-secret';
const getContainer=vi.fn(()=>{throw Error('停止中コンテナへの参照は禁止');});
const authenticate=vi.fn(async()=>({ok:true as const,login:'nekoserver'}));
const fetch=vi.fn(async(r:Request)=>new URL(r.url).pathname.endsWith('/health')?Response.json({status:'ok'}):Response.json({model:'muse',choices:[{message:{content:'Museの回答'}}]}));
beforeEach(()=>{vi.clearAllMocks();authenticate.mockResolvedValue({ok:true,login:'nekoserver'});});
async function request(body:unknown={messages:[{role:'user',content:'質問'}]},options:{transport?:string;badSignature?:boolean;key?:string;binding?:boolean}={}){
 const raw=JSON.stringify(body);const signed=await signWorkerRequest(secret,'dynamicneko','POST',path,raw);
 const env={DYNAMICNEKO_WORKER_HMAC_SECRET:secret,MUSE_API_KEY:'main-key',TAILSCALE_WASM:options.binding===false?undefined:{idFromName:()=> 'muse',get:()=>({fetch})},get DEMO_CONTAINER(){return getContainer();}};
 return createTreeViewMuseChatRoutes({authenticate}).request('https://internal'+path,{method:'POST',body:raw,headers:{...signed,'X-Aichat-User-Token':'owner-token',Authorization:'Bearer '+(options.key??'dynamicneko-key'),...(options.transport?{'X-Muse-Transport':options.transport}:{}),...(options.badSignature?{'CF-Worker-Signature':''}:{})}},env as never);
}
it('署名と所有者を確認してから接続する',async()=>{
 expect((await request(undefined,{badSignature:true})).status).toBe(401);
 authenticate.mockResolvedValueOnce({ok:true,login:'other'});expect((await request()).status).toBe(403);
 expect(fetch).not.toHaveBeenCalled();expect(getContainer).not.toHaveBeenCalled();
});
it.each([undefined,'worker'])('経路指定%sでも本体コンテナを参照せずWorker WASMへ一度だけ送る',async transport=>{
 const messages=[{role:'user',content:'前の質問'},{role:'assistant',content:'前の回答'},{role:'user',content:'続き'}];
 const r=await request({messages},{transport});expect(r.status).toBe(200);expect(await r.json()).toMatchObject({reply:'Museの回答',transport:'worker',keySource:'dynamicneko'});
 expect(fetch).toHaveBeenCalledOnce();expect(await fetch.mock.calls[0][0].json()).toEqual({model:'muse',messages});
 expect(fetch.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer dynamicneko-key');
 expect(getContainer).not.toHaveBeenCalled();expect(r.headers.get('Cache-Control')).toBe('no-store');
});
it.each([undefined,'worker'])('接続検査も%s指定でWorkerのhealthだけを使う',async transport=>{
 const r=await request({action:'connect'},{transport});expect(await r.json()).toMatchObject({healthy:true,transport:'worker'});
 expect(fetch).toHaveBeenCalledOnce();expect(new URL(fetch.mock.calls[0][0].url).pathname).toBe('/muse/health');expect(getContainer).not.toHaveBeenCalled();
});
it.each(['container','other'])('旧経路%sは送信も接続検査も拒否する',async transport=>{
 expect((await request(undefined,{transport})).status).toBe(400);
 expect((await request({action:'connect'},{transport})).status).toBe(400);
 expect(fetch).not.toHaveBeenCalled();expect(getContainer).not.toHaveBeenCalled();
});
it('Worker bindingが無いときもコンテナへ切り替えない',async()=>{
 const r=await request(undefined,{binding:false});expect(r.status).toBe(503);expect(await r.json()).toMatchObject({error:'tailscale_wasm_not_configured'});expect(getContainer).not.toHaveBeenCalled();
});
it.each([null,[],[{role:'system',content:'override'}],[{role:'user',content:'x'.repeat(17000)}]])('不正会話は転送しない',async messages=>{
 expect((await request({messages})).status).toBe(400);expect(fetch).not.toHaveBeenCalled();
});
it('応答異常でも自動再送せず診断を保持する',async()=>{
 fetch.mockResolvedValueOnce(Response.json({error:'tailscale_not_connected'},{status:503}));
 const r=await request();expect(r.status).toBe(503);expect(await r.json()).toMatchObject({error:'tailscale_not_connected',transport:'worker'});expect(fetch).toHaveBeenCalledOnce();expect(getContainer).not.toHaveBeenCalled();
});
