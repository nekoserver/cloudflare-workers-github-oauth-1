import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 対象: demoコンテナのイメージの作り方(wrangler.toml の [[containers]])と、戻すためのイメージの記録(containers/demo/image.lock.json)。
// 経緯: 2026-11-11、Workers BuildsのDockerビルドが「runc ... mounting "proc" ... operation not permitted」で落ち続けたため、
// ビルド済みのイメージをdigestで固定し、GitHub Actions で作り直す方式にした。
// 2026-11-13(ユーザー指定): GitHub Actions は使わない。Workers Builds の本番のデプロイ(npx wrangler deploy)で、Dockerfile からイメージを作る方式に戻す。
// image.lock.json は、最後に動いたイメージ(Workers Builds のビルドが落ちたときに戻す先)の記録として残す。
// 故障想定: Dockerfile のパスやビルド引数がずれて別のイメージになる / 戻す先のdigestの書式が崩れる。

const lock = JSON.parse(readFileSync('containers/demo/image.lock.json', 'utf8')) as { image: string; buildArgs: Record<string, string>; builtFrom: string };
const wrangler = readFileSync('wrangler.toml', 'utf8');
const block = wrangler.slice(wrangler.indexOf('[[containers]]'));

describe('demoコンテナのイメージは Workers Builds が Dockerfile から作る(2026-11-13)', () => {
  it('wrangler.toml は Dockerfile のパスを指し、ビルド引数を image_vars で渡す', () => {
    expect(block).toMatch(/^image = "\.\/containers\/demo\/Dockerfile"$/m);
    expect(block).toMatch(/^image_vars = \{ INSTALL_DOCKER = "false", INSTALL_VITEST = "true", INSTALL_TYPESCRIPT = "true", INSTALL_WRANGLER = "true" \}$/m);
  });

  it('ビルド引数は、最後に動いたイメージを作ったときと同じ', () => {
    expect(lock.buildArgs).toEqual({ INSTALL_DOCKER: 'false', INSTALL_VITEST: 'true', INSTALL_TYPESCRIPT: 'true', INSTALL_WRANGLER: 'true' });
  });

  it('戻す先のイメージ(最後に動いたもの)をdigestで記録している', () => {
    expect(lock.image).toMatch(/^registry\.cloudflare\.com\/[0-9a-f]{32}\/cloudflare-workers-github-oauth-1-democontainer@sha256:[0-9a-f]{64}$/);
    expect(lock.builtFrom).toBeTruthy();
  });
});
