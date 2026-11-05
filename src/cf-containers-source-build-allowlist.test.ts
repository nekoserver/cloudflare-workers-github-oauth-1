import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 方針(CLAUDE.md ルール44、ユーザー指定 2026-10-31): 公式のコンパイル済みのバイナリがあるものは、それを使うのが既定。
// ソースからのビルドは、下の表に「コンパイル済みを使えない理由」を書いたものだけに限る。
// 新しくソースビルドを足す(または、公式のバイナリからソースビルドへ戻す)には、ユーザーの許可を得て、この表に理由を書く。
// 理由が解消したら、公式のバイナリへ切り替えて、表から消す。
const ALLOWED_SOURCE_BUILDS: Record<string, string> = {
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
  'ruby-build': { verify: "/opt/ruby/bin/ruby -ropenssl", remove: 'rm -rf /tmp/ruby-src /tmp/ruby.tar.gz /tmp/ruby-pkg.tgz /tmp/ruby-cache-check' },
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

// ソースを捨てる前に、ソースからのコンパイル時間と、パッケージ(キャッシュ)からのインストール時間を測り、
// CACHE_EFFECT の行をビルドログへ出す。ビルドの記録の取り込み(storeBuildTimings)が、D1の cf_container_build_cache_effects に保存する。
const EFFECT_PACKAGE: Record<string, string> = { 'ruby-build': 'ruby' };
describe('ソースを捨てる前に、キャッシュの効果を測ってログに出す', () => {
  it('許可したソースビルドには、すべてパッケージ名の対応がある', () => {
    expect(Object.keys(EFFECT_PACKAGE).sort()).toEqual(Object.keys(ALLOWED_SOURCE_BUILDS).sort());
  });
  for (const [name, packageName] of Object.entries(EFFECT_PACKAGE)) {
    it(`${name}: パッケージを作り、そこから入れ直して時間を測り、ソースを消す前に CACHE_EFFECT を出す`, () => {
      const run = stages.find(item => item.name === name)!.text.split(/^RUN /m).find(text => SOURCE_BUILD.test(text))!;
      const effect = run.indexOf('CACHE_EFFECT package=' + packageName + ' ');
      expect(effect, 'CACHE_EFFECT の行が無い').toBeGreaterThan(0);
      expect(run).toContain('compile_ms=');
      expect(run).toContain('install_ms=');
      expect(run).toContain('source_bytes=');
      expect(run).toContain('package_bytes=');
      expect(run).toMatch(/tar -czf \/tmp\/\S+-pkg\.tgz/);
      expect(run).toMatch(/tar -xzf \/tmp\/\S+-pkg\.tgz/);
      expect(effect).toBeLessThan(run.indexOf(CLEANUP[name].remove));
    });
  }
});
