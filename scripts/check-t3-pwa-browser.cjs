'use strict';
// Uses the running loopback T3, creates only read-only diagnostic sessions,
// never calls a model, and revokes every diagnostic session in finally.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const execute=promisify(execFile);
const {chromium,webkit}=require(require.resolve('playwright',{paths:[path.dirname(__dirname),'/root/dynamicneko']}));
const {createPwaAuth}=require('../containers/demo/t3-pwa-auth.cjs');
const {createServer}=require('../containers/demo/t3-embed-proxy.cjs');
const net=require('node:net'),originalConnect=net.connect;
net.connect=function(...args){const socket=originalConnect.apply(this,args);if(args[0]===3773)socket.once('data',chunk=>console.log('Diagnostic upstream upgrade:',chunk.toString().split('\r\n')[0]));return socket;};
const binary='/root/.t3/runtime/versions/0.1.3/t3';
const usePublic=process.env.T3_PWA_PUBLIC==='1';
const mode=process.env.T3_PWA_MODE||'iframe';
const standalone=mode!=='iframe';
const ownerLabel='pwa-browser-check-'+crypto.randomBytes(6).toString('hex');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'t3-pwa-browser-'));
let app,proxy,parent,browser;const handoffIds=new Set();
async function command(args){return(await execute(binary,args,{timeout:30000,maxBuffer:1024*1024})).stdout;}
const listen=(server,port)=>new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
(async()=>{
 try{
  const pairing=JSON.parse(await command(['auth','pairing','create','--scope','orchestration:read','--scope','diagnostics:read','--scope','access:write','--ttl','5m','--label',ownerLabel,'--json']));
  const exchange=await fetch('http://127.0.0.1:3773/api/auth/browser-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:pairing.credential})});
  assert.equal(exchange.status,200);
  const cookie=exchange.headers.get('set-cookie').split(';')[0],split=cookie.indexOf('=');
  const useWebkit=process.env.T3_PWA_BROWSER==='webkit';
  const origin=usePublic?'https://t3.nekomaneki.work':'http://localhost:4174';
  if(!usePublic){
  app=createPwaAuth({dbPath:path.join(temp,'state.sqlite'),origin,readConfig:()=>({enabled:true,developmentOnly:true,generation:'browser-check'})});
  proxy=createServer(app);proxy.on('upgrade',req=>console.log('Diagnostic proxy upgrade origin:',req.headers.origin,'host:',req.headers.host));await new Promise(resolve=>proxy.listen(4174,resolve));
  parent=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html','Permissions-Policy':'local-network-access=(self "http://localhost:4174")'});res.end('<!doctype html><title>PWA embed test</title><iframe title="T3" src="http://localhost:4174/" allow="local-network-access" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>');});await listen(parent,4173);
  
  }
  browser=await (useWebkit?webkit.launch():chromium.launch({executablePath:process.env.CHROME_PATH||'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']}));
  const owner=await browser.newContext();if(!useWebkit&&!usePublic)await owner.grantPermissions(['local-network-access']);await owner.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin,secure:usePublic,httpOnly:true,sameSite:'Lax'}]);
  const device=await browser.newContext();
  if(standalone)await device.addInitScript(mode=>{if(mode==='ios-standalone')Object.defineProperty(navigator,'standalone',{value:true});else{const media=window.matchMedia.bind(window);window.matchMedia=query=>query==='(display-mode: standalone)'?{matches:true,media:query,addEventListener(){},removeEventListener(){}}:media(query);}},mode);
  await device.addInitScript(()=>{
   const Native=window.WebSocket;window.__t3PwaSocketEvidence={opened:0,messages:0,errors:0};
   class ObservedSocket extends Native{constructor(...args){super(...args);this.addEventListener('open',()=>window.__t3PwaSocketEvidence.opened++);this.addEventListener('message',()=>window.__t3PwaSocketEvidence.messages++);this.addEventListener('error',()=>window.__t3PwaSocketEvidence.errors++);}}
   window.WebSocket=ObservedSocket;
  });if(!useWebkit&&!usePublic)await device.grantPermissions(['local-network-access']);
  await device.route('**/*',async route=>{
   if(usePublic&&new URL(route.request().url()).origin==='https://dynamicneko.nekoflare.workers.dev'){
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>PWA public embed test</title><iframe title="T3" src="'+origin+'/" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>'});return;
   }
   const headers=await route.request().allHeaders();delete headers.cookie;
   const response=await route.fetch({headers}),next={...response.headers()};delete next['set-cookie'];
   await route.fulfill({response,headers:next});
  });
  const page=await device.newPage();let socketFrames=0,socketErrors=0,createRequests=0,verifiedResponses=0;
  page.on('request',request=>{if(new URL(request.url()).pathname==='/_t3/pwa/create'&&request.method()==='POST')createRequests++;});
  page.on('response',response=>{if(new URL(response.url()).pathname==='/_t3/pwa/verified'&&response.status()===200)verifiedResponses++;});
  page.on('response',response=>{if(response.status()>=400)console.log('Diagnostic HTTP:',response.status(),new URL(response.url()).pathname);});
  page.on('console',message=>{if(message.type()==='error')console.log('Diagnostic console:',message.text().replace(/(?:https?|wss?):\/\/[^\s'"]+/g,'[URL]').slice(0,250));});
  page.on('pageerror',error=>console.log('Diagnostic JS error:',error.message.slice(0,160)));
  page.on('websocket',socket=>{console.log('Diagnostic WebSocket host:',new URL(socket.url()).host,'path:',new URL(socket.url()).pathname,'ticket:',new URL(socket.url()).searchParams.has('wsTicket'));socket.on('framereceived',()=>socketFrames++);socket.on('socketerror',()=>{socketErrors++;console.log('Diagnostic socket error');});});
  await page.goto(standalone?origin+'/':usePublic?'https://dynamicneko.nekoflare.workers.dev/tree-view':'http://127.0.0.1:4173/');
  const frame=standalone?page.mainFrame():page.frame({url:origin+'/'});assert.ok(frame);
  await frame.getByRole('heading',{name:'開発用PWAのT3に接続',exact:true}).waitFor({timeout:45000});
  const approval=frame.getByRole('link',{name:'ログイン済みの別タブで承認する'});await approval.waitFor({timeout:30000});
  const href=await approval.getAttribute('href'),code=await frame.locator('.comparison-code').innerText();handoffIds.add(href.split('/').pop());
  assert.ok(code.match(/[A-F0-9]{8}/));
  const approvalPage=await owner.newPage();await approvalPage.goto(origin+href);
  await approvalPage.getByRole('button',{name:'このPWAを承認',exact:true}).waitFor({timeout:30000});
  assert.equal(await approvalPage.locator('.comparison-code').innerText(),code);
  await approvalPage.getByRole('button',{name:'このPWAを承認',exact:true}).click();
  await approvalPage.getByText('承認しました。PWAへ戻ってください。',{exact:true}).waitFor();
  await page.bringToFront();
  await frame.locator('#pwa-connect').waitFor({state:'detached',timeout:60000});
  await frame.waitForFunction(()=>window.__t3PwaSocketEvidence?.messages>0,null,{timeout:30000});
  await frame.waitForFunction(async()=>{const r=await fetch('/api/auth/session');return(await r.json()).authenticated===true;},{timeout:15000});
  if(!socketFrames)console.log('Diagnostic state:',{socketErrors,overlay:await frame.locator('#pwa-connect').count(),hasBearer:await frame.evaluate(()=>Boolean(localStorage.getItem('t3:pwa-native-session:v1'))),pairing:(await frame.locator('body').innerText()).includes('Pairing token'),stillConnecting:(await frame.locator('body').innerText()).includes('Still connecting')});
  const applicationEvidence=await frame.evaluate(()=>window.__t3PwaSocketEvidence);assert.ok(applicationEvidence.messages>0,'Native WebSocket must deliver application messages');console.log('Application WebSocket messages received:',applicationEvidence.messages);assert.equal(socketErrors,0);
  await frame.waitForFunction(()=>!document.getElementById('boot-shell')&&Boolean(document.getElementById('root')?.textContent.trim())&&!document.getElementById('root').textContent.includes('Still connecting'),null,{timeout:30000});
  await frame.locator('body').screenshot({path:'/var/log/t3-setup/pwa-native-ui-'+(useWebkit?'webkit':'chromium')+'.png'});
  assert.equal((await device.cookies()).length,0,'The device must authenticate without any browser Cookie');
  if(app)assert.equal(app.db.prepare('SELECT count(*) n FROM sessions WHERE first_verified IS NOT NULL').get().n,1);
  assert.ok(verifiedResponses>=1,'Server must confirm the native session verification record');
  assert.equal(createRequests,1);
  if(process.env.T3_PWA_DERIVED==='1'){
   await frame.evaluate(()=>{window.__sourceDocumentKept=true;});
   await page.evaluate(origin=>{const box=document.createElement('section');box.id='derived-test-window';const child=document.createElement('iframe');child.src=origin+'/';child.referrerPolicy='no-referrer';child.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');box.append(child);document.body.append(box);},origin);
   let child;for(let count=0;count<100;count++){child=page.frames().find(candidate=>candidate!==frame&&candidate.url()===origin+'/');if(child)break;await new Promise(resolve=>setTimeout(resolve,100));}
   assert.ok(child,'Derived iframe must load');
   await child.waitForFunction(()=>window.__t3PwaSocketEvidence?.messages>0,null,{timeout:30000});
   assert.equal(await child.locator('#pwa-connect').count(),0,'Derived iframe must reuse the existing session');
   assert.equal(createRequests,1,'Derived window must not create a second approval');
   assert.equal(await frame.evaluate(()=>window.__sourceDocumentKept),true,'The authenticated source document must remain alive');
   await page.evaluate(()=>document.getElementById('derived-test-window').remove());
   assert.equal(await frame.evaluate(()=>window.__sourceDocumentKept),true);
   console.log('PASS: derived iframe reused native authentication; no second approval; original document retained.');
  }
  const firstFrames=socketFrames;
  await page.reload();const restored=standalone?page.mainFrame():page.frame({url:origin+'/'});
  await restored.waitForFunction(()=>window.__t3PwaSocketEvidence?.messages>0,null,{timeout:30000});
  assert.equal(await restored.locator('#pwa-connect').count(),0);
  assert.equal(createRequests,1,'Reload must reuse the PWA token');
  assert.ok((await restored.evaluate(()=>window.__t3PwaSocketEvidence.messages))>0,'Reload must reconnect native WebSocket');
  await restored.waitForFunction(()=>!document.getElementById('boot-shell')&&Boolean(document.getElementById('root')?.textContent.trim()),null,{timeout:30000});
  const nativeOwnerPage=await owner.newPage();await nativeOwnerPage.goto(origin+'/');
  const ownerState=await nativeOwnerPage.evaluate(async()=>{const r=await fetch('/api/auth/session');const d=await r.json();return{authenticated:d.authenticated,method:d.sessionMethod};});
  assert.deepEqual(ownerState,{authenticated:true,method:'browser-session-cookie'},'The original owner browser login must remain valid');
  await nativeOwnerPage.waitForFunction(()=>!document.getElementById('boot-shell')&&Boolean(document.getElementById('root')?.textContent.trim()),null,{timeout:30000});
  assert.equal((await device.cookies()).length,0);
  console.log('PASS mode='+mode+': all Cookies removed, explicit approval, native bearer verification, real native UI/WebSocket, reload without a second handoff.');
 }finally{
  if(browser)await browser.close();
  const all=JSON.parse(await command(['auth','session','list','--json']));
  const ids=new Set(all.filter(s=>s.client?.label===ownerLabel||[...handoffIds].some(id=>s.client?.label==='tree-view-pwa:'+id)).map(s=>s.sessionId));
  if(app){for(const s of app.db.prepare('SELECT id FROM sessions').all())ids.add(s.id);const labels=new Set(app.db.prepare('SELECT id FROM handoffs').all().map(r=>'tree-view-pwa:'+r.id));for(const s of all)if(labels.has(s.client?.label))ids.add(s.sessionId);}
  for(const id of ids)await command(['auth','session','revoke',id]);
  console.log('Isolated diagnostic sessions revoked:',ids.size);
  if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}
  if(parent){parent.closeAllConnections();await new Promise(r=>parent.close(r));}
  if(app)app.close();
  fs.rmSync(temp,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
