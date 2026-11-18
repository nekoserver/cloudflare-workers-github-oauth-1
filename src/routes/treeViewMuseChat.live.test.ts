import {expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
// 実際の両中継・公開SDK・workerdを通す。本人認証は隔離fixture、コンテナbindingは存在しない。
it.skipIf(process.env.RUN_TREE_VIEW_MUSE_LIVE!=='1')('両中継から実MuseへWorker直通し、コンテナ参照0回・投稿1回',async()=>{
 const {stdout}=await promisify(execFile)('node',['scripts/check-treeview-muse-do-live.mjs'],{timeout:100000,maxBuffer:1024*1024});
 const event=stdout.split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x)).find(x=>x.phase==='dynamicneko-main-real-wasm-muse');
 expect(event).toMatchObject({status:200,replyReceived:true,posts:1,containerReads:0,success:true});
},110000);
