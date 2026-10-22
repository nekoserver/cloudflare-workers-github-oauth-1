import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 22番は本番ではプラットフォーム側のdropbearが先に取っている(/debug/netのss -tulpnで確認、2026-10-17)。
// このイメージのsshdは2222番で待ち受け、ヘルスチェックもそこを見ること。
describe('demo container sshd port', () => {
  it('entrypoint.sh starts sshd on 2222', () => {
    const s = readFileSync('containers/demo/entrypoint.sh', 'utf-8');
    expect(s).toMatch(/\/usr\/sbin\/sshd -p 2222 /);
  });

  it('server.js health probes 2222 for sshd', () => {
    const s = readFileSync('containers/demo/server.js', 'utf-8');
    expect(s).toMatch(/probeTcp\(2222\)/);
    expect(s).not.toMatch(/probeTcp\(22\)/);
  });
  it('routes the nekoroot tunnel to the same SSH port and Apache 8443', () => {
    const ingress = readFileSync('containers/demo/cloudflared-ingress.yml.template', 'utf8');
    expect(ingress).toContain('service: ssh://127.0.0.1:2222');
    expect(ingress).toContain('service: https://127.0.0.1:8443');
    expect(ingress).not.toMatch(/service: ssh:\/\/127\.0\.0\.1:22\s/);
  });
});
