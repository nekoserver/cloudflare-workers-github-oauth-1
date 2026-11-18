import { describe, it, expect, afterEach } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 対象: containers/demo/lib-restore-wait.sh — entrypoint.sh が Apache の起動の後に裏で呼ぶ。
// /root/lib(nekoserver/lib、イメージに入れない)が届くのを待ち、届いたら /var/www/html/lib にbind mountしてから
// lib の restore-claude-host.sh(tunnels API・LLM worker・observer・ストリーム・hook)を1回だけ実行する。
// 経緯(2026-11-18): /root/lib はコンテナの起動から約2時間後に置かれた。起動時に一度だけ見る作りでは、
// 復元もbind mountも行われず、askgk・ワーカータブ・管理者の入口のSSIがすべて止まっていた。
// 故障想定: 届くのを待たずに諦める / 永久に待ち続ける / 復元を2回走らせる / 復元の失敗が記録されない /
// bind mountに失敗すると復元まで止まる / 秘密の値をコマンドラインやログに出す。

const SCRIPT = 'containers/demo/lib-restore-wait.sh';
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) {
    // root で走るとbind mountが本当に行われるので、外してから消す。
    if (spawnSync('mountpoint', ['-q', join(d, 'www')]).status === 0) spawnSync('umount', [join(d, 'www')]);
    rmSync(d, { recursive: true, force: true });
  }
});

function setup() {
  const d = mkdtempSync(join(tmpdir(), 'lib-restore-wait-'));
  dirs.push(d);
  return { d, lib: join(d, 'lib'), www: join(d, 'www'), log: join(d, 'restore.log'), runs: join(d, 'runs') };
}

function placeLib(lib: string, runs: string, exitCode = 0) {
  mkdirSync(join(lib, 'claude/ops'), { recursive: true });
  const restore = join(lib, 'claude/ops/restore-claude-host.sh');
  writeFileSync(restore, `#!/bin/sh\necho run >> '${runs}'\necho "restore output"\nexit ${exitCode}\n`);
  chmodSync(restore, 0o755);
}

function run(args: string[], env: Record<string, string> = {}) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn('sh', [SCRIPT, ...args], { env: { PATH: process.env.PATH ?? '', ...env } });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

describe('lib-restore-wait.sh は /root/lib が届くのを待ってから、lib の復元を1回だけ実行する', () => {
  it('起動の時点で lib があれば、待たずに復元を実行し、出力を記録に残す', async () => {
    const t = setup();
    placeLib(t.lib, t.runs);
    const r = await run([t.lib, t.www, '5', '1', t.log]);
    expect(r.code).toBe(0);
    expect(readFileSync(t.runs, 'utf8')).toBe('run\n');
    expect(readFileSync(t.log, 'utf8')).toContain('restore output');
    expect(r.out).toMatch(/lib: restore-claude-host\.sh done/);
    expect(r.out).not.toMatch(/arrived after/);
  });

  it('lib が後から届いたら、届いた後に復元を実行する(2026-11-18 の起動から約2時間後に届いた場面)', async () => {
    const t = setup();
    const pending = run([t.lib, t.www, '10', '1', t.log]);
    await new Promise((r) => setTimeout(r, 1500));
    expect(existsSync(t.runs)).toBe(false);
    placeLib(t.lib, t.runs);
    const r = await pending;
    expect(r.code).toBe(0);
    expect(readFileSync(t.runs, 'utf8')).toBe('run\n');
    expect(r.out).toMatch(/lib: .* arrived after \d+s/);
  });

  it('上限まで届かなければ、理由を記録して諦める(永久に待たない)', async () => {
    const t = setup();
    const started = Date.now();
    const r = await run([t.lib, t.www, '2', '1', t.log]);
    expect(r.code).not.toBe(0);
    expect(Date.now() - started).toBeLessThan(8000);
    expect(r.out).toMatch(/WARN: lib: no .*restore-claude-host\.sh after 2s/);
    expect(existsSync(t.runs)).toBe(false);
  });

  it('復元が失敗したら WARN を残す', async () => {
    const t = setup();
    placeLib(t.lib, t.runs, 3);
    const r = await run([t.lib, t.www, '5', '1', t.log]);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/WARN: lib: restore-claude-host\.sh failed \(see .*restore\.log\)/);
  });

  it('bind mount の成否に関わらず復元は実行する(失敗なら理由を残す)', async () => {
    const t = setup();
    placeLib(t.lib, t.runs);
    const r = await run([t.lib, t.www, '5', '1', t.log]);
    expect(readFileSync(t.runs, 'utf8')).toBe('run\n');
    expect(r.out).toMatch(/lib: mounted .* on .*www|WARN: lib: mount --bind .* failed|lib: .*www is already mounted/);
  });

  it('秘密の値は、記録にも出力にも出さない(環境変数のまま復元へ引き継ぐ)', async () => {
    const t = setup();
    placeLib(t.lib, t.runs);
    const r = await run([t.lib, t.www, '5', '1', t.log], { ORIGIN_HMAC_SECRET: 'secret-value-x' });
    expect(r.out).not.toContain('secret-value-x');
    expect(readFileSync(t.log, 'utf8')).not.toContain('secret-value-x');
    expect(readFileSync(SCRIPT, 'utf8')).not.toMatch(/ORIGIN_HMAC_SECRET|MUSE_API_KEY/);
  });

  it('引数が足りなければ、使い方を出して止まる', async () => {
    const r = await run([]);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/usage: lib-restore-wait\.sh LIB_DIR WWW_DIR TIMEOUT_SECONDS INTERVAL_SECONDS LOG_FILE/);
  });
});
