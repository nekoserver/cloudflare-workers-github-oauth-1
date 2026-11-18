import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');
const entrypoint = readFileSync('containers/demo/entrypoint.sh', 'utf8');

describe('demoコンテナのsshguardと検索ツール', () => {
  it('sshdのログをファイルに出し、sshguardがそれを監視してnftablesで遮断する', () => {
    // sshdは-D -eで標準エラーに出し、時刻を付けて/tmp/sshd.logへ追記する(sshguardが読める形式)
    expect(entrypoint).toContain('"$SSHD_BIN" -D -e -p 2222 2> >(');
    expect(entrypoint).toContain('done >> /tmp/sshd.log');
    expect(entrypoint).toContain('BACKEND="/usr/libexec/sshguard/sshg-fw-nft-sets"');
    expect(entrypoint).toContain('LOGREADER="LANG=C tail -F -n 0 /tmp/sshd.log"');
    expect(readFileSync('containers/demo/server.js', 'utf8')).toContain("'/tmp/sshguard.log'");
  });
  it('jjは公式のリリースのバイナリ(musl)を取得してPATHに置く', () => {
    expect(dockerfile).toContain('install -m 755 /tmp/jj/jj /usr/bin/jj');
  });
});

describe('demoコンテナのCodexネットワーク許可', () => {
  it('起動時にsandbox_workspace_writeが無ければnetwork_access = trueを追記する', () => {
    const ep = readFileSync('containers/demo/entrypoint.sh', 'utf8');
    expect(ep).toContain("grep -q '^\\[sandbox_workspace_write\\]' /root/.codex/config.toml");
    expect(ep).toContain("printf '\\n[sandbox_workspace_write]\\nnetwork_access = true\\n' >> /root/.codex/config.toml");
  });
});

describe('demoコンテナのファイアウォール', () => {
  const ep = readFileSync('containers/demo/entrypoint.sh', 'utf8');
  it('ループバックの後、IPv6は送信元・件数・ログを取ってから破棄する', () => {
    const lo = ep.indexOf('    iif lo accept');
    const v6 = ep.indexOf('meta nfproto ipv6 update @drop_src6 { ip6 saddr counter } counter');
    const v6log = ep.indexOf('meta nfproto ipv6 limit rate 10/second burst 20 packets log prefix "nft-drop ipv6 "');
    const v6drop = ep.indexOf('    meta nfproto ipv6 drop');
    expect(lo).toBeGreaterThan(-1);
    expect(v6).toBeGreaterThan(lo);
    expect(v6log).toBeGreaterThan(v6);
    expect(v6drop).toBeGreaterThan(v6log);
  });
  it('NEWは許可し、それ以外は送信元・件数・ログを取ってからpolicy dropで破棄する', () => {
    expect(ep).toContain('type filter hook input priority 0; policy drop;');
    const accept = ep.indexOf('ct state established,related,new accept');
    const rest = ep.indexOf('meta nfproto ipv4 update @drop_src4 { ip saddr counter } counter');
    expect(accept).toBeGreaterThan(-1);
    expect(rest).toBeGreaterThan(accept);
    expect(ep).toContain('limit rate 10/second burst 20 packets log prefix "nft-drop policy "');
    expect(ep).toContain('ct state invalid limit rate 10/second burst 20 packets log prefix "nft-drop invalid "');
  });
  it('/debug/netで件数・送信元とカーネルログを見られる', () => {
    const server = readFileSync('containers/demo/server.js', 'utf8');
    expect(server).toContain("runCmd('nft', ['list', 'ruleset'])");
    expect(server).toContain('grep nft-drop');
  });
});
