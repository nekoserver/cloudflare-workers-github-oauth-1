import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { workspaceTools, initialFile, demoFile, simulatedFetch, gatewayFetch } from '../public/fx-wasm.mjs';

test('workspace rejects traversal, other files and oversized writes without changing contents', () => {
  const workspace = { value: initialFile };
  const [read, write] = workspaceTools(workspace);
  for (const path of ['../hello.js', '/etc/passwd', 'other.js']) {
    assert.throws(() => read.execute({ path }));
    assert.throws(() => write.execute({ path, content: 'bad' }));
  }
  assert.throws(() => write.execute({ path: 'hello.js', content: 'あ'.repeat(22000) }));
  assert.equal(workspace.value, initialFile);
  write.execute({ path: 'hello.js', content: demoFile });
  assert.equal(read.execute({ path: 'hello.js' }), demoFile);
});

test('real model transport blocks unexpected URLs before sending keys', async () => {
  let count = 0;
  const send = gatewayFetch(async request => { count++; assert.equal(request.redirect, 'error'); return new Response('ok'); });
  for (const url of ['https://evil.example/v4/ai/language-model', 'https://ai-gateway.vercel.sh/other', 'https://ai-gateway.vercel.sh/v4/ai/language-model?extra=1']) {
    await assert.rejects(send(url, { method: 'POST', headers: { Authorization: 'Bearer test-only' } }));
  }
  assert.equal(count, 0);
  await send('https://ai-gateway.vercel.sh/v4/ai/language-model', { method: 'POST' });
  assert.equal(count, 1);
});

test('simulated model is deterministic and rejects unintended network destinations', async () => {
  const mock = simulatedFetch();
  await assert.rejects(mock('https://other.example', { method: 'POST' }));
  const outputs = [];
  for (let i = 0; i < 3; i++) outputs.push(await (await mock('https://fx-demo.invalid/v1/chat/completions', { method: 'POST' })).text());
  assert.match(outputs[0], /read_file/);
  assert.match(outputs[1], /write_file/);
  assert.match(outputs[2], /FX_WASM_DEMO_OK/);
});

test('all vendored files match pinned SHA256, including actual WASM', async () => {
  const root = new URL('../public/vendor/libfx/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  for (const [name, hash] of Object.entries(manifest.files)) {
    const bytes = await readFile(new URL(name, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, name);
  }
  const bytes = await readFile(new URL('fx-core.wasm', root));
  assert.equal(bytes.subarray(0, 4).toString('hex'), '0061736d');
});
