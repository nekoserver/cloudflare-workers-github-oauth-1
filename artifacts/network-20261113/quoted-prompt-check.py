import asyncio,json,os,sys,time,subprocess,importlib.util
from pathlib import Path
sys.path.insert(0,'/root/cf-container/ops/test')
import network_live_test as t
sys.path.insert(0,'/var/www/html/lib/ops');import llm_worker
llm_worker.WORKSPACE='/var/www/html/lib'
auth=subprocess.run(llm_worker.command('claude')[:-1]+['/opt/claude-web/claude','auth','status'],capture_output=True,timeout=30)
print(json.dumps({'claude_auth_exit':auth.returncode}),flush=True)
async def test(engine,s):
 marker=engine.upper()+'_QUOTED_OK_20261113'
 status,data=await t.request(s,'POST','/lib/api/tunnels.rb',{'message':engine+'_prompt=“'+marker+' とだけ返答してください”'})
 deadline=time.monotonic()+340
 while status==200 and data.get('ask_status') in ('pending','running') and time.monotonic()<deadline:
  await asyncio.sleep(2)
  status,data=await t.request(s,'GET','/lib/api/tunnels.rb?ask_id='+data['ask_id'])
 print(json.dumps({'engine':engine,'http':status,'ask_status':data.get('ask_status'),'error':data.get('ask_error') or data.get('error'),'exact_reply':data.get('reply','').strip()==marker},ensure_ascii=False),flush=True)
async def main():
 async with t.aiohttp.ClientSession(timeout=t.aiohttp.ClientTimeout(total=120)) as s:
  for engine in ['codex','claude','muse','nemotron']:
   if engine=='claude' and auth.returncode!=0:
    print('SKIP Claude inference: dedicated user authentication failed',flush=True);continue
   await test(engine,s)
asyncio.run(main())
