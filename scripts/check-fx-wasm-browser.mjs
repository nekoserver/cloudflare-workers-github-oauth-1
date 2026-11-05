import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { getFxWasmPage } from '../src/views/fxWasm.ts';
import assert from 'node:assert/strict';

const publicRoot = resolve('public');
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/fx-wasm') {
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://ai-gateway.vercel.sh; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
      res.setHeader('Content-Type', 'text/html'); res.end(getFxWasmPage()); return;
    }
    const file = resolve(publicRoot, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(publicRoot + '/')) { res.writeHead(403).end(); return; }
    const type = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm' }[extname(file)] || 'text/plain';
    res.setHeader('Content-Type', type); res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    if (!route.request().url().startsWith('http://127.0.0.1:')) { external.push(new URL(route.request().url()).origin); await route.abort(); }
    else await route.continue();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/fx-wasm`);
  assert.match(await page.locator('#runtime').innerText(), /対応しています/);
  await page.locator('#run').click();
  await page.waitForFunction(() => /完了|実行できません/.test(document.querySelector('#status').textContent), null, { timeout: 30000 });
  const status = await page.locator('#status').innerText();
  const output = await page.locator('#output').innerText();
  assert.equal(status, '完了（模擬モデル）');
  assert.match(output, /FX_WASM_DEMO_OK/);
  assert.match(await page.locator('#workspace').inputValue(), /こんにちは/);
  assert.match(await page.locator('#events').innerText(), /read_file/);
  assert.match(await page.locator('#events').innerText(), /write_file/);
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  await page.locator('#reset').click();
  assert.match(await page.locator('#workspace').inputValue(), /Hello/);
  await page.locator('#mode').selectOption('gateway');
  await page.locator('#run').click();
  assert.match(await page.locator('#status').innerText(), /モデルIDと自分のAPIキー/);
  await page.locator('#api-key').fill('test-only-key');
  await page.locator('#mode').selectOption('demo');
  assert.equal(await page.locator('#api-key').inputValue(), '');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  // Fail closed before creating an engine when JSPI is absent.
  await page.addInitScript(() => { Object.defineProperty(WebAssembly, 'Suspending', { value: undefined }); });
  await page.reload();
  assert.match(await page.locator('#runtime').innerText(), /非対応/);
  assert.equal(await page.locator('#run').isDisabled(), true);
  console.log(JSON.stringify({ wasm: 'official libfx 0.0.16', status, fileEdited: true, externalRequests: external.length, pageErrors: errors.length, reset: true, unsupportedBrowser: true }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
