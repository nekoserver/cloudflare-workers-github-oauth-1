// 本体ワーカーと同じ公式Tailscale WASM(public/tailscale-connect)で実際にtailnetへ参加し、muse-vmの/healthへ届くかを確かめる。
// 2026-11-08にこの手順で、名前(muse-vm)とIPの両方から200 {"status": "ok"}が返ることを確かめた。
// check-muse-status-browser.mjsは外部への通信を遮断してログインの手前までを見る。こちらは実tailnetへの参加まで行う。
//
// 実行: node scripts/check-muse-vm-wasm-live.mjs
//   - ログイン用のURLを表示するので、tailnetの持ち主が承認する。承認されるまで最大WAIT_MINUTES分(既定25)待つ。
//   - 承認すると「muse-wasm-check」という端末がtailnetに増える。終わったら管理画面で消す(使い捨てかは未確認)。
//   - KEEP_SECONDS(既定0)を指定すると、その秒数のあいだ接続を保ち、INTERVAL_SECONDS(既定30)ごとに/healthを送り続ける。
//   - Chromeの場所はCHROME_PATH(既定/usr/bin/google-chrome)。HTTPS_PROXYがあればChromeにも使わせる。
//   - プロキシがTLSを中継する環境では、そのCAをChromeの証明書ストア(~/.pki/nssdb)に入れておく。証明書の検証は無効にしない。
// 終了コード: 0=すべて200、1=届かない宛先があった、2=参加できなかった。
// 確かめるのは到達性だけで、Museへの推論は送らない(WASMのfetchはGETだけでヘッダーを付けられない)。
import { TAILSCALE_WASM_ROOT } from '../public/tailscale-wasm-client.mjs';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const WAIT_MS = Number(process.env.WAIT_MINUTES || 25) * 60_000;
const KEEP_MS = Number(process.env.KEEP_SECONDS || 0) * 1000;
const INTERVAL_MS = Number(process.env.INTERVAL_SECONDS || 30) * 1000;
const ASSETS = ['/tailscale-wasm-client.mjs', `${TAILSCALE_WASM_ROOT}/pkg.js`, `${TAILSCALE_WASM_ROOT}/main.wasm.gz`];
const log = (message) => console.log(`${new Date().toISOString()} ${message}`);

const PAGE = `<!doctype html><meta charset="utf-8"><body><script type="module">
import { loadTailscaleClient } from '/tailscale-wasm-client.mjs';
const memory = {};
const ipn = await loadTailscaleClient({ authKey: '', hostname: 'muse-wasm-check', stateStorage: { getState: (k) => memory[k] ?? '', setState: (k, v) => { memory[k] = v; } }, panicHandler: (e) => window.report('panic ' + e) });
window.ipn = ipn;
ipn.run({
  notifyState: (s) => window.report('state ' + s),
  notifyNetMap: (v) => { try { window.report('netmap ' + JSON.stringify((JSON.parse(v).peers || []).map((p) => ({ name: p.name, addresses: p.addresses, online: p.online })))); } catch (e) { window.report('netmap-error ' + e); } },
  notifyBrowseToURL: (u) => window.report('login ' + u),
  notifyPanicRecover: (e) => window.report('panic ' + e),
});
ipn.login();
</script>`;

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    if (path === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(PAGE); return; }
    if (!ASSETS.includes(path)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', path.endsWith('.gz') ? 'application/gzip' : 'text/javascript');
    res.end(await readFile('public' + path));
  } catch { res.statusCode = 500; res.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const args = ['--no-sandbox'];
if (process.env.HTTPS_PROXY) {
  const proxy = new URL(process.env.HTTPS_PROXY);
  args.push(`--proxy-server=${proxy.protocol}//${proxy.host}`, '--proxy-bypass-list=127.0.0.1');
}
let browser;
let exitCode = 2;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args });
  const page = await browser.newPage();
  let state = '';
  let museIp = '';
  await page.exposeFunction('report', (message) => {
    if (message.startsWith('state ')) { state = message.slice(6); log(`Tailscale: ${state}`); }
    else if (message.startsWith('login ')) log(`ログインURL(承認してください): ${message.slice(6)}`);
    else if (message.startsWith('netmap ')) {
      try {
        const vm = JSON.parse(message.slice(7)).find((p) => String(p.name).split('.')[0] === 'muse-vm');
        museIp = vm?.addresses?.find((a) => a.includes('.'))?.split('/')[0] || museIp;
        log(`netmap: muse-vm ${vm ? `${museIp || '(IPv4なし)'} online=${vm.online}` : 'なし'}`);
      } catch { log('netmapを読めませんでした'); }
    } else log(message);
  });
  page.on('pageerror', (error) => log(`pageerror ${error.message}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);

  const deadline = Date.now() + WAIT_MS;
  while (state !== 'Running' && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 1000));
  if (state !== 'Running') throw new Error(`参加できませんでした(状態: ${state || 'なし'})`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const checkAll = async () => {
    let allOk = true;
    for (const url of ['http://muse-vm:8080/health', ...(museIp ? [`http://${museIp}:8080/health`] : [])]) {
      const started = Date.now();
      const result = await page.evaluate(async (target) => {
        try {
          const res = await Promise.race([window.ipn.fetch(target), new Promise((_, reject) => setTimeout(() => reject(new Error('時間切れ(20秒)')), 20_000))]);
          return { status: res.status, body: (await res.text()).slice(0, 300) };
        } catch (error) { return { error: String(error) }; }
      }, url);
      if (result.status !== 200) allOk = false;
      log(`${url} ${Date.now() - started}ms ${JSON.stringify(result)}`);
    }
    return allOk;
  };
  let ok = await checkAll();
  const keepUntil = Date.now() + KEEP_MS;
  while (Date.now() + INTERVAL_MS <= keepUntil) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    ok = (await checkAll()) && ok;
  }
  exitCode = ok ? 0 : 1;
  log(ok ? 'OK: すべての宛先から200が返りました' : 'NG: 届かない宛先がありました');
} catch (error) {
  log(`NG: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
process.exit(exitCode);
