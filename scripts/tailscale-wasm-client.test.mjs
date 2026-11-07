import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { decodeTailscaleWasm, isTailscaleLoginURL } from '../public/tailscale-wasm-client.mjs';
const WASM = Uint8Array.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);
test('ファイル自体のgzipとHTTPで展開済みの両方からWASMを取り出す', async () => {
  assert.deepEqual([...await decodeTailscaleWasm(gzipSync(WASM))], [...WASM]);
  assert.deepEqual([...await decodeTailscaleWasm(WASM)], [...WASM]);
  await assert.rejects(decodeTailscaleWasm(new TextEncoder().encode('<html>')), /WASMの配信形式が不正/);
});
test('TailscaleのHTTPSのログインURLだけを許す', () => {
  assert.equal(isTailscaleLoginURL('https://login.tailscale.com/a/x'), true);
  assert.equal(isTailscaleLoginURL('http://login.tailscale.com/a/x'), false);
  assert.equal(isTailscaleLoginURL('https://tailscale.com.evil.example/a'), false);
  assert.equal(isTailscaleLoginURL('https://user:pw@login.tailscale.com/a'), false);
  assert.equal(isTailscaleLoginURL('not a url'), false);
});
