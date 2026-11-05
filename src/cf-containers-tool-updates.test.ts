import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const server=require('../containers/demo/server.js');
const df=readFileSync('containers/demo/Dockerfile','utf8');
const arg=(n:string)=>df.match(new RegExp('^ARG '+n+'=(\\S+)','m'))?.[1];
// Official metadata and downloaded binaries checked 2026-11-05; see REPORT.
const VERIFIED={CLOUDFLARED_VERSION:'2026.10.7',TAILSCALE_VERSION:'1.104.5',CLAUDE_VERSION:'2.1.318',JJ_VERSION:'0.47.1',PREPRINT_VERSION:'0.1.2'};
describe('container tools: verified precompiled releases',()=>{
 it('pins every requested tool to its verified release',()=>{for(const [n,v] of Object.entries(VERIFIED))expect(arg(n),n).toBe(v);});
 it('verifies downloaded archives and native Claude bytes',()=>{
  expect(arg('CLOUDFLARED_SHA256')).toBe('70b1a1e0f46033ffc8d90b406e554044ba6cbf2e4360295ef1163aed31e09393');
  expect(arg('TAILSCALE_SHA256')).toBe('720cbbccbfc03d8b55df72afc19e5a72e31b0f65934700aa6fa38074d4ad7bf7');
  expect(arg('PREPRINT_SHA256')).toBe('451a0ec62252e8747080daa4f8dc08c85949db9fea67ecedac45d4ce56e3ba9f');
  expect(arg('CHROME_SHA256')).toBe('a62b277dc03da2cff50cc04589deb66f6875be339c066d46adb49b49eedb629d');
  expect(arg('CLAUDE_NATIVE_SHA256')).toBe('708c77b204db30086ff6f1ed34577bda03e1be74ced80557cbf7b54249ebf0bd');
  for(const name of ['TAILSCALE','PREPRINT','CHROME','CLAUDE_NATIVE'])expect(df).toContain('${'+name+'_SHA256}');
 });
 it('uses official Tailscale binaries without a Go build',()=>{
  expect(df).toContain('https://pkgs.tailscale.com/stable/tailscale_${TAILSCALE_VERSION}_amd64.tgz');
  expect(df).not.toMatch(/^FROM golang:/m);expect(df).not.toContain('go install');
 });
 it('makes preprint and a real Chrome available without source compilation',()=>{
  expect(df).toContain('@supermemory/preprint/-/preprint-${PREPRINT_VERSION}.tgz');
  expect(df).toContain('npm install -g /tmp/preprint.tgz --ignore-scripts');
  expect(df).toContain('apt-get install -y --no-install-recommends /tmp/chrome.deb');
  expect(df).toContain('preprint --help');expect(df).toContain('preprint --version');
  expect(df).toContain('google-chrome --version');expect(df).not.toContain('cargo build');
 });
 it('reuses the retained and verified jj release package',()=>{
  const name='jj-v0.47.1-x86_64-unknown-linux-musl.tar.gz';
  const file='containers/demo/packages/'+name;
  expect(existsSync(file)).toBe(true);
  if(existsSync(file))expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(arg('JJ_SHA256'));
  expect(df).toContain('COPY packages/jj-v${JJ_VERSION}-x86_64-unknown-linux-musl.tar.gz /tmp/jj.tar.gz');
 });
 it('reports installed preprint metadata through health and apt through the APT candidate table',()=>{
  expect(server.VERSION_SOURCES).toContainEqual({name:'preprint',cmd:'preprint',args:['--version'],key:'preprint'});
  expect(server.APT_TOOLS).toContainEqual({name:'apt',pkg:'apt'});
  expect(df).toContain('"preprint":"%s"');
 });
});

it('checks the actual T3 Code version without changing its verified install pin',()=>{
 expect(server.VERSION_SOURCES).toContainEqual({name:'t3',cmd:'t3',args:['--version'],key:'t3'});
 expect(df).toContain('"t3":"%s"');
 expect(arg('T3_VERSION')).toBe('0.1.3');
});
