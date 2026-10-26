import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { normalizeNetMap, chooseProvider, setupContainerMonitor } from '../public/container-monitor.mjs';
const fixture = () => new JSDOM(`<select id="monitor-provider"></select><span id="monitor-status"></span><table><tbody id="monitor-targets"></tbody></table><input id="monitor-filter"><span id="monitor-count"></span><span id="monitor-scope"></span><div id="monitor-wasm-controls"></div><div id="monitor-login"></div><button id="monitor-refresh"></button><button id="monitor-connect"></button><button id="monitor-disconnect"></button><input type="checkbox" id="monitor-auto">`, { url: 'https://monitor.example' });
const provider = { id: 'tailscale-wasm', label: 'WASM', execution: 'browser', scope: 'visible peers' };
test('normalizes peers without private keys and preserves unknown state', () => {
 const targets = normalizeNetMap({ peers: [{ name: 'node', addresses: ['100.64.0.1'], online: false, machineKey: 'private' }, { name: 'unknown' }] });
 assert.equal(targets[0].status, 'offline'); assert.equal(targets[1].status, 'unknown'); assert.ok(!JSON.stringify(targets).includes('private'));
 assert.equal(chooseProvider({ defaultProvider: 'tailscale-wasm', providers: [provider] }, 'removed'), 'tailscale-wasm');
});
test('works without API tokens and renders untrusted peer names as text', async () => {
 const dom = fixture(); const doc = dom.window.document; let callbacks; let loginCalls = 0;
 const monitor = setupContainerMonitor(doc, {
  fetch: async () => new Response(JSON.stringify({ defaultProvider: 'tailscale-wasm', providers: [provider] })),
  createIPN: async config => { assert.equal(config.authKey, ''); return { run: value => { callbacks = value; }, login: () => loginCalls++, logout: () => {} }; },
 });
 try {
  await monitor.initialize(); assert.equal(doc.getElementById('monitor-provider').value, 'tailscale-wasm');
  await monitor.connect(); assert.equal(loginCalls, 1);
  callbacks.notifyState('Running');
  callbacks.notifyNetMap(JSON.stringify({ peers: [{ name: '<img src=x onerror=alert(1)>', online: true, addresses: ['100.64.0.1'] }] }));
  assert.ok(doc.getElementById('monitor-targets').textContent.includes('<img'));
  assert.equal(doc.querySelectorAll('#monitor-targets img').length, 0);
  callbacks.notifyBrowseToURL('https://evil.example/login'); assert.equal(doc.getElementById('monitor-login').children.length, 0);
  callbacks.notifyBrowseToURL('https://login.tailscale.com/a/example'); assert.equal(doc.querySelector('#monitor-login a').rel, 'noopener noreferrer');
  callbacks.notifyState('Stopped'); assert.equal(doc.getElementById('monitor-targets').children.length, 0);
  callbacks.notifyNetMap({ peers: [{ name: 'old', online: true }] });
  await monitor.refresh();
  assert.equal(doc.getElementById('monitor-targets').children.length, 0);
 } finally { monitor.destroy(); dom.window.close(); }
});
test('removes unavailable API options and ignores an older response after switching to WASM', async () => {
 const dom = fixture(); const doc = dom.window.document;
 const api = { id: 'cloudflare-api', label: 'API', execution: 'worker', scope: 'account' };
 let config = { defaultProvider: api.id, providers: [api, provider] }; let resolveSnapshot;
 const monitor = setupContainerMonitor(doc, { fetch: async url => {
  if (url.endsWith('/providers')) return new Response(JSON.stringify(config));
  return new Promise(resolve => { resolveSnapshot = resolve; });
 } });
 try {
  const initializing = monitor.initialize();
  while (!resolveSnapshot) await new Promise(resolve => setTimeout(resolve, 1));
  doc.getElementById('monitor-provider').value = 'tailscale-wasm';
  doc.getElementById('monitor-provider').dispatchEvent(new dom.window.Event('change'));
  resolveSnapshot(new Response(JSON.stringify({ targets: [{ name: 'stale', group: 'old', status: 'running', addresses: [] }], scope: 'old', fetchedAt: new Date().toISOString(), complete: true, errors: [] })));
  await initializing;
  assert.equal(doc.getElementById('monitor-targets').textContent, '');
  config = { defaultProvider: 'tailscale-wasm', providers: [provider] };
  await monitor.reloadProviders();
  assert.equal(doc.getElementById('monitor-provider').options.length, 1);
  assert.equal(doc.getElementById('monitor-provider').value, 'tailscale-wasm');
 } finally { monitor.destroy(); dom.window.close(); }
});
