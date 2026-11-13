import asyncio,contextlib,json,os,ssl,sys
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0,'/root/cf-container/ops/test')
from network_single_thread_post import queue_list
MARKER='STREAM_POST_OK_20261113'
PROMPT='ストリームパネルの同一会話投稿テストです。この投稿を実際に受信したら '+MARKER+' と返答し、元のネットワーク設定作業を継続してください。'
async def forward(reader,writer):
 upstream=None
 try:
  ur,upstream=await asyncio.open_connection('127.0.0.1',8445)
  async def pipe(r,w):
   while data:=await r.read(65536):w.write(data);await w.drain()
  tasks=[asyncio.create_task(pipe(reader,upstream)),asyncio.create_task(pipe(ur,writer))]
  await asyncio.wait(tasks,return_when=asyncio.FIRST_COMPLETED)
  for task in tasks:task.cancel()
 except (ConnectionError,asyncio.CancelledError):pass
 finally:
  writer.close()
  if upstream:upstream.close()
async def main():
 secret=os.environ['ORIGIN_HMAC_SECRET']
 ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);ctx.load_cert_chain('/etc/apache2/tls/nekoroot.crt','/etc/apache2/tls/nekoroot.key')
 server=await asyncio.start_server(forward,'127.0.0.1',9445,ssl=ctx)
 async with server,async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--no-proxy-server','--host-resolver-rules=MAP mygw.nekomaneki.work 127.0.0.1:9445'])
  context=await browser.new_context(ignore_https_errors=True)
  page=await context.new_page()
  await page.route('https://mygw.nekomaneki.work/network-test-parent',lambda route:route.fulfill(content_type='text/html',body='''<!doctype html><iframe id="chat" style="width:100%;height:900px" src="/lib/conversation-embed.html"></iframe><script>setInterval(()=>document.querySelector('iframe').contentWindow.postMessage({type:'conversation-controls',observationControls:'embed',consoleTtlSeconds:900},location.origin),500)</script>'''))
  await page.goto('https://mygw.nekomaneki.work/network-test-parent')
  frame=page.frame_locator('#chat')
  await frame.locator('#key').fill(secret)
  await frame.locator('#login button').click()
  await frame.locator('#form').wait_for(timeout=30000)
  if await frame.locator('#secret').is_visible():await frame.locator('#secret').fill(secret)
  # Authenticated embed starts observation automatically.
  await frame.locator('#conversation').wait_for(state='visible',timeout=30000)
  await frame.locator('#console-section').wait_for(state='visible',timeout=30000)
  print('PASS Chrome real gated panel: HMAC login, current conversation render, console form visible',flush=True)
  await frame.locator('#console-key').fill(secret)
  await frame.locator('#console-prompt').fill(PROMPT)
  async with page.expect_response(lambda r:r.url.endswith('/lib/api/chat/console') and r.request.method=='POST',timeout=30000) as response:
   await frame.locator('#console-send').click()
  res=await response.value;data=await res.json()
  print(json.dumps({'console_http':res.status,'accepted':data.get('accepted'),'queued':data.get('queued'),'error':data.get('error')},ensure_ascii=False),flush=True)
  assert res.status==200 and data.get('accepted') is True
  if data.get('queued'):
   queue=await queue_list();match=[x for x in queue['data'] if any(i.get('text')==PROMPT for i in x.get('input',[]))]
   assert len(match)==1
   print('PASS exactly one matching native queue entry in current ENV thread; assistant response pending',flush=True)
  else:
   print('Accepted direct turn; assistant response requires observer follow-up',flush=True)
  await frame.locator('#console-revoke').click()
  await context.close();await browser.close()
asyncio.run(main())
