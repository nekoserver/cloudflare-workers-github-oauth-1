#!/usr/bin/env node
'use strict';

/**
 * PostToolUseフック: migrations/*.sql でCREATE TABLEされたテーブルが
 * src/index.ts の3レジストリ(STATUS_TABLE_DEFINITIONS/TABLE_COLUMN_KEYS/
 * TABLE_GROUP_MAP)に登録されているかをチェックする。
 *
 * 使い方(Claude CodeのPostToolUseフックから呼ばれる想定):
 *   echo '<hook payload json>' | node scripts/check-migration-table-registry.js
 *
 * 単体では何もしない(標準入力からのJSONが必須)。
 * 詳細は SPEC.cloudflare-workers-github-oauth-1.20260728.Harness.md を参照。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INDEX_TS_PATH = path.join(ROOT, 'src', 'index.ts');
const FALLBACK_LOG_PATH = path.join(ROOT, '.claude', 'harness-hook-log-fallback.jsonl');
const CHECK_NAME = 'migration_table_registry_check';
const D1_DATABASE_NAME = 'workers-github-oauth';

function extractCreateTableNames(sql) {
  const names = [];
  const re = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

function extractBlock(src, startMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) return null;
  const end = src.indexOf('\n};', start);
  if (end === -1) return null;
  return src.slice(start, end);
}

function checkRegistries(tables, indexTsSrc) {
  const defsBlock = extractBlock(indexTsSrc, 'STATUS_TABLE_DEFINITIONS: StatusTableDefinition[] = [') || '';
  const colKeysBlock = extractBlock(indexTsSrc, 'TABLE_COLUMN_KEYS: Record<string, ColumnKeyInfo> = {') || '';
  const groupMapBlock = extractBlock(indexTsSrc, 'TABLE_GROUP_MAP: Record<string, string> = {') || '';

  const definedNames = new Set([...defsBlock.matchAll(/name:\s*'([a-zA-Z0-9_]+)'/g)].map((m) => m[1]));
  const colKeyNames = new Set([...colKeysBlock.matchAll(/([a-zA-Z0-9_]+):\s*\{/g)].map((m) => m[1]));
  const groupNames = new Set([...groupMapBlock.matchAll(/([a-zA-Z0-9_]+):\s*'/g)].map((m) => m[1]));

  const results = [];
  for (const t of tables) {
    const missing = [];
    if (!definedNames.has(t)) missing.push('STATUS_TABLE_DEFINITIONS');
    if (!colKeyNames.has(t)) missing.push('TABLE_COLUMN_KEYS');
    if (!groupNames.has(t)) missing.push('TABLE_GROUP_MAP');
    if (missing.length > 0) results.push({ table: t, missing });
  }
  return results;
}

function escSql(value) {
  if (value === null || value === undefined) return 'NULL';
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function buildInsertSql(row) {
  return (
    'INSERT INTO harness_hook_log (hook_event, check_name, tool_name, file_path, result, detail, session_id) VALUES (' +
    [
      escSql(row.hookEvent),
      escSql(row.checkName),
      escSql(row.toolName),
      escSql(row.filePath),
      escSql(row.result),
      escSql(row.detail),
      escSql(row.sessionId),
    ].join(', ') +
    ');'
  );
}

function appendFallbackLog(fallbackPath, row, error) {
  fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
  const line = JSON.stringify({ ...row, loggedAt: new Date().toISOString(), d1Error: error ? String(error.message || error) : null }) + '\n';
  fs.appendFileSync(fallbackPath, line);
  return line;
}

function logResult(row) {
  const sql = buildInsertSql(row);
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', D1_DATABASE_NAME, '--remote', '--command', sql], {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 8000,
    });
  } catch (e) {
    try {
      appendFallbackLog(FALLBACK_LOG_PATH, row, e);
    } catch (e2) {
      process.stderr.write('[' + CHECK_NAME + '] D1書き込み・ローカルフォールバック保存の両方に失敗しました: ' + String(e2) + '\n');
      return;
    }
    process.stderr.write(
      '[' + CHECK_NAME + '] D1への記録に失敗したため .claude/harness-hook-log-fallback.jsonl にフォールバック保存しました\n'
    );
  }
}

function readStdinJson() {
  try {
    const data = fs.readFileSync(0, 'utf-8');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function main() {
  const payload = readStdinJson();
  const toolName = payload.tool_name || '';
  const filePath = (payload.tool_input && payload.tool_input.file_path) || '';
  const sessionId = payload.session_id || null;

  if (!['Edit', 'Write'].includes(toolName)) return;
  if (!/migrations[/\\]\d{4}_.*\.sql$/.test(filePath)) return;

  let sql;
  try {
    sql = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const tables = extractCreateTableNames(sql);
  if (tables.length === 0) {
    logResult({ hookEvent: 'PostToolUse', checkName: CHECK_NAME, toolName, filePath, result: 'ok', detail: 'CREATE TABLEなし(ALTER等のため対象外)', sessionId });
    return;
  }

  let indexTsSrc;
  try {
    indexTsSrc = fs.readFileSync(INDEX_TS_PATH, 'utf-8');
  } catch (e) {
    logResult({ hookEvent: 'PostToolUse', checkName: CHECK_NAME, toolName, filePath, result: 'error', detail: 'src/index.ts の読み込みに失敗: ' + String(e.message || e), sessionId });
    return;
  }

  const missingResults = checkRegistries(tables, indexTsSrc);

  if (missingResults.length === 0) {
    logResult({
      hookEvent: 'PostToolUse',
      checkName: CHECK_NAME,
      toolName,
      filePath,
      result: 'ok',
      detail: tables.join(', ') + ' は全レジストリに登録済み',
      sessionId,
    });
    return;
  }

  const detailLines = missingResults.map((r) => r.table + ': ' + r.missing.join('/') + ' 未登録').join('; ');
  logResult({ hookEvent: 'PostToolUse', checkName: CHECK_NAME, toolName, filePath, result: 'ng', detail: detailLines, sessionId });

  process.stderr.write(
    '[' + CHECK_NAME + '] ' + filePath + ' でCREATE TABLEされたテーブルの登録漏れを検知しました:\n' +
    detailLines + '\n' +
    'src/index.ts の STATUS_TABLE_DEFINITIONS / TABLE_COLUMN_KEYS / TABLE_GROUP_MAP' +
    '(該当する場合はSTATUS_MIGRATION_SQLも)へ登録してください。\n' +
    '(npx vitest run src/db-table-registry-completeness-20260728.test.ts でも再確認できます)\n'
  );
  process.exitCode = 2;
}

module.exports = {
  extractCreateTableNames,
  extractBlock,
  checkRegistries,
  escSql,
  buildInsertSql,
  appendFallbackLog,
};

if (require.main === module) {
  main();
}
