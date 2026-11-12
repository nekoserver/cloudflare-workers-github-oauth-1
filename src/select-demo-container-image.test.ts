import { describe, it, expect } from 'vitest';
import { contextFiles, contextSha256, imageTag, decide, rewriteWranglerImage } from '../scripts/select-demo-container-image.mjs';

// 対象: Workers Builds のビルドコマンドで、demo コンテナのイメージを作るかどうかを決める(ユーザー指定 2026-11-13)。
// 方針: イメージを作るのは containers/demo の中身が変わったときだけ。Worker だけ・ドキュメントだけの変更では作らない。
// 中身のハッシュを付けたタグ(ctx-<12桁>)のイメージがレジストリにあれば使い、無いときだけ作って push する。作れなければ最後に動いたイメージ(image.lock.json)で出す。
// 故障想定: ドキュメントの変更でハッシュが変わってビルドが走る / 既にあるのに作り直す / 作れないとき Worker のデプロイまで止まる / wrangler.toml の書き換え漏れ。

describe('demo コンテナのイメージを作るかどうか', () => {
  it('中身のハッシュは、テスト・文書・記録(image.lock.json)を含めない', () => {
    const files = contextFiles();
    expect(files).toContain('Dockerfile');
    expect(files.some((f: string) => f.endsWith('.md') || f.startsWith('tests/') || f === 'image.lock.json')).toBe(false);
    expect(contextSha256(files)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('タグは中身のハッシュの先頭12桁で決まる', () => {
    expect(imageTag('0123456789abcdef'.repeat(4))).toBe('cloudflare-workers-github-oauth-1-democontainer:ctx-0123456789ab');
  });

  it('同じ中身のイメージがあれば作らない', () => {
    expect(decide({ tag: 'x:ctx-aaa', existing: 'repo  ctx-aaa  ...' })).toEqual({ build: false });
  });

  it('無ければ作る', () => {
    expect(decide({ tag: 'x:ctx-aaa', existing: 'repo  ctx-bbb  ...' })).toEqual({ build: true });
  });

  it('wrangler.toml の image を差し替え、image_vars を消す', () => {
    const toml = '[[containers]]\nclass_name = "DemoContainer"\nimage = "./containers/demo/Dockerfile"\nimage_vars = { INSTALL_DOCKER = "false" }\nmax_instances = 1\n';
    const out = rewriteWranglerImage(toml, 'registry.cloudflare.com/abc/x:ctx-aaa');
    expect(out).toContain('image = "registry.cloudflare.com/abc/x:ctx-aaa"\n');
    expect(out).not.toContain('image_vars');
    expect(out).not.toContain('./containers/demo/Dockerfile');
  });

  it('書き換える行が無ければ失敗する(黙って Dockerfile からのビルドにしない)', () => {
    expect(() => rewriteWranglerImage('[[containers]]\nimage = "other"\n', 'r')).toThrow();
  });
});
