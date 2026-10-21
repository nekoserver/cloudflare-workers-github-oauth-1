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

describe('demoコンテナのCodexネットワーク許可', () => {
  it('起動時にsandbox_workspace_writeが無ければnetwork_access = trueを追記する', () => {
    const ep = readFileSync('containers/demo/entrypoint.sh', 'utf8');
    expect(ep).toContain("grep -q '^\\[sandbox_workspace_write\\]' /root/.codex/config.toml");
    expect(ep).toContain("printf '\\n[sandbox_workspace_write]\\nnetwork_access = true\\n' >> /root/.codex/config.toml");
  });
});

describe('demoコンテナのIPv6遮断', () => {
  it('ループバックを許可した後でIPv6の受信と転送を破棄する', () => {
    const ep = readFileSync('containers/demo/entrypoint.sh', 'utf8');
    const lo = ep.indexOf('nft add rule inet filter input iif lo accept');
    const v6 = ep.indexOf('nft add rule inet filter input meta nfproto ipv6 drop');
    expect(lo).toBeGreaterThan(-1);
    expect(v6).toBeGreaterThan(lo);
    expect(ep).toContain('nft add rule inet filter forward meta nfproto ipv6 drop');
  });
});
