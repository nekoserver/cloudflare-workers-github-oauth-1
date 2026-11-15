import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Claude Code のフック(UserPromptSubmit・SessionStart、scripts/claude-self-check-guard.js)。
// 毎回の発言の前に、ユーザー指定の行動指針をエージェントの文脈に差し込む。
//   - 2026-11-13: 自分で調べられることはユーザーに聞く前に確かめる
//   - 2026-11-15: 自分で決められることはいちいち質問せず、選んだものを報告する
//
// 故障シナリオ:
//   (1) 指示の一部が消え、エージェントが調べずに聞く・決められることを質問する
//   (2) フックの登録が外れ、指示が差し込まれない

const run = () => spawnSync('node', ['scripts/claude-self-check-guard.js'], { input: '{}', encoding: 'utf8' });

describe('発言の前に差し込む行動指針', () => {
  it('自分で調べられることは、聞く前に確かめるよう指示する', () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('こっちに聞く前に自分で確認しろ');
  });

  it('自分で決められることは、いちいち質問せずに進め、選んだものを報告するよう指示する', () => {
    const r = run();
    expect(r.stdout).toContain('いちいち質問するな');
    expect(r.stdout).toContain('何を選んだかを報告に書く');
    expect(r.stdout).toContain('取り消しにくい操作');
  });

  it('.claude/settings.json の UserPromptSubmit と SessionStart に登録されている', () => {
    const hooks = JSON.parse(readFileSync('.claude/settings.json', 'utf8')).hooks;
    for (const event of ['UserPromptSubmit', 'SessionStart']) {
      expect(JSON.stringify(hooks[event]), event).toContain('scripts/claude-self-check-guard.js');
    }
  });
});
