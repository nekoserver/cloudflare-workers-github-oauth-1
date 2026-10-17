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
});
