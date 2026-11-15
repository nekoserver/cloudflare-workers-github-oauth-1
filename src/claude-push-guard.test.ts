import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// エージェントが git push する前に、自動で検査する(Claude CodeのPreToolUseフック、.claude/settings.json)。
// 指示やルールを読み忘れても、検査は飛ばせない。失敗したら終了コード2でpushを止め、理由をエージェントに返す。
const run = (command: string, env: Record<string, string>) => spawnSync('node', ['scripts/claude-push-guard.js'], {
  input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8',
  env: { ...process.env, PUSH_GUARD_TRACKED_NODE_MODULES: '', ...env },
});

describe('pushの前の自動検査', () => {
  it('git push 以外のコマンドは、何もしないで通す', () => {
    const r = run('git status', { PUSH_GUARD_CHANGED: 'containers/demo/Dockerfile', PUSH_GUARD_TEST_CMD: 'false' });
    expect(r.status).toBe(0);
  });
  it('コンテナに触れる変更で検査が失敗したら、pushを止めて理由を返す', () => {
    const r = run('git push -u origin x', { PUSH_GUARD_CHANGED: 'containers/demo/Dockerfile', PUSH_GUARD_TEST_CMD: 'false' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('src/cf-containers');
  });
  it('コンテナに触れる変更で検査が通れば、pushを通す', () => {
    expect(run('git push', { PUSH_GUARD_CHANGED: 'containers/demo/t3-embed-proxy.cjs', PUSH_GUARD_TEST_CMD: 'true' }).status).toBe(0);
  });
  it('コンテナに触れない変更では、コンテナの検査を走らせない', () => {
    expect(run('git push', { PUSH_GUARD_CHANGED: 'README.md', PUSH_GUARD_TEST_CMD: 'false' }).status).toBe(0);
  });
  // 2026-11-15: node_modules が自分自身を指すシンボリックリンクとしてコミットされ(fee856be)、
  // リポジトリの中でテストを起動できず、ガードが「テストの失敗」としてpushを止め続けた。原因が分からず、hookが壊れたように見えた。
  it('node_modules がgitで追跡されていたら、変更の中身に関わらずpushを止め、外し方を返す', () => {
    const r = run('git push', { PUSH_GUARD_CHANGED: 'README.md', PUSH_GUARD_TEST_CMD: 'true', PUSH_GUARD_TRACKED_NODE_MODULES: 'node_modules' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('node_modules がgitで追跡されています');
    expect(r.stderr).toContain('git rm --cached node_modules');
  });
  it('node_modules が追跡されていなければ、その検査では止めない', () => {
    expect(run('git push', { PUSH_GUARD_CHANGED: 'README.md', PUSH_GUARD_TEST_CMD: 'false', PUSH_GUARD_TRACKED_NODE_MODULES: '' }).status).toBe(0);
  });
  // 実際の壊れた環境では、npx は何も出さずに終了コード216で終わった。出力では判定できないため、起動の前に node_modules を調べる。
  it('node_modules が自分自身を指すシンボリックリンクなら、テストを起動せずに止め、テストの失敗と区別して直し方を返す', () => {
    const dir = mkdtempSync(join(tmpdir(), 'push-guard-'));
    symlinkSync(join(dir, 'node_modules'), join(dir, 'node_modules'));
    const r = run('git push', { PUSH_GUARD_CHANGED: 'containers/demo/Dockerfile', PUSH_GUARD_TEST_CMD: 'true', PUSH_GUARD_NODE_MODULES_DIR: join(dir, 'node_modules') });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('テストを起動できませんでした');
    expect(r.stderr).toContain('自分自身を指すシンボリックリンク');
    expect(r.stderr).toContain('rm -rf node_modules && npm ci');
    expect(r.stderr).not.toContain('src/cf-containers のテストを直してから');
  });
  it('node_modules に vitest が無ければ、テストを起動せずに止める', () => {
    const dir = mkdtempSync(join(tmpdir(), 'push-guard-'));
    mkdirSync(join(dir, 'node_modules'));
    const r = run('git push', { PUSH_GUARD_CHANGED: 'containers/demo/Dockerfile', PUSH_GUARD_TEST_CMD: 'true', PUSH_GUARD_NODE_MODULES_DIR: join(dir, 'node_modules') });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('vitest が入っていません');
  });
  it('node_modules が正常なら、その検査では止めずにテストへ進む', () => {
    const dir = mkdtempSync(join(tmpdir(), 'push-guard-'));
    mkdirSync(join(dir, 'node_modules', 'vitest'), { recursive: true });
    writeFileSync(join(dir, 'node_modules', 'vitest', 'package.json'), '{}');
    expect(run('git push', { PUSH_GUARD_CHANGED: 'containers/demo/Dockerfile', PUSH_GUARD_TEST_CMD: 'true', PUSH_GUARD_NODE_MODULES_DIR: join(dir, 'node_modules') }).status).toBe(0);
  });
  it('.claude/settings.json に、Bash の PreToolUse フックとして登録されている', () => {
    const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
    const entry = settings.hooks.PreToolUse.find((h: { matcher: string }) => h.matcher === 'Bash');
    expect(JSON.stringify(entry.hooks)).toContain('scripts/claude-push-guard.js');
  });
});
