"""Explicit live console post: creates ONE input in the fixed ENV thread queue.
Never run as a recurring health check. Queue acceptance is not an AI response.
"""
import asyncio,contextlib,json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent));import network_live_test as t
from websockets.asyncio.client import unix_connect

async def queue_list():
 async with unix_connect('/run/lib-chat-app/app-server.sock',uri='ws://localhost',max_size=16777216) as ws:
  async def rpc(i,m,p):
   await ws.send(json.dumps({'id':i,'method':m,'params':p}))
   while True:
    d=json.loads(await ws.recv())
    if d.get('id')==i:
     assert 'error' not in d
     return d['result']
  await rpc(1,'initialize',{'clientInfo':{'name':'network_queue_verifier','version':'1'},'capabilities':{'experimentalApi':True}})
  await ws.send('{"method":"initialized","params":{}}')
  return await rpc(2,'thread/queue/list',{'threadId':os.environ['CODEX_THREAD_ID'],'limit':100})

async def main():
 src=json.loads(Path('/var/lib/lib-chat-observer/source.json').read_text())
 assert src['threadId']==os.environ['CODEX_THREAD_ID']
 marker='STREAM_POST_OK_20261105'
 prompt='ストリームパネルの同一会話投稿テストです。この投稿を実際に受信したら '+marker+' と返答し、元の作業を継続してください。'
 async with t.aiohttp.ClientSession(timeout=t.aiohttp.ClientTimeout(total=30)) as s:
  code,d=await t.request(s,'POST',t.PREFIX+'console-session',{'type':'console','ttl_seconds':900})
  assert code==200 and d.get('token');token=d['token']
  try:
   code,d=await t.request(s,'POST',t.PREFIX+'console',{'prompt':prompt},signed=False,extra={'Authorization':'Bearer '+token})
   print('Single-thread console HTTP=',code,'accepted=',d.get('accepted'),'queued=',d.get('queued'),'error=',d.get('error'),flush=True)
   assert code==200 and d.get('accepted') is True
   data=await queue_list()
   matching=[item for item in data['data'] if any(i.get('text')==prompt for i in item.get('input',[]))]
   assert len(matching)==1,'Native queue did not contain exactly one matching input'
   assert json.loads(Path('/var/lib/lib-chat-observer/source.json').read_text())['threadId']==src['threadId']
   print('PASS: one matching native queue item in current ENV thread; observer target unchanged; no fork.',flush=True)
   print('PENDING: existing writer consumption and assistant response, not proven by acceptance.',flush=True)
  finally:
   await t.request(s,'DELETE',t.PREFIX+'console-session',signed=False,extra={'Authorization':'Bearer '+token})
if __name__ == '__main__':
 asyncio.run(main())
