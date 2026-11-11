import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ユーザー指定(2026-11-11): Claude Codeの応答を日本語に強制する(.claude/settings.jsonのhook)。
// 指示を差し込むだけでは英語で答えてしまったことがあるため、Stopフックで最後の応答を調べ、
// 日本語(かな・漢字)がほとんど無ければ止めて書き直させる。
// 故障想定: 日本語の応答を止める(コードやURLが多い応答を含む) / 英語の応答を通す / 書き直しで無限に止める /
// 記録(transcript)が読めないときに止めて作業を妨げる / 指示の差し込みが設定から外れる。

const run = (input: unknown) => spawnSync('node', ['scripts/claude-japanese-guard.js'], { input: JSON.stringify(input), encoding: 'utf8' });

function transcript(lines: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), 'jaguard-'));
  const file = join(dir, 't.jsonl');
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return file;
}
const assistant = (text: string) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
const toolOnly = { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: 'Bash', input: {} }] } };
const user = (text: string) => ({ type: 'user', message: { role: 'user', content: text } });

describe('Stopフック: 最後の応答が日本語でなければ止める', () => {
  it('英語だけの応答は終了コード2で止め、日本語で書き直すよう伝える', () => {
    const file = transcript([user('テストして'), assistant('All 56 tests pass and the typecheck is clean. The PR is open as a draft.')]);
    const r = run({ hook_event_name: 'Stop', transcript_path: file, stop_hook_active: false });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('日本語');
  });

  it('日本語の応答は通す。コード・コマンド・URL・英語の識別子が多くても通す', () => {
    const text = [
      'muse-monitorを直しました。',
      '```bash\nnpx wrangler secret put MONITOR_HMAC_SECRET\n```',
      '- PR: https://github.com/nekoserver/muse-monitor/pull/7',
      '`fetchMuseMonitor` が `hmac_rejected` を返したら `MONITOR_HMAC_SECRET` を揃えてください。',
    ].join('\n');
    const file = transcript([user('x'), assistant(text)]);
    expect(run({ hook_event_name: 'Stop', transcript_path: file, stop_hook_active: false }).status).toBe(0);
  });

  it('最後のテキストの応答を見る(後ろにツール呼び出しだけの行があっても)', () => {
    const file = transcript([assistant('This is English only and fairly long, so it should be blocked.'), toolOnly]);
    expect(run({ hook_event_name: 'Stop', transcript_path: file, stop_hook_active: false }).status).toBe(2);
  });

  it('短い応答(OK・コマンドだけ等)は止めない', () => {
    const file = transcript([assistant('Done.')]);
    expect(run({ hook_event_name: 'Stop', transcript_path: file, stop_hook_active: false }).status).toBe(0);
  });

  it('書き直しの最中(stop_hook_active)は止めない(無限に止めない)', () => {
    const file = transcript([assistant('Still English, but we must not loop forever on this.')]);
    expect(run({ hook_event_name: 'Stop', transcript_path: file, stop_hook_active: true }).status).toBe(0);
  });

  it('記録が無い・読めない・壊れているときは止めない', () => {
    expect(run({ hook_event_name: 'Stop', transcript_path: '/nonexistent/t.jsonl', stop_hook_active: false }).status).toBe(0);
    const dir = mkdtempSync(join(tmpdir(), 'jaguard-'));
    const broken = join(dir, 'b.jsonl');
    writeFileSync(broken, 'not json\n{"type":"assistant"}\n');
    expect(run({ hook_event_name: 'Stop', transcript_path: broken, stop_hook_active: false }).status).toBe(0);
    expect(spawnSync('node', ['scripts/claude-japanese-guard.js'], { input: 'garbage', encoding: 'utf8' }).status).toBe(0);
  });
});

describe('UserPromptSubmit・SessionStart: 日本語で書く指示を差し込む', () => {
  it('毎回、応答・コミット・PRを日本語で書く指示を標準出力に出す', () => {
    for (const event of ['UserPromptSubmit', 'SessionStart']) {
      const r = run({ hook_event_name: event, prompt: 'hello' });
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('日本語');
      expect(r.stdout).toContain('コミット');
    }
  });
});

describe('.claude/settings.json', () => {
  it('Stop・UserPromptSubmit・SessionStartにこのスクリプトを登録し、既存のフックを残す', () => {
    const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
    for (const event of ['Stop', 'UserPromptSubmit', 'SessionStart']) {
      const commands = (settings.hooks[event] ?? []).flatMap((g: { hooks: { command: string }[] }) => g.hooks.map((h) => h.command));
      expect(commands.some((c: string) => c.includes('scripts/claude-japanese-guard.js')), event).toBe(true);
    }
    const pre = settings.hooks.PreToolUse.flatMap((g: { hooks: { command: string }[] }) => g.hooks.map((h) => h.command));
    expect(pre.some((c: string) => c.includes('claude-push-guard.js'))).toBe(true);
    expect(pre.some((c: string) => c.includes('claude-full-test-guard.js'))).toBe(true);
  });
});
