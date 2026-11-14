import {expect,it,vi} from 'vitest';
import {museWorkerDep,checkMuseWorkerHealth} from './museWorkerAsk';
import {readMuseNodeSnapshot} from './museNodeReady';
function fixture(response:()=>Response){
 const fetch=vi.fn(async(_request:Request)=>response());
 const env={MUSE_API_KEY:'test-key',TAILSCALE_WASM:{idFromName:()=> 'muse',get:()=>({fetch})},get DEMO_CONTAINER(){throw Error('停止中コンテナへのアクセスは禁止');}};
 return {env:env as unknown as Parameters<typeof museWorkerDep>[0],fetch};
}
it('本体コンテナを参照せずWorkerだけでhealthと投稿ができる',async()=>{
 const f=fixture(()=>Response.json({status:'ok',model:'muse',choices:[{message:{content:'回答'}}]}));
 expect(await checkMuseWorkerHealth(f.env)).toBe(true);
 expect(await museWorkerDep(f.env)('質問')).toMatchObject({ok:true,reply:'回答'});
 expect(f.fetch).toHaveBeenCalledTimes(2);
});
it('直通の待ち時間が指定済みならaskgk用D1設定を参照しない',async()=>{
 const f=fixture(()=>Response.json({model:'muse',choices:[{message:{content:'回答'}}]}));
 const prepare=vi.fn(()=>{throw Error('無関係な設定DBは利用不可');});
 Object.defineProperty(f.env,'DB',{value:{prepare}});
 expect(await museWorkerDep(f.env)('質問')).toMatchObject({ok:true});
 expect(prepare).not.toHaveBeenCalled();
});
it.each([[401,'muse_authentication_failed'],[429,'muse_usage_limit'],[500,'muse_execution_failed'],[503,'muse_command_failed']])('MuseのHTTP %sをTailscale切断として扱わない',async(status,error)=>{
 const f=fixture(()=>Response.json({error:'upstream_error'},{status:status as number}));const signal=vi.fn();
 expect(await museWorkerDep(f.env,signal)('質問')).toMatchObject({ok:false,error});
 expect(signal).toHaveBeenCalledExactlyOnceWith(true);
 expect(f.fetch).toHaveBeenCalledOnce();
});
it('HTTP200の壊れた本文は接続済みの応答異常として扱う',async()=>{
 const f=fixture(()=>new Response('not-json'));const signal=vi.fn();
 expect(await museWorkerDep(f.env,signal)('質問')).toMatchObject({ok:false,error:'muse_execution_failed'});
 expect(signal).toHaveBeenCalledExactlyOnceWith(true);
});
it('WASM自身の未接続エラーはMuseのHTTP503と区別する',async()=>{
 const f=fixture(()=>Response.json({error:'tailscale_not_connected'},{status:503}));const signal=vi.fn();
 expect(await museWorkerDep(f.env,signal)('質問')).toMatchObject({ok:false,error:'tailscale_not_connected'});
 expect(signal).toHaveBeenCalledExactlyOnceWith(false);
});
it('SDKのホスト名とDNS名は独立に確認する',()=>{
 expect(readMuseNodeSnapshot(JSON.stringify({state:'Running',peers:[{name:'old-hostname',dnsName:'muse-vm.tail.ts.net.',online:true}]}))).toEqual({state:'Running',museOnline:true});
});
it.each(['null','{"state":"Running","peers":{}}','{"state":"Running","peers":[null]}'])('不正status %sで例外にせず未接続にする',raw=>{
 expect(readMuseNodeSnapshot(raw)).toEqual({state:raw==='null'?'':'Running',museOnline:false});
});
it('直通のhealthも呼出元の現在の鍵を明示し、DO起動時の鍵に任せない',async()=>{
 const f=fixture(()=>Response.json({status:'ok'}));
 expect(await checkMuseWorkerHealth(f.env)).toBe(true);
 expect(f.fetch.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer test-key');
});
