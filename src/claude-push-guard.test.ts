import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// エージェントが git push する前に、自動で検査する(Claude CodeのPreToolUseフック、.claude/settings.json)。
// 指示やルールを読み忘れても、検査は飛ばせない。失敗したら終了コード2でpushを止め、理由をエージェントに返す。
const run = (command: string, env: Record<string, string>) => spawnSync('node', ['scripts/claude-push-guard.js'], {
  input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8',
  env: { ...process.env, ...env },
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
  it('.claude/settings.json に、Bash の PreToolUse フックとして登録されている', () => {
    const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
    const entry = settings.hooks.PreToolUse.find((h: { matcher: string }) => h.matcher === 'Bash');
    expect(JSON.stringify(entry.hooks)).toContain('scripts/claude-push-guard.js');
  });
});
