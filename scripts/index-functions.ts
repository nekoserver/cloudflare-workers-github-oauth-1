#!/usr/bin/env npx tsx
/**
 * 関数カタログ更新スクリプト
 *
 * 使い方:
 *   npx tsx scripts/index-functions.ts [<file1.ts> <file2.ts> ...]
 *
 * 引数なしの場合は src/ 以下の全 .ts ファイルを対象にする。
 * 出力された SQL を D1 コンソールで実行すること。
 *
 * 新関数（purpose='(自動検出)'）が含まれる場合は purpose を日本語に修正してから実行する。
 */

import * as fs from 'fs';
import * as path from 'path';

// parse-functions は src/utils/ にあるが、tsx はそのまま import できる
const ROOT = path.resolve(__dirname, '..');

// src/utils/parse-functions を動的に読んで使う
// (tsconfig exclude に scripts/ が含まれないため型は any で扱う)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseFunctions, findCallers } = require(path.join(ROOT, 'src/utils/parse-functions'));

const REPO_ID = 1;

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(full));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(full);
    }
  }
  return results;
}

function rel(abs: string): string {
  return path.relative(ROOT, abs).replace(/\\/g, '/');
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

const args = process.argv.slice(2);
const targetFiles =
  args.length > 0
    ? args.map((a) => path.resolve(ROOT, a))
    : getAllTsFiles(path.join(ROOT, 'src'));

const allFiles = getAllTsFiles(path.join(ROOT, 'src'));
const fileContents = new Map<string, string>();
for (const f of allFiles) {
  fileContents.set(rel(f), fs.readFileSync(f, 'utf-8'));
}

const lines: string[] = [];

for (const file of targetFiles) {
  const r = rel(file);
  const source = fs.readFileSync(file, 'utf-8');
  const functions: Array<{
    name: string;
    startLine: number;
    endLine: number;
    isExported: boolean;
    isAsync: boolean;
  }> = parseFunctions(source);

  for (const fn of functions) {
    lines.push(
      `INSERT INTO ts_function_catalog (repo_id, file_path, function_name, purpose, is_exported, is_async, start_line, end_line)` +
        ` VALUES (${REPO_ID}, '${esc(r)}', '${esc(fn.name)}', '(自動検出)', ${fn.isExported ? 1 : 0}, ${fn.isAsync ? 1 : 0}, ${fn.startLine}, ${fn.endLine})` +
        ` ON CONFLICT(repo_id, file_path, function_name) DO UPDATE SET` +
        ` start_line = excluded.start_line, end_line = excluded.end_line,` +
        ` is_exported = excluded.is_exported, is_async = excluded.is_async;`
    );

    const callers: Array<{ callerFile: string; callerLine: number }> = findCallers(
      fn.name,
      fileContents,
      r
    );

    if (callers.length > 0) {
      lines.push(
        `DELETE FROM ts_function_callers WHERE callee_id = (SELECT id FROM ts_function_catalog WHERE repo_id=${REPO_ID} AND file_path='${esc(r)}' AND function_name='${esc(fn.name)}');`
      );
      for (const caller of callers) {
        lines.push(
          `INSERT OR IGNORE INTO ts_function_callers (repo_id, callee_id, caller_file, caller_line)` +
            ` VALUES (${REPO_ID},` +
            ` (SELECT id FROM ts_function_catalog WHERE repo_id=${REPO_ID} AND file_path='${esc(r)}' AND function_name='${esc(fn.name)}'),` +
            ` '${esc(caller.callerFile)}', ${caller.callerLine});`
        );
      }
    }
  }
}

console.log(lines.join('\n'));
