import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const server = require('../containers/demo/server.js') as {
  extractVersion: (text: string) => string | null;
  compareVersions: (a: string, b: string) => number;
  judgeVersion: (actual: string | null, expected?: string, minimum?: string) => 'ok' | 'warn' | 'ng';
};

describe('demoコンテナ: バージョンの取り出しと判定', () => {
  it('各コマンドの出力から版を取り出す', () => {
    expect(server.extractVersion('v26.12.1')).toBe('26.12.1');
    expect(server.extractVersion('Server version: Apache/2.4.66 (Ubuntu)')).toBe('2.4.66');
    expect(server.extractVersion('OpenSSH_10.2p1 Ubuntu-2ubuntu3.8, OpenSSL 3.5.5')).toBe('10.2p1');
    expect(server.extractVersion('cloudflared version 2026.10.1 (built 2026-10-15)')).toBe('2026.10.1');
    expect(server.extractVersion('1.104.1-ERR-BuildInfo')).toBe('1.104.1');
    expect(server.extractVersion('2.1.306 (Claude Code)')).toBe('2.1.306');
    expect(server.extractVersion('[実行失敗: spawn codex ENOENT]')).toBeNull();
  });
  it('版を数値で比べる', () => {
    expect(server.compareVersions('26.12.1', '26.12.0')).toBeGreaterThan(0);
    expect(server.compareVersions('26.9.0', '26.12.1')).toBeLessThan(0);
    expect(server.compareVersions('1.104.1', '1.104.1')).toBe(0);
  });
  it('無ければ赤、最低版より古ければ赤、想定と違えば黄、それ以外は緑', () => {
    expect(server.judgeVersion(null, '0.163.0')).toBe('ng');
    expect(server.judgeVersion('26.12.0', '26.12.1', '26.12.1')).toBe('ng');
    expect(server.judgeVersion('26.13.0', '26.12.1', '26.12.1')).toBe('warn');
    expect(server.judgeVersion('26.12.1', '26.12.1', '26.12.1')).toBe('ok');
    expect(server.judgeVersion('2.4.66')).toBe('ok');
  });
});

describe('demoコンテナ: 想定の版の書き出しと画面表示', () => {
  it('Dockerfileが固定した版を/etc/image-versions.jsonに書き出す', () => {
    const df = readFileSync('containers/demo/Dockerfile', 'utf8');
    expect(df).toContain('/etc/image-versions.json');
  });
  it('ページにバージョン表を出し、判定ごとに色を付ける', () => {
    const view = readFileSync('src/views/cfContainers.ts', 'utf8');
    expect(view).toContain('id="version-table"');
    expect(view).toContain('.badge[data-level="warn"]');
  });
});

describe('Cloudflare Tunnel一覧が0件のときの表示', () => {
  it('問い合わせたアカウントの末尾とトークンの種類を出す', () => {
    const view = readFileSync('src/views/cfContainers.ts', 'utf8');
    expect(view).toContain("'(トンネルが見つかりません: アカウント末尾' + (q.accountIdTail || '?')");
    const index = readFileSync('src/index.ts', 'utf8');
    expect(index).toContain('queriedWith: { accountIdTail: c.env.CLOUDFLARE_ACCOUNT_ID.slice(-4), tokenSource: cfApiKeySource(c.env) }');
  });
});

describe('コンテナのイメージのビルド情報', () => {
  it('wrangler.tomlの[build]でbuild-info.jsonを書き出し、Dockerfileがコピーする', () => {
    expect(readFileSync('wrangler.toml', 'utf8')).toContain('command = "sh scripts/write-container-build-info.sh"');
    const sh = readFileSync('scripts/write-container-build-info.sh', 'utf8');
    expect(sh).toContain('WORKERS_CI_COMMIT_SHA');
    expect(sh).toContain('WORKERS_CI_BUILD_UUID');
    expect(readFileSync('containers/demo/Dockerfile', 'utf8')).toContain('COPY server.js build-info*.json ./');
  });
  it('/healthにbuildを含め、ページにコミットとビルドを出す', () => {
    expect(readFileSync('containers/demo/server.js', 'utf8')).toContain('build: readBuildInfo(),');
    expect(readFileSync('src/views/cfContainers.ts', 'utf8')).toContain("'イメージ: commit ' + String(build.commit || '?').slice(0, 7)");
  });
});
