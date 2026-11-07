// /muse-statusの実ブラウザ確認。本体コンテナが停止中の応答を返し、「Tailscaleへ接続」で公式のTailscale WASMが
// ページのCSPの下で読み込まれ、ログインの手前まで進むことを確かめる。外部への通信は遮断するので、実tailnetへの参加は確かめない。
// 実行: node scripts/check-muse-status-browser.mjs  (Chromeの場所はCHROME_PATH、既定は/usr/bin/google-chrome)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import assert from 'node:assert/strict';

const result = await build({ entryPoints: ['src/views/museStatus.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { getMuseStatusPage, MUSE_STATUS_CSP } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const stopped = { containerRunning: false, backendState: null, error: 'container_not_running', checkedAt: new Date().toISOString(), nodes: ['muse', 'muse-vm'].map((name) => ({ name, found: false })) };
const json = (res, body) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
const assets = ['/tailscale-wasm-client.mjs', '/tailscale-connect/1.102.3-3/pkg.js', '/tailscale-connect/1.102.3-3/main.wasm.gz'];
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Security-Policy', MUSE_STATUS_CSP); res.end(getMuseStatusPage()); return; }
    if (path === '/api/muse-status') return json(res, stopped);
    if (path === '/api/muse-status/signal') return json(res, { node: 'muse-vm', code: 'container_not_running', latencyMs: null, checkedAt: new Date().toISOString(), detail: null });
    if (path === '/api/muse-status/nix') return json(res, { node: 'muse-vm', state: 'container_not_running', packages: [], total: 0, truncated: false, generatedAt: null });
    if (!assets.includes(path)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', path.endsWith('.gz') ? 'application/gzip' : 'text/javascript');
    res.end(await readFile('public' + path));
  } catch { res.statusCode = 500; res.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  const cspViolations = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (/Content Security Policy/i.test(message.text())) cspViolations.push(message.text()); });
  await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => document.getElementById('muse-source')?.textContent === 'なし');
  assert.match(await page.locator('#muse-notice').textContent(), /Tailscaleへ接続/);
  assert.equal(await page.locator('[data-node="muse-vm"] [data-field="online"]').textContent(), '確認できません');
  await page.click('#muse-wasm-connect');
  // WASMの読み込み・createIPN・run・loginが例外なく進めば、notifyStateで「Tailscale: …」になる
  await page.waitForFunction(() => /^Tailscale: /.test(document.getElementById('muse-wasm-state')?.textContent ?? '') || /失敗/.test(document.getElementById('muse-wasm-state')?.textContent ?? ''), null, { timeout: 60_000 });
  const state = await page.locator('#muse-wasm-state').textContent();
  assert.match(state, /^Tailscale: /, `WASMの初期化に失敗: ${state}`);
  assert.deepEqual(errors, []);
  assert.deepEqual(cspViolations, []);
  console.log(`Browser: /muse-status loaded the official Tailscale WASM under its CSP (${state}); external network blocked, tailnet login not attempted.`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
