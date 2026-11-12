#!/usr/bin/env bash
# コンテナを起動し直したあとに1回実行する(ユーザー指定 2026-11-13)。
# このリポジトリのフック(日本語ガード・自分で確認しろ・確認画面と質問ダイアログを出さない)と、アンケートを出さない設定を、ユーザー設定 ~/.claude/settings.json に入れる。
# リポジトリの .claude/settings.json は、このリポジトリの中で Claude Code を起動したときしか読まれないため、
# どこで起動しても効くようにユーザー設定にも入れる。何度実行しても同じ結果になる(既存の設定は残す)。
# 使い方: bash cloudflare-workers-github-oauth-1/scripts/install-claude-user-hooks.sh
set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETTINGS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
mkdir -p "$(dirname "$SETTINGS")"
SCRIPTS_DIR="$SCRIPTS_DIR" SETTINGS="$SETTINGS" node <<'NODE'
const fs = require('node:fs');
const { SCRIPTS_DIR, SETTINGS } = process.env;
let settings = {};
try { settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch { settings = {}; }
const cmd = name => `node "${SCRIPTS_DIR}/${name}"`;
const ours = {
  UserPromptSubmit: [cmd('claude-japanese-guard.js'), cmd('claude-self-check-guard.js')],
  SessionStart: [cmd('claude-japanese-guard.js'), cmd('claude-self-check-guard.js')],
  Stop: [cmd('claude-japanese-guard.js')],
  PermissionRequest: [cmd('claude-no-ask-guard.js')],
  PreToolUse: [cmd('claude-no-ask-guard.js')],
};
// 以前に入れたこのリポジトリのフック(同じスクリプト名、または手で入れた echo の指示)は入れ直す
const isOurs = c => /claude-(japanese|self-check|no-ask)-guard\.js/.test(c) || /こっちに聞く前に自分で確認しろ/.test(c);
settings.hooks = settings.hooks || {};
for (const [event, commands] of Object.entries(ours)) {
  const kept = (settings.hooks[event] || [])
    .map(group => ({ ...group, hooks: (group.hooks || []).filter(h => !isOurs(h.command || '')) }))
    .filter(group => group.hooks.length);
  settings.hooks[event] = [...kept, { hooks: commands.map(command => ({ type: 'command', command })) }];
}
// アンケート(フィードバックの調査)を出さない(ユーザー指定 2026-11-13)
settings.env = { ...(settings.env || {}), CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: '1' };
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log('Claude Code のフックを入れました: ' + SETTINGS);
NODE
