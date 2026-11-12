#!/usr/bin/env node
// Workers Builds の本番のデプロイコマンド。demo コンテナのイメージを作るかどうかを決め、wrangler.toml の image を書き換えてから、
// npx wrangler deploy --containers-rollout=gradual を実行する(ユーザー指定 2026-11-13)。
// - イメージを作るのは containers/demo の中身が変わったときだけ。Worker だけ・ドキュメントだけの変更では作らない。
// - 中身のハッシュを付けたタグ(ctx-<12桁>)のイメージがレジストリにあれば、それを使う。無いときだけ作って push する。
// - 作れなかったら、最後に動いたイメージ(containers/demo/image.lock.json)で出し、Worker のデプロイは止めない。
// 使い方: node scripts/select-demo-container-image.mjs [--dry-run] [--no-deploy]
//   --dry-run   判定だけ表示し、何も変えない
//   --no-deploy 書き換えまでで止め、wrangler deploy を実行しない
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = 'containers/demo';
const REPO = 'cloudflare-workers-github-oauth-1-democontainer';
/** 以前の Workers Builds のデプロイコマンド(npx wrangler deploy --containers-rollout=gradual)と同じ引数。 */
export const DEPLOY_ARGS = ['--containers-rollout=gradual'];

/** イメージの中身を決めるファイル(git で管理しているもの。テスト・文書・記録の image.lock.json は除く)。 */
export function contextFiles() {
  return execFileSync('git', ['ls-files', DIR], { encoding: 'utf8' }).split('\n').filter(Boolean)
    .map((f) => f.slice(DIR.length + 1))
    .filter((f) => f !== 'image.lock.json' && !f.startsWith('tests/') && !f.endsWith('.md'))
    .sort();
}

export function contextSha256(files) {
  const hash = createHash('sha256');
  for (const f of files) { hash.update(f + '\0'); hash.update(readFileSync(`${DIR}/${f}`)); hash.update('\0'); }
  return hash.digest('hex');
}

export function imageTag(sha) { return `${REPO}:ctx-${sha.slice(0, 12)}`; }

/** existing はレジストリの一覧(wrangler containers images list の出力)。同じタグがあれば作らない。 */
export function decide({ tag, existing }) {
  return { build: !existing.includes(tag.split(':')[1]) };
}

/** wrangler.toml の [[containers]] の image(Dockerfile のパス)と image_vars を、レジストリのイメージに差し替える。 */
export function rewriteWranglerImage(toml, ref) {
  const imageLine = /^image = "\.\/containers\/demo\/Dockerfile"\n/m;
  if (!imageLine.test(toml)) throw new Error('wrangler.toml: image = "./containers/demo/Dockerfile" が見つからない');
  return toml.replace(imageLine, `image = "${ref}"\n`).replace(/^image_vars = .*\n/m, '');
}

function wrangler(args, opts = {}) {
  return execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts });
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const lock = JSON.parse(readFileSync(`${DIR}/image.lock.json`, 'utf8'));
  const account = lock.image.split('/')[1];
  const sha = contextSha256(contextFiles());
  const tag = imageTag(sha);
  const ref = `registry.cloudflare.com/${account}/${tag}`;
  let existing = '';
  try { existing = wrangler(['containers', 'images', 'list', '--filter', REPO]); }
  catch (e) { console.log(`[container-image] 一覧を取れなかった(作る側に倒す): ${e.message}`); }
  const { build } = decide({ tag, existing });
  console.log(`[container-image] 中身 ${sha.slice(0, 12)} → ${build ? '作る' : '作らない(既にある)'}: ${tag}`);
  let use = ref;
  if (build && !dryRun) {
    try { execFileSync('npx', ['wrangler', 'containers', 'build', '-p', '-t', tag, DIR], { stdio: 'inherit' }); }
    catch (e) {
      use = lock.image;
      console.log(`[container-image] 作れなかった。最後に動いたイメージで出す: ${use}(${e.message})`);
    }
  }
  if (dryRun) { console.log(`[container-image] dry-run: image = "${use}"`); return; }
  writeFileSync('wrangler.toml', rewriteWranglerImage(readFileSync('wrangler.toml', 'utf8'), use));
  console.log(`[container-image] wrangler.toml の image = "${use}"`);
  if (process.argv.includes('--no-deploy')) return;
  // デプロイの失敗は隠さない(終了コードをそのまま返す)。
  execFileSync('npx', ['wrangler', 'deploy', ...DEPLOY_ARGS], { stdio: 'inherit' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
