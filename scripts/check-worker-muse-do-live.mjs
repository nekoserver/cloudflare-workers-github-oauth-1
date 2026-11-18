// Actual production DO class, published WASM and existing credentials; one real POST.
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const inherited = Object.fromEntries((await readFile('/proc/73/environ', 'utf8')).split('\0').filter(x => x.includes('=')).map(x => [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1)]));
const key = process.env.TAILSCALE_AUTHKEY || inherited.TAILSCALE_AUTHKEY;
if (!key || !process.env.MUSE_API_KEY) throw new Error('Existing credentials unavailable');
const dir = await mkdtemp(join(tmpdir(), 'muse-do-live-'));
let mf;
try {
  await build({ entryPoints: ['src/durable/tailscaleWasm.ts'], outfile: join(dir, 'node.mjs'), bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'], plugins: [{ name: 'wasm', setup(b) { b.onResolve({ filter: /\/main\.wasm$/ }, () => ({ path: './main.wasm', external: true })); } }] });
  await copyFile(require.resolve('@ai-ecoverse/wasm-tailscale/main.wasm'), join(dir, 'main.wasm'));
  await writeFile(join(dir, 'entry.mjs'), `export {TailscaleWasm} from './node.mjs'; console.log=console.warn=console.error=()=>{}; export default {fetch(request,env){return env.TAILSCALE_WASM.get(env.TAILSCALE_WASM.idFromName('muse')).fetch(request)}};`);
  mf = new Miniflare(convertV4MiniflareOptions({ log: new Log(LogLevel.NONE), workers: [{ name: 'test', compatibilityDate: '2024-11-17', modulesRoot: dir, modules: [{ type: 'ESModule', path: join(dir, 'entry.mjs') }, { type: 'ESModule', path: join(dir, 'node.mjs') }, { type: 'CompiledWasm', path: join(dir, 'main.wasm') }], durableObjects: { TAILSCALE_WASM: { className: 'TailscaleWasm', useSQLite: true } }, bindings: { TAILSCALE_WASM_AUTHKEY: key, MUSE_API_KEY: process.env.MUSE_API_KEY } }] }));
  let health;
  for (let i = 0; i < 6; i++) {
    const res = await mf.dispatchFetch('http://node/muse/health');
    health = await res.json();
    if (res.status === 200 && health.status === 'ok') break;
  }
  console.log(JSON.stringify({ phase: 'real-do-health', healthy: health?.status === 'ok' }));
  if (health?.status !== 'ok') throw new Error('Real DO health not ready; no inference POST sent');
  const res = await mf.dispatchFetch('http://node/muse/v1/chat/completions', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with exactly WORKER_DO_MUSE_ROUTE_OK_20261108 and nothing else.' }] }) });
  const data = await res.json();
  const marker = data?.choices?.[0]?.message?.content?.trim() === 'WORKER_DO_MUSE_ROUTE_OK_20261108';
  console.log(JSON.stringify({ phase: 'real-do-single-post', status: res.status, exactMarker: marker }));
  if (res.status !== 200 || !marker) process.exitCode = 1;
  await mf.dispatchFetch('http://node/logout', { method: 'POST', body: '{}' });
  const stopped = await mf.dispatchFetch('http://node/muse/health');
  console.log(JSON.stringify({ phase: 'explicit-logout-stays-off', status: stopped.status, success: stopped.status === 503 }));
  if (stopped.status !== 503) process.exitCode = 1;
} finally { if (mf) await mf.dispose(); await rm(dir, { recursive: true, force: true }); }
