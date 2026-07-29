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
 * 結果はデプロイ済みWorker自身の POST /internal/harness-hook-log
 * (D1バインディングを直接使うためCLOUDFLARE_API_TOKEN不要)へHTTPS POSTで記録する。
 * 認証は環境変数 HARNESS_HOOK_SECRET の共有シークレット(Authorization: Bearer)。
 * 未設定またはリクエスト失敗時は .claude/harness-hook-log-fallback.jsonl へ記録する。
 *
 * 単体では何もしない(標準入力からのJSONが必須)。
 * 詳細は SPEC.cloudflare-workers-github-oauth-1.20260728.Harness.md を参照。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_TS_PATH = path.join(ROOT, 'src', 'index.ts');
const FALLBACK_LOG_PATH = path.join(ROOT, '.claude', 'harness-hook-log-fallback.jsonl');
const CHECK_NAME = 'migration_table_registry_check';
const WORKER_BASE_URL = 'https://cloudflare-workers-github-oauth-1.nekoflare.workers.dev';
const HARNESS_HOOK_ENDPOINT = WORKER_BASE_URL + '/internal/harness-hook-log';
const FETCH_TIMEOUT_MS = 8000;

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

function appendFallbackLog(fallbackPath, row, error) {
  fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
  const line = JSON.stringify({ ...row, loggedAt: new Date().toISOString(), d1Error: error ? String(error.message || error) : null }) + '\n';
  fs.appendFileSync(fallbackPath, line);
  return line;
}

function buildRequestBody(row) {
  return {
    hookEvent: row.hookEvent,
    checkName: row.checkName,
    toolName: row.toolName,
    filePath: row.filePath,
    result: row.result,
    detail: row.detail,
    sessionId: row.sessionId,
  };
}

async function postToWorker(row, secret, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (secret) headers.Authorization = 'Bearer ' + secret;
  try {
    const response = await fetchImpl(HARNESS_HOOK_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildRequestBody(row)),
      signal: controller.signal,
    });
    if (response.status < 200 || response.status >= 300) {
      const detail = await response.text().catch(() => '');
      throw new Error('HTTP ' + response.status + (detail ? ': ' + detail.slice(0, 300) : ''));
    }
  } finally {
    clearTimeout(timer);
  }
}

async function logResult(row, opts) {
  const fetchImpl = (opts && opts.fetchImpl) || fetch;
  // HARNESS_HOOK_SECRETが未設定でも書き込みは試みる。Worker側もシークレット未設定の間は
  // 認証なしで受け付けるため、当面シークレットレスで動作を継続できる。
  // 設定した場合は自動的にBearer認証付きで送るようになる。
  const secret = (opts && opts.secret !== undefined) ? opts.secret : process.env.HARNESS_HOOK_SECRET;

  try {
    await postToWorker(row, secret, fetchImpl);
  } catch (e) {
    try {
      appendFallbackLog(FALLBACK_LOG_PATH, row, e);
    } catch (e2) {
      process.stderr.write('[' + CHECK_NAME + '] Worker書き込み・ローカルフォールバック保存の両方に失敗しました: ' + String(e2) + '\n');
      return;
    }
    process.stderr.write(
      '[' + CHECK_NAME + '] harness_hook_logへの書き込みに失敗したため .claude/harness-hook-log-fallback.jsonl にフォールバック保存しました: ' + String(e.message || e) + '\n'
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

async function main() {
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
    await logResult({ hookEvent: 'PostToolUse', checkName: CHECK_NAME, toolName, filePath, result: 'ok', detail: 'CREATE TABLEなし(ALTER等のため対象外)', sessionId });
    return;
  }

  let indexTsSrc;
  try {
    indexTsSrc = fs.readFileSync(INDEX_TS_PATH, 'utf-8');
  } catch (e) {
    await logResult({ hookEvent: 'PostToolUse', checkName: CHECK_NAME, toolName, filePath, result: 'error', detail: 'src/index.ts の読み込みに失敗: ' + String(e.message || e), sessionId });
    return;
  }

  const missingResults = checkRegistries(tables, indexTsSrc);

  if (missingResults.length === 0) {
    await logResult({
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
  await logResult({ hookEvent: 'PostToolUse', checkName: CHECK_NAME, toolName, filePath, result: 'ng', detail: detailLines, sessionId });

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
  buildRequestBody,
  postToWorker,
  appendFallbackLog,
  logResult,
  HARNESS_HOOK_ENDPOINT,
};

if (require.main === module) {
  main();
}
