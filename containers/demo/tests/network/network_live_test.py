"""Opt-in live acceptance. Never logs keys, tokens or conversation text.
Run read checks by default; --prompt makes one CGI model request;
--console makes exactly one console submission to the configured fixed thread.
"""
import argparse,asyncio,hashlib,hmac,json,os,ssl,time
import aiohttp
from websockets.asyncio.client import connect

ORIGIN=os.environ.get('NETWORK_TEST_ORIGIN','https://mygw.nekomaneki.work')
BASE=os.environ.get('NETWORK_TEST_BASE',ORIGIN)
SECRET=(os.environ.get('ORIGIN_HMAC_SECRET','').strip() or os.environ.get('HMAC_SECRET','').strip()).encode()
CTX=ssl._create_unverified_context() if BASE.startswith('https://127.') else ssl.create_default_context()
PREFIX='/lib/api/chat/'

def headers(method,path,body=b''):
 ts=str(int(time.time()));canonical=f'{method}\n{path}\n{ts}\n{hashlib.sha256(body).hexdigest()}'
 return {'Origin':ORIGIN,'User-Agent':'lib-network-acceptance/1','Content-Type':'application/json',
         'X-Timestamp':ts,'X-Signature':hmac.new(SECRET,canonical.encode(),hashlib.sha256).hexdigest()}

async def request(s,method,path,data=None,signed=True,extra=None):
 body=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode() if data is not None else b''
 hdr=headers(method,path,body) if signed else {'Origin':ORIGIN,'Content-Type':'application/json','User-Agent':'lib-network-acceptance/1'}
 hdr.update(extra or {})
 async with s.request(method,BASE+path,data=body,headers=hdr,ssl=CTX) as r:
  return r.status,await r.json(content_type=None)

async def snapshot(s,protocol='ndjson',timeout=20):
 path=PREFIX+protocol;body=b'{"type":"observe"}'
 async with s.post(BASE+path,data=body,headers=headers('POST',path,body),ssl=CTX) as r:
  assert r.status==200,f'{protocol} HTTP {r.status}'
  async with asyncio.timeout(timeout):
   async for line in r.content:
    raw=line.decode().strip()
    if protocol=='sse':
     if not raw.startswith('data: '): continue
     raw=raw[6:]
    raw=raw.lstrip('\x1e')
    if not raw:continue
    event=json.loads(raw)
    assert event.get('type')!='error',event.get('error')
    if event.get('type')=='conversation':
     assert event.get('messages'),'empty conversation'
     return event
 raise AssertionError('no conversation event')

async def main(args):
 assert SECRET,'existing signing ENV missing'
 async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=120)) as s:
  if args.prompt:
   marker='NETWORK_PROMPT_OK_20261105'
   status,data=await request(s,'POST','/lib/api/tunnels.rb',{'message':f'codex_prompt=“{marker} とだけ返答してください”'})
   while status==200 and data.get('ask_status') in ('pending','running'):
    await asyncio.sleep(2)
    status,data=await request(s,'GET','/lib/api/tunnels.rb?ask_id='+data['ask_id'])
   assert status==200 and data.get('ask_status')=='done' and data.get('reply','').strip()==marker, f'prompt HTTP={status} state={data.get("ask_status")} error={data.get("ask_error")}'
   print('PASS quoted codex_prompt: done and exact real assistant reply',flush=True)
   return
  if args.console:
   status,data=await request(s,'POST',PREFIX+'console-session',{'type':'console','ttl_seconds':900})
   assert status==200 and data.get('token'),'console permission failed'
   token=data['token'];marker='STREAM_POST_OK_20261105'
   status,data=await request(s,'POST',PREFIX+'console',{'prompt':marker+' とだけ返答してください'},signed=False,extra={'Authorization':'Bearer '+token})
   print(f'Console submission HTTP={status}, accepted={data.get("accepted",False)}, error={data.get("error", "none")}',flush=True)
   assert status==200 and data.get('accepted') is True,'console not accepted'
   async with asyncio.timeout(100):
    while True:
     snap=await snapshot(s)
     if any(m.get('role')=='assistant' and m.get('text','').strip()==marker for m in snap['messages']):break
     await asyncio.sleep(2)
   await request(s,'DELETE',PREFIX+'console-session',signed=False,extra={'Authorization':'Bearer '+token})
   print('PASS console post: exact assistant response observed from same fixed thread',flush=True)
   return
  status,data=await request(s,'GET','/lib/api/tunnels.rb')
  assert status==200 and isinstance(data,dict)
  print(f'API HTTP={status}, auth={data.get("auth")}, tunnels={len(data.get("tunnels",[]))}, error={data.get("error")}',flush=True)
  status,data=await request(s,'POST','/lib/api/tunnels.rb',{'message':'codex_prompt="unauthorized-must-not-run"'},signed=False)
  assert status in (401,403),'unsigned AI input accepted'
  print('PASS unsigned model request rejected',flush=True)
  for protocol in ('sse','ndjson','jsonseq'):
   await snapshot(s,protocol)
   print('PASS '+protocol+': signed real conversation event',flush=True)
  path=PREFIX+'ws';url=BASE.replace('https://','wss://').replace('http://','ws://')+path
  async with connect(url,origin=ORIGIN,ssl=CTX if url.startswith('wss:') else None,additional_headers={'User-Agent':'lib-network-acceptance/1'},max_size=1048576) as ws:
   challenge=json.loads(await ws.recv());nonce=challenge['nonce']
   await ws.send(json.dumps({'type':'auth','signature':hmac.new(SECRET,f'WS\n{path}\n{nonce}'.encode(),hashlib.sha256).hexdigest()}))
   assert json.loads(await ws.recv())['type']=='authenticated'
   await ws.send('{"type":"observe"}')
   async with asyncio.timeout(20):
    while True:
     event=json.loads(await ws.recv())
     assert event.get('type')!='error',event.get('error')
     if event.get('type')=='conversation':
      assert event.get('messages');break
  print('PASS websocket: challenge authentication and real conversation event',flush=True)

if __name__=='__main__':
 p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group();g.add_argument('--prompt',action='store_true');g.add_argument('--console',action='store_true')
 asyncio.run(main(p.parse_args()))
