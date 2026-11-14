import asyncio,json,re,sys
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent
async def main():
 html=(ROOT/'page.html').read_text()
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
  for width,height in [(1440,1000),(390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   async def route(r):
    if r.request.url=='https://preview.test/aichat':await r.fulfill(content_type='text/html',body=html)
    else:await r.fulfill(content_type='application/json',body='{"results":[],"keywords":[],"jobs":[],"models":[]}')
   await page.route('**/*',route)
   await page.goto('https://preview.test/aichat')
   await page.evaluate('''() => showHistoryModal({id:'width-test',user_hash:'fixture',question:'短い質問',answer:'短い回答',model:'test',created_at:'2026-11-13T00:00:00Z'}, '')''')
   async def sizes():return await page.evaluate('''() => { const b=document.querySelector('#historyModalChat .assistant'),c=document.getElementById('historyModalChat'),m=document.querySelector('.history-modal'); const s=getComputedStyle(c); return {modal:m.getBoundingClientRect().width,body:b.getBoundingClientRect().width,available:c.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),overflow:c.scrollWidth>c.clientWidth}; }''')
   before=await sizes()
   await page.locator('#historyModalFullscreenBtn').click()
   full=await sizes()
   await page.locator('#historyModalFullscreenBtn').click()
   restored=await sizes()
   print(json.dumps({'viewport':width,'before':before,'fullscreen':full,'restored':restored,'errors':errors},ensure_ascii=False),flush=True)
   assert abs(full['modal']-width)<1
   assert abs(full['body']-full['available'])<1,'fullscreen body does not use available width'
   assert not full['overflow']
   assert abs(restored['body']-before['body'])<1
   await page.close()
  await browser.close()
asyncio.run(main())
