// Real Chrome UI checks with simulated APIs; no tailnet enrollment or real posts.
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const bundle = await build({ entryPoints: ['src/views/tailscaleWasm.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { renderTailscaleWasmPage } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const server = createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.end(renderTailscaleWasmPage());
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(7000);
  page.setDefaultNavigationTimeout(7000);
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('PAGEERROR', error.message); });
  page.on('console', message => { if (/Content Security Policy/i.test(message.text())) errors.push(message.text()); });
  let state = 'Running', configured = true, gadgetReady = true, chatMode = 'success';
  let chatCalls = 0, toolsRunning = false, agentCalls = 0, taskCounter = 0;
  const taskResults = new Map();
  const requests = [];
  await page.route('**/api/tailscale-wasm/**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').pop();
    requests.push(action);
    let body;
    let status = 200;
    if (action === 'status') body = { state, peers: [], sdkTokenConfigured: configured, sdkTokenFormatValid: configured, loginURL: 'https://evil.example/login' };
    else if (action === 'bridge-health') body = { healthy: gadgetReady && configured && state === 'Running' };
    else if (action === 'container-status') body = { running: toolsRunning, agentsConfigured: true };
    else if (action === 't3-test') body = { ok: true, state: 'ready' };
    else if (action === 'agent-ask') { agentCalls++; body = { ok: true, reply: 'review answer' }; }
    else if (action === 'tasks') { const data = route.request().postDataJSON(); taskCounter++; const jobId = 'ui-job-' + taskCounter; if (data.action === 'bridge-chat') { chatCalls++; assert.equal(data.payload.prompt, '質問 “△”'); taskResults.set(jobId, chatMode === 'error' ? { ok: false, error: 'muse_connection_failed' } : { ok: true, reply: '<script>unsafe</script>' }); } else if (data.action === 'agent-ask') { agentCalls++; taskResults.set(jobId, { ok: true, reply: 'review answer' }); } body = { jobId }; status = 202; }
    else if (action === 'cost') body = { fetchedAt: '2026-11-08T22:00:00Z', periodStart: '2026-11-01', workerRequests: 2953, workerErrors: 0, doRequests: 2203, doDurationGBSeconds: 74047, paidPlanReference: { durationPercent: 18.51, additionalComputeEstimateUsd: 0, additionalRequestsEstimateUsd: 0 }, note: 'account-wide analytics, not invoice', daily: [{ date: '2026-11-08', durationGBSeconds: 7301 }] };
    else if (action === 'fleet') body = { fetchedAt: '2026-11-08', snapshot: { complete: true, targets: [{ group: 'app', name: 'container', status: 'stopped', observedAt: '2026-11-08' }] }, costs: { totals: { knownEstimateUsd: 1.2, unknownCostSessions: 1 }, unattributedEvents: 0, byContainer: [{ key: 'container', label: 'container', seconds: 3600, knownEstimateUsd: 1.2, unknownCostSessions: 1 }] } };
    else body = { ok: true };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/api/aichat/jobs/**', async route => {
    const jobId = new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'done', result: taskResults.get(jobId) || { ok: false, error: 'missing test result' } }) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/tailscale-wasm`);
  assert.deepEqual(requests, []);
  assert.equal(await page.locator('#send').isDisabled(), true);
  async function refresh(expected) {
    await page.click('#refresh');
    await page.waitForFunction(text => document.getElementById('gadget').textContent.includes(text), expected).catch(async error => { console.error('REFRESH STATE', await page.locator('#status').textContent(), await page.locator('#gadget').textContent(), errors); throw error; });
  }
  await refresh('送信できます');
  assert.equal(await page.locator('#login').isVisible(), false);
  await page.fill('#prompt', '質問 “△”');
  await page.evaluate(() => {
    const form = document.getElementById('chat');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await page.waitForFunction(() => document.getElementById('result').textContent === '回答を受信しました。');
  assert.equal(chatCalls, 1);
  assert.equal(await page.locator('#history script').count(), 0);
  assert.match(await page.locator('#history').textContent(), /<script>unsafe<\/script>/);
  chatMode = 'error';
  await page.fill('#prompt', '質問 “△”');
  await page.click('#send');
  await page.waitForFunction(() => document.getElementById('result').textContent.includes('自動再送はしません'));
  assert.equal(chatCalls, 2);
  assert.equal(await page.locator('#history article').count(), 1);
  assert.equal(await page.locator('#prompt').inputValue(), '質問 “△”');
  gadgetReady = false;
  await refresh('Museへの接続を確認できません');
  assert.equal(await page.locator('#send').isDisabled(), true);
  configured = false;
  await refresh('Museへの接続を確認できません');
  assert.equal(await page.locator('#send').isDisabled(), true);
  configured = true;
  state = 'NeedsLogin';
  await refresh('Museへの接続を確認できません');
  assert.equal(await page.locator('#send').isDisabled(), true);
  await page.click('#cost-refresh');
  await page.waitForFunction(() => document.querySelectorAll('#cost-chart rect').length === 1);
  await page.click('#fleet-refresh');
  await page.waitForFunction(() => document.querySelectorAll('#fleet-rows tr').length === 1);
  assert.match(await page.locator('#fleet-cost-summary').textContent(), /費用不明/);
  await page.locator('summary').click();
  await page.click('#tools-refresh');
  await page.waitForFunction(() => document.getElementById('container-status').textContent.includes('停止中'));
  assert.equal(await page.locator('#agent-send').isDisabled(), true);
  assert.equal(agentCalls, 0);
  toolsRunning = true;
  await page.click('#tools-refresh');
  await page.waitForFunction(() => !document.getElementById('agent-send').disabled);
  await page.click('#t3-test');
  await page.waitForFunction(() => document.getElementById('tools-result').textContent.includes('接続確認済み'));
  await page.fill('#agent-prompt', 'review this');
  await page.click('#agent-send');
  await page.waitForFunction(() => document.getElementById('tools-result').textContent === 'review answer');
  assert.equal(agentCalls, 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS Chrome: initial inactivity, readiness gates, one send, safe reply rendering, error without retry, Worker readiness states, cost/fleet graphs, stopped-container controls, T3 and agent form, untrusted login URL blocked, mobile layout, CSP. APIs simulated; no real Muse request.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
