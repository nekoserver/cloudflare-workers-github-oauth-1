import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALLOWED_SECRET_NAMES } from './utils/cfWorkerSecretApi';

describe('コンテナ内ghのトークン(CONTAINER_GH_TOKEN→GH_TOKEN)', () => {
  it('Workerのシークレットをコンテナへ GH_TOKEN として渡す(本体のGITHUB_TOKENは流用しない)', () => {
    const dc = readFileSync('src/containers/demoContainer.ts', 'utf8');
    expect(dc).toContain("GH_TOKEN: env.CONTAINER_GH_TOKEN ?? '',");
    expect(dc).not.toContain('env.GITHUB_TOKEN');
  });
  it('値があるときだけSSHのシェル用に書き出し、gitの認証をghに任せる', () => {
    const ep = readFileSync('containers/demo/entrypoint.sh', 'utf8');
    expect(ep).toContain(`if [ -n "\${GH_TOKEN:-}" ]; then printf 'export GH_TOKEN=%q\\n' "$GH_TOKEN"; fi`);
    expect(ep).toContain('gh auth setup-git');
    expect(ep).toContain('. /etc/profile.d/cf-env.sh');
  });
  it('ページのトークン設定から入れられる', () => {
    expect(ALLOWED_SECRET_NAMES).toContain('CONTAINER_GH_TOKEN');
    expect(readFileSync('src/views/cfContainers.ts', 'utf8')).toContain('<option value="CONTAINER_GH_TOKEN">');
  });
});
