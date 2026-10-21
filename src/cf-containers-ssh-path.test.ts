import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('SSHのセッションでもcodex等が見つかる', () => {
  it('codex・node・npm・npxを/usr/local/binにリンクし、/opt/node22/binをログインシェルのPATHに入れる', () => {
    const df = readFileSync('containers/demo/Dockerfile', 'utf8');
    expect(df).toContain('for b in node npm npx codex; do ln -sf /opt/node22/bin/$b /usr/local/bin/$b; done');
    expect(df).toContain("printf 'export PATH=/opt/node22/bin:$PATH\\n' > /etc/profile.d/node22.sh");
    expect(df).toContain('>> /etc/bash.bashrc');
  });
  it('チェックスクリプトでSSHと同じ条件のコマンド探索を確認する', () => {
    expect(readFileSync('scripts/check-cf-containers.sh', 'utf8')).toContain("env -i HOME=/root TERM=xterm bash -lc 'for c in node npm codex claude wrangler gh jj git cf;");
  });
});
