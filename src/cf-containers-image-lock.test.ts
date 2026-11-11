import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// 対象: demoコンテナのイメージを、ビルド済みのものをdigestで固定する(ユーザー指定、2026-11-11。dynamicnekoと同じ方式)。
// 背景: 2026-11-11、Workers BuildsのDockerビルドが、どのステージも最初のRUNで
// 「runc run failed: ... mounting "proc" ... operation not permitted」と落ち続け、Workerもデプロイできなくなった。
// 故障想定: containers/demo を変えたのにイメージを作り直さず、古いイメージのまま「デプロイ成功」になる /
// wrangler.toml がDockerfileからのビルドに戻る / 固定する番号の書式が崩れる。

const DIR = 'containers/demo';
const lock = JSON.parse(readFileSync(`${DIR}/image.lock.json`, 'utf8')) as { image: string; contextSha256: string; files: string[]; buildArgs: Record<string, string>; builtFrom: string };
const wrangler = readFileSync('wrangler.toml', 'utf8');
const REMEDY = 'containers/demo/ が変わっています。Dockerのある環境でイメージを作り直し(例: npx wrangler containers build -p -t cloudflare-workers-github-oauth-1-democontainer:<tag> containers/demo)、出力されたdigestで containers/demo/image.lock.json の image・contextSha256・files・builtFrom と wrangler.toml の image を更新してください。';

/** イメージの中身を決めるファイル(gitで管理しているもの。テスト・文書・この固定の記録そのものは除く)。 */
export function contextFiles(): string[] {
  return execFileSync('git', ['ls-files', DIR], { encoding: 'utf8' }).split('\n').filter(Boolean)
    .map((f) => f.slice(DIR.length + 1))
    .filter((f) => f !== 'image.lock.json' && !f.startsWith('tests/') && !f.endsWith('.md'))
    .sort();
}
export function contextSha256(files: string[]): string {
  const hash = createHash('sha256');
  for (const f of files) { hash.update(f + '\0'); hash.update(readFileSync(`${DIR}/${f}`)); hash.update('\0'); }
  return hash.digest('hex');
}

describe('demoコンテナのイメージはビルド済みのものをdigestで固定する', () => {
  it('固定した番号の書式', () => {
    expect(lock.image).toMatch(/^registry\.cloudflare\.com\/[0-9a-f]{32}\/cloudflare-workers-github-oauth-1-democontainer@sha256:[0-9a-f]{64}$/);
    expect(lock.builtFrom).toBeTruthy();
  });

  it('wrangler.tomlは固定したイメージを使い、デプロイのたびにDockerfileからビルドしない', () => {
    const block = wrangler.slice(wrangler.indexOf('[[containers]]'));
    expect(block).toContain(`image = "${lock.image}"`);
    expect(block).not.toMatch(/^image = "\.\/containers\/demo\/Dockerfile"/m);
    expect(block).not.toMatch(/^image_vars\s*=/m);
  });

  it('containers/demo の中身が、固定したイメージを作ったときと同じ(違えばイメージの作り直しが要る)', () => {
    const files = contextFiles();
    expect(files, 'ファイルの増減。' + REMEDY).toEqual(lock.files);
    expect(contextSha256(files), REMEDY).toBe(lock.contextSha256);
  });

  it('イメージを作ったときのビルド引数を記録している(以前の image_vars)', () => {
    expect(lock.buildArgs).toEqual({ INSTALL_DOCKER: 'false', INSTALL_VITEST: 'true', INSTALL_TYPESCRIPT: 'true', INSTALL_WRANGLER: 'true' });
  });
});
