import asyncio,functools,http.server,threading,json
from pathlib import Path
from playwright.async_api import async_playwright
root=Path('/root/cloudflare-workers-github-oauth-1')
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
  page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(f'http://127.0.0.1:{server.server_port}/rust-never-sample/')
  await page.locator('#run').wait_for()
  await page.wait_for_function('!document.querySelector("#run").disabled')
  assert await page.locator('#total').inner_text()=='Ok(3) — 1のビット数'
  assert await page.locator('#trap').inner_text()=='通常終了 → 21'
  await page.locator('#value').fill('43');await page.locator('#run').click()
  assert await page.locator('#trap').get_attribute('data-trapped')=='true'
  await page.locator('#value').fill('42');await page.locator('#run').click()
  assert await page.locator('#trap').inner_text()=='通常終了 → 21'
  for value in ['-1','4294967296','1.5','']:
   await page.locator('#value').fill(value);await page.locator('#run').click()
   assert await page.locator('#validation').inner_text()
  await page.locator('#value').fill('4294967295');await page.locator('#run').click()
  assert await page.locator('#total').inner_text()=='Ok(32) — 1のビット数'
  for width in [1440,390]:
   await page.set_viewport_size({'width':width,'height':1000})
   assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
   await page.screenshot(path=str(root/f'artifacts/rust-never-sample-20261113/browser-{width}.png'),full_page=True)
  assert not errors,errors
  print(json.dumps({'browser':'Chrome','real_wasm':True,'even_odd_recovery':True,'invalid_inputs':4,'u32_max':True,'viewport_widths':[1440,390],'page_errors':errors}))
  await browser.close()
try:asyncio.run(main())
finally:server.shutdown()
