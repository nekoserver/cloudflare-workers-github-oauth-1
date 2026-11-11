#!/usr/bin/env node
// scripts/build-demo-packages-ubuntu26.sh が作った git と Apache のパッケージを containers/demo/packages/ に置き、
// Dockerfile の版とハッシュ、SHA256SUMS、README を更新する。古い版のファイルと行は消す。
// 仕様: SPEC.cloudflare-workers-github-oauth-1.20261111.container-auto-build.md。
//   node scripts/demo-packages-apply.mjs --from <出力先> --git <版> --apache <版> --built "<いつ・どこで>"
// 足りないファイルがあれば、何も変えずに失敗する。書き換えの後、古い版が残っていれば失敗する。
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PK = join(ROOT, 'containers/demo/packages');
const DOCKERFILE = join(ROOT, 'containers/demo/Dockerfile');
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function fail(message) { console.error('demo-packages-apply: ' + message); process.exit(1); }
const from = arg('--from');
const git = arg('--git');
const apache = arg('--apache');
const built = arg('--built');
if (!from || !git || !apache || !built) fail('usage: --from <dir> --git <version> --apache <version> --built <text>');
if (!/^\d+\.\d+\.\d+$/.test(git) || !/^\d+\.\d+\.\d+$/.test(apache)) fail('versions must look like 2.56.1');

const wanted = [`git-${git}-linux-x64-ubuntu26.04.tar.xz`, `git-${git}.tar.xz`, `apache-${apache}-linux-x64-ubuntu26.04.tar.xz`, `httpd-${apache}.tar.gz`];
for (const f of wanted) if (!existsSync(join(from, f))) fail(`missing ${f} in ${from}`);
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

// 現在の版(Dockerfile の先頭の ARG)
const df = readFileSync(DOCKERFILE, 'utf8');
const oldGit = df.match(/^ARG GIT_VERSION=(\S+)$/m)?.[1];
const oldApache = df.match(/^ARG APACHE_VERSION=(\S+)$/m)?.[1];
if (!oldGit || !oldApache) fail('Dockerfile: ARG GIT_VERSION= / ARG APACHE_VERSION= not found');

// Dockerfile を書き換える(まだ書き込まない)
let next = df
  .replace(/^ARG GIT_VERSION=\S+$/m, `ARG GIT_VERSION=${git}`)
  .replace(/^ARG APACHE_VERSION=\S+$/m, `ARG APACHE_VERSION=${apache}`)
  .replace(/^ARG GIT_PACKAGE_SHA256=[0-9a-f]{64}$/m, `ARG GIT_PACKAGE_SHA256=${sha(join(from, wanted[0]))}`)
  .replace(/^ARG APACHE_PACKAGE_SHA256=[0-9a-f]{64}$/m, `ARG APACHE_PACKAGE_SHA256=${sha(join(from, wanted[2]))}`);
for (const line of [`ARG GIT_VERSION=${git}`, `ARG APACHE_VERSION=${apache}`, `ARG GIT_PACKAGE_SHA256=${sha(join(from, wanted[0]))}`, `ARG APACHE_PACKAGE_SHA256=${sha(join(from, wanted[2]))}`]) {
  if (!next.includes(line)) fail('Dockerfile: rewrite did not take effect: ' + line);
}

// 古いファイルを消し、新しいものを置く
const isOld = (f) => (oldGit !== git && f.startsWith(`git-${oldGit}`)) || (oldApache !== apache && (f.startsWith(`apache-${oldApache}-`) || f.startsWith(`httpd-${oldApache}.`)));
const sumsPath = join(PK, 'SHA256SUMS');
const keep = readFileSync(sumsPath, 'utf8').split('\n').filter(Boolean).filter((line) => {
  const name = line.split(/\s+/)[1] ?? '';
  return !isOld(name) && !wanted.includes(name);
});
for (const f of readdirSync(PK)) if (isOld(f)) rmSync(join(PK, f));
for (const f of wanted) copyFileSync(join(from, f), join(PK, f));
const sums = [...keep, ...wanted.map((f) => `${sha(join(PK, f))}  ${f}`)].join('\n') + '\n';
writeFileSync(sumsPath, sums);
writeFileSync(DOCKERFILE, next);
const readme = join(PK, 'README.md');
let text = readFileSync(readme, 'utf8');
const note = (label, src) => `\n- Rebuilt: ${built} by scripts/build-demo-packages-ubuntu26.sh from \`${src}\` (SHA256 \`${sha(join(PK, src))}\`, checked against the upstream published hash). The notes below were written for the previous build (${label}); the recipe is unchanged.\n`;
for (const [head, oldV, newV, src] of [['git', oldGit, git, wanted[1]], ['Apache httpd', oldApache, apache, wanted[3]]]) {
  const oldHead = `## ${head} ${oldV}\n`;
  if (text.includes(oldHead)) text = text.replace(oldHead, `## ${head} ${newV}\n` + note(`${head} ${oldV}`, src));
  else if (!text.includes(`## ${head} ${newV}\n`)) text = text.trimEnd() + `\n\n## ${head} ${newV}\n` + note(`none recorded`, src);
}
writeFileSync(readme, text);

// 古い版が残っていないこと
const leftovers = [readFileSync(DOCKERFILE, 'utf8'), readFileSync(sumsPath, 'utf8')].join('\n');
for (const v of [oldGit !== git ? `git-${oldGit}` : null, oldApache !== apache ? `${oldApache}` : null].filter(Boolean)) {
  if (leftovers.includes(v)) fail('old version remains: ' + v);
}
console.log(`applied git ${oldGit} -> ${git}, Apache ${oldApache} -> ${apache}`);
