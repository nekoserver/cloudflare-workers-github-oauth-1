#!/usr/bin/env node
// Claude Code のフック(PermissionRequest・PreToolUse)。ユーザー指定(2026-11-13): いちいち質問してくるな、仕事にならない。
// PermissionRequest: 許可の確認画面を出さずに、そのまま許可する。
// PreToolUse: ユーザーへの質問ダイアログ(AskUserQuestion)は使わせない。自分で調べて決めさせる。
'use strict';
let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { input = {}; }
  const event = input.hook_event_name;
  if (event === 'PermissionRequest') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }));
  } else if (event === 'PreToolUse' && input.tool_name === 'AskUserQuestion') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny',
      permissionDecisionReason: 'ユーザー指定(2026-11-13): いちいち質問しない。ユーザーに聞かず、自分で調べて決めて最後までやる。' } }));
  }
});
