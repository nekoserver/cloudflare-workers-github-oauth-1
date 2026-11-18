// One real AI chat textbox-style POST through AICHAT_JOB, /api/aichat, the Tailscale DO, and Muse.
// Uses existing credentials from the local runtime, emits only sanitized result metadata, and sends once.
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, copyFile, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
const require = createRequire(import.meta.url);
const inherited = Object.fromEntries((await readFile('/proc/73/environ', 'utf8')).split('\0').filter(x => x.includes('=')).map(x => [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1)]));
const tailnetKey = process.env.TAILSCALE_AUTHKEY || inherited.TAILSCALE_AUTHKEY;
const museKey = process.env.MUSE_API_KEY || inherited.MUSE_API_KEY;
if (!tailnetKey || !museKey) throw new Error('Existing credentials unavailable');
const secret = webcrypto.randomUUID() + webcrypto.randomUUID();
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const header = enc({ alg: 'HS256', typ: 'JWT' }), payload = enc({ sub: 'local-live-check', name: 'textbox test', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+600 });
const signed = header + '.' + payload;
const signature = Buffer.from(await webcrypto.subtle.sign('HMAC', await webcrypto.subtle.importKey('raw', Buffer.from(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), Buffer.from(signed))).toString('base64url');
const token = signed + '.' + signature;
const dir = await mkdtemp(join(tmpdir(), 'aichat-muse-live-'));
let mf;
try {
  const wasmFiles = new Map();
  await build({ entryPoints: ['src/worker-entry.ts'], outfile: join(dir, 'worker.mjs'), bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'], plugins: [{ name: 'wasm', setup(b) {
    b.onResolve({ filter: /\.wasm$/ }, async args => {
      if (/\/main\.wasm$/.test(args.path) && args.path.includes('wasm-tailscale')) return { path: './main.wasm', external: true };
      const source = args.path.startsWith('.') ? resolve(args.resolveDir, args.path) : require.resolve(args.path), rel = relative(process.cwd(), source), dest = join(dir, rel);
      await mkdir(resolve(dest, '..'), { recursive: true }); await copyFile(source, dest); wasmFiles.set(rel, dest);
      return { path: './' + rel.split('\\').join('/'), external: true };
    });
  } }] });
  await copyFile(require.resolve('@ai-ecoverse/wasm-tailscale/main.wasm'), join(dir, 'main.wasm'));
  const modules = [{ type: 'ESModule', path: join(dir, 'worker.mjs') }, ...[...wasmFiles.values(), join(dir, 'main.wasm')].map(path => ({ type: 'CompiledWasm', path }))];
  mf = new Miniflare(convertV4MiniflareOptions({ log: new Log(LogLevel.NONE), workers: [{ name: 'aichat-live', compatibilityDate: '2024-11-17', modulesRoot: dir, modules, durableObjects: { AICHAT_JOB: { className: 'AichatJob', useSQLite: true }, TAILSCALE_WASM: { className: 'TailscaleWasm', useSQLite: true } }, bindings: { JWT_SECRET: secret, TAILSCALE_WASM_AUTHKEY: tailnetKey, MUSE_API_KEY: museKey, AI_CHAT_MODEL: 'muse' } }] }));
  const headers = { Authorization: 'Bearer ' + token, Cookie: 'aichat_muse_signal=%7B%22transport%22%3A%22worker%22%7D', 'Content-Type': 'application/json' };
  const marker = 'AICHAT_TEXTBOX_MUSE_POST_OK_20261108';
  const submitted = await mf.dispatchFetch('http://aichat-live/api/aichat/jobs', { method: 'POST', headers, body: JSON.stringify({ model: 'muse', message: 'Reply with exactly ' + marker + ' and nothing else.', source: 'textbox', stream: false }) });
  const started = await submitted.json();
  if (submitted.status !== 202 || typeof started.jobId !== 'string') throw new Error('AI chat job submission failed (HTTP ' + submitted.status + ')');
  let status, result;
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const response = await mf.dispatchFetch('http://aichat-live/api/aichat/jobs/' + encodeURIComponent(started.jobId) + '?offset=0', { headers: { Authorization: headers.Authorization } });
    status = await response.json();
    if (status.status === 'done') { result = status.result; break; }
    if (status.status === 'failed') throw new Error('AI chat job failed; no resubmission: ' + String(status.error || 'unknown'));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const exact = result?.response?.trim() === marker;
  console.log(JSON.stringify({ phase: 'real-aichat-textbox-post', submitStatus: submitted.status, jobStatus: status?.status || 'timeout', transport: result?.usedModel === 'muse' ? 'muse' : 'other', tailscale: result?.museTailscale || null, exactMarker: exact }));
  if (!exact) process.exitCode = 1;
  await mf.dispatchFetch('http://aichat-live/logout', { method: 'POST', body: '{}' });
} finally { if (mf) await mf.dispose(); await rm(dir, { recursive: true, force: true }); }
