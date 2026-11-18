// Reuse the integrity-pinned upstream binary; no Go or Docker build is required.
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const packageVersion = '1.102.3-3-tb31d8a75a-g5e651e16f';
const expected = 'sha512-O7im3aW8KgQzyJ8M6csL5P85dubvUJvLIqCH1lAUx8OkMWR/CxS8bmoHfDjljm6xxGQIoqcbyQnU/9iKOwo/tw==';
const output = new URL('../public/tailscale-connect/1.102.3-3/', import.meta.url);
const temporary = await mkdtemp(join(tmpdir(), 'tailscale-connect-'));
try {
 const response = await fetch(`https://registry.npmjs.org/@tailscale/connect/-/connect-${packageVersion}.tgz`);
 if (!response.ok) throw new Error(`package download HTTP ${response.status}`);
 const archive = Buffer.from(await response.arrayBuffer());
 if ('sha512-' + createHash('sha512').update(archive).digest('base64') !== expected) throw new Error('package integrity mismatch');
 const filename = join(temporary, 'package.tgz'); await writeFile(filename, archive);
 execFileSync('tar', ['-xzf', filename, '-C', temporary, 'package/pkg.js', 'package/main.wasm.gz']);
 const info = JSON.parse(await readFile(new URL('build-info.json', output), 'utf8'));
 if (info.integrity !== expected) throw new Error('build-info package integrity mismatch');
 for (const [name, sha] of Object.entries(info.files)) {
  if (createHash('sha256').update(await readFile(join(temporary, 'package', name))).digest('hex') !== sha) throw new Error(`output checksum mismatch: ${name}`);
 }
 await mkdir(output, { recursive: true });
 for (const name of ['pkg.js', 'main.wasm.gz']) await copyFile(join(temporary, 'package', name), new URL(name, output));
 console.log('Verified upstream Tailscale Connect assets restored.');
} finally { await rm(temporary, { recursive: true, force: true }); }
