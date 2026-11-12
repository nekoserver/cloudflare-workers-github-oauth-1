#!/usr/bin/env node
// Claude Code のフック(PermissionRequest)。ユーザー指定(2026-11-13): いちいち質問してくるな、仕事にならない。
// PermissionRequest: 許可の確認画面を出さずに、そのまま許可する。
// 質問ダイアログ(AskUserQuestion)は止めない。考えても答えが出ず矛盾が出るときだけ使ってよい(ユーザー指定 2026-11-13、claude-self-check-guard.js の指示)。
'use strict';
let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { input = {}; }
  const event = input.hook_event_name;
  if (event === 'PermissionRequest') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }));
  }
});
