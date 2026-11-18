import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// ユーザー指定(2026-11-07): Apacheはaptの版(2.4.66)ではなく上流の最新をソースからビルドしたものを使う。
// コンテナのCPUではソースビルドが重いため、git・OpenSSHと同じく、ビルド済みのパッケージをpackages/に保管して
// イメージのビルドではCOPYとsha256の照合だけを行う(コンパイルも取得もしない)。
const dockerfile = readFileSync(new URL('../containers/demo/Dockerfile', import.meta.url), 'utf8');
const sums = readFileSync(new URL('../containers/demo/packages/SHA256SUMS', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../containers/demo/packages/README.md', import.meta.url), 'utf8');
const version = dockerfile.match(/^ARG APACHE_VERSION=(\S+)$/m)?.[1];

describe('demoコンテナ: Apacheはビルド済みのパッケージを使う', () => {
  it('版を全ステージ共有のARGで固定する', () => {
    expect(version).toMatch(/^2\.4\.\d+$/);
  });
  it('保管したパッケージをCOPYし、SHA256SUMSと同じハッシュで照合する', () => {
    const pkg = `apache-${version}-linux-x64-ubuntu26.04.tar.xz`;
    expect(dockerfile).toContain('COPY packages/apache-${APACHE_VERSION}-linux-x64-ubuntu26.04.tar.xz /tmp/apache.tar.xz');
    const pinned = dockerfile.match(/^ARG APACHE_PACKAGE_SHA256=([0-9a-f]{64})$/m)?.[1];
    expect(pinned).toBeTruthy();
    expect(sums).toContain(`${pinned}  ${pkg}`);
    expect(dockerfile).toContain('echo "${APACHE_PACKAGE_SHA256}  /tmp/apache.tar.xz" | sha256sum -c -');
  });
  it('元のソースもSHA256SUMSとREADMEに記録する', () => {
    expect(sums).toMatch(new RegExp(`^[0-9a-f]{64}  httpd-${version!.replace(/\./g, '\\.')}\\.tar\\.gz$`, 'm'));
    expect(readme).toContain(`## Apache httpd ${version}`);
  });
  it('aptのapache2はholdし、apt upgradeでビルド済みの本体が戻らないようにする', () => {
    expect(dockerfile).toContain('apt-mark hold apache2 apache2-bin apache2-data apache2-utils');
  });
  it('入れた後に版・静的モジュール・共有ライブラリ・設定を確かめる', () => {
    expect(dockerfile).toContain('test "$(apache2 -v | sed -n \'s#^Server version: Apache/\\([0-9.]*\\) .*#\\1#p\')" = "${APACHE_VERSION}"');
    expect(dockerfile).toContain("apache2 -l | grep -q 'mod_unixd.c'");
    expect(dockerfile).toContain("if ldd /usr/sbin/apache2 /usr/lib/apache2/modules/*.so | grep -q 'not found'; then exit 1; fi");
    expect(dockerfile).toContain(". /etc/apache2/envvars; exec apache2 -t");
  });
  it('/etc/image-versions.jsonに想定の版を書き出し、/healthで比べる', () => {
    expect(dockerfile).toContain('"apache":"%s"');
    const server = createRequire(import.meta.url)('../containers/demo/server.js') as { VERSION_SOURCES: Array<{ name: string; key?: string }> };
    expect(server.VERSION_SOURCES).toContainEqual(expect.objectContaining({ name: 'apache', key: 'apache' }));
  });
});

describe('demoコンテナ: jq', () => {
  it('aptでjqを入れる', () => {
    expect(dockerfile).toMatch(/apt-get install -y --no-install-recommends \\\n(?:.*\\\n)*?.*\bjq\b/);
  });
});
