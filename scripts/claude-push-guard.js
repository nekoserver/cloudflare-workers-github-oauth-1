#!/usr/bin/env node
// Claude CodeのPreToolUseフック(.claude/settings.json)。エージェントが git push する前に、自動で検査する。
// コンテナ(containers/・src/containers/・src/views/cfContainers.ts)に触れる変更なら、src/cf-containers のテストを走らせる。
// このテストには、ソースからのビルドを許可の表に限る検査(CLAUDE.md ルール44)も含まれる。
// 失敗したら終了コード2でpushを止め、標準エラーの内容がエージェントに返る。
// node_modules がgitで追跡されていたら、変更の中身に関わらず止める(2026-11-15、fee856be で自分自身を指すシンボリックリンクが
// コミットされ、リポジトリの中でテストを起動できなくなった)。テストを起動できないときは、テストの失敗と区別して直し方を返す。
'use strict';
const { execSync, spawnSync } = require('node:child_process');

function nodeModulesProblem(dir) {
  const fs = require('node:fs');
  const path = require('node:path');
  let stat;
  try { stat = fs.statSync(dir); }
  catch (err) {
    if (err.code === 'ELOOP') return 'node_modules が自分自身を指すシンボリックリンクになっています(ELOOP)';
    if (err.code === 'ENOENT') return 'node_modules がありません';
    return 'node_modules を読めません(' + err.code + ')';
  }
  if (!stat.isDirectory()) return 'node_modules がディレクトリではありません';
  if (!fs.existsSync(path.join(dir, 'vitest', 'package.json'))) return 'node_modules に vitest が入っていません';
  return null;
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let command = '';
  try { command = JSON.parse(input)?.tool_input?.command ?? ''; } catch { process.exit(0); }
  if (!/(^|[;&|\s])git\s+push\b/.test(command)) process.exit(0);

  // テストでは、追跡されている node_modules の一覧を差し替えられる。
  let trackedNodeModules = process.env.PUSH_GUARD_TRACKED_NODE_MODULES;
  if (trackedNodeModules === undefined) {
    try { trackedNodeModules = execSync('git ls-files -- node_modules', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { trackedNodeModules = ''; }
  }
  if (trackedNodeModules.trim()) {
    process.stderr.write('[push-guard] node_modules がgitで追跡されています。リポジトリの中でテストを起動できなくなるため、pushを止めました。\n'
      + '追跡を外してください: git rm -r --cached node_modules(シンボリックリンク1つなら git rm --cached node_modules)。.gitignore は末尾のスラッシュ無しの「node_modules」にする。\n');
    process.exit(2);
  }

  // テストでは、変更されたファイルと検査のコマンドを差し替えられる。
  let changed = process.env.PUSH_GUARD_CHANGED;
  if (changed === undefined) {
    try { changed = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { changed = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' }); }
  }
  const files = changed.split(/\s+/).filter(Boolean);
  if (!files.some(file => /^(containers\/|src\/containers\/|src\/views\/cfContainers\.ts$|src\/cf-containers)/.test(file))) process.exit(0);

  const testCommand = process.env.PUSH_GUARD_TEST_CMD ?? 'npx vitest run src/cf-containers';
  // テストを起動する前に node_modules を調べる。壊れた node_modules では npx が何も出さずに終わり(実測: 終了コード216)、
  // 出力からは原因が分からないため。テストでは調べる場所を差し替えられる(既定はコマンドを差し替えていないときだけ調べる)。
  const nodeModulesDir = process.env.PUSH_GUARD_NODE_MODULES_DIR ?? (process.env.PUSH_GUARD_TEST_CMD ? null : 'node_modules');
  const problem = nodeModulesDir ? nodeModulesProblem(nodeModulesDir) : null;
  if (problem) {
    process.stderr.write('[push-guard] 検査(' + testCommand + ')のテストを起動できませんでした: ' + problem + '。テストの失敗ではありません。pushは止めています。\n'
      + 'リポジトリで入れ直してください: rm -rf node_modules && npm ci\n');
    process.exit(2);
  }
  const result = spawnSync(testCommand, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (result.status === 0) process.exit(0);
  process.stderr.write('[push-guard] コンテナに触れる変更で、検査(' + testCommand + ')が失敗したため、pushを止めました。\n'
    + 'src/cf-containers のテストを直してから、もう一度pushしてください。ソースからのビルドを足した場合は、CLAUDE.md ルール44に従ってください。\n'
    + String(result.stdout || '').split('\n').filter(line => /FAIL|×|Error|expected/.test(line)).slice(0, 30).join('\n') + '\n');
  process.exit(2);
});
