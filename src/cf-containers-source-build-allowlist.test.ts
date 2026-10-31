import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 方針(CLAUDE.md ルール44、ユーザー指定 2026-10-31): 公式のコンパイル済みのバイナリがあるものは、それを使うのが既定。
// ソースからのビルドは、下の表に「コンパイル済みを使えない理由」を書いたものだけに限る。
// 新しくソースビルドを足す(または、公式のバイナリからソースビルドへ戻す)には、ユーザーの許可を得て、この表に理由を書く。
// 理由が解消したら、公式のバイナリへ切り替えて、表から消す。
const ALLOWED_SOURCE_BUILDS: Record<string, string> = {
  'tailscale-build': 'GitHubのリリースにバイナリが無い。pkgs.tailscale.com はエージェントのサンドボックスから届かず、1.104.4 の sha256 を確かめられていない(2026-10-31)',
  'ruby-build': '公式のコンパイル済みはDebian向けのDockerイメージだけで、UbuntuのイメージへそのままCOPYして動くかを確かめていない(2026-10-31)',
};
const dockerfile = readFileSync(new URL('../containers/demo/Dockerfile', import.meta.url), 'utf8');
// ステージごとに本文を切り出す
const stages = dockerfile.split(/^(?=FROM )/m).map(text => ({ name: text.match(/^FROM \S+(?: AS (\S+))?/)?.[1] ?? '(final)', text }));
const SOURCE_BUILD = /\bgo install\b|\bcargo install\b|\.\/configure\b|\bmake\s+(?:-j|install)|\bcmake\b|\bnpm (?:run )?build\b/;

describe('ソースからのビルドは、理由を書いたものだけ', () => {
  it('ソースビルドをしているステージは、すべて許可の表にある', () => {
    const building = stages.filter(stage => SOURCE_BUILD.test(stage.text)).map(stage => stage.name);
    const unexplained = building.filter(name => !(name in ALLOWED_SOURCE_BUILDS));
    expect(unexplained, 'コンパイル済みの公式バイナリを使うか、ユーザーの許可を得て ALLOWED_SOURCE_BUILDS に理由を書く').toEqual([]);
  });
  it('許可の表に、もうソースビルドしていないステージが残っていない(理由が解消したら消す)', () => {
    const building = new Set(stages.filter(stage => SOURCE_BUILD.test(stage.text)).map(stage => stage.name));
    expect(Object.keys(ALLOWED_SOURCE_BUILDS).filter(name => !building.has(name))).toEqual([]);
  });
});

// 方針(CLAUDE.md ルール44、ユーザー指定 2026-10-31): ソースからビルドしたら、パッケージ(インストール先)まで作り、
// ビルド済みのものが読み込めることを確かめた時点で、ソースツリーとビルドのキャッシュを捨てる。
// Dockerでは、同じRUNの中で「インストール → 動作の確認 → ソースの削除」まで行う。
const CLEANUP: Record<string, { verify: string; remove: string }> = {
  'tailscale-build': { verify: '/go/bin/tailscaled --version', remove: 'go clean -modcache -cache' },
  'ruby-build': { verify: "/opt/ruby/bin/ruby -ropenssl", remove: 'rm -rf /tmp/ruby-src /tmp/ruby.tar.gz' },
};
describe('ソースからビルドしたら、確認の後にソースツリーを捨てる', () => {
  it('許可したソースビルドには、すべて削除の決まりがある', () => {
    expect(Object.keys(CLEANUP).sort()).toEqual(Object.keys(ALLOWED_SOURCE_BUILDS).sort());
  });
  for (const [name, rule] of Object.entries(CLEANUP)) {
    it(`${name}: ビルドと同じRUNの中で、動作を確かめてから、ソースとキャッシュを消す`, () => {
      const stage = stages.find(item => item.name === name)!.text;
      const run = stage.split(/^RUN /m).find(text => SOURCE_BUILD.test(text))!;
      expect(run).toContain(rule.verify);
      expect(run).toContain(rule.remove);
    });
  }
});
