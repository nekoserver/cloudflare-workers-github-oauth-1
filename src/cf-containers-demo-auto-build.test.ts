import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// SPEC.cloudflare-workers-github-oauth-1.20261111.container-auto-build.md
// 故障想定: スクリプトの入力の計算がテスト(cf-containers-image-lock)と食い違う / 書き込みで wrangler.toml や buildArgs を壊す /
// digest の無い参照を固定する / パッケージの更新で古い版が残る / ワークフローが承認していないシークレットを使う・同じ入力で作り直す。

const ROOT = process.cwd();
const LOCK_SCRIPT = join(ROOT, 'scripts/demo-image-lock.mjs');
const APPLY_SCRIPT = join(ROOT, 'scripts/demo-packages-apply.mjs');

// cf-containers-image-lock.test.ts と同じ計算(独立に書き、スクリプトと突き合わせる)
function testSideContext(root: string) {
  const files = execFileSync('git', ['-C', root, 'ls-files', 'containers/demo'], { encoding: 'utf8' }).split('\n').filter(Boolean)
    .map((f) => f.slice('containers/demo/'.length))
    .filter((f) => f !== 'image.lock.json' && !f.startsWith('tests/') && !f.endsWith('.md')).sort();
  const hash = createHash('sha256');
  for (const f of files) { hash.update(f + '\0'); hash.update(readFileSync(join(root, 'containers/demo', f))); hash.update('\0'); }
  return { files, sha: hash.digest('hex') };
}
const run = (script: string, args: string[], cwd = ROOT) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });

