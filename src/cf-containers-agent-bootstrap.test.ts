import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 起動時の初期セットアップ(Codexのサインイン復元)。
// 関数単体をシェルで実行して振る舞いを検証する(fakeのcodexをPATHの先頭に置く)。
const SCRIPT = join(process.cwd(), 'containers/demo/agent-bootstrap.sh');

interface Fixture {
  dir: string;
  bin: string;
  state: string;
  home: string;
  log: string;
  calls: string;
}

let current: Fixture | undefined;

function setup(): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'agent-bootstrap-test-'));
  const bin = join(dir, 'bin');
  const state = join(dir, 'state');
  const home = join(dir, 'home');
  const log = join(dir, 'bootstrap.log');
  const calls = join(dir, 'calls.log');
  for (const d of [bin, state, home]) mkdirSync(d, { recursive: true });
  writeFileSync(join(bin, 'codex'), `#!/bin/bash\necho "codex $*" >> "${calls}"\nexit 0\n`);
  chmodSync(join(bin, 'codex'), 0o755);
  current = { dir, bin, state, home, log, calls };
  return current;
}

function run(f: Fixture, env: Record<string, string> = {}) {
  const r = spawnSync('bash', ['-c', `. "${SCRIPT}"; agent_bootstrap`], {
    env: {
      PATH: `${f.bin}:${process.env.PATH}`,
      HOME: f.home,
      AGENT_STATE_DIR: f.state,
      AGENT_BOOTSTRAP_LOG: f.log,
      ...env,
    },
    encoding: 'utf-8',
  });
  const calls = existsSync(f.calls) ? readFileSync(f.calls, 'utf-8').trim().split('\n').filter(Boolean) : [];
  const log = existsSync(f.log) ? readFileSync(f.log, 'utf-8') : '';
  return { status: r.status, output: r.stdout + r.stderr, calls, log };
}

afterEach(() => {
  if (current) rmSync(current.dir, { recursive: true, force: true });
  current = undefined;
});

describe('agent_bootstrap: 状態ファイルが無い場合', () => {
  it('何もせず成功で終わり、スキップしたことをログに残す', () => {
    const f = setup();
    const r = run(f);
    expect(r.status).toBe(0);
    expect(r.calls).toHaveLength(0);
    expect(r.log).toContain('codex-auth.json');
  });
});

describe('agent_bootstrap: Codexのサインイン復元', () => {
  const AUTH = '{"tokens":{"access_token":"SECRET-TOKEN-VALUE"}}';

  it('~/.codex/auth.json が無ければ状態ファイルから復元し、権限を600にする', () => {
    const f = setup();
    writeFileSync(join(f.state, 'codex-auth.json'), AUTH);
    const r = run(f);
    const dest = join(f.home, '.codex/auth.json');
    expect(r.status).toBe(0);
    expect(readFileSync(dest, 'utf-8')).toBe(AUTH);
    expect(statSync(dest).mode & 0o777).toBe(0o600);
  });

  it('すでに ~/.codex/auth.json があれば上書きしない', () => {
    const f = setup();
    mkdirSync(join(f.home, '.codex'), { recursive: true });
    writeFileSync(join(f.home, '.codex/auth.json'), '{"existing":true}');
    writeFileSync(join(f.state, 'codex-auth.json'), AUTH);
    run(f);
    expect(readFileSync(join(f.home, '.codex/auth.json'), 'utf-8')).toBe('{"existing":true}');
  });

  it('トークンの値をログにも標準出力にも出さない', () => {
    const f = setup();
    writeFileSync(join(f.state, 'codex-auth.json'), AUTH);
    const r = run(f);
    expect(r.output).not.toContain('SECRET-TOKEN-VALUE');
    expect(r.log).not.toContain('SECRET-TOKEN-VALUE');
  });

  it('JSONとして壊れた状態ファイルは復元せず、失敗として記録する(空のファイルを作らない)', () => {
    const f = setup();
    writeFileSync(join(f.state, 'codex-auth.json'), 'not json');
    const r = run(f);
    expect(r.status).not.toBe(0);
    expect(r.log).toContain('FAIL');
    expect(existsSync(join(f.home, '.codex/auth.json'))).toBe(false);
  });
});

describe('demo container wiring for agent-bootstrap', () => {
  it('スクリプトはシェルとして構文エラーが無い', () => {
    const r = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf-8' });
    expect(r.status).toBe(0);
  });

  it('entrypoint.sh は関数を読み込み、バックグラウンドで実行する(起動を止めない)', () => {
    const s = readFileSync('containers/demo/entrypoint.sh', 'utf-8');
    expect(s).toMatch(/agent-bootstrap\.sh/);
    expect(s).toMatch(/agent_bootstrap/);
    const idx = s.indexOf('agent_bootstrap');
    expect(s.slice(idx, idx + 200)).toMatch(/&\s*$/m);
  });

  it('Dockerfile が agent-bootstrap.sh をイメージへ配置する', () => {
    const s = readFileSync('containers/demo/Dockerfile', 'utf-8');
    expect(s).toMatch(/COPY\s+agent-bootstrap\.sh\s+\/usr\/local\/bin\/agent-bootstrap\.sh/);
  });

  it('秘密情報をイメージにCOPYしない(状態ファイルは起動時に外から置く)', () => {
    const s = readFileSync('containers/demo/Dockerfile', 'utf-8');
    expect(s).not.toMatch(/COPY[^\n]*codex-auth/);
  });
});
