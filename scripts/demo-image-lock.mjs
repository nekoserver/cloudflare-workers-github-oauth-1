#!/usr/bin/env node
// demo コンテナの固定したイメージ(containers/demo/image.lock.json)と、その入力のずれを調べる・記録する。
// 仕様: SPEC.cloudflare-workers-github-oauth-1.20261111.container-auto-build.md。Docker は使わない。
//   node scripts/demo-image-lock.mjs --check            一致なら0、違えば1(理由を出す)
//   node scripts/demo-image-lock.mjs --print-context    入力の一覧とハッシュを JSON で出す
//   node scripts/demo-image-lock.mjs --write --image <registry...@sha256:...> --built-from <説明>
// 入力の計算は src/cf-containers-image-lock.test.ts と同じ(テストが突き合わせる)。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIR = 'containers/demo';
const LOCK = join(ROOT, DIR, 'image.lock.json');
const DIGEST_REF = /^registry\.cloudflare\.com\/[0-9a-f]{32}\/cloudflare-workers-github-oauth-1-democontainer@sha256:[0-9a-f]{64}$/;

function contextFiles() {
  return execFileSync('git', ['-C', ROOT, 'ls-files', DIR], { encoding: 'utf8' }).split('\n').filter(Boolean)
    .map((f) => f.slice(DIR.length + 1))
    .filter((f) => f !== 'image.lock.json' && !f.startsWith('tests/') && !f.endsWith('.md'))
    .sort();
}
function contextSha256(files) {
  const hash = createHash('sha256');
  for (const f of files) { hash.update(f + '\0'); hash.update(readFileSync(join(ROOT, DIR, f))); hash.update('\0'); }
  return hash.digest('hex');
}
function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const mode = ['--check', '--print-context', '--write'].find((m) => process.argv.includes(m));
if (!mode) { console.error('usage: --check | --print-context | --write --image <ref> --built-from <text>'); process.exit(2); }
const files = contextFiles();
const sha = contextSha256(files);

if (mode === '--print-context') {
  process.stdout.write(JSON.stringify({ files, contextSha256: sha }) + '\n');
} else if (mode === '--check') {
  const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  if (JSON.stringify(files) !== JSON.stringify(lock.files)) {
    const added = files.filter((f) => !lock.files.includes(f));
    const removed = lock.files.filter((f) => !files.includes(f));
    console.log(`REBUILD inputs added ${JSON.stringify(added)} removed ${JSON.stringify(removed)}`);
    process.exit(1);
  }
  if (sha !== lock.contextSha256) { console.log('REBUILD inputs changed since the image was built'); process.exit(1); }
  console.log('OK image matches its inputs');
} else {
  const image = arg('--image');
  const builtFrom = arg('--built-from');
  if (!image || !DIGEST_REF.test(image)) { console.error('--image must be registry.cloudflare.com/<account>/cloudflare-workers-github-oauth-1-democontainer@sha256:<digest>'); process.exit(2); }
  if (!builtFrom) { console.error('--built-from is required'); process.exit(2); }
  const old = JSON.parse(readFileSync(LOCK, 'utf8'));
  const tomlPath = join(ROOT, 'wrangler.toml');
  const toml = readFileSync(tomlPath, 'utf8');
  const updated = toml.replace(/^image = "registry\.cloudflare\.com\/[^"]+"$/m, `image = "${image}"`);
  if (updated === toml && !toml.includes(`image = "${image}"`)) { console.error('wrangler.toml: no pinned image line found'); process.exit(1); }
  if (old.image && old.image !== image && updated.includes(old.image)) { console.error('wrangler.toml: the old image reference remains'); process.exit(1); }
  const lock = { image, contextSha256: sha, files, buildArgs: old.buildArgs ?? {}, builtFrom };
  writeFileSync(tomlPath, updated);
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
  console.log(`wrote ${DIR}/image.lock.json: ${image} (${files.length} files) from ${builtFrom}`);
}
