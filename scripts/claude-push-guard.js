#!/usr/bin/env node
// Claude CodeのPreToolUseフック(.claude/settings.json)。エージェントが git push する前に、自動で検査する。
// コンテナ(containers/・src/containers/・src/views/cfContainers.ts)に触れる変更なら、src/cf-containers のテストを走らせる。
// このテストには、ソースからのビルドを許可の表に限る検査(CLAUDE.md ルール44)も含まれる。
// 失敗したら終了コード2でpushを止め、標準エラーの内容がエージェントに返る。
'use strict';
const { execSync, spawnSync } = require('node:child_process');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let command = '';
  try { command = JSON.parse(input)?.tool_input?.command ?? ''; } catch { process.exit(0); }
  if (!/(^|[;&|\s])git\s+push\b/.test(command)) process.exit(0);

  // テストでは、変更されたファイルと検査のコマンドを差し替えられる。
  let changed = process.env.PUSH_GUARD_CHANGED;
  if (changed === undefined) {
    try { changed = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { changed = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' }); }
  }
  const files = changed.split(/\s+/).filter(Boolean);
  if (!files.some(file => /^(containers\/|src\/containers\/|src\/views\/cfContainers\.ts$|src\/cf-containers)/.test(file))) process.exit(0);

  const testCommand = process.env.PUSH_GUARD_TEST_CMD ?? 'npx vitest run src/cf-containers';
  const result = spawnSync(testCommand, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (result.status === 0) process.exit(0);
  process.stderr.write('[push-guard] コンテナに触れる変更で、検査(' + testCommand + ')が失敗したため、pushを止めました。\n'
    + 'src/cf-containers のテストを直してから、もう一度pushしてください。ソースからのビルドを足した場合は、CLAUDE.md ルール44に従ってください。\n'
    + String(result.stdout || '').split('\n').filter(line => /FAIL|×|Error|expected/.test(line)).slice(0, 30).join('\n') + '\n');
  process.exit(2);
});