describe('scripts/demo-image-lock.mjs', () => {
  it('入力の一覧とハッシュが、cf-containers-image-lock のテストの計算と一致する', () => {
    const r = run(LOCK_SCRIPT, ['--print-context']);
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout) as { files: string[]; contextSha256: string };
    const expected = testSideContext(ROOT);
    expect(out.files).toEqual(expected.files);
    expect(out.contextSha256).toBe(expected.sha);
  });

  it('--check は、固定と入力が一致すれば0、違えば1で理由を出す', () => {
    const lock = JSON.parse(readFileSync(join(ROOT, 'containers/demo/image.lock.json'), 'utf8'));
    const same = lock.contextSha256 === testSideContext(ROOT).sha;
    const r = run(LOCK_SCRIPT, ['--check']);
    expect(r.status).toBe(same ? 0 : 1);
    expect(r.stdout).toMatch(same ? /^OK / : /^REBUILD /);
  });

  it('--write は image.lock.json と wrangler.toml の image を更新し、buildArgs を保つ。digest の無い参照は拒む', () => {
    const dir = mkdtempSync(join(tmpdir(), 'demo-lock-'));
    try {
      execFileSync('git', ['init', '-q', dir]);
      mkdirSync(join(dir, 'containers/demo'), { recursive: true });
      writeFileSync(join(dir, 'containers/demo/Dockerfile'), 'FROM ubuntu:26.04\n');
      writeFileSync(join(dir, 'containers/demo/entrypoint.sh'), 'echo hi\n');
      writeFileSync(join(dir, 'containers/demo/README.md'), 'docs\n');
      const old = 'registry.cloudflare.com/' + '0'.repeat(32) + '/cloudflare-workers-github-oauth-1-democontainer@sha256:' + '1'.repeat(64);
      const neu = 'registry.cloudflare.com/' + '0'.repeat(32) + '/cloudflare-workers-github-oauth-1-democontainer@sha256:' + '2'.repeat(64);
      writeFileSync(join(dir, 'containers/demo/image.lock.json'), JSON.stringify({ image: old, contextSha256: 'x', files: [], buildArgs: { INSTALL_DOCKER: 'false' }, builtFrom: 'old' }));
      writeFileSync(join(dir, 'wrangler.toml'), `name = "x"\n[[containers]]\n# keep this comment\nimage = "${old}"\nmax_instances = 1\n`);
      execFileSync('git', ['-C', dir, 'add', '-A']);
      expect(run(LOCK_SCRIPT, ['--write', '--image', 'registry.cloudflare.com/acct/x:latest', '--built-from', 'abc'], dir).status).not.toBe(0);
      const r = run(LOCK_SCRIPT, ['--write', '--image', neu, '--built-from', 'main abc123 (GitHub Actions)'], dir);
      expect(r.status, r.stderr).toBe(0);
      const lock = JSON.parse(readFileSync(join(dir, 'containers/demo/image.lock.json'), 'utf8'));
      expect(lock.image).toBe(neu);
      expect(lock.builtFrom).toBe('main abc123 (GitHub Actions)');
      expect(lock.buildArgs).toEqual({ INSTALL_DOCKER: 'false' });
      expect(lock.files).toEqual(['Dockerfile', 'entrypoint.sh']);
      expect(lock.contextSha256).toBe(testSideContext(dir).sha);
      const toml = readFileSync(join(dir, 'wrangler.toml'), 'utf8');
      expect(toml).toContain(`image = "${neu}"`);
      expect(toml).not.toContain(old);
      expect(toml).toContain('# keep this comment');
      expect(run(LOCK_SCRIPT, ['--check'], dir).status).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('scripts/demo-packages-apply.mjs', () => {
  function fixture() {
    const dir = mkdtempSync(join(tmpdir(), 'demo-pkg-'));
    const pk = join(dir, 'containers/demo/packages');
    mkdirSync(pk, { recursive: true });
    writeFileSync(join(dir, 'containers/demo/Dockerfile'), [
      'ARG GIT_VERSION=2.56.0', 'ARG APACHE_VERSION=2.4.70', 'ARG GIT_VERSION',
      'ARG GIT_PACKAGE_SHA256=' + 'a'.repeat(64), 'ARG APACHE_VERSION', 'ARG APACHE_PACKAGE_SHA256=' + 'b'.repeat(64), '',
    ].join('\n'));
    for (const f of ['git-2.56.0-linux-x64-ubuntu26.04.tar.xz', 'git-2.56.0.tar.xz', 'apache-2.4.70-linux-x64-ubuntu26.04.tar.xz', 'httpd-2.4.70.tar.gz', 'httpd-2.4.70.tar.gz.asc', 'jj-v0.47.1.tar.gz']) writeFileSync(join(pk, f), f);
    writeFileSync(join(pk, 'SHA256SUMS'), ['j'.repeat(64) + '  jj-v0.47.1.tar.gz', 'a'.repeat(64) + '  git-2.56.0-linux-x64-ubuntu26.04.tar.xz', 'c'.repeat(64) + '  git-2.56.0.tar.xz', 'b'.repeat(64) + '  apache-2.4.70-linux-x64-ubuntu26.04.tar.xz', 'd'.repeat(64) + '  httpd-2.4.70.tar.gz', ''].join('\n'));
    writeFileSync(join(pk, 'README.md'), '# packages\n\n## git 2.56.0\n\nold git notes\n\n## Apache httpd 2.4.70\n\nold apache notes\n');
    const out = join(dir, 'out');
    mkdirSync(out);
    for (const f of ['git-2.56.1-linux-x64-ubuntu26.04.tar.xz', 'git-2.56.1.tar.xz', 'apache-2.4.71-linux-x64-ubuntu26.04.tar.xz', 'httpd-2.4.71.tar.gz']) writeFileSync(join(out, f), 'new ' + f);
    return { dir, pk, out };
  }
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');

  it('新しいパッケージを置き、古い版を消し、Dockerfile の版とハッシュ・SHA256SUMS を更新する', () => {
    const { dir, pk, out } = fixture();
    try {
      const r = run(APPLY_SCRIPT, ['--from', out, '--git', '2.56.1', '--apache', '2.4.71', '--built', '2026-11-11 GitHub Actions ubuntu:26.04'], dir);
      expect(r.status, r.stderr).toBe(0);
      const df = readFileSync(join(dir, 'containers/demo/Dockerfile'), 'utf8');
      expect(df).toContain('ARG GIT_VERSION=2.56.1');
      expect(df).toContain('ARG APACHE_VERSION=2.4.71');
      expect(df).toContain('ARG GIT_PACKAGE_SHA256=' + sha('new git-2.56.1-linux-x64-ubuntu26.04.tar.xz'));
      expect(df).toContain('ARG APACHE_PACKAGE_SHA256=' + sha('new apache-2.4.71-linux-x64-ubuntu26.04.tar.xz'));
      expect(df).not.toMatch(/2\.56\.0|2\.4\.70/);
      for (const f of ['git-2.56.0-linux-x64-ubuntu26.04.tar.xz', 'git-2.56.0.tar.xz', 'apache-2.4.70-linux-x64-ubuntu26.04.tar.xz', 'httpd-2.4.70.tar.gz', 'httpd-2.4.70.tar.gz.asc']) expect(existsSync(join(pk, f)), f).toBe(false);
      expect(existsSync(join(pk, 'jj-v0.47.1.tar.gz'))).toBe(true);
      const sums = readFileSync(join(pk, 'SHA256SUMS'), 'utf8');
      expect(sums).toContain('j'.repeat(64) + '  jj-v0.47.1.tar.gz');
      expect(sums).toContain(sha('new httpd-2.4.71.tar.gz') + '  httpd-2.4.71.tar.gz');
      expect(sums).not.toMatch(/2\.56\.0|2\.4\.70/);
      const readme = readFileSync(join(pk, 'README.md'), 'utf8');
      expect(readme).toContain('## git 2.56.1\n');
      expect(readme).toContain('## Apache httpd 2.4.71\n');
      expect(readme).not.toMatch(/^## (git 2\.56\.0|Apache httpd 2\.4\.70)$/m);
      expect(readme).toContain('Rebuilt: 2026-11-11 GitHub Actions ubuntu:26.04');
      expect(readme).toContain(sha('new httpd-2.4.71.tar.gz'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('出力のファイルが足りなければ、何も変えずに失敗する', () => {
    const { dir, out } = fixture();
    try {
      rmSync(join(out, 'httpd-2.4.71.tar.gz'));
      const before = readFileSync(join(dir, 'containers/demo/Dockerfile'), 'utf8');
      expect(run(APPLY_SCRIPT, ['--from', out, '--git', '2.56.1', '--apache', '2.4.71', '--built', 'x'], dir).status).not.toBe(0);
      expect(readFileSync(join(dir, 'containers/demo/Dockerfile'), 'utf8')).toBe(before);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('ワークフロー', () => {
  const secretsOf = (y: string) => new Set([...y.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]));
  it('container-image: ワークフローは存在しない(GitHub Actions は使わない。2026-11-18 に利用者が削除)', () => {
    expect(existsSync(join(ROOT, '.github/workflows/container-image.yml'))).toBe(false);
  });
  it('demo-packages: ubuntu:26.04 のコンテナでビルドスクリプトを動かし、更新を適用してテストを通してから PR を出す', () => {
    const y = readFileSync(join(ROOT, '.github/workflows/demo-packages.yml'), 'utf8');
    expect(y).toContain('workflow_dispatch');
    expect(y).toMatch(/image: ubuntu:26\.04/);
    expect(y).toContain('bash scripts/build-demo-packages-ubuntu26.sh');
    expect(y).toContain('node scripts/demo-packages-apply.mjs');
    expect(y.indexOf('npx vitest run')).toBeLessThan(y.indexOf('gh pr create'));
    expect(secretsOf(y)).toEqual(new Set(['GITHUB_TOKEN']));
  });
  it('ビルドスクリプトは root で動くとき sudo を使わない(コンテナの中で動かすため)', () => {
    const s = readFileSync(join(ROOT, 'scripts/build-demo-packages-ubuntu26.sh'), 'utf8');
    expect(s).toMatch(/id -u/);
    expect(s).not.toMatch(/^sudo apt-get/m);
  });
});
