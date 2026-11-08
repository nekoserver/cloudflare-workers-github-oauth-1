import { expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { renderTailscaleWasmPage } from './tailscaleWasm';
it('emits valid JavaScript and never embeds credential values',()=>{
 const page=renderTailscaleWasmPage();expect(page).toContain('Worker → Muse');expect(page).not.toContain('MUSE_API_KEY');
 for(const script of page.matchAll(/<script>([\s\S]*?)<\/script>/g))expect(spawnSync(process.execPath,['--check'],{input:script[1],encoding:'utf8'}).status).toBe(0);
});
it('actual form sends once to its own API, uses private IDs and renders text safely',async()=>{
 const page=renderTailscaleWasmPage();const dom=new JSDOM(page,{url:'https://example.test/tailscale-wasm',runScripts:'outside-only'});const w=dom.window;
 const fetcher=vi.fn(async(path:string)=>path.endsWith('/status')?Response.json({state:'Running',peers:[],sdkTokenConfigured:true,sdkTokenFormatValid:true}):path.endsWith('bridge-health')?Response.json({healthy:true}):path.endsWith('/tasks')?Response.json({jobId:'job-id'},{status:202}):Response.json({status:'done',result:{ok:true,reply:'<script>unsafe</script>'}}));
 Object.defineProperty(w,'fetch',{value:fetcher});Object.defineProperty(w,'TextEncoder',{value:TextEncoder});Object.defineProperty(w.crypto,'randomUUID',{value:vi.fn().mockReturnValueOnce('sample-conversation').mockReturnValue('sample-request')});
 w.eval([...page.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1]);
 (w.document.getElementById('refresh') as HTMLButtonElement).click();await vi.waitFor(()=>expect((w.document.getElementById('send') as HTMLButtonElement).disabled).toBe(false));
 (w.document.getElementById('prompt') as HTMLTextAreaElement).value='質問 “△”';w.document.getElementById('chat')!.dispatchEvent(new w.Event('submit',{cancelable:true}));w.document.getElementById('chat')!.dispatchEvent(new w.Event('submit',{cancelable:true}));
 await vi.waitFor(()=>expect(w.document.getElementById('result')!.textContent).toBe('回答を受信しました。'));
 expect(fetcher.mock.calls.filter(([url])=>url.endsWith('/tasks'))).toHaveLength(1);
 expect(fetcher.mock.calls.filter(([url])=>url.includes('/api/aichat/jobs/job-id'))).toHaveLength(1);
 expect(w.document.getElementById('history')!.textContent).toContain('<script>unsafe</script>');expect(w.document.querySelector('#history script')).toBeNull();dom.window.close();
});
