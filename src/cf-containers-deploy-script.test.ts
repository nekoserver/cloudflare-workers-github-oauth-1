import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// SPEC.cloudflare-workers-github-oauth-1.container-image-explicit-build:
// デプロイは wrangler の変更判定に頼らず、明示ビルド付きスクリプトを通る。
const SCRIPT = 'scripts/deploy-with-container-build.sh';

describe('明示ビルド付きデプロイスクリプト', () => {
  it('スクリプトが存在し、bash として構文が正しい', () => {
    expect(existsSync(SCRIPT)).toBe(true);
    const r = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
    expect(r.status).toBe(0);
  });

  it('入力ハッシュからタグを作り、registry になければ明示ビルドして push する', () => {
    const src = readFileSync(SCRIPT, 'utf8');
    expect(src).toContain('demo-image-lock.mjs --print-context');
    expect(src).toContain('ctx-');
    expect(src).toContain('wrangler containers build');
    expect(src).toContain('-p');
    expect(src).toContain('wrangler containers images list');
  });

  it('digest 固定とロック再記録が deploy より前に来る', () => {
    const src = readFileSync(SCRIPT, 'utf8');
    const writeIdx = src.indexOf('demo-image-lock.mjs --write');
    const deployIdx = src.indexOf('\nnpx wrangler deploy');
    expect(writeIdx).toBeGreaterThan(-1);
    expect(deployIdx).toBeGreaterThan(-1);
    expect(writeIdx).toBeLessThan(deployIdx);
  });
});
