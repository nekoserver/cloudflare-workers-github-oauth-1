// Verify the published binary against the publisher's versioned build manifest.
// No source build and no network/credentials are used.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const version = '1.104.1-13';
const root = dirname(require.resolve('@ai-ecoverse/wasm-tailscale/package.json'));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(root, 'dist/build-info.json'), 'utf8'));
if (pkg.version !== version || manifest.version !== version) throw new Error('WASM Tailscale version mismatch');
const hashes = {
 'main.wasm': 'd3c564f58abf124b9815c9ad3c141a974142e6c374e3831171e54395f02426ab',
 'wasm_exec.js': '0c949f4996f9a89698e4b5c586de32249c3b69b7baadb64d220073cc04acba14',
 'THIRD-PARTY-NOTICES.md': '9c6f9175328cf6a0db82658d776e8282d8363d61d9b9843948e22624db69169f',
};
for (const [file, expected] of Object.entries(hashes)) {
 const path = resolve(root, file.endsWith('.md') ? file : 'dist/' + file);
 const actual = createHash('sha256').update(await readFile(path)).digest('hex');
 if (actual !== expected || manifest.files[file] !== expected) throw new Error('WASM Tailscale checksum mismatch: ' + file);
}
console.log('PASS @ai-ecoverse/wasm-tailscale ' + version + ': published WASM, Go shim and notices SHA256 verified');
