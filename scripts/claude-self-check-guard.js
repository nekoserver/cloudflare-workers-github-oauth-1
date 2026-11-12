#!/usr/bin/env node
// Claude Code のフック(UserPromptSubmit・SessionStart)。ユーザー指定(2026-11-13)。
// 自分で調べられることをユーザーに聞かないよう、毎回の発言の前に指示を差し込む。
'use strict';
process.stdout.write([
  'ユーザー指定(2026-11-13): こっちに聞く前に自分で確認しろ。',
  'PRのマージやデプロイの状態、ファイル・設定・ログなど、自分で調べられることはユーザーに聞く前に必ず自分で確かめること。',
].join('\n') + '\n');
