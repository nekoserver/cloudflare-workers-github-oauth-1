import asyncio,functools,http.server,json,threading,shutil
from pathlib import Path
from playwright.async_api import async_playwright
root=Path('/tmp/rust-wasm-smoke-20261113')
shutil.copy2('/tmp/rust-wasm-smoke-cases-20261113.mjs',root/'cases.mjs')
(root/'index.html').write_text('''<!doctype html><script type="module">
import {checks} from './cases.mjs';
try {window.passed=[];for(const [name,check] of Object.entries(checks)){const m=await import('./'+name+'.mjs');await m.default({module_or_path:'./'+name+'_bg.wasm'});check(m);window.passed.push(name);}window.finished=true;}catch(e){window.failure=String(e);window.finished=true;}
</script>''')
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',18779),functools.partial(Handler,directory=str(root)))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
  page=await browser.new_page();await page.goto('http://127.0.0.1:18779/')
  await page.wait_for_function('window.finished===true')
  result=await page.evaluate('({passed:window.passed,error:window.failure||null})')
  print(json.dumps(result),flush=True)
  assert result['error'] is None and len(result['passed'])==9
  await browser.close()
try:asyncio.run(main())
finally:server.shutdown();server.server_close()
