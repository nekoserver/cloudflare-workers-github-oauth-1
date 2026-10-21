import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');
const entrypoint = readFileSync('containers/demo/entrypoint.sh', 'utf8');

describe('demoコンテナのsshguardと検索ツール', () => {
  it('sshdのログをファイルに出し、sshguardがそれを監視してnftablesで遮断する', () => {
    expect(entrypoint).toContain('/usr/sbin/sshd -p 2222 -E /tmp/sshd.log &');
    expect(entrypoint).toContain('BACKEND="/usr/libexec/sshguard/sshg-fw-nft-sets"');
    expect(entrypoint).toContain('LOGREADER="LANG=C tail -F -n 0 /tmp/sshd.log"');
    expect(readFileSync('containers/demo/server.js', 'utf8')).toContain("'/tmp/sshguard.log'");
  });
  it('jjをcrates.ioのソースからビルドしてPATHに置く', () => {
    expect(dockerfile).toContain('cargo install --locked jj-cli@${JJ_VERSION}');
    expect(dockerfile).toContain('COPY --from=jj-build /usr/local/cargo/bin/jj /usr/bin/jj');
  });
});
