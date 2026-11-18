#!/usr/bin/env node
// Claude CodeのPreToolUseフック(.claude/settings.json)。範囲を指定しない vitest・npm test(全体テスト)を止める。
// ユーザー指定(2026-11-06、AGENT.md 14〜18行): このコンテナでは全体テストを実行しない(standard-1で50分を超える)。
// 2026-11-08、記録(AGENT.md・NOTICE・D1のce-k1)があったのにエージェントが読まずに走らせたため、読み落としても止まるようにした。
// 止めるときは終了コード2で、標準エラーの内容がエージェントに返る。
'use strict';

const VALUE_FLAGS = new Set(['--reporter', '-t', '--testNamePattern', '--config', '-c', '--project', '--environment',
  '--pool', '--shard', '--outputFile', '--maxWorkers', '--minWorkers', '--exclude', '--mode', '--root', '-r']);
const RUNNERS = new Set(['npx', 'pnpm', 'yarn', 'bunx', 'pnpx']);
const RUNNER_SUBCOMMANDS = new Set(['exec', 'dlx', 'run']);
// 位置引数があっても、実質は全体になる指定(Codex・Museの評価、2026-11-08)。
const WHOLE_TARGETS = new Set(['.', './', 'src', 'src/', './src', './src/']);
// 範囲を絞るフラグ。位置引数が無くても全体にはならない。
const SCOPING_FLAGS = new Set(['--changed', '--related']);

function tokensOf(segment) {
  const raw = segment.trim().split(/\s+/).filter(Boolean).map(t => t.replace(/^['"]+|['"]+$/g, ''));
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (t === '>' || t === '>>' || t === '<' || t === '2>') { i++; continue; }
    if (/[<>]/.test(t)) continue;
    out.push(t);
  }
  while (out.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(out[0])) out.shift();
  return out;
}

function isFullVitest(tokens) {
  let i = 0;
  if (RUNNERS.has(tokens[0])) {
    i = 1;
    while (i < tokens.length && (tokens[i].startsWith('-') || RUNNER_SUBCOMMANDS.has(tokens[i]))) i++;
  }
  const head = tokens[i] || '';
  if (head !== 'vitest' && !head.endsWith('/vitest')) return false;
  const args = tokens.slice(i + 1);
  if (args[0] === 'related') return false;
  if (args[0] === 'run' || args[0] === 'watch' || args[0] === 'dev') args.shift();
  for (let j = 0; j < args.length; j++) {
    const a = args[j];
    if (SCOPING_FLAGS.has(a.split('=')[0])) return false;
    if (a.startsWith('-')) { if (VALUE_FLAGS.has(a)) j++; continue; }
    if (!WHOLE_TARGETS.has(a)) return false;
  }
  return true;
}

function isFullNpmTest(tokens) {
  if (tokens[0] !== 'npm') return false;
  let rest;
  if (tokens[1] === 'test' || tokens[1] === 't') rest = tokens.slice(2);
  else if (tokens[1] === 'run' && /^test(:|$)/.test(tokens[2] || '')) rest = tokens.slice(3);
  else return false;
  const sep = rest.indexOf('--');
  if (sep === -1) return true;
  return !rest.slice(sep + 1).some(a => !a.startsWith('-') && !WHOLE_TARGETS.has(a));
}

function findFullTest(command) {
  for (const segment of String(command).split(/;|&&|\|\||\||\n/)) {
    const tokens = tokensOf(segment);
    if (!tokens.length) continue;
    if ((tokens[0] === 'sh' || tokens[0] === 'bash') && tokens[1] === '-c') {
      const inner = findFullTest(tokens.slice(2).join(' '));
      if (inner) return segment.trim();
      continue;
    }
    if (isFullVitest(tokens) || isFullNpmTest(tokens)) return segment.trim();
  }
  return null;
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let command = '';
  try { command = JSON.parse(input)?.tool_input?.command ?? ''; } catch { process.exit(0); }
  const hit = findFullTest(command);
  if (!hit) process.exit(0);
  process.stderr.write('[full-test-guard] 全体テスト(' + hit + ')を止めました。\n'
    + 'AGENT.md 14〜18行(ユーザー指定、2026-11-06): このコンテナでは npx vitest run・npm test の全体を実行しない(50分を超える)。\n'
    + '変えたファイルのテストだけを、パスを指定して実行する(例: npx vitest run src/views/museInquiries.test.ts)。全体テストを省いたことと実行した範囲を報告に書く。\n');
  process.exit(2);
});
