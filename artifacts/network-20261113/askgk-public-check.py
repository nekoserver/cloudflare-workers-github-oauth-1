import asyncio,json,sys,time
from pathlib import Path
sys.path.insert(0,'/root/cf-container/ops/test');import network_live_test as t
async def main():
 async with t.aiohttp.ClientSession(timeout=t.aiohttp.ClientTimeout(total=60)) as s:
  path='/lib/api/tunnels'
  async with s.post(t.BASE+path,json={'command':'railway_uptime'},headers={'User-Agent':'askgk-public-check/1'}) as response:
   assert response.status==403
   print('PASS public unsigned POST rejected with HTTP403',flush=True)
  code,data=await t.request(s,'POST',path,{'command':'railway_uptime'})
  assert code==200 and 'uptime_seconds' in data
  print('PASS public signed POST HTTP200 with real uptime',flush=True)
  for engine in ['codex','muse']:
   marker=engine.upper()+'_ASKGK_PUBLIC_OK_20261113'
   code,data=await t.request(s,'POST',path,{'message':engine+'_prompt=“'+marker+' とだけ返答してください”','status':'healthy','format':'json','wait_seconds':0})
   ask_id=data.get('ask_id');deadline=time.monotonic()+340
   while code==200 and data.get('ask_status') in ['pending','running'] and time.monotonic()<deadline:
    await asyncio.sleep(1)
    code,data=await t.request(s,'POST',path,{'format':'json','ask_id':ask_id})
    assert data.get('ask_id')==ask_id
   result={'engine':engine,'http':code,'ask_status':data.get('ask_status'),'ask_error':data.get('ask_error'),'exact_reply':data.get('reply','').strip()==marker}
   print(json.dumps(result),flush=True)
   assert code==200 and result['ask_status']=='done' and result['exact_reply']
asyncio.run(main())
