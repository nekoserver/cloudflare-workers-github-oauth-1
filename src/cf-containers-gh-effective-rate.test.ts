import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

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
    expect(df).toContain('COPY cf /usr/local/bin/cf');
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
