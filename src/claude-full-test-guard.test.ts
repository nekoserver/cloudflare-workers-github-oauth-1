import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// ユーザー指定(2026-11-06、AGENT.md 14〜18行): このコンテナでは全体テストを実行しない(standard-1で50分を超える)。
// 2026-11-08、AGENT.md・NOTICE・D1(ce-k1)に記録があったのにエージェントが読まずに全体テストを走らせたため、
// Claude CodeのPreToolUseフック(.claude/settings.json)で、範囲を指定しない vitest・npm test を機械的に止める。
const run = (command: string) => spawnSync('node', ['scripts/claude-full-test-guard.js'], {
  input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8',
});

describe('全体テストの自動停止', () => {
  it.each([
    'npx vitest run',
    'npx vitest',
    'vitest run --reporter dot',
    'cd ~/cloudflare-workers-github-oauth-1 && npx vitest run 2>&1 | tail -15',
    'npm test',
    'npm run test',
    'npm t',
    'npx vitest run -t 表示',
    // Codex・Museの評価(agent-guard-hooks-20261108)で指摘されたすり抜け
    'pnpm exec vitest run',
    './node_modules/.bin/vitest run',
    'sh -c "npx vitest run"',
    'bash -c npm test',
    'npx vitest run .',
    'npx vitest run src',
    'npx vitest run ./src/',
    'npm run test:unit',
  ])('範囲を指定しない「%s」は止め、AGENT.mdを理由に返す', (command) => {
    const r = run(command);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('AGENT.md');
  });

  it.each([
    'npx vitest run src/views/museInquiries.test.ts',
    'npx vitest run src/views/museInquiries.test.ts 2>&1 | tail -5',
    'npx vitest run --reporter dot src/cf-containers',
    'npx vitest run museInquiries',
    'npm test -- src/views/museInquiries.test.ts',
    'npx vitest run --changed',
    'npx vitest related src/utils/museInquiryBoard.ts',
    'npm run test:unit -- src/views/museInquiries.test.ts',
    'echo "npx vitest run は禁止"',
    'git status',
    'grep -n vitest package.json',
    'cat vitest.config.ts',
  ])('範囲を指定した実行や、テスト以外の「%s」は通す', (command) => {
    expect(run(command).status).toBe(0);
  });

  it('入力が壊れていても、ほかのコマンドを止めない', () => {
    const r = spawnSync('node', ['scripts/claude-full-test-guard.js'], { input: 'not json', encoding: 'utf8' });
    expect(r.status).toBe(0);
  });

  it('.claude/settings.json に、Bash の PreToolUse フックとして登録されている', () => {
    const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
    const entries = settings.hooks.PreToolUse.filter((h: { matcher: string }) => h.matcher === 'Bash');
    expect(JSON.stringify(entries)).toContain('scripts/claude-full-test-guard.js');
  });
});
