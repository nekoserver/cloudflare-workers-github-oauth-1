import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 公式のリリースにコンパイル済みのバイナリがあるものは、ソースからビルドしない(毎回のビルドで約20分かかっていた)。
// 2026-10-21 にソースビルドへ変えた理由は「エージェントのサンドボックスから配布元に届かない」ことで、本番のビルドには関係なかった。
// 取得物は、配布元の値で固定したsha256で照合する(gh: gh_<版>_checksums.txt、jj: 配布物から計算した値)。
const dockerfile = readFileSync(new URL('../containers/demo/Dockerfile', import.meta.url), 'utf8');
const arg = (name: string) => dockerfile.match(new RegExp(`^ARG ${name}=(\\S+)`, 'm'))?.[1];

describe('公式のリリースのバイナリを使う', () => {
  it('ghとjjをソースからビルドしない', () => {
    expect(dockerfile).not.toContain('github.com/cli/cli/v2/cmd/gh@');
    expect(dockerfile).not.toContain('cargo install');
    expect(dockerfile).not.toMatch(/^FROM \S+ AS (gh|jj)-build/m);
  });
  it('ghはGitHubのリリースから取得し、sha256で照合する', () => {
    expect(dockerfile).toContain('https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz');
    expect(arg('GH_SHA256')).toMatch(/^[a-f0-9]{64}$/);
    expect(dockerfile).toContain('echo "${GH_SHA256}  /tmp/gh.tar.gz" | sha256sum -c -');
  });
  it('jjはGitHubのリリース(musl)から取得し、sha256で照合する', () => {
    expect(dockerfile).toContain('https://github.com/jj-vcs/jj/releases/download/v${JJ_VERSION}/jj-v${JJ_VERSION}-x86_64-unknown-linux-musl.tar.gz');
    expect(arg('JJ_SHA256')).toMatch(/^[a-f0-9]{64}$/);
    expect(dockerfile).toContain('echo "${JJ_SHA256}  /tmp/jj.tar.gz" | sha256sum -c -');
  });
  it('固定したsha256は、固定した版のもの', () => {
    // 版を上げるときは、配布元の値でsha256も上げる(下の表もあわせて直す)
    expect({ gh: [arg('GH_VERSION'), arg('GH_SHA256')], jj: [arg('JJ_VERSION'), arg('JJ_SHA256')] }).toEqual({
      gh: ['2.103.3', '4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d'],
      jj: ['0.46.0', 'fce0271158e665ceb82dc66c5eb95b1728649094e9133074f3b5baece345fc08'],
    });
  });
});
