import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

// ユーザー指定(2026-11-08): 「不要ならビルド指示をつけるな」。
// mainへのマージごとに、Worker側だけの変更でもWorkers Buildsがコンテナのイメージを作り直し、コンテナが入れ替わっていた
// (本番D1: #2544のマージ3秒後にビルド57段、cf_container_snapshotsのimage_commitが更新)。
// デプロイの命令を scripts/workers-deploy.sh にし、コンテナに関わるファイルが変わったときだけイメージを作る。
// それ以外は wrangler deploy --containers-rollout=none (Workerだけ。公式: イメージのビルド・送信とインスタンスの入れ替えを飛ばす)。
const run = (env: Record<string, string>) => spawnSync('bash', ['scripts/workers-deploy.sh'], {
  encoding: 'utf8', env: { ...process.env, WORKERS_DEPLOY_DRY_RUN: '1', ...env },
});
const cmd = (r: ReturnType<typeof run>) => (r.stdout.split('\n').find((l) => l.startsWith('DEPLOY: ')) || '').slice(8);

describe('Workers Buildsのデプロイ: コンテナに関わる変更のときだけイメージを作る', () => {
  it.each([
    'src/views/museInquiries.ts\nsrc/utils/museInquiryBoard.ts',
    'README.md\nSPEC.x.md',
    'scripts/claude-full-test-guard.js\n.claude/settings.json',
  ])('コンテナに触れない変更(%s)はWorkerだけをデプロイする', (changed) => {
    const r = run({ WORKERS_DEPLOY_CHANGED: changed });
    expect(r.status).toBe(0);
    expect(cmd(r)).toBe('npx wrangler deploy --containers-rollout=none');
  });

  it.each([
    'containers/demo/Dockerfile',
    'containers/demo/entrypoint.sh\nsrc/views/x.ts',
    'src/containers/demoContainer.ts',
    'wrangler.toml',
  ])('コンテナに関わる変更(%s)は通常のデプロイでイメージも作る', (changed) => {
    const r = run({ WORKERS_DEPLOY_CHANGED: changed });
    expect(r.status).toBe(0);
    expect(cmd(r)).toBe('npx wrangler deploy');
  });

  it('差分が分からないとき(浅いクローンなど)は、安全側で通常のデプロイにする', () => {
    const r = run({ WORKERS_DEPLOY_CHANGED: '__UNKNOWN__' });
    expect(cmd(r)).toBe('npx wrangler deploy');
    expect(r.stdout).toContain('差分を取れない');
  });

  it('FORCE_CONTAINER_BUILD=1 なら、変更に関わらずイメージを作る(前回のイメージのビルドが失敗したときの作り直し用)', () => {
    const r = run({ WORKERS_DEPLOY_CHANGED: 'src/views/x.ts', FORCE_CONTAINER_BUILD: '1' });
    expect(cmd(r)).toBe('npx wrangler deploy');
  });

  it('判断の理由と、変わったファイルのうちコンテナに関わるものを出す', () => {
    const r = run({ WORKERS_DEPLOY_CHANGED: 'containers/demo/Dockerfile\nsrc/views/x.ts' });
    expect(r.stdout).toContain('containers/demo/Dockerfile');
    expect(r.stdout).not.toContain('src/views/x.ts\n');
  });
});
