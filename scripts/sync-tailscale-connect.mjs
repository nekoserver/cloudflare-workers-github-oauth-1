// Restore the pinned SDK and gzip the official WASM for Cloudflare Static Assets.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { TAILSCALE_WASM_ROOT } from '../public/tailscale-wasm-client.mjs';

const output = new URL('../public' + TAILSCALE_WASM_ROOT + '/', import.meta.url);
const info = JSON.parse(await readFile(new URL('build-info.json', output), 'utf8'));
const packageVersion = info.package.slice('@tailscale/connect@'.length);
const temporary = await mkdtemp(join(tmpdir(), 'tailscale-connect-'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

try {
  const response = await fetch(`https://registry.npmjs.org/@tailscale/connect/-/connect-${packageVersion}.tgz`);
  if (!response.ok) throw new Error(`package download HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const integrity = 'sha512-' + createHash('sha512').update(archive).digest('base64');
  if (integrity !== info.integrity) throw new Error('package integrity mismatch');

  const filename = join(temporary, 'package.tgz');
  await writeFile(filename, archive);
  execFileSync('tar', ['-xzf', filename, '-C', temporary, 'package/pkg.js', 'package/main.wasm', 'package/build-info.json']);
  const unpacked = join(temporary, 'package');
  const upstream = JSON.parse(await readFile(join(unpacked, 'build-info.json'), 'utf8'));
  const wasm = await readFile(join(unpacked, 'main.wasm'));
  // Upstream records the pre-optimization digest. The distributed WASM has its own digest.
  if (upstream.raw_wasm_sha256 !== info.preOptimizationWasmSha256 || sha256(wasm) !== info.wasmSha256) {
    throw new Error('official WASM checksum mismatch');
  }

  const assets = {
    'pkg.js': await readFile(join(unpacked, 'pkg.js')),
    'main.wasm.gz': gzipSync(wasm, { level: 9 }),
  };
  for (const [name, bytes] of Object.entries(assets)) {
    if (sha256(bytes) !== info.files[name]) throw new Error(`output checksum mismatch: ${name}`);
  }
  for (const [name, bytes] of Object.entries(assets)) {
    await writeFile(new URL(name, output), bytes);
  }
  console.log('Verified upstream Tailscale Connect assets restored.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
