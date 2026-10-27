import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// TAILSCALE_LOGIN_SERVER を読んで tailscale up に --login-server を付け、
// 失敗時は1分間隔で3回リトライし、それでも駄目なら tailscaled を停止する。
// 本番のコンテナでは起動を止めないようバックグラウンドで実行するため、
// 関数単体をシェルで実行して振る舞いを検証する(fake の tailscale を PATH の先頭に置く)。
const SCRIPT = join(process.cwd(), 'containers/demo/tailscale-up.sh');

interface Fixture {
  dir: string;
  bin: string;
  callLog: string;
  daemon: ChildProcess;
}

function setupFixture(failTimes: number): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'ts-up-test-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const callLog = join(dir, 'calls.log');
  // fake tailscale: 呼び出しの引数を記録し、最初の failTimes 回だけ失敗する。
  writeFileSync(join(bin, 'tailscale'), `#!/bin/bash
echo "$*" >> "${callLog}"
count=$(wc -l < "${callLog}")
if [ "$count" -le ${failTimes} ]; then exit 1; fi
exit 0
`);
  chmodSync(join(bin, 'tailscale'), 0o755);
  const daemon = spawn('sleep', ['300'], { stdio: 'ignore' });
  return { dir, bin, callLog, daemon };
}

function runScript(fixture: Fixture, env: Record<string, string>) {
  const logPath = join(fixture.dir, 'tailscale-up.log');
  const command = `. "${SCRIPT}"; tailscale_up_with_retry`;
  const result = spawnSync('bash', ['-c', command], {
    env: {
      PATH: `${fixture.bin}:${process.env.PATH}`,
      TAILSCALE_AUTHKEY: 'tskey-test',
      TAILSCALED_PID: String(fixture.daemon.pid),
      TAILSCALE_UP_LOG: logPath,
      TAILSCALE_UP_INTERVAL: '0',
      ...env,
    },
    encoding: 'utf-8',
  });
  const calls = existsSync(fixture.callLog) ? readFileSync(fixture.callLog, 'utf-8').trim().split('\n') : [];
  return { status: result.status, output: result.stdout + result.stderr, calls, logPath };
}

function daemonAlive(fixture: Fixture): boolean {
  return fixture.daemon.exitCode === null && fixture.daemon.signalCode === null;
}

describe('tailscale_up_with_retry', () => {
  let fixture: Fixture | undefined;

  beforeEach(() => {
    fixture = undefined;
  });

  afterEach(() => {
    if (fixture) {
      fixture.daemon.kill();
      rmSync(fixture.dir, { recursive: true, force: true });
    }
  });

  it('TAILSCALE_LOGIN_SERVER が未設定なら --login-server を付けない(既定の管理サーバーを使う)', () => {
    fixture = setupFixture(0);
    const r = runScript(fixture, {});
    expect(r.status).toBe(0);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]).not.toContain('--login-server');
    expect(r.calls[0]).toContain('--authkey=tskey-test');
  });

  it('TAILSCALE_LOGIN_SERVER が設定されていれば --login-server=<URL> を付ける', () => {
    fixture = setupFixture(0);
    const r = runScript(fixture, { TAILSCALE_LOGIN_SERVER: 'https://headscale.example.com' });
    expect(r.status).toBe(0);
    expect(r.calls[0]).toContain('--login-server=https://headscale.example.com');
  });

  it('1回目が失敗し2回目で成功すれば、リトライして成功扱いにする(tailscaledは止めない)', () => {
    fixture = setupFixture(1);
    const r = runScript(fixture, {});
    expect(r.status).toBe(0);
    expect(r.calls).toHaveLength(2);
    expect(daemonAlive(fixture)).toBe(true);
  });

  it('全試行が失敗したら tailscaled を停止し、失敗を記録して非0で終わる', () => {
    fixture = setupFixture(99);
    const r = runScript(fixture, {});
    // 初回 + リトライ3回 = 4回呼ばれる
    expect(r.calls).toHaveLength(4);
    expect(r.status).not.toBe(0);
    expect(r.output).toContain('tailscaled');
    expect(readFileSync(r.logPath, 'utf-8')).toContain('attempt 4');
    // 停止シグナルは非同期に届くため、少し待ってから確認する
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        try {
          expect(daemonAlive(fixture!)).toBe(false);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, 200);
    });
  });

  it('リトライ間隔は TAILSCALE_UP_INTERVAL に従う(本番では60秒)', () => {
    fixture = setupFixture(99);
    const start = Date.now();
    runScript(fixture, { TAILSCALE_UP_INTERVAL: '1' });
    // 4回の試行の間に3回の待機(1秒ずつ)が入る
    expect(Date.now() - start).toBeGreaterThanOrEqual(3000);
  });
});

describe('demo container wiring for TAILSCALE_LOGIN_SERVER', () => {
  it('entrypoint.sh は関数を読み込み、バックグラウンドで実行する(起動を止めない)', () => {
    const s = readFileSync('containers/demo/entrypoint.sh', 'utf-8');
    expect(s).toMatch(/tailscale-up\.sh/);
    expect(s).toMatch(/tailscale_up_with_retry/);
    expect(s).toMatch(/TAILSCALED_PID=\$!/);
    expect(s).not.toMatch(/tailscale up --authkey="\$\{TAILSCALE_AUTHKEY\}"/);
  });

  it('Dockerfile が tailscale-up.sh をイメージへ配置する', () => {
    const s = readFileSync('containers/demo/Dockerfile', 'utf-8');
    expect(s).toMatch(/COPY\s+tailscale-up\.sh\s+\/usr\/local\/bin\/tailscale-up\.sh/);
  });

  it('Worker が TAILSCALE_LOGIN_SERVER をコンテナへ渡す', () => {
    const s = readFileSync('src/containers/demoContainer.ts', 'utf-8');
    expect(s).toMatch(/TAILSCALE_LOGIN_SERVER: env\.TAILSCALE_LOGIN_SERVER \?\? ''/);
    const t = readFileSync('src/types.ts', 'utf-8');
    expect(t).toMatch(/TAILSCALE_LOGIN_SERVER\?: string/);
  });
});
