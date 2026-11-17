import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('/cf-containers 実質時間単価とgh', () => {
  it('総経費を総接続時間で割った時間単価を表示する(接続0秒では出さない)', () => {
    const view = readFileSync('src/views/cfContainers.ts', 'utf8');
    expect(view).toContain('実質時間単価(総経費÷総接続時間)');
    expect(view).toContain('data.cost.estimatedCostUsd / (data.cost.cumulativeConnectedSeconds / 3600)');
    expect(view).toContain('data.cost.cumulativeConnectedSeconds > 0');
  });
  it('イメージにgitとghを入れる', () => {
    expect(readFileSync('containers/demo/Dockerfile', 'utf8')).toContain('COPY packages/git-${GIT_VERSION}-linux-x64-ubuntu26.04.tar.xz /tmp/git.tar.xz');
    expect(readFileSync('containers/demo/Dockerfile', 'utf8')).toContain('install -m 755 /tmp/gh/bin/gh /usr/bin/gh');
  });
});

describe('demoコンテナのwranglerとcf', () => {
  it('wranglerを/opt/node22のnpmで入れてPATHに置き、cfもPATHに置く', () => {
    const df = readFileSync('containers/demo/Dockerfile', 'utf8');
    expect(df).toContain('PATH=/opt/node22/bin:$PATH npm install -g wrangler');
    expect(df).toContain('PATH=/opt/node22/bin:$PATH exec /opt/node22/bin/wrangler');
    expect(df).toContain('COPY cf-api /usr/local/bin/cf-api');
  });
  // 公式の Cloudflare CLI(npm の cf、bin は cf と cloudflare)を版を固定して入れる(ユーザー指定 2026-11-13)。
  // 自作の簡易スクリプトは名前がぶつかるので cf-api に移した。
  it('公式の Cloudflare CLI(cf)を版を固定して入れ、/usr/local/bin/cf に置く', () => {
    const df = readFileSync('containers/demo/Dockerfile', 'utf8');
    expect(df).toMatch(/^ARG CF_CLI_VERSION=1\.0\.0-rc\.1$/m);
    expect(df).toContain('npm install -g cf@${CF_CLI_VERSION}');
    expect(df).toContain('ln -sf /opt/node22/bin/cf /usr/local/bin/cf');
    expect(df).toContain('cf --version');
    expect(df).not.toContain('COPY cf /usr/local/bin/cf\n');
    expect(existsSync('containers/demo/cf')).toBe(false);
    expect(existsSync('containers/demo/cf-api')).toBe(true);
  });
});

describe('demoコンテナの日本語ロケール', () => {
  it('ja_JP.UTF-8を生成し、SSHのシェルでも既定にする', () => {
    const df = readFileSync('containers/demo/Dockerfile', 'utf8');
    expect(df).toContain('locale-gen ja_JP.UTF-8');
    expect(df).toContain("printf 'LANG=ja_JP.UTF-8\\n' > /etc/default/locale");
    expect(df).toContain("printf 'export LANG=ja_JP.UTF-8\\n' > /etc/profile.d/locale.sh");
  });
});
