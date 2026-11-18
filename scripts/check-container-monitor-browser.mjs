import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
const result = await build({ entryPoints: ['src/views/containerMonitor.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { getContainerMonitorPage } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const server = createServer(async (req, res) => {
 try {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(getContainerMonitorPage()); return; }
  if (req.url === '/api/container-monitor/providers') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ defaultProvider: 'tailscale-wasm', providers: [{ id: 'tailscale-wasm', label: 'Tailscale WASM', execution: 'browser', scope: 'visible peers' }] })); return; }
  if (req.url === '/favicon.ico') { res.statusCode = 204; res.end(); return; }
  const paths = ['/container-monitor.mjs', '/tailscale-wasm-client.mjs', '/tailscale-connect/1.102.3-3/pkg.js', '/tailscale-connect/1.102.3-3/main.wasm.gz'];
  if (!paths.includes(req.url)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', req.url.endsWith('.gz') ? 'application/gzip' : 'text/javascript');
  res.end(await readFile('public' + req.url));
 } catch { res.statusCode = 500; res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
 browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
 const page = await browser.newPage(); const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(() => document.querySelector('#monitor-provider').value === 'tailscale-wasm');
 assert.equal(await page.locator('#monitor-wasm-controls').isVisible(), true);
 const initialized = await page.evaluate(async () => {
  const { loadTailscaleClient } = await import('/container-monitor.mjs');
  const client = await loadTailscaleClient({ authKey: '', wasmURL: '/tailscale-connect/1.102.3-3/main.wasm.gz', panicHandler: () => {} });
  return { run: typeof client.run, login: typeof client.login, fetch: typeof client.fetch };
 });
 assert.deepEqual(initialized, { run: 'function', login: 'function', fetch: 'function' });
 assert.deepEqual(errors, []);
 console.log('Browser: token-free provider UI and official Tailscale WASM initialization passed; external network blocked.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
